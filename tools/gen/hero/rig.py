"""Stage 4 (Blender): fit a Mixamo-named humanoid armature to the mesh and skin it.
usage: blender -b -P rig.py -- <hero_mesh.blend> <hero_rig.blend>

Joints are found by slicing the mesh (object "HeroHi", vertex coloured, from mesh_prep.py):
crotch = lowest height where the two leg sections merge, armpits = highest height where an arm section
is still separate from the trunk, neck = narrowest section above the shoulders, arm axis = line fit
through the arm sections, wrist / ankle = where the surface colour flips from cloth to skin / shoe.
Skinning: bone heat ("automatic weights"); falls back to a voxel-remeshed proxy + Data Transfer, and
then to nearest-bone weights, if bone heat leaves vertices unweighted. Weights are then smoothed,
limited to 4 influences and normalised.
Blender axes: Z up, character faces -Y, its left side is +X."""
import bpy, sys, math, time
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, out_blend = argv[:2]
t0 = time.time()
def log(*a): print("[rig %5.1fs]" % (time.time() - t0), *a, flush=True)

bpy.ops.wm.open_mainfile(filepath=src)
scene = bpy.context.scene
low, hi = bpy.data.objects["Hero"], bpy.data.objects["HeroHi"]

me = hi.data
P = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", P); P = P.reshape(-1, 3)
C = np.empty(len(me.vertices) * 4); me.color_attributes[0].data.foreach_get("color", C); C = C.reshape(-1, 4)[:, :3]
LUM = C @ np.array([0.2126, 0.7152, 0.0722])
H = P[:, 2].max()
order = np.argsort(P[:, 2]); Pz = P[order, 2]

def slab(z, dz=0.007):
    a, b = np.searchsorted(Pz, [z - dz, z + dz])
    return order[a:b]

def segments(x, gap=0.016):
    """Sorted 1D values -> list of (lo, hi) runs separated by more than gap."""
    if len(x) == 0:
        return []
    x = np.sort(x)
    cut = np.nonzero(np.diff(x) > gap)[0]
    los = np.concatenate([[x[0]], x[cut + 1]]); his = np.concatenate([x[cut], [x[-1]]])
    return list(zip(los, his))

def centre(idx):
    p = P[idx]
    return (p.min(0) + p.max(0)) / 2

# ---- crotch: lowest slice where the legs are one section
crotch = None
for z in np.arange(0.30 * H, 0.62 * H, 0.004):
    i = slab(z); x = P[i, 0]; x = x[np.abs(x) < 0.30]
    if len(segments(x)) == 1:
        crotch = float(z); break
if crotch is None or not (0.38 * H < crotch < 0.56 * H):
    log("crotch not found by slicing (legs fused?), using ratio. got", crotch); crotch = 0.47 * H
log("crotch z", round(crotch, 3), "=", round(crotch / H, 3), "H")

# ---- armpits: highest slice where an arm is separate from the trunk
arm_gap = {+1: [], -1: []}   # per side list of (z, gap centre x)
for z in np.arange(crotch + 0.05, 0.90 * H, 0.004):
    seg = segments(P[slab(z), 0])
    for (a0, a1), (b0, b1) in zip(seg[:-1], seg[1:]):
        g = (a1 + b0) / 2
        if abs(g) > 0.08:
            arm_gap[1 if g > 0 else -1].append((float(z), float(g)))
armpit = {}
for s in (1, -1):
    if arm_gap[s]:
        zs = np.array(arm_gap[s])
        k = np.argmax(zs[:, 0]); armpit[s] = (zs[k, 0], zs[k, 1])
    else:
        log("no arm gap on side", s, "(arm fused to trunk): using ratios"); armpit[s] = (0.72 * H, s * 0.19)
log("armpits (z, x)", {k: (round(v[0], 3), round(v[1], 3)) for k, v in armpit.items()})

