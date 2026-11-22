"""Stage 1a: raw image-to-3D GLB -> hero_hi.blend (object "HeroHi": welded, normalised, source textures packed).
usage: blender -b -P hero2/s1_import.py -- <raw.glb> <out_hi.blend> [height=1.75]
Blender axes: Z up, the figure faces -Y (glTF +Z), feet on z = 0, centred on x / y."""
import bpy, sys, os, json
import numpy as np
from mathutils import Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

pos, opt = args()
src, out = os.path.abspath(pos[0]), os.path.abspath(pos[1])
HEIGHT = float(opt.get("height", 1.75))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src, merge_vertices=True)
obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
assert len(obs) == 1, obs
hi = obs[0]
for o in list(bpy.context.scene.objects):
    if o is not hi: bpy.data.objects.remove(o)
activate(hi)
hi.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
hi.name = "HeroHi"; hi.data.name = "HeroHi"
me = hi.data
log("imported verts", len(me.vertices), "tris", len(tri_array(me)), "uv", [u.name for u in me.uv_layers])

# weld coincident vertices (UV seams are duplicated in the file), drop degenerate faces and loose bits
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=1e-7)
bpy.ops.mesh.dissolve_degenerate(threshold=1e-9)
bpy.ops.mesh.delete_loose()
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
log("welded verts", len(me.vertices), "tris", len(tri_array(me)))

co = coords(me)
lab, n = components(len(co), edge_array(me))
counts = np.bincount(lab, minlength=n)
order = np.argsort(-counts)
report = {"raw_components": int(n), "component_verts": [int(counts[i]) for i in order[:40]], "components": []}
for i in order[:40]:
    c = co[lab == i]
    report["components"].append({"verts": int(counts[i]), "min": c.min(0).round(4).tolist(), "max": c.max(0).round(4).tolist()})
log("components", n, "sizes", report["component_verts"][:20])
report["raw_manifold"] = manifold_report(me)
log("manifold", report["raw_manifold"])

# keep the main shell only
main = order[0]
if n > 1:
    me.vertices.foreach_set("select", (lab != main))
    for p in me.polygons: p.select = False
    for e in me.edges: e.select = False
    me.vertices.foreach_set("select", (lab != main))
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_mode(type="VERT")
    bpy.ops.mesh.delete(type="VERT"); bpy.ops.object.mode_set(mode="OBJECT")
    log("removed", int(counts.sum() - counts[main]), "verts in", n - 1, "small components")

# scale, ground, centre (x on the stance, depth on the trunk)
co = coords(me)
s = HEIGHT / (co[:, 2].max() - co[:, 2].min())
me.transform(Matrix.Scale(s, 4)); co = coords(me)
legs = co[co[:, 2] < co[:, 2].min() + 0.35 * HEIGHT]
cx = (legs[:, 0].min() + legs[:, 0].max()) / 2
torso = co[(co[:, 2] > co[:, 2].min() + 0.5 * HEIGHT) & (co[:, 2] < co[:, 2].min() + 0.8 * HEIGHT) & (np.abs(co[:, 0] - cx) < 0.12)]
cy = (torso[:, 1].min() + torso[:, 1].max()) / 2
me.transform(Matrix.Translation((-cx, -cy, -co[:, 2].min()))); me.update()
co = coords(me)
report["scale"] = s; report["offset"] = [cx, cy, float(co[:, 2].min())]
report["bounds"] = [co.min(0).round(4).tolist(), co.max(0).round(4).tolist()]
log("normalised", report["bounds"], "scale", s)

for p in me.polygons: p.use_smooth = True
for img in bpy.data.images:
    log("image", img.name, tuple(img.size), img.colorspace_settings.name)
    if not img.packed_file: img.pack()
bpy.ops.wm.save_as_mainfile(filepath=out)
json.dump(report, open(out.replace(".blend", "_report.json"), "w"), indent=1)
log("saved", out)
