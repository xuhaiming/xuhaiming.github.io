"""Measure rigging landmarks on the final mesh and write them as JSON (glTF space: Y up, +Z front, +X = character's left, metres).
usage: blender -b -P hero2/landmarks.py -- <hero_mesh.blend> <landmarks.json>
Every entry is {"p": [x, y, z], "how": "measured ..." | "estimated ..."}. "measured" points come from the geometry or the
baked texture; "estimated" ones are joint centres hidden under clothing, placed with anatomical ratios on measured centrelines.
Look at the result with: review.py ... marks=<landmarks.json>"""
import bpy, sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

pos, opt = args()
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(pos[0]))
ob = bpy.data.objects["Hero"]; me = ob.data
cb = coords(me)
G = np.stack([cb[:, 0], cb[:, 2], -cb[:, 1]], 1)            # glTF coordinates
X, Y, Z = G[:, 0], G[:, 1], G[:, 2]
nv = len(G)
reg = region_of(cb)
hair = np.zeros(nv, np.float32); me.attributes["hair"].data.foreach_get("value", hair)
E = edge_array(me)

# base colour at the vertices (from the baked texture)
img = next(i for i in bpy.data.images if i.name.startswith("hero_basecolor"))
W, H = img.size
px = np.empty(W * H * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers[0].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get("vertex_index", lv)
vuv = np.zeros((nv, 2), np.float32); vuv[lv] = uv
col = px[np.clip((vuv[:, 1] * H).astype(int), 0, H - 1), np.clip((vuv[:, 0] * W).astype(int), 0, W - 1), :3]
lum = col @ np.array([0.299, 0.587, 0.114], np.float32)
red = col[:, 0] - 0.5 * (col[:, 1] + col[:, 2])

L = {}
def put(name, p, how):
    L[name] = {"p": [round(float(v), 4) for v in p], "how": how}
def bbox_centre(m):
    return (G[m].min(0) + G[m].max(0)) / 2

head = reg == REG_HEAD
skin = head & (hair < 0.5)
put("head_top", G[np.argmax(Y)], "measured: highest vertex (top of the hair)")
m = head & (hair > 0.5)
put("hair_bounds_min", G[m].min(0), "measured: hair bounding box"); put("hair_bounds_max", G[m].max(0), "measured: hair bounding box")

# ---- face (texture based: the eyes are painted)
face = skin & (Z > 0.03)
def dark_blob(x0, x1, y0, y1, thr):
    m = face & (X > x0) & (X < x1) & (Y > y0) & (Y < y1)
    d = m & (lum < thr)
    return d, m
for side, sx in (("r", -1), ("l", 1)):
    xa, xb = sorted((sx * 0.012 + 0.002, sx * 0.058 + 0.002))
    d, m = dark_blob(xa, xb, 1.603, 1.630, 0.0)
    thr = np.percentile(lum[m], 12)                       # the iris / pupil is the darkest part of the eye box
    d = m & (lum <= thr)
    c = np.median(G[d], 0)
    near = d & (np.linalg.norm(G - c, axis=1) < 0.008)
    put("eye_" + side, G[near].mean(0), "measured: centre of the dark iris in the baked texture, on the surface (the eyeball centre is about 0.012 behind)")
    # eye corners / lids: extent of the dark lash line
    lash = m & (lum <= np.percentile(lum[m], 30)) & (np.abs(Y - L["eye_" + side]["p"][1]) < 0.008)
    xs = G[lash]
    put("eye_%s_inner" % side, xs[np.argmin(np.abs(xs[:, 0]))], "measured: inner end of the lash line")
    put("eye_%s_outer" % side, xs[np.argmax(np.abs(xs[:, 0]))], "measured: outer end of the lash line")
    ey = L["eye_" + side]["p"][1]
    mb = face & (X > xa - 0.004) & (X < xb + 0.006) & (Y > ey + 0.011) & (Y < ey + 0.034)
    db = mb & (lum <= np.percentile(lum[mb], 25))
    c = np.median(G[db], 0); nb = db & (np.linalg.norm(G - c, axis=1) < 0.02)
    put("brow_" + side, G[nb].mean(0), "measured: centre of the dark brow in the baked texture")
    put("brow_%s_inner" % side, G[nb][np.argmin(np.abs(G[nb][:, 0]))], "measured: inner end of the brow")
    put("brow_%s_outer" % side, G[nb][np.argmax(np.abs(G[nb][:, 0]))], "measured: outer end of the brow")
cx = (L["eye_l"]["p"][0] + L["eye_r"]["p"][0]) / 2
# midline profile
prof = skin & (np.abs(X - cx) < 0.004) & (Z > 0.0)
pr = G[prof]; pr = pr[np.argsort(pr[:, 1])]
nose = pr[np.argmax(pr[:, 2])]
put("nose_tip", nose, "measured: most forward point of the midline profile")
below = pr[(pr[:, 1] < nose[1] - 0.02) & (pr[:, 1] > nose[1] - 0.1)]
chin = below[np.argmax(below[:, 2] - below[:, 1])]
put("chin", chin, "measured: chin tip, the midline point furthest forward and down")
# lips: the mouth is closed; the lip seam is the dark line between the red lips
mb = face & (np.abs(X - cx) < 0.045) & (Y < nose[1] - 0.018) & (Y > chin[1] + 0.02)
ys = np.linspace(Y[mb].min(), Y[mb].max(), 40)
mid = mb & (np.abs(X - cx) < 0.012)
rows = [(lum[mid & (np.abs(Y - y) < 0.0015)].mean() if (mid & (np.abs(Y - y) < 0.0015)).any() else 9, y) for y in ys]
seam_y = min(rows)[1]
c = mid & (np.abs(Y - seam_y) < 0.002) & (np.abs(X - cx) < 0.004)
put("lip_centre", [cx, seam_y, Z[c].max() if c.any() else nose[2] - 0.02], "measured: lip seam on the midline (darkest row between the lips)")
# corners: follow the dark seam sideways while it stays darker than the skin above and below it
skin_l = np.median(lum[face & (np.abs(X - cx) < 0.05) & (Y > seam_y - 0.03) & (Y < seam_y + 0.03)])
for side, sx in (("r", -1), ("l", 1)):
    last = None; y = seam_y
    for dx in np.arange(0.004, 0.045, 0.002):
        col_m = face & (np.abs(X - (cx + sx * dx)) < 0.0015) & (np.abs(Y - y) < 0.006)
        if not col_m.any(): continue
        i = np.where(col_m)[0][np.argmin(lum[col_m])]
        if lum[i] > skin_l * 0.86: break
        last = G[i]; y = last[1]
    put("mouth_corner_" + side, last, "measured: end of the dark lip seam in the baked texture")
ul = pr[(pr[:, 1] > seam_y) & (pr[:, 1] < seam_y + 0.012)]; ll = pr[(pr[:, 1] < seam_y) & (pr[:, 1] > seam_y - 0.014)]
put("upper_lip", ul[np.argmax(ul[:, 2])], "measured: most forward midline point of the upper lip")
put("lower_lip", ll[np.argmax(ll[:, 2])], "measured: most forward midline point of the lower lip")
jaw = skin & (Y < seam_y) & (Y > chin[1] - 0.005)
for side, sx in (("r", -1), ("l", 1)):
    # ear: the part of the head skin that sticks out sideways behind the cheek
    m = skin & (sx * (X - cx) > 0.05) & (Z < 0.02) & (Z > -0.06) & (Y > 1.555) & (Y < 1.66)
    out_i = np.where(m)[0][np.argmax(sx * X[m])]
    em = m & (np.abs(X - X[out_i]) < 0.02)
    put("ear_" + side, bbox_centre(em), "measured: centre of the outer ear (bounding box of the protruding part)")
    put("ear_%s_outer" % side, G[out_i], "measured: outermost point of the ear")
ne = skin & (Y > 1.497) & (Y < 1.512) & (np.abs(X) < 0.09) & (red > 0.06) & (lum > 0.3)      # skin-coloured only, not the collar
put("neck_at_collar", bbox_centre(ne), "measured: centre of the visible neck where it enters the collar")
skull = head & (Y > 1.56)
put("head_centre", bbox_centre(skull & (hair < 2)), "measured: bounding-box centre of the head above the jaw")

# ---- arms and hands (T-pose along x)
def slab_x(sx, x, w=0.006):
    return (sx * X > x - w) & (sx * X < x + w) & (Y > 1.15)
def armpit_of(sx):
    line = []
    for x in np.arange(0.16, 0.69, 0.01):
        m = slab_x(sx, x)
        if m.sum() > 3: line.append((x, G[m][:, 1].min(), G[m][:, 1].max()))
    line = np.array(line); th = line[:, 2] - line[:, 1]
    thick = np.median(th[line[:, 0] > 0.4])
    return line[th < 1.35 * thick][:, 0].min()
SH_X = (armpit_of(1) + armpit_of(-1)) / 2 - 0.04
for side, sx, hreg in (("l", 1, REG_HAND_L), ("r", -1, REG_HAND_R)):
    line = []
    for x in np.arange(0.16, 0.69, 0.01):
        m = slab_x(sx, x)
        if m.sum() > 3: line.append((x, G[m][:, 1].min(), G[m][:, 1].max(), G[m][:, 2].min(), G[m][:, 2].max()))
    line = np.array(line)
    thick = np.median((line[:, 2] - line[:, 1])[line[:, 0] > 0.4])
    arm = line[(line[:, 2] - line[:, 1]) < 1.35 * thick]
    armpit_x = arm[:, 0].min()
    def centre(x):
        i = np.argmin(np.abs(line[:, 0] - x)); return [sx * x, (line[i, 1] + line[i, 2]) / 2, (line[i, 3] + line[i, 4]) / 2]
    put("armpit_" + side, [sx * armpit_x, line[np.argmin(np.abs(line[:, 0] - armpit_x)), 1], centre(armpit_x)[2]], "measured: where the sleeve leaves the torso (underside)")
    wm = (sx * X > WRIST_X) & (sx * X < WRIST_X + 0.012)
    wrist = bbox_centre(wm)
    put("wrist_" + side, wrist, "measured: centre of the arm cross-section at the end of the cuff, where the hand skin starts")
    # the jacket (shoulder pads, wide armholes) hides the joint: put it 4 cm inside the armpit, at the height and depth
    # of the sleeve centreline measured 6 cm outside the armpit, and use the same |x| on both sides
    sh_x = SH_X
    ref = centre(armpit_x + 0.06)
    sh = [sx * sh_x, ref[1], ref[2]]
    put("shoulder_" + side, sh, "estimated: 4 cm inside the mean armpit x, on the sleeve centreline height/depth (joint hidden by the jacket)")
    el_x = sh_x + 0.56 * (abs(wrist[0]) - sh_x)
    put("elbow_" + side, centre(el_x), "estimated: sleeve centreline at 56% of shoulder-to-wrist (upper arm : forearm = 0.186 : 0.146 of stature)")
    L["arm_centreline_" + side] = {"p": [[round(float(v), 4) for v in centre(x)] for x in np.arange(max(0.2, round(armpit_x, 2)), 0.69, 0.05)],
                                   "how": "measured: bounding-box centre of sleeve cross-sections every 5 cm"}
    # fingers: superlevel sets of the geodesic distance from the wrist; every finger is a component that is born at its tip
    hv = np.where(reg == hreg)[0]
    gi = np.full(nv, -1, np.int64); gi[hv] = np.arange(len(hv))
    e = gi[E]; e = e[(e >= 0).all(1)]
    hp = G[hv]; el = np.linalg.norm(hp[e[:, 0]] - hp[e[:, 1]], axis=1)
    d = np.where(sx * hp[:, 0] < WRIST_X + 0.006, 0.0, np.inf)
    for _ in range(400):
        nd = d.copy()
        np.minimum.at(nd, e[:, 0], d[e[:, 1]] + el); np.minimum.at(nd, e[:, 1], d[e[:, 0]] + el)
        if np.allclose(nd, d): break
        d = nd
    order = np.argsort(-d)
    parent = np.full(len(hv), -1, np.int64)                # union-find over vertices in descending distance
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    nbr, start = adjacency(len(hv), e)
    birth = {}; fingers = []                              # root -> tip vertex
    for v in order.tolist():
        parent[v] = v; birth[v] = v
        roots = {find(int(w)) for w in nbr[start[v]:start[v + 1]] if parent[w] >= 0}
        roots.discard(v)
        if not roots: continue
        roots = sorted(roots, key=lambda r: -d[birth[r]])   # oldest (farthest tip) survives
        keep = roots[0]
        for r in roots[1:]:
            pers = d[birth[r]] - d[v]
            if pers > 0.02: fingers.append((birth[r], d[v], pers))
            parent[r] = keep
        parent[v] = keep
    # the component that survives to the wrist is one more finger (the longest one): its web is the highest merge level it took part in
    longest = order[0]
    fingers = sorted(fingers, key=lambda f: -f[2])[:4]
    web_long = max(f[1] for f in fingers)
    fingers.append((int(longest), web_long, d[longest] - web_long))
    info = []
    for tip, web_d, pers in fingers:
        # the finger = vertices beyond the web level connected to the tip
        m = d > web_d + 0.001
        sub = np.where(m)[0]; g2 = np.full(len(hv), -1, np.int64); g2[sub] = np.arange(len(sub))
        ee = g2[e]; ee = ee[(ee >= 0).all(1)]
        lab, _ = components(len(sub), ee)
        fm = sub[lab == lab[g2[tip]]]
        ring = fm[d[fm] < web_d + 0.006]
        base = (hp[ring].min(0) + hp[ring].max(0)) / 2
        tipc = hp[fm[d[fm] > d[tip] - 0.004]].mean(0)     # centre of the fingertip pad rather than one vertex
        info.append({"tip": hp[tip], "tip_c": tipc, "base": base, "len": float(np.linalg.norm(hp[tip] - base)), "verts": fm})
    # thumb = the finger whose tip reaches least far along the arm; the others ordered front (index) to back (pinky)
    thumb = min(info, key=lambda f: sx * f["tip"][0])
    rest = sorted([f for f in info if f is not thumb], key=lambda f: -f["base"][2])
    for nm, f in zip(["thumb", "index", "middle", "ring", "pinky"], [thumb] + rest):
        axis = (f["base"] - f["tip"]) / max(f["len"], 1e-6)
        k = 0.18 if nm == "thumb" else 0.30
        put("%s_%s_tip" % (nm, side), f["tip"], "measured: fingertip (farthest point from the wrist along the surface)")
        put("%s_%s_web" % (nm, side), f["base"], "measured: centre of the finger cross-section where it separates from its neighbour (web level)")
        put("%s_%s_base" % (nm, side), f["base"] + axis * k * f["len"], "estimated: base knuckle, the finger axis extended %d%% of the free finger length into the palm" % (k * 100))
        # centreline stations for the two further joints
        fm = f["verts"]; t = (hp[fm] - f["base"]) @ (-axis)
        for frac, jn in ((0.36, "joint2"), (0.68, "joint3")) if nm != "thumb" else ((0.45, "joint2"),):
            s = fm[np.abs(t - frac * f["len"]) < 0.004]
            if len(s): put("%s_%s_%s" % (nm, side, jn), (hp[s].min(0) + hp[s].max(0)) / 2, "estimated: finger centreline at %d%% of the free length (approximate knuckle)" % (frac * 100))
    put("hand_%s_centre" % side, bbox_centre((reg == hreg) & (sx * X < WRIST_X + 0.07)), "measured: centre of the palm block")

# ---- legs and feet
body = reg == REG_BODY
mid = body & (np.abs(X) < 0.012) & (Y > 0.5) & (Y < 1.05)
# crotch: lowest point of the surface on the midline, ignoring anything hanging in front (belt straps)
ym = np.sort(Y[mid & (np.abs(Z) < 0.06)])
crotch_y = float(ym[0])
put("crotch", [0.0, crotch_y, float(np.median(Z[mid & (Y < crotch_y + 0.01)]))], "measured: lowest point of the trousers on the midline")
wa = body & (Y > crotch_y + 0.06) & (Y < crotch_y + 0.08)
for side, sx in (("l", 1), ("r", -1)):
    line = []
    for y in np.arange(0.03, crotch_y - 0.01, 0.01):
        m = body & (sx * X > 0.0) & (np.abs(Y - y) < 0.006)
        if m.sum() > 3: line.append((y, (G[m][:, 0].min() + G[m][:, 0].max()) / 2, (G[m][:, 2].min() + G[m][:, 2].max()) / 2))
    line = np.array(line)
    def centre(y):
        i = np.argmin(np.abs(line[:, 0] - y)); return [line[i, 1], y, line[i, 2]]
    top = centre(crotch_y - 0.03)
    hip_y = crotch_y + 0.07
    put("hip_" + side, [top[0] * 0.92, hip_y, top[2]], "estimated: hip joint 7 cm above the crotch, on the thigh centreline")
    foot = body & (sx * X > 0) & (Y < 0.13)
    toe = G[np.where(foot)[0][np.argmax(Z[foot])]]; heel = G[np.where(foot & (Y < 0.08))[0][np.argmin(Z[foot & (Y < 0.08)])]]
    put("toe_tip_" + side, toe, "measured: most forward point of the shoe")
    put("heel_" + side, heel, "measured: rearmost point of the shoe below 8 cm")
    ankle_y = 0.11
    an = centre(ankle_y)
    put("ankle_" + side, an, "estimated: leg centreline 11 cm above the floor (high-top shoe hides the joint)")
    knee_y = ankle_y + 0.5 * (hip_y - ankle_y) + 0.01
    put("knee_" + side, centre(knee_y), "estimated: leg centreline just above the middle of hip and ankle")
    fl = foot & (Y < 0.05)
    put("toe_base_" + side, [(G[fl][:, 0].min() + G[fl][:, 0].max()) / 2, 0.02, toe[2] - 0.30 * (toe[2] - heel[2])], "estimated: ball of the foot, 30% of the shoe length behind the toe tip")
    L["leg_centreline_" + side] = {"p": [[round(float(v), 4) for v in centre(y)] for y in np.arange(0.05, crotch_y - 0.02, 0.05)],
                                   "how": "measured: bounding-box centre of leg cross-sections every 5 cm"}
wb = body & (Y > 0.98) & (Y < 1.0)
put("waist", bbox_centre(body & (np.abs(Y - (crotch_y + 0.2)) < 0.01) & (np.abs(X) < 0.3)), "measured: torso cross-section centre 20 cm above the crotch")
put("chest", bbox_centre(body & (np.abs(Y - 1.25) < 0.01) & (np.abs(X) < 0.17)), "measured: torso cross-section centre at y = 1.25 (below the armpits)")
sh_y = (L["shoulder_l"]["p"][1] + L["shoulder_r"]["p"][1]) / 2
nc = L["neck_at_collar"]["p"]
put("neck_base", [nc[0], sh_y + 0.6 * (nc[1] - sh_y), nc[2] - 0.02], "estimated: 60% of the way from shoulder height to the collar rim, 2 cm behind the visible neck centre (inside the collar)")
bb = [G.min(0), G.max(0)]
out = {"space": "glTF: Y up, +Z front, +X character's left, metres; feet on y = 0", "bounds": [[round(float(v), 4) for v in b] for b in bb], "landmarks": L}
json.dump(out, open(os.path.abspath(pos[1]), "w"), indent=1)
for k, v in L.items():
    if not k.endswith("centreline_l") and not k.endswith("centreline_r"): print("%-22s %s  %s" % (k, v["p"], v["how"].split(":")[0]))