# ---- neck: narrowest section between shoulders and head
z_top_pit = max(armpit[1][0], armpit[-1][0])
zs = np.arange(z_top_pit + 0.08, H - 0.12, 0.004)
widths = np.array([np.ptp(P[slab(z), 0]) for z in zs])
z_neckmin = float(zs[np.argmin(widths)])
log("neck narrowest z", round(z_neckmin, 3), "width", round(float(widths.min()), 3))

def trunk_centre(z):
    i = slab(z, 0.01); i = i[np.abs(P[i, 0]) < 0.10]
    c = centre(i); return float(c[1])

J = {}   # joint name -> position
# ---- arms
arm_dir = {}
for s, side in ((1, "Left"), (-1, "Right")):
    pz, px = armpit[s]
    gaps = np.array(arm_gap[s]) if arm_gap[s] else None
    if gaps is not None and len(gaps) > 8:
        # arm = everything outside the gap, below the armpit
        gx = np.interp(P[:, 2], gaps[:, 0], gaps[:, 1], left=np.nan, right=np.nan)
        m = (P[:, 2] < pz - 0.01) & ~np.isnan(gx) & (s * P[:, 0] > s * gx)
        # the hand hangs below the lowest gap slice
        lowz = gaps[:, 0].min()
        m |= (P[:, 2] <= lowz) & (s * P[:, 0] > s * np.interp(lowz, gaps[:, 0], gaps[:, 1]) - 0.02) & (P[:, 2] > lowz - 0.25) & (s * P[:, 0] > 0.25)
    else:
        m = (s * P[:, 0] > abs(px) + 0.02) & (P[:, 2] < pz + 0.1)
    A = P[m]; Alum = LUM[m]
    c = A.mean(0)
    u, sv, vt = np.linalg.svd(A - c, full_matrices=False)
    d = vt[0]
    if d[2] > 0: d = -d                      # pointing from shoulder to hand
    t = (A - c) @ d
    t_tip = np.percentile(t, 99.9)
    # shoulder joint: on the arm axis, just inside the armpit
    x_sh = s * (abs(px) - 0.012)
    t_sh = (x_sh - c[0]) / d[0]
    sh = c + d * t_sh
    # sanity: 3..9 cm below the top of the shoulder
    near = (np.abs(P[:, 0] - sh[0]) < 0.012) & (P[:, 2] > pz) & (P[:, 2] < z_neckmin)
    if near.any():
        top = P[near, 2].max()
        if not (0.03 < top - sh[2] < 0.09):
            log(side, "shoulder z", round(sh[2], 3), "off vs top", round(top, 3), "-> clamped")
            sh[2] = top - 0.055
        ysl = P[near & (np.abs(P[:, 2] - sh[2]) < 0.02), 1]
        if len(ysl): sh[1] = (ysl.min() + ysl.max()) / 2
    L = t_tip - t_sh
    # wrist: where the surface turns from sleeve to skin
    bins = np.arange(t_sh + 0.5 * L, t_tip, 0.008)
    thr = (np.percentile(Alum, 10) + np.percentile(Alum, 97)) / 2
    frac = np.array([(Alum[(t >= b) & (t < b + 0.008)] > thr).mean() if ((t >= b) & (t < b + 0.008)).any() else 0 for b in bins])
    t_wr = None
    for k in range(len(bins) - 3):
        if (frac[k:k + 4] > 0.6).all():
            t_wr = bins[k] + 0.012; break
    if t_wr is None or not (0.62 < (t_wr - t_sh) / L < 0.88):
        log(side, "wrist by colour failed", None if t_wr is None else round((t_wr - t_sh) / L, 3), "-> ratio"); t_wr = t_sh + 0.76 * L
    t_el = t_sh + 0.535 * (t_wr - t_sh)
    def station(tt):
        mm = np.abs(t - tt) < 0.012
        p = A[mm]; return (p.min(0) + p.max(0)) / 2 if len(p) > 10 else c + d * tt
    el, wr = station(t_el), station(t_wr)
    tip = c + d * t_tip
    tipm = t > t_tip - 0.03
    if tipm.sum() > 5: tip = A[tipm].mean(0)
    hand_end = wr + (tip - wr) * 0.55
    J[side + "Arm"], J[side + "ForeArm"], J[side + "Hand"], J[side + "Hand_end"] = sh, el, wr, hand_end
    arm_dir[side] = d
    log(side, "arm: angle from vertical %.1f deg" % math.degrees(math.acos(-d[2])), "length", round(L, 3), "wrist at", round((t_wr - t_sh) / L, 3),
        "sh", sh.round(3), "el", el.round(3), "wr", wr.round(3))

