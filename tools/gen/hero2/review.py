"""Review renders: orthographic shots of one object, composed into a contact sheet (EEVEE, local only).
usage: blender -b -P hero2/review.py -- <in.blend|in.glb> <out.png> [obj=Hero] [attr=<point attribute to overlay>] [set=head|hands|body|top] [shots="name:cx,cy,cz,size,dx,dy,dz;..."]
       [cell=640] [cols=4] [mode=diffuse|pbr|flat|wire|clay] [basecolor=<png to swap in>] [nonormal=1] [marks=<landmarks.json>] [xray=1]
Coordinates and view directions are glTF (Y up, +Z front, character's left +X); dx,dy,dz points from the target to the camera.
mode=diffuse shows the texture under soft light (metal off), pbr keeps metallic/roughness, wire overlays the triangle edges."""
import bpy, sys, os
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

pos, opt = args()
src, out = os.path.abspath(pos[0]), os.path.abspath(pos[1])
CELL = int(opt.get("cell", 640)); COLS = int(opt.get("cols", 4)); MODE = opt.get("mode", "diffuse")
HC = (0, 1.615, 0.0)   # head centre
SETS = {
 "head": [("front", *HC, .36, 0, 0, 1), ("q_left", *HC, .36, .7, .1, .7), ("left", *HC, .36, 1, 0, 0), ("back", *HC, .36, 0, 0, -1),
          ("right", *HC, .36, -1, 0, 0), ("q_right", *HC, .36, -.7, .1, .7), ("top", 0, 1.65, 0, .36, 0, 1, .001), ("topfront", 0, 1.66, 0, .36, 0, .8, .6)],
 "hair": [("front", 0, 1.69, 0, .26, 0, .15, 1), ("topfront", 0, 1.69, 0, .26, 0, .7, .7), ("top", 0, 1.69, 0, .26, 0, 1, .001), ("topback", 0, 1.69, 0, .26, 0, .7, -.7),
          ("q_left", 0, 1.69, 0, .26, .7, .35, .6), ("q_right", 0, 1.69, 0, .26, -.7, .35, .6), ("left", 0, 1.69, 0, .26, 1, .2, .1), ("right", 0, 1.69, 0, .26, -1, .2, .1),
          ("topleft", 0, 1.69, 0, .26, .7, .7, 0), ("topright", 0, 1.69, 0, .26, -.7, .7, 0), ("lowfront", 0, 1.67, 0, .26, 0, -.35, 1), ("back", 0, 1.66, 0, .26, 0, .1, -1)],
 "face": [("front", 0, 1.60, 0, .2, 0, 0, 1), ("q_left", 0, 1.60, 0, .2, .6, 0, .8), ("q_right", 0, 1.60, 0, .2, -.6, 0, .8), ("below", 0, 1.59, 0, .2, 0, -.5, .85)],
 "hands": [("L_top", .755, 1.31, -.01, .22, 0, 1, .001), ("L_palm", .755, 1.31, -.01, .22, 0, -1, .001), ("L_front", .755, 1.31, -.01, .22, 0, .2, 1), ("L_tip", .755, 1.31, -.01, .22, 1, .3, .3),
           ("R_top", -.755, 1.31, -.01, .22, 0, 1, .001), ("R_palm", -.755, 1.31, -.01, .22, 0, -1, .001), ("R_front", -.755, 1.31, -.01, .22, 0, .2, 1), ("R_tip", -.755, 1.31, -.01, .22, -1, .3, .3)],
 "body": [("front", 0, .875, 0, 1.9, 0, 0, 1), ("left", 0, .875, 0, 1.9, 1, 0, 0), ("back", 0, .875, 0, 1.9, 0, 0, -1), ("q", 0, .875, 0, 1.9, .7, .15, .7)],
 "parts": [("torso_f", 0, 1.2, 0, .7, 0, 0, 1), ("torso_b", 0, 1.2, 0, .7, 0, 0, -1), ("legs_f", 0, .55, 0, .8, 0, 0, 1), ("shoes", 0, .12, 0, .5, .6, .3, .7)],
}
shots = []
for s in opt.get("set", "").split(","):
    if s: shots += SETS[s]
for s in opt.get("shots", "").split(";"):
    if s:
        n, v = s.split(":"); shots.append((n, *[float(x) for x in v.split(",")]))

if src.endswith(".blend"):
    bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
if "clip" in opt:   # pose the armature: clip=<action name> frame=<n, 0-based>
    arm = next(o for o in sc.objects if o.type == "ARMATURE")
    arm.animation_data_create()
    for t in list(arm.animation_data.nla_tracks): arm.animation_data.nla_tracks.remove(t)
    act = next(a for a in bpy.data.actions if a.name.split("|")[-1].lower() == opt["clip"] or a.name == opt["clip"])
    arm.animation_data.action = act
    sc.frame_set(int(act.frame_range[0]) + int(opt.get("frame", 0)))
name = opt.get("obj")
ob = bpy.data.objects[name] if name else next(o for o in sc.objects if o.type == "MESH")
for o in sc.objects:
    o.hide_render = o is not ob
ob.hide_render = False; ob.hide_viewport = False
for p in ob.data.polygons: p.use_smooth = True

