"""Stage 1c: source mesh -> low-poly mesh "Hero" with an uneven triangle budget (head and hands favoured).
usage: blender -b -P hero2/s3_lowpoly.py -- <hero_hi.blend> <out_low.blend> [rest=38000] [hair=12000] [head_skin=13000] [face_feat=5000] [hand=7000]
One quadric collapse pass per region. Blender's Decimate modifier never collapses an edge whose two vertices both have
weight 0 in its vertex group, so each pass reduces exactly one region to its budget and leaves the others untouched.
Cleans up afterwards and reports topology (components, boundary and non-manifold edges)."""
import bpy, sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

pos, opt = args()
src, out = os.path.abspath(pos[0]), os.path.abspath(pos[1])
BUDGET = {"rest": int(opt.get("rest", 38000)), "hair": int(opt.get("hair", 12000)), "head_skin": int(opt.get("head_skin", 13000)),
          "face_feat": int(opt.get("face_feat", 5000)), "hand_l": int(opt.get("hand", 7000)), "hand_r": int(opt.get("hand", 7000))}

bpy.ops.wm.open_mainfile(filepath=src)
hi = bpy.data.objects["HeroHi"]
activate(hi); bpy.ops.object.duplicate()
low = bpy.context.view_layer.objects.active
low.name = "Hero"; low.data.name = "Hero"
bpy.data.objects.remove(hi)
while low.data.uv_layers: low.data.uv_layers.remove(low.data.uv_layers[0])
low.data.materials.clear()
log("start", sub_tris(low.data))

for name in ["rest", "hair", "head_skin", "face_feat", "hand_l", "hand_r"]:
    for rep in range(3):                      # region membership shifts a little while collapsing: repeat to converge
        me = low.data
        cur = sub_tris(me)
        excess = cur[name] - BUDGET[name]
        if excess < BUDGET[name] * 0.01: break
        sub = subregion_of(me)
        for g in list(low.vertex_groups): low.vertex_groups.remove(g)
        vg = low.vertex_groups.new(name="decim")
        vg.add(np.where(sub == SUB_NAMES.index(name))[0].tolist(), 1.0, "REPLACE")
        m = low.modifiers.new("dec", "DECIMATE"); m.ratio = (cur["total"] - excess) / cur["total"]
        m.use_collapse_triangulate = True; m.vertex_group = "decim"; m.vertex_group_factor = 1000.0
        activate(low); bpy.ops.object.modifier_apply(modifier=m.name)
        log(name, "pass", rep, sub_tris(low.data))

# ---- clean up
for g in list(low.vertex_groups): low.vertex_groups.remove(g)
activate(low)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.dissolve_degenerate(threshold=1e-6)
bpy.ops.mesh.delete_loose()
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.quads_convert_to_tris()
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
me = low.data
lab, n = components(len(me.vertices), edge_array(me))
rep = {"tris": sub_tris(me), "region_tris": region_tris(me), "verts": len(me.vertices), "components": int(n), "manifold": manifold_report(me)}
log("clean", rep)
for poly in me.polygons: poly.use_smooth = True
for m in list(bpy.data.meshes):
    if m.users == 0: bpy.data.meshes.remove(m)
for i in list(bpy.data.images): bpy.data.images.remove(i)
bpy.ops.wm.save_as_mainfile(filepath=out)
json.dump(rep, open(out.replace(".blend", "_report.json"), "w"), indent=1)
log("saved", out)