# ---- legs
for s, side in ((1, "Left"), (-1, "Right")):
    m = (P[:, 2] < crotch + 0.02) & (s * P[:, 0] > 0) & (np.abs(P[:, 0]) < 0.30)
    Lp = P[m]; Ll = LUM[m]
    def sec(z, dz=0.012):
        q = Lp[np.abs(Lp[:, 2] - z) < dz]
        return (q.min(0) + q.max(0)) / 2
    # ankle: top of the (bright) shoe
    thr = (np.percentile(Ll, 10) + np.percentile(Ll[Lp[:, 2] < 0.05], 80)) / 2
    z_shoe = None
    for z in np.arange(0.20, 0.02, -0.005):
        q = Ll[np.abs(Lp[:, 2] - z) < 0.006]
        if len(q) and (q > thr).mean() > 0.5:
            z_shoe = float(z); break
    z_an = min(max(z_shoe if z_shoe is not None else 0.08, 0.065), 0.10)
    an = sec(z_an + 0.03); an[2] = z_an
    z_hip = crotch + 0.06
    hp = sec(crotch - 0.04); hp[2] = z_hip
    z_kn = z_an + 0.5 * (z_hip - z_an)
    kn = sec(z_kn); kn[1] -= 0.012          # slightly forward so the leg has an unambiguous bend direction
    foot = Lp[Lp[:, 2] < 0.05]
    y_front = np.percentile(foot[:, 1], 0.3)
    y_tb = an[1] + 0.62 * (y_front - an[1])
    ff = foot[foot[:, 1] < y_tb]
    x_tb = (ff[:, 0].min() + ff[:, 0].max()) / 2
    tb = np.array([x_tb, y_tb, 0.022])
    te = np.array([x_tb, y_front, 0.022])
    J[side + "UpLeg"], J[side + "Leg"], J[side + "Foot"], J[side + "ToeBase"], J[side + "Toe_end"] = hp, kn, an, tb, te
    log(side, "leg: shoe top", z_shoe, "hip", hp.round(3), "knee", kn.round(3), "ankle", an.round(3), "toe", tb.round(3))

# symmetrise heights of paired joints (keeps the walk even); x/y stay as measured
for n in ("Arm", "ForeArm", "Hand", "UpLeg", "Leg", "Foot"):
    z = (J["Left" + n][2] + J["Right" + n][2]) / 2
    J["Left" + n][2] = J["Right" + n][2] = z

# ---- trunk
z_hips = J["LeftUpLeg"][2] + 0.05
z_neck = J["LeftArm"][2] + 0.045
z_head = max(z_neckmin + 0.015, z_neck + 0.07)
x0 = (J["LeftUpLeg"][0] + J["RightUpLeg"][0]) / 2
def tr(z, back=0.0): return np.array([x0, trunk_centre(z) + back, z])
J["Hips"] = tr(z_hips)
for n, f in (("Spine", 0.18), ("Spine1", 0.42), ("Spine2", 0.68)):
    J[n] = tr(z_hips + f * (z_neck - z_hips))
J["Neck"] = tr(z_neck, 0.012)
J["Head"] = tr(z_head, 0.012)
J["Head_end"] = np.array([x0, J["Head"][1], H - 0.02])
for s, side in ((1, "Left"), (-1, "Right")):
    J[side + "Shoulder"] = np.array([x0 + s * 0.04, J["Neck"][1], z_neck - 0.035])
