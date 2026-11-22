"""Stage 1c: head sculpt (handsomer, slimmer lower face, tidy hair). Smooth masked deformation of the T-pose mesh after
body_slim.py; topology, UVs, attributes and textures untouched. Blender 5.0 headless, local only.

    blender -b -P hero2/head_sculpt.py -- src/hero2/hero_mesh_body.blend src/hero2/hero_mesh.blend [key=value ...]

Reads landmarks_body.json next to the input (written by body_slim.py), writes landmarks.json next to the output.
Blender space (Z up, the face looks toward -Y, character's left is +X). Two parts:

 1. skin (`deform_skin`, an analytic map so that rig_face.py can map its feature constants through `map_pts`):
    - jaw / cheek narrowing in x (JAW, CHEEK), faded in beyond |x| 0.03 so mouth, nose and eyes do not move, off at the ears
    - cheekbone: a small outward / forward bump under the outer eye corner (BONE)
    - chin: longer (CHIN_DZ), a little forward (CHIN_DY), narrower; under-chin fullness tucked up and back (SUBM), neck slimmer (NECK)
    - head scale (HS) about the chin height, blended out toward the collar rim so the collar stays put
 2. hair (vertex based): Taubin smoothing of the fringe zone (the tooth-like bangs), the lower edge raised to a clean line
    that is a little higher on the character's left (a slight side sweep), more volume on the crown, tidier sides.
    Hair vertices touching skin stay on the skin; the same analytic map moves hair and skin alike, so nothing tears.
"""
import sys, os, json
import numpy as np
import bpy, bmesh

KW = dict(JAW=0.12, CHEEK=0.085, BONE=0.0018, CHIN_DZ=0.0045, CHIN_DY=0.003, CHIN_NARROW=0.07, SUBM=0.004, NECK=0.08, HS=0.93,
          FR_IT=40, FR_RAISE=0.85, VOL=0.007, SIDE=0.05, SWEEP=0.006, HAIR_IT=6, LINE=1.672, YF=-0.108, WCD=0.008,
          EAR=0.008, SPK=0.0022, SPK_G=0.0070, SPK_IT=60, COL_IT=10, COL_T=0.0022)
PIV_Z = 1.50


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def deform_skin(P, wc=None, kw=KW):
    """P (n,3) Blender-space points -> new points. wc (n,) in [0,1] = distance factor from the collar (1 = free); None = 1."""
    x, y, z = P.T
    ax, sg = np.abs(x), np.sign(x)
    wc = np.ones(len(P)) if wc is None else wc
    ear = ss(0.072, 0.080, ax) * ss(-0.035, -0.012, y) * ss(1.560, 1.572, z) * (1 - ss(1.630, 1.645, z))
    free = (1 - ear) * wc
    # --- narrowing of jaw and cheeks
    wx = ss(0.030, 0.058, ax)
    wy = 1 - ss(0.045, 0.09, y)
    wj = ss(1.488, 1.515, z) * (1 - ss(1.545, 1.58, z))
    wch = ss(1.545, 1.565, z) * (1 - ss(1.60, 1.625, z))
    f = 1 - (kw['JAW'] * wj + kw['CHEEK'] * wch) * wx * wy * free
    # --- chin and neck
    wchin = (1 - ss(0.03, 0.06, ax)) * ss(1.535, 1.512, z) * ss(-0.02, -0.06, y) * free
    f = f * (1 - kw['CHIN_NARROW'] * wchin)
    wneck = (1 - ss(1.50, 1.54, z)) * (1 - ss(0.07, 0.11, ax)) * wc
    f = f * (1 - kw['NECK'] * wneck)
    x1 = x * f
    # --- ears: pull the flared rim toward the head (zero at the attachment, about EAR at the rim), smooth in x / y / z
    ew = ss(0.068, 0.088, ax) * ss(1.548, 1.568, z) * (1 - ss(1.610, 1.628, z)) * ss(-0.042, -0.018, y) * (1 - ss(0.045, 0.065, y))
    x1 = x1 - sg * kw['EAR'] * ew
    wsm = ss(-0.07, -0.04, y) * (1 - ss(0.02, 0.05, y)) * ss(1.46, 1.48, z) * (1 - ss(1.505, 1.525, z)) * (1 - ss(0.045, 0.075, ax)) * wc
    # --- cheekbone bump
    g = np.exp(-0.5 * (((ax - 0.060) / 0.012) ** 2 + ((z - 1.598) / 0.012) ** 2 + ((y + 0.07) / 0.03) ** 2)) * free
    x1 = x1 + sg * kw['BONE'] * g
    y1 = y - kw['CHIN_DY'] * wchin - kw['BONE'] * 0.8 * g + kw['SUBM'] * wsm
    z1 = z - kw['CHIN_DZ'] * wchin + kw['SUBM'] * 0.75 * wsm
    # --- head scale about (0, 0.0, PIV_Z), weight 0 at the collar
    ws = ss(1.485, 1.54, z) * wc
    k = (kw['HS'] - 1) * ws
    return np.stack([x1 + (x1 - 0.0) * k, y1 + (y1 - 0.0) * k, z1 + (z1 - PIV_Z) * k], 1)


