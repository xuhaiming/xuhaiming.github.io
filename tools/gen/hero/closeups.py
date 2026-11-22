"""Blender: orthographic close-ups of regions of a GLB, for review.
usage: blender -b -P closeups.py -- <in.glb> <out_prefix> name:cx,cy,cz,size,view ...   (glTF coords: Y up, +Z front)
view: front|back|left|right|top"""
import bpy, sys, os, math
from mathutils import Vector, Euler
argv = sys.argv[sys.argv.index("--") + 1:]
src, pre = os.path.abspath(argv[0]), os.path.abspath(argv[1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = 900
sc.view_settings.view_transform = "Standard"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
for m in bpy.data.materials:   # flat look: show the texture itself
    if m.use_nodes:
        b = m.node_tree.nodes.get("Principled BSDF")
        if b: b.inputs["Metallic"].default_value = 0; [m.node_tree.links.remove(l) for l in list(b.inputs["Metallic"].links)]; [m.node_tree.links.remove(l) for l in list(b.inputs["Roughness"].links)]; b.inputs["Roughness"].default_value = 0.9
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"
dirs = {"front": (0, -1, 0), "back": (0, 1, 0), "left": (1, 0, 0), "right": (-1, 0, 0), "top": (0, 0, 1)}
for spec in argv[2:]:
    name, v = spec.split(":"); cx, cy, cz, size, view = v.split(",")
    c = Vector((float(cx), -float(cz), float(cy)))   # glTF -> Blender
    d = Vector(dirs[view]); cam.location = c + d * 5
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.ortho_scale = float(size)
    sc.render.filepath = f"{pre}_{name}.png"; bpy.ops.render.render(write_still=True)