log("trunk: hips", J["Hips"].round(3), "neck", J["Neck"].round(3), "head", J["Head"].round(3))

# ---- armature
BONES = [  # name, parent, tail joint
    ("Hips", None, "Spine"), ("Spine", "Hips", "Spine1"), ("Spine1", "Spine", "Spine2"), ("Spine2", "Spine1", "Neck"),
    ("Neck", "Spine2", "Head"), ("Head", "Neck", "Head_end"),
]
for side in ("Left", "Right"):
    BONES += [
        (side + "Shoulder", "Spine2", side + "Arm"), (side + "Arm", side + "Shoulder", side + "ForeArm"),
        (side + "ForeArm", side + "Arm", side + "Hand"), (side + "Hand", side + "ForeArm", side + "Hand_end"),
        (side + "UpLeg", "Hips", side + "Leg"), (side + "Leg", side + "UpLeg", side + "Foot"),
        (side + "Foot", side + "Leg", side + "ToeBase"), (side + "ToeBase", side + "Foot", side + "Toe_end"),
    ]
PRE = "mixamorig:"
arm_data = bpy.data.armatures.new("Armature")
arm = bpy.data.objects.new("Armature", arm_data); scene.collection.objects.link(arm)
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = arm; arm.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
for name, parent, tail in BONES:
    b = arm_data.edit_bones.new(PRE + name)
    b.head = Vector(J[name]); b.tail = Vector(J[tail]); b.roll = 0
    if parent:
        b.parent = arm_data.edit_bones[PRE + parent]; b.use_connect = False
bpy.ops.object.mode_set(mode="OBJECT")
log("bones", len(arm_data.bones))

# ---- skinning
def weights_of(obj):
    names = [PRE + b[0] for b in BONES]
    gi = {obj.vertex_groups[n].index: k for k, n in enumerate(names) if n in obj.vertex_groups}
    W = np.zeros((len(obj.data.vertices), len(names)))
    for v in obj.data.vertices:
        for g in v.groups:
            k = gi.get(g.group)
            if k is not None: W[v.index, k] = g.weight
    return W, names

def bind_heat(obj):
    obj.vertex_groups.clear()
    for m in list(obj.modifiers):
        if m.type == "ARMATURE": obj.modifiers.remove(m)
    obj.parent = None
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    W, names = weights_of(obj)
    return W, float((W.sum(1) < 1e-4).mean())

