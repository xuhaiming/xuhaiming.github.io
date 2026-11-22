"""Stage 1d: UV atlas for the low-poly mesh.
usage: blender -b -P hero2/s4_uv.py -- <hero_low.blend> <out_uv.blend> [face=4.5] [skin=3.2] [hair=1.8] [hand=1.8] [collar=2.0] [margin=0.0028] [angle=66] [smooth=1] [min_chart=8] [stretch=60]
Islands: the face front (hairline to under the chin, in front of the ears) is one island unwrapped with minimum stretch,
so no seam crosses the face; the other charts come from Smart UV Project on a lightly smoothed copy of the shape and are
then unwrapped (angle based + minimise stretch) on the real shape. Islands are then set to the same texel
density, the head and hand islands are scaled up, and everything is packed into one atlas.
Face attribute "uv_region" (int): 0 rest, 1 hair, 2 head skin, 3 face island, 4 hand L, 5 hand R, 6 collar / shoulder tops."""
import bpy, sys, os, math, bmesh
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

pos, opt = args()
src, out = os.path.abspath(pos[0]), os.path.abspath(pos[1])
K_FACE = float(opt.get("face", 4.5)); K_SKIN = float(opt.get("skin", 3.2)); K_HAIR = float(opt.get("hair", 1.8)); K_HAND = float(opt.get("hand", 1.8))
K_COLLAR = float(opt.get("collar", 2.0)); COLLAR_Y = float(opt.get("collar_y", 1.40))
MARGIN = float(opt.get("margin", 0.0028)); ANGLE = float(opt.get("angle", 66))
FACE_YMIN = float(opt.get("face_ymin", 1.497)); MIN_CHART = int(opt.get("min_chart", 8))
SMOOTH = int(opt.get("smooth", 1)); STRETCH_IT = int(opt.get("stretch", 60)); FACE_STRETCH_IT = int(opt.get("face_stretch", 30))

bpy.ops.wm.open_mainfile(filepath=src)
low = bpy.data.objects["Hero"]; me = low.data
activate(low)
co = coords(me)
sub = subregion_of(me)                    # per vertex: 0 rest, 1 hair, 2 head skin, 3 features, 4/5 hands
npoly = len(me.polygons)
pv = np.empty(npoly * 3, np.int64); me.polygons.foreach_get("vertices", pv); pv = pv.reshape(-1, 3)
psub = np.sort(sub[pv], 1)[:, 1]          # majority vote
freg = np.zeros(npoly, np.int32)
freg[psub == 1] = 1
freg[(psub == 2) | (psub == 3)] = 2
freg[psub == 4] = 4; freg[psub == 5] = 5
# face island: head skin in front of the ears, largest connected patch
zf = -co[:, 1]
cand = (freg == 2) & (zf[pv].min(1) > 0.012) & (co[:, 2][pv].min(1) > FACE_YMIN)
bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
seen = np.zeros(npoly, bool); best = []
for f0 in np.where(cand)[0]:
    if seen[f0]: continue
    comp = [f0]; seen[f0] = True; i = 0
    while i < len(comp):
        f = bm.faces[comp[i]]; i += 1
        for e in f.edges:
            for g in e.link_faces:
                if cand[g.index] and not seen[g.index]:
                    seen[g.index] = True; comp.append(g.index)
    if len(comp) > len(best): best = comp
freg[np.array(best)] = 3
# absorb small enclosed specks (stray dark bits on the forehead) into the face island
changed = True
while changed:
    changed = False
    for f in bm.faces:
        if freg[f.index] in (1, 2) and zf[pv[f.index]].min() > 0.012 and co[:, 2][pv[f.index]].min() > FACE_YMIN:
            nb = [g.index for e in f.edges for g in e.link_faces if g is not f]
            if sum(freg[n] == 3 for n in nb) >= 2:
                freg[f.index] = 3; changed = True