if "basecolor" in opt:
    new = bpy.data.images.load(os.path.abspath(opt["basecolor"]))
    for m in ob.data.materials:
        b = m.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].links[0].from_node.image = new
if opt.get("nonormal") == "1":
    for m in ob.data.materials:
        b = m.node_tree.nodes.get("Principled BSDF")
        for l in list(b.inputs["Normal"].links): m.node_tree.links.remove(l)
if MODE != "pbr":
    for m in ob.data.materials:
        if m and m.use_nodes:
            b = m.node_tree.nodes.get("Principled BSDF")
            if b:
                for k, v in (("Metallic", 0.0), ("Roughness", 0.85)):
                    for l in list(b.inputs[k].links): m.node_tree.links.remove(l)
                    b.inputs[k].default_value = v
if "attr" in opt:   # overlay a point attribute in magenta (debugging masks)
    for m in ob.data.materials:
        nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
        a = nt.nodes.new("ShaderNodeAttribute"); a.attribute_name = opt["attr"]
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
        src_l = b.inputs["Base Color"].links[0].from_socket
        nt.links.new(a.outputs["Fac"], mix.inputs[0]); nt.links.new(src_l, mix.inputs[6]); mix.inputs[7].default_value = (1, 0, 1, 1)
        nt.links.new(mix.outputs[2], b.inputs["Base Color"])
if MODE == "flat":   # unlit base colour
    for m in ob.data.materials:
        nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
        src_l = b.inputs["Base Color"].links[0].from_socket
        e = nt.nodes.new("ShaderNodeEmission"); nt.links.new(src_l, e.inputs[0])
        o = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"); nt.links.new(e.outputs[0], o.inputs[0])
if MODE in ("wire", "clay"):   # untextured grey surface, wire adds the triangle edges
    cm = bpy.data.materials.new("clay"); cm.use_nodes = True
    cm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.75, 0.75, 0.75, 1)
    cm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.7
    ob.data.materials.clear(); ob.data.materials.append(cm)
if MODE == "wire":
    wm = bpy.data.materials.new("wire"); wm.use_nodes = True
    wm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0, 0.02, 0.25, 1)
    ob.data.materials.append(wm)
    mod = ob.modifiers.new("w", "WIREFRAME"); mod.thickness = float(opt.get("wire", 0.00025)); mod.use_replace = False; mod.material_offset = 1

sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = CELL
sc.render.image_settings.file_format = "PNG"
sc.view_settings.view_transform = "Standard"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.75 if MODE != "pbr" else 0.6
cam = bpy.data.objects.new("rc", bpy.data.cameras.new("rc")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.clip_end = 50
sun = bpy.data.objects.new("rsun", bpy.data.lights.new("rsun", "SUN")); sun.data.energy = 1.2 if MODE != "pbr" else 2.5
sc.collection.objects.link(sun)
con = sun.constraints.new("COPY_ROTATION"); con.target = cam

if "marks" in opt:   # landmark markers from landmarks.json (red = measured, yellow = estimated)
    import json
    R = float(opt.get("mark_r", 0.0025))
    mm = {}
    for nm, colr in (("measured", (1, 0, 0, 1)), ("estimated", (1, 0.8, 0, 1))):
        m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        o = nt.nodes.new("ShaderNodeOutputMaterial"); e = nt.nodes.new("ShaderNodeEmission"); e.inputs[0].default_value = colr
        nt.links.new(e.outputs[0], o.inputs[0]); mm[nm] = m
    for k, v in json.load(open(os.path.abspath(opt["marks"])))["landmarks"].items():
        pts = v["p"] if isinstance(v["p"][0], list) else [v["p"]]
        for q in pts:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=R, location=(q[0], -q[2], q[1]))
            sph = bpy.context.active_object; sph.data.materials.append(mm["estimated" if v["how"].startswith("est") else "measured"])
            sph.hide_render = False
    if opt.get("xray", "0") == "1":
        for m in ob.data.materials:
            m.surface_render_method = "BLENDED"; b = m.node_tree.nodes.get("Principled BSDF"); b.inputs["Alpha"].default_value = 0.35

tmp = out + "._cell.png"; cells = []
for n, cx, cy, cz, size, dx, dy, dz in shots:
    c = Vector((cx, -cz, cy)); d = Vector((dx, -dz, dy)).normalized()
    cam.location = c + d * 5
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    cam.data.ortho_scale = size
    sc.render.filepath = tmp; bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp)
    cells.append(np.array(img.pixels[:], np.float32).reshape(CELL, CELL, 4)); bpy.data.images.remove(img)
os.remove(tmp)
while len(cells) % COLS and len(cells) > COLS: cells.append(np.ones((CELL, CELL, 4), np.float32))
cols = min(COLS, len(cells))
rows = [np.concatenate(cells[i:i + cols], 1) for i in range(0, len(cells), cols)]
sheet = np.concatenate(rows[::-1], 0)
res = bpy.data.images.new("sheet", sheet.shape[1], sheet.shape[0], alpha=False)
res.pixels.foreach_set(sheet.ravel()); res.filepath_raw = out
res.file_format = "JPEG" if out.lower().endswith(".jpg") else "PNG"
sc.render.image_settings.quality = 92
res.save()
print("wrote", out, [s[0] for s in shots])