method = "bone heat on the mesh"
W, bad = bind_heat(low)
log("bone heat: unweighted fraction", round(bad, 4))
if bad > 0.01:
    method = "bone heat on voxel proxy + data transfer"
    bpy.ops.object.select_all(action="DESELECT")
    low.select_set(True); bpy.context.view_layer.objects.active = low
    bpy.ops.object.duplicate(); proxy = bpy.context.view_layer.objects.active; proxy.name = "Proxy"
    proxy.vertex_groups.clear()
    for m in list(proxy.modifiers): proxy.modifiers.remove(m)
    rm = proxy.modifiers.new("rm", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = 0.012
    bpy.ops.object.modifier_apply(modifier=rm.name)
    Wp, badp = bind_heat(proxy)
    log("proxy bone heat: unweighted fraction", round(badp, 4), "proxy verts", len(proxy.data.vertices))
    if badp <= 0.01:
        low.vertex_groups.clear()
        for name, _, _ in BONES: low.vertex_groups.new(name=PRE + name)
        dt = low.modifiers.new("dt", "DATA_TRANSFER"); dt.object = proxy
        dt.use_vert_data = True; dt.data_types_verts = {"VGROUP_WEIGHTS"}; dt.vert_mapping = "POLYINTERP_NEAREST"
        dt.layers_vgroup_select_src = "ALL"; dt.layers_vgroup_select_dst = "NAME"
        bpy.ops.object.select_all(action="DESELECT"); low.select_set(True); bpy.context.view_layer.objects.active = low
        bpy.ops.object.modifier_apply(modifier=dt.name)
        W, _ = weights_of(low); bad = float((W.sum(1) < 1e-4).mean())
    bpy.data.objects.remove(proxy)
    if bad > 0.01:
        method = "nearest-bone weights + smoothing"
        V = np.array([v.co[:] for v in low.data.vertices])
        D = np.empty((len(V), len(BONES)))
        for k, (name, _, tail) in enumerate(BONES):
            a, b = J[name], J[tail]; ab = b - a
            tt = np.clip(((V - a) @ ab) / (ab @ ab), 0, 1)
            D[:, k] = np.linalg.norm(V - (a + tt[:, None] * ab), axis=1)
        W = np.exp(-(D - D.min(1, keepdims=True)) / 0.02)
log("skinning method:", method)

mesh = low.data
V = np.empty(len(mesh.vertices) * 3); mesh.vertices.foreach_get("co", V); V = V.reshape(-1, 3)
E = np.empty(len(mesh.edges) * 2, np.int64); mesh.edges.foreach_get("vertices", E); E = E.reshape(-1, 2)
names = [PRE + b[0] for b in BONES]
col = {n: k for k, n in enumerate(names)}
deg = np.bincount(E.ravel(), minlength=len(V)).astype(float)[:, None]

def neighbour_mean(W):
    S = np.zeros_like(W)
    np.add.at(S, E[:, 0], W[E[:, 1]]); np.add.at(S, E[:, 1], W[E[:, 0]])
    return S / np.maximum(deg, 1)

# fill any unweighted vertices from their neighbours
for _ in range(50):
    empty = W.sum(1) < 1e-4
    if not empty.any(): break
    W[empty] = neighbour_mean(W)[empty]
# no left/right leakage across the body: a side's limb bones never drive the other side
for side, sgn in (("Left", 1), ("Right", -1)):
    wrong = sgn * (V[:, 0] - x0) < -0.03
    for n in ("Arm", "ForeArm", "Hand", "UpLeg", "Leg", "Foot", "ToeBase"):
        W[wrong, col[PRE + side + n]] = 0
# hands and feet below the knees never follow the other limb type
for side in ("Left", "Right"):
    below = V[:, 2] < J[side + "Leg"][2] - 0.05
    for n in ("Arm", "ForeArm", "Hand"):
        W[below, col[PRE + side + n]] = 0
# light smoothing of the weight field (softens bone-heat creases at hips and shoulders)
for _ in range(3):
    W = 0.5 * W + 0.5 * neighbour_mean(W)
# skull is rigid
rigid = V[:, 2] > J["Head"][2] + 0.06
W[rigid] = 0; W[rigid, col[PRE + "Head"]] = 1
# limit to 4 influences, normalise
idx = np.argsort(-W, axis=1)[:, :4]
W4 = np.zeros_like(W); np.put_along_axis(W4, idx, np.take_along_axis(W, idx, 1), 1)
W4[W4 < 0.01] = 0
tot = W4.sum(1, keepdims=True)
assert (tot > 0).all()
W4 /= tot
low.vertex_groups.clear()
for k, n in enumerate(names):
    g = low.vertex_groups.new(name=n)
    nz = np.nonzero(W4[:, k])[0]
    for i, w in zip(nz.tolist(), W4[nz, k].tolist()):
        g.add([i], w, "REPLACE")
log("weights written; max influences", int((W4 > 0).sum(1).max()), "per-bone vertex counts", {n.split(":")[1]: int((W4[:, k] > 0.5).sum()) for k, n in enumerate(names)})

if not any(m.type == "ARMATURE" for m in low.modifiers):
    mod = low.modifiers.new("Armature", "ARMATURE"); mod.object = arm
low.parent = arm
arm["skin_method"] = method
bpy.data.objects.remove(hi)
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
log("saved", out_blend)