bm.free()
# clothing right next to the head (collar, shoulders top) shows in every head close-up: its own region with more texels
cz = co[:, 2][pv].mean(1); cxa = np.abs(co[:, 0][pv].mean(1))
freg[(freg == 0) & (cz > COLLAR_Y) & (cxa < 0.17)] = 6
log("faces per uv region", np.bincount(freg, minlength=7).tolist())
att = me.attributes.get("uv_region") or me.attributes.new("uv_region", "INT", "FACE")
att.data.foreach_set("value", freg)

while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
me.uv_layers.new(name="UVMap")

def select_faces(mask):
    bpy.ops.object.mode_set(mode="OBJECT")
    me.polygons.foreach_set("select", mask)
    me.update()
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="FACE")

# ---- charts: Smart UV Project on a lightly smoothed copy of the shape (less facet noise, fewer crumbs), crumbs merged
# into their neighbours, then the real shape is unwrapped along those chart borders. Heavy smoothing gives fewer charts
# but pockets, straps and hair strands then get squeezed to almost no texels by the conformal unwrap.
orig = coords(me).copy()
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.mark_seam(clear=True)
if SMOOTH > 0: bpy.ops.mesh.vertices_smooth(factor=0.5, repeat=SMOOTH)
for r, ang in ((0, ANGLE), (6, ANGLE), (1, ANGLE), (2, ANGLE), (4, 75), (5, 75)):
    select_faces(freg == r)
    bpy.ops.uv.smart_project(angle_limit=math.radians(ang), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
select_faces(freg == 3)
bpy.ops.uv.smart_project(angle_limit=math.radians(89), island_margin=0.0)
bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.seams_from_islands(mark_seams=True, mark_sharp=False)
bpy.ops.object.mode_set(mode="OBJECT")
me.vertices.foreach_set("co", orig.ravel()); me.update()
# seams: region borders always, never inside the face island
bm = bmesh.new(); bm.from_mesh(me)
for e in bm.edges:
    fr = [freg[f.index] for f in e.link_faces]
    if len(set(fr)) > 1: e.seam = True
    elif fr and fr[0] == 3: e.seam = False
# dissolve crumb charts: each one joins the neighbouring chart (same region) it shares the most edges with
bm.faces.ensure_lookup_table()
lab = np.full(npoly, -1, np.int64); n = 0
for f0 in bm.faces:
    if lab[f0.index] >= 0: continue
    lab[f0.index] = n; st = [f0]
    while st:
        f = st.pop()
        for e in f.edges:
            if e.seam: continue
            for g in e.link_faces:
                if lab[g.index] < 0: lab[g.index] = n; st.append(g)
    n += 1
pairs = np.array([(e.link_faces[0].index, e.link_faces[1].index) for e in bm.edges if len(e.link_faces) == 2], np.int64)
pairs = pairs[freg[pairs[:, 0]] == freg[pairs[:, 1]]]
n_start = n
for rnd in range(200):
    size = np.bincount(lab, minlength=n)
    la, lb = lab[pairs[:, 0]], lab[pairs[:, 1]]
    m = la != lb
    if not m.any(): break
    la, lb = la[m], lb[m]
    key = np.concatenate([la * n + lb, lb * n + la])          # (chart, neighbour) with multiplicity = shared edges
    uk, cnt = np.unique(key, return_counts=True)
    c, nb = uk // n, uk % n
    small = size[c] < MIN_CHART
    if not small.any(): break
    c, nb, cnt = c[small], nb[small], cnt[small]
    order = np.lexsort((cnt, c))                              # last entry per chart = its best neighbour
    c, nb = c[order], nb[order]
    last = np.r_[c[1:] != c[:-1], True]
    c, nb = c[last], nb[last]
    # merge the smallest charts first, one hop per round, never chain within a round
    remap = np.arange(n); used = np.zeros(n, bool)
    for ci, ni in sorted(zip(c.tolist(), nb.tolist()), key=lambda t: size[t[0]]):
        if used[ci] or used[ni]: continue
        remap[ci] = ni; used[ci] = used[ni] = True
    lab = remap[lab]
size = np.bincount(lab, minlength=n)
log("charts", n_start, "->", int((size > 0).sum()), "after merging crumbs under", MIN_CHART, "faces")
for e in bm.edges:
    if len(e.link_faces) == 2:
        fa, fb = e.link_faces[0].index, e.link_faces[1].index
        e.seam = bool(lab[fa] != lab[fb] or freg[fa] != freg[fb]) and not (freg[fa] == 3 and freg[fb] == 3)
bm.to_mesh(me); bm.free()
bpy.ops.object.mode_set(mode="EDIT")
select_faces(freg != 3)
bpy.ops.uv.unwrap(method="ANGLE_BASED", margin=0.0)
bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.minimize_stretch(iterations=STRETCH_IT)
select_faces(freg == 3)
bpy.ops.uv.unwrap(method="ANGLE_BASED", margin=0.0)
bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.minimize_stretch(iterations=FACE_STRETCH_IT)

# equal texel density, then the per-region scale
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.average_islands_scale()
bpy.ops.object.mode_set(mode="OBJECT")
uv = np.empty(len(me.loops) * 2, np.float64); me.uv_layers[0].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
k = np.ones(7); k[6] = K_COLLAR; k[1] = K_HAIR; k[2] = K_SKIN; k[3] = K_FACE; k[4] = k[5] = K_HAND
ls = np.empty(npoly, np.int64); me.polygons.foreach_get("loop_start", ls)
loop_face = np.repeat(np.arange(npoly), 3)
# uniform scale about the origin per region: islands of different regions may overlap for a moment, packing separates them
uv *= k[freg][loop_face][:, None]
me.uv_layers[0].data.foreach_set("uv", uv.ravel())
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.select_all(action="SELECT")
log("packing")
bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, rotate_method="ANY", scale=True, merge_overlap=False,
                        margin_method="FRACTION", margin=MARGIN, shape_method="CONCAVE")
