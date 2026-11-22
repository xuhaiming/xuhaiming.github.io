"""Export head mesh data (positions, uv, tris, uv_region) from hero_mesh.blend to npz. blender -b -P face_export.py -- <hero_mesh.blend> <out.npz>"""
import bpy, sys, os
import numpy as np
argv = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(argv[0]))
ob = bpy.data.objects["Hero"]; me = ob.data
me.calc_loop_triangles()
n = len(me.loop_triangles)
lt = np.empty(n * 3, np.int64); me.loop_triangles.foreach_get("loops", lt); lt = lt.reshape(-1, 3)
vt = np.empty(n * 3, np.int64); me.loop_triangles.foreach_get("vertices", vt); vt = vt.reshape(-1, 3)
pi = np.empty(n, np.int64); me.loop_triangles.foreach_get("polygon_index", pi)
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
uv = np.empty(len(me.loops) * 2); me.uv_layers[0].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
reg = np.empty(len(me.polygons), np.int32); me.attributes["uv_region"].data.foreach_get("value", reg)
# glTF space: x, y=z, z=-y
P = np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)
np.savez(argv[1], P=P[vt], UV=uv[lt], region=reg[pi], vt=vt)
print("tris", n, "regions", np.bincount(reg[pi]))
