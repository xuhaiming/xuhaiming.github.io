"""Draw the UV layout of an object to a PNG, coloured by the face attribute uv_region, and print island statistics.
usage: blender -b -P hero2/uv_layout.py -- <in.blend> <out.png> [obj=Hero] [size=2048]"""
import bpy, sys, os, bmesh
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
pos, opt = args()
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(pos[0]))
ob = bpy.data.objects[opt.get("obj", "Hero")]; me = ob.data
N = int(opt.get("size", 2048))
uv = np.empty(len(me.loops) * 2, np.float64); me.uv_layers[0].data.foreach_get("uv", uv); uv = uv.reshape(-1, 3, 2)
freg = np.zeros(len(me.polygons), np.int32)
if "uv_region" in me.attributes: me.attributes["uv_region"].data.foreach_get("value", freg)
pal = np.array([[.55, .6, .7], [.2, .2, .25], [.9, .6, .5], [1, .4, .3], [.4, .8, .4], [.3, .7, .9], [.8, .8, .3]], np.float32)
img = np.ones((N, N, 3), np.float32)
P = uv * N
for t in range(len(P)):
    a, b, c = P[t]
    x0 = max(int(min(a[0], b[0], c[0])), 0); x1 = min(int(max(a[0], b[0], c[0])) + 1, N - 1)
    y0 = max(int(min(a[1], b[1], c[1])), 0); y1 = min(int(max(a[1], b[1], c[1])) + 1, N - 1)
    if x1 < x0 or y1 < y0: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
    if abs(d) < 1e-12: continue
    w1 = ((xs - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (ys - a[1])) / d
    w2 = ((b[0] - a[0]) * (ys - a[1]) - (xs - a[0]) * (b[1] - a[1])) / d
    inside = (w1 >= 0) & (w2 >= 0) & (w1 + w2 <= 1)
    edge = inside & ((w1 < 0.06) | (w2 < 0.06) | (w1 + w2 > 0.94))
    sub = img[y0:y1 + 1, x0:x1 + 1]
    sub[inside] = pal[freg[t]]; sub[edge] = pal[freg[t]] * 0.6
out = bpy.data.images.new("uvl", N, N, alpha=False)
out.pixels.foreach_set(np.concatenate([img, np.ones((N, N, 1), np.float32)], 2).ravel())
out.filepath_raw = os.path.abspath(pos[1]); out.file_format = "PNG"; out.save()
# islands
bm = bmesh.new(); bm.from_mesh(me); uvl = bm.loops.layers.uv.active
bm.faces.ensure_lookup_table()
seen = set(); sizes = []
for f in bm.faces:
    if f.index in seen: continue
    st = [f]; seen.add(f.index); n = 0
    while st:
        g = st.pop(); n += 1
        for l in g.loops:
            for o in l.edge.link_loops:
                h = o.face
                if h.index in seen or h is g: continue
                # connected in uv if the shared edge has the same uvs
                la = {tuple(round(v, 6) for v in ll[uvl].uv) for ll in g.loops if ll.vert in l.edge.verts}
                lb = {tuple(round(v, 6) for v in ll[uvl].uv) for ll in h.loops if ll.vert in l.edge.verts}
                if la == lb: seen.add(h.index); st.append(h)
    sizes.append((n, freg[f.index]))
sizes.sort(reverse=True)
print("islands", len(sizes), "per region", np.bincount([s[1] for s in sizes], minlength=7).tolist(), "largest", sizes[:8], "single-tri islands", sum(1 for s in sizes if s[0] <= 2))
