"""Blender: render a GLB from several views (and optionally several frames of a clip) into one contact sheet.
usage: blender -b -P render_views.py -- <in.glb> <out.png> [views=front,side,back] [clip=walk] [frames=0,4,8] [cell=512x768] [fit=1.75]
Views: front (camera on glTF +Z), back, side (camera on glTF +X), left, q (three-quarter).
Stills: one row, a column per view. Clips: frames run left to right, one row per view. Works on raw vertex-coloured meshes as well as the textured, rigged hero."""
import bpy, sys, os, math
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = os.path.abspath(argv[0]), os.path.abspath(argv[1])
opt = dict(a.split("=", 1) for a in argv[2:])
views = opt.get("views", "front,side,back").split(",")
clip = opt.get("clip")
frames = [int(f) for f in opt["frames"].split(",")] if "frames" in opt else [None]
cw, ch = (int(v) for v in opt.get("cell", "512x768").split("x"))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 30   # before the import, so glTF seconds map to 30 fps frames
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH"]
arm = next((o for o in scene.objects if o.type == "ARMATURE"), None)

# vertex-coloured raw meshes get an emission-free diffuse material driven by the colour attribute
for o in meshes:
    has_tex = any(n.type == "TEX_IMAGE" for m in o.data.materials if m and m.use_nodes for n in m.node_tree.nodes)
    if not has_tex and len(o.data.color_attributes):
        mat = bpy.data.materials.new("vc"); mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        att = nt.nodes.new("ShaderNodeVertexColor"); att.layer_name = o.data.color_attributes[0].name
        nt.links.new(att.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.8
        o.data.materials.clear(); o.data.materials.append(mat)

if arm and not clip:   # stills show the bind pose, not whichever clip the importer left active
    arm.animation_data_clear()
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
if clip and arm:
    act = bpy.data.actions.get(clip)
    if act is None:
        raise SystemExit("no clip %s, have %s" % (clip, [a.name for a in bpy.data.actions]))
    arm.animation_data_create()
    for t in arm.animation_data.nla_tracks:
        t.mute = True
    arm.animation_data.action = act
    try:
        arm.animation_data.action_slot = act.slots[0]
    except Exception:
        pass

# bounds in the rest state
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        for i in range(3):
            lo[i] = min(lo[i], w[i]); hi[i] = max(hi[i], w[i])
centre = (lo + hi) / 2
height = hi.z - lo.z
span = float(opt["fit"]) if "fit" in opt else height
if "fit" in opt:   # posed, skinned figures: frame the nominal standing volume instead of the stale bounds
    centre = Vector((0, 0, span / 2))
print("bounds", [round(v, 3) for v in lo], [round(v, 3) for v in hi])

cam_data = bpy.data.cameras.new("cam"); cam_data.type = "ORTHO"
cam_data.ortho_scale = span * 1.12 * max(1.0, cw / ch)
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
target = bpy.data.objects.new("t", None); scene.collection.objects.link(target); target.location = centre
con = cam.constraints.new("TRACK_TO"); con.target = target; con.track_axis = "TRACK_NEGATIVE_Z"; con.up_axis = "UP_Y"

# Blender axes: glTF +Z (front) is Blender -Y, glTF +X is Blender +X
dirs = {"front": (0, -1, 0), "back": (0, 1, 0), "side": (1, 0, 0), "left": (-1, 0, 0), "q": (0.7, -0.7, 0.15), "top": (0, -0.001, 1)}

world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.56, 0.58, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 2.5
scene.collection.objects.link(sun)
scon = sun.constraints.new("COPY_ROTATION"); scon.target = cam  # key light follows the camera

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y = cw, ch
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "Standard"

tmp = os.path.join(os.path.dirname(out), "_cell.png")
rows = []
for f in frames:
    if f is not None:
        scene.frame_set(f)
    row = []
    for v in views:
        d = Vector(dirs[v]).normalized()
        cam.location = centre + d * 10
        scene.render.filepath = tmp
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(tmp)
        px = np.array(img.pixels[:], np.float32).reshape(ch, cw, 4)
        bpy.data.images.remove(img)
        row.append(px)
    rows.append(row)
if len(frames) > 1:   # clips: frames run left to right, one row per view
    rows = [[rows[f][v] for f in range(len(frames))] for v in range(len(views))]
sheet = np.concatenate([np.concatenate(r, 1) for r in rows][::-1], 0)  # image rows are bottom-up
res = bpy.data.images.new("sheet", sheet.shape[1], sheet.shape[0], alpha=True)
res.pixels.foreach_set(sheet.ravel())
res.filepath_raw = out; res.file_format = "PNG"; res.save()
os.remove(tmp)
print("wrote", out, sheet.shape[1], "x", sheet.shape[0])
