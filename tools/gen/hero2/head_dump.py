"""dump head vertex data: blender -b -P head_dump.py -- in.blend out.npz"""
import bpy, sys, numpy as np
a = sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
me = bpy.data.objects['Hero'].data
n = len(me.vertices)
co = np.empty(n*3); me.vertices.foreach_get('co', co); co = co.reshape(-1,3)
h = np.empty(n); me.attributes['hair'].data.foreach_get('value', h)
reg = np.empty(len(me.polygons), np.int32); me.attributes['uv_region'].data.foreach_get('value', reg)
vr = np.full(n, -1)
pv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', pv)
pl = np.repeat(np.arange(len(me.polygons)), [p.loop_total for p in me.polygons])
# per-vertex min and max region of incident faces
vmin = np.full(n, 99); vmax = np.full(n, -1)
np.minimum.at(vmin, pv, reg[pl]); np.maximum.at(vmax, pv, reg[pl])
e = np.empty(len(me.edges)*2, np.int64); me.edges.foreach_get('vertices', e)
np.savez(a[1], co=co, hair=h, vmin=vmin, vmax=vmax, edges=e.reshape(-1,2))
print(n, (h>0.5).sum())
