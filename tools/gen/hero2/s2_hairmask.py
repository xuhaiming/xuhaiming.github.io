"""Stage 1b: find the hair on the source mesh and the skin-coloured patches inside it.
usage: blender -b -P hero2/s2_hairmask.py -- <hero_hi.blend> [zmin=1.50] [dark=0.2] [open=0.004]
Writes two float point attributes on HeroHi and saves the file in place:
  hair    1 on hair (dark, connected region on the head)
  hairfix 1 on vertices that are on the hair but were left skin-coloured by the generator (to be darkened after baking)
A patch is (a) a light island on the head that is enclosed by hair, or (b) a thin light peninsula (narrower than 2*open metres)
that hangs off the hair mass above the brows, e.g. the tips of forelock strands. The face, ears and neck are the one big light
component that survives a geodesic erosion by <open>, so they are never selected."""
import bpy, sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

pos, opt = args()
path = os.path.abspath(pos[0])
ZMIN = float(opt.get("zmin", 1.50)); DARK = float(opt.get("dark", 0.2)); OPEN = float(opt.get("open", 0.004))
BROW_Z = float(opt.get("browz", 1.635))
bpy.ops.wm.open_mainfile(filepath=path)
hi = bpy.data.objects["HeroHi"]; me = hi.data
co = coords(me); nv = len(co)

# base colour at every vertex
img = next(i for i in bpy.data.images if i.colorspace_settings.name == "sRGB" and i.size[0] > 1000)
W, H = img.size
px = np.empty(W * H * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers[0].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get("vertex_index", lv)
vuv = np.zeros((nv, 2), np.float32); vuv[lv] = uv
xi = np.clip((vuv[:, 0] % 1.0) * W, 0, W - 1).astype(np.int64); yi = np.clip((vuv[:, 1] % 1.0) * H, 0, H - 1).astype(np.int64)
col = px[yi, xi, :3]; del px
lum = col @ np.array([0.299, 0.587, 0.114], np.float32)
sat = col.max(1) - col.min(1)

head = np.where((co[:, 2] > ZMIN) & (np.abs(co[:, 0]) < 0.16))[0]
gi = np.full(nv, -1, np.int64); gi[head] = np.arange(len(head))
e = edge_array(me); e = gi[e]; e = e[(e >= 0).all(1)]
hco = co[head]; hl = lum[head]; hs = sat[head]
elen = np.linalg.norm(hco[e[:, 0]] - hco[e[:, 1]], axis=1)
log("head verts", len(head), "edges", len(e), "median edge mm", float(np.median(elen) * 1000),
    "bounds", hco.min(0).round(3), hco.max(0).round(3))
log("lum percentiles", np.percentile(hl, [5, 25, 50, 75, 95]).round(3))

def comp(mask):
    """labels of connected components of the sub-graph on mask (label -1 outside), sizes"""
    ee = e[mask[e[:, 0]] & mask[e[:, 1]]]
    idx = np.where(mask)[0]; g = np.full(len(mask), -1, np.int64); g[idx] = np.arange(len(idx))
    lab, n = components(len(idx), g[ee])
    out = np.full(len(mask), -1, np.int64); out[idx] = lab
    return out, np.bincount(lab, minlength=n)

def geodist(src, limit):
    """approximate geodesic distance to the source set along edges, up to limit"""
    d = np.where(src, 0.0, np.inf)
    for _ in range(200):
        nd = d.copy()
        np.minimum.at(nd, e[:, 0], d[e[:, 1]] + elen); np.minimum.at(nd, e[:, 1], d[e[:, 0]] + elen)
        ch = (nd < d - 1e-9) & (nd <= limit)
        d = np.minimum(d, nd)
        if not ch.any(): break
    return d

dark = hl < DARK
lab, sizes = comp(dark)
# hair = the biggest dark component (brows, eyes, collar are separate or get cut below)
hair = lab == np.argmax(sizes)
log("dark comps", len(sizes), "hair verts", int(hair.sum()), "next", np.sort(sizes)[-5:])
# small dark bits touching nothing are not hair; dark bits above the brows near hair (strand shadows) are
light = ~hair
lab2, sizes2 = comp(light)
main = np.argmax(sizes2)
islands = light & (lab2 != main) & (hco[:, 2] > BROW_Z - 0.05)
log("light comps", len(sizes2), "main", int(sizes2[main]), "island verts", int(islands.sum()))
# peninsulas: erode the main light component, keep what still connects to the bulk, dilate back
mainmask = light & (lab2 == main)
d_in = geodist(~mainmask, OPEN * 1.5)
core = mainmask & (d_in > OPEN)
lab3, sizes3 = comp(core)
core_main = core & (lab3 == np.argmax(sizes3))
d_back = geodist(core_main, OPEN * 2.5)
restored = mainmask & (d_back <= OPEN * 1.6)
penins = mainmask & ~restored & (hco[:, 2] > BROW_Z) & (np.abs(hco[:, 0]) < 0.085)
# only light-coloured, skin-like vertices need the fix, and only next to hair
d_hair = geodist(hair, 0.03)
fix = (islands | penins) & (d_hair < 0.02)
log("peninsula verts", int(penins.sum()), "fix verts", int(fix.sum()), "of which lum>0.3", int((fix & (hl > 0.3)).sum()))
hair_all = hair | fix
med = np.median(col[head][hair], 0)
log("hair median colour (sRGB)", med.round(4), "lum p10/p50/p90", np.percentile(hl[hair], [10, 50, 90]).round(4))

for name, m in (("hair", hair_all), ("hairfix", fix)):
    a = me.attributes.get(name) or me.attributes.new(name, "FLOAT", "POINT")
    v = np.zeros(nv, np.float32); v[head] = m.astype(np.float32)
    a.data.foreach_set("value", v)
hi["hair_median_srgb"] = [float(x) for x in med]
bpy.ops.wm.save_as_mainfile(filepath=path)
log("saved", path)