bpy.ops.object.mode_set(mode="OBJECT")

# report: texel density per region (uv area / 3d area) and island count
uv = np.empty(len(me.loops) * 2, np.float64); me.uv_layers[0].data.foreach_get("uv", uv); uv = uv.reshape(-1, 3, 2)
a2 = np.abs(np.cross(uv[:, 1] - uv[:, 0], uv[:, 2] - uv[:, 0])) / 2
p = co[pv]; a3 = np.linalg.norm(np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0]), axis=1) / 2
dens = {}
for r, n in enumerate(["rest", "hair", "head_skin", "face_island", "hand_l", "hand_r", "collar"]):
    m = freg == r
    if m.any(): dens[n] = {"uv_area": float(a2[m].sum()), "area_m2": float(a3[m].sum()), "px_per_m_at_4096": float(4096 * math.sqrt(a2[m].sum() / a3[m].sum()))}
log("atlas fill", float(a2.sum()), "uv bounds", uv.min((0, 1)).round(4), uv.max((0, 1)).round(4))
for n, d in dens.items(): log(n, {kk: round(v, 4) for kk, v in d.items()}, "x%.2f" % (d["px_per_m_at_4096"] / dens["rest"]["px_per_m_at_4096"]))
rel = (a2 / np.maximum(a3, 1e-12)); 
for r, n in enumerate(["rest", "hair", "head_skin", "face_island", "hand_l", "hand_r", "collar"]):
    m = freg == r; med = np.sum(a2[m]) / np.sum(a3[m]); q = rel[m] / med
    log(n, "area share with texel density < 0.5x: %.3f, < 0.25x: %.3f, > 2x: %.3f" % (a3[m][q < 0.25 ** 1].sum() / a3[m].sum() if False else a3[m][q < 0.25].sum() / a3[m].sum(), a3[m][q < 0.0625].sum() / a3[m].sum(), a3[m][q > 4].sum() / a3[m].sum()))
low["uv_report"] = str(dens)
bpy.ops.wm.save_as_mainfile(filepath=out)
log("saved", out)