def map_pts(P, kw=KW):
    """for points far from the collar (face features): same map with wc = 1"""
    return deform_skin(np.asarray(P, float).reshape(-1, 3), None, kw)


def taubin(co, nbr, start, w, it, lam=0.5, mu=-0.53):
    """Taubin smoothing of co (n,3) with per-vertex weight w (n,), CSR graph (nbr, start)."""
    deg = np.diff(start).astype(float)
    row = np.repeat(np.arange(len(deg)), np.diff(start))
    for _ in range(it):
        for s in (lam, mu):
            mean = np.zeros_like(co)
            np.add.at(mean, row, co[nbr])
            mean /= np.maximum(deg, 1)[:, None]
            co = co + (s * w)[:, None] * (mean - co)
    return co


def main():
    a = sys.argv[sys.argv.index('--') + 1:]
    src, out = os.path.abspath(a[0]), os.path.abspath(a[1])
    kw = dict(KW)
    for q in a[2:]:
        k, v = q.split('=')
        kw[k] = float(v)
    bpy.ops.wm.open_mainfile(filepath=src)
    ob = bpy.data.objects['Hero']
    me = ob.data
    n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(n, 3)
    hair = np.empty(n); me.attributes['hair'].data.foreach_get('value', hair); hair = hair > 0.5
    reg = np.empty(len(me.polygons), np.int32); me.attributes['uv_region'].data.foreach_get('value', reg)
    pv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', pv)
    pl = np.repeat(np.arange(len(me.polygons)), [p.loop_total for p in me.polygons])
    vmin = np.full(n, 99); vmax = np.full(n, -1)
    np.minimum.at(vmin, pv, reg[pl]); np.maximum.at(vmax, pv, reg[pl])
    e = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get('vertices', e); e = e.reshape(-1, 2)
    both = np.concatenate([e, e[:, ::-1]]); order = np.argsort(both[:, 0], kind='stable')
    nbr = both[order, 1]; start = np.searchsorted(both[order, 0], np.arange(n + 1))
    x, y, z = co.T
    head = (z > 1.44) & (np.abs(x) < 0.15) & (z < 1.80)
    collar = head & ((vmax == 6) | (vmin == 0)) & ~hair
    ci = np.where(collar)[0]
    hi = np.where(head)[0]
    # distance of every head vertex to the collar (chunked brute force)
    d = np.full(n, 1.0)
    for i in range(0, len(hi), 2000):
        s = hi[i:i + 2000]
        d[s] = np.sqrt(((co[s, None, :] - co[None, ci, :]) ** 2).sum(-1)).min(1)
    wc = ss(0.0, kw["WCD"], d)
    new = co.copy()
    new[hi] = deform_skin(co[hi], wc[hi], kw)
    # ---------------------------------------------------------------- hair
    H = hair & head
    seam = H & (vmax > 1)                                        # hair vertices that touch skin
    skin_i = np.where(head & ~hair & (vmax <= 3) & (vmin >= 2))[0]
    dsk = np.full(n, 1.0)
    hh = np.where(H)[0]
    for i in range(0, len(hh), 1500):
        s = hh[i:i + 1500]
        dsk[s] = np.sqrt(((new[s, None, :] - new[None, skin_i, :]) ** 2).sum(-1)).min(1)
    wsk = ss(0.004, 0.02, dsk)
    px, py, pz = new.T
    # fringe zone: smooth the tooth-like tips
    zf = H & ~seam
    wf = zf * ss(1.62, 1.645, pz) * ss(-0.02, -0.05, py) * (1 - ss(1.735, 1.755, pz)) * (1 - ss(0.085, 0.10, np.abs(px)))
    sm = taubin(new, nbr, start, wf * (kw['FR_IT'] > 0), int(kw['FR_IT']))
    # lower edge: a clean line, a little higher on the left (+x) side
    line = kw['LINE'] + kw['SWEEP'] * np.tanh(sm[:, 0] / 0.035)
    low = H & ~seam & (sm[:, 1] < -0.05) & (sm[:, 2] < line + 0.01)
    zz = sm[:, 2].copy()
    zz[low] = zz[low] + (line[low] - zz[low]) * kw['FR_RAISE'] * ss(-0.045, -0.07, sm[low, 1]) * ss(0.092, 0.075, np.abs(sm[low, 0])) * ss(line[low] + 0.01, line[low] - 0.004, zz[low])
    sm[:, 2] = zz
    new[H] = sm[H]
    # forward tufts on the crown: pull the overhang back
    yf = kw['YF']
    ov = np.clip(yf - new[:, 1], 0, None)
    wt = H * ~seam * ss(1.66, 1.69, new[:, 2]) * wsk
    new[:, 1] = new[:, 1] + wt * ov * 0.7
    # crown volume (radial), tidy sides
    cen = np.array([0.0, 0.012, 1.60])
    r = new - cen
    rn = r / np.maximum(np.linalg.norm(r, axis=1), 1e-9)[:, None]
    wv = H * wsk * ss(1.655, 1.715, new[:, 2]) * (1 - 0.0 * ss(-0.12, 0.0, new[:, 1]))
    new = new + (kw['VOL'] * wv)[:, None] * rn
    wside = H * wsk * ss(1.625, 1.65, new[:, 2]) * (1 - ss(1.69, 1.72, new[:, 2])) * ss(0.05, 0.078, np.abs(new[:, 0])) * (1 - ss(0.07, 0.11, new[:, 1]))
    new[:, 0] *= 1 - kw['SIDE'] * wside
    # a light overall smoothing of the hair surface (not at the skin)
    wh = H * wsk * (1 - ss(-0.02, 0.0, 0 * new[:, 1]))
    new = taubin(new, nbr, start, wh * 0.9, int(kw['HAIR_IT']))
    # spike trim: strand tufts that stick out of the smoothed hair surface are pulled back (zones: front corners, crown front, nape)
    pz_, py_, px_ = new[:, 2], new[:, 1], new[:, 0]
    zone = np.maximum.reduce([ss(-0.01, -0.045, py_) * ss(1.64, 1.67, pz_),            # front top / fringe corners
                              ss(0.02, 0.05, py_) * (1 - ss(1.665, 1.69, pz_)),       # nape and back
                              np.zeros(n)])
    wz = (H * wsk * 1.0)
    t = kw['SPK_G'] + (kw['SPK'] - kw['SPK_G']) * zone
    S = taubin(new, nbr, start, wz * 0.9, int(kw['SPK_IT']), lam=0.5, mu=0.0)      # plain Laplacian: a smooth reference surface (shrinks ~1 mm)
    v = new - S
    vl = np.linalg.norm(v, axis=1)
    sc = np.where(vl > t, t / np.maximum(vl, 1e-9), 1.0)
    print('spike trim: clamped', int(((sc < 1) & (wz > 0)).sum()), 'dev p99/max mm', np.round(np.percentile(vl[wz > 0], [99, 100]) * 1000, 1))
    new = new + (wz * (sc - 1.0))[:, None] * v
    print('spike trim done')
    # ---------------------------------------------------------------- collar and shoulder tops: remove stair-steps / serration, keep the design edges
    C = (vmax == 6) & ~hair & (new[:, 2] > 1.30)
    wcol = C * np.where(vmin <= 3, 0.4, 1.0)
    if kw['COL_IT'] > 0:
        S = taubin(new, nbr, start, wcol * 0.9, int(kw['COL_IT']))
        v = new - S
        vl = np.linalg.norm(v, axis=1)
        sc = np.where(vl > kw['COL_T'], kw['COL_T'] / np.maximum(vl, 1e-9), 1.0)
        new = new + (wcol * (sc - 1.0))[:, None] * v
        print('collar verts', int(C.sum()), 'max trim %.4f' % (wcol * vl).max())
    # ---------------------------------------------------------------- write
    me.vertices.foreach_set('co', new.ravel())
    me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    print('boundary edges', sum(1 for e_ in bm.edges if e_.is_boundary), 'non-manifold', sum(1 for e_ in bm.edges if not e_.is_manifold))
    bm.free()
    moved = np.linalg.norm(new - co, axis=1)
    print('moved vertices', int((moved > 1e-6).sum()), 'max move %.4f' % moved.max(), 'hair top %.4f' % new[H, 2].max())
    # landmarks: features through the analytic map, head_top / hair bounds re-measured
    lp = os.path.join(os.path.dirname(src), 'landmarks_body.json')
    if os.path.exists(lp):
        lm = json.load(open(lp))

        def g2b(p): return [p[0], -p[2], p[1]]

        def b2g(b): return [round(float(b[0]), 4), round(float(b[2]), 4), round(float(-b[1]), 4)]
        for k, ent in lm['landmarks'].items():
            p = ent['p']
            if isinstance(p[0], list) or p[1] < 1.44 or k in ('head_top', 'hair_bounds_min', 'hair_bounds_max', 'neck_base'):
                continue
            ent['p'] = b2g(map_pts([g2b(p)], kw)[0])
        hv = new[H]
        top = hv[hv[:, 2].argmax()]
        lm['landmarks']['head_top']['p'] = b2g(top)
        gv = np.stack([hv[:, 0], hv[:, 2], -hv[:, 1]], 1)
        lm['landmarks']['hair_bounds_min']['p'] = [round(float(v), 4) for v in gv.min(0)]
        lm['landmarks']['hair_bounds_max']['p'] = [round(float(v), 4) for v in gv.max(0)]
        lm['note_head'] = 'head landmarks mapped through head_sculpt.py map_pts(); head_top / hair bounds re-measured'
        json.dump(lm, open(os.path.join(os.path.dirname(out), 'landmarks.json'), 'w'), indent=1)
        print('landmarks written')
    bpy.ops.wm.save_as_mainfile(filepath=out)


if __name__ == '__main__':
    main()
