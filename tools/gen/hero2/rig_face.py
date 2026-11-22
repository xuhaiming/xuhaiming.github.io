"""Face bones and their weights (used by rig_build.py). Blender space: Z up, the face looks toward -Y, left is +X.

Every face bone has the Head's rest orientation (local X = the character's left, Y = up, Z = forward) and its pivot
sits straight behind the feature it moves, inside the head, so a small rotation slides the skin over the skull:
    +X rotation moves the feature down (-X up), +Y moves it toward the character's left, +Z rolls it (left end up).
The eyes are painted on a continuous surface. A blink moves the skin of the upper lid down: every vertex between the
lid lines gets the weight (height above the lower lid line) / D, so that at the closing angle the whole opening
collapses onto the lower lid line and the lid skin above it stretches down over it. Nothing folds over.

The constants below were read off orthographic close-ups of the baked texture (0.06 mm per pixel).
"""
import math

import numpy as np

P = 'mixamorig:'
LID_R = 0.050                 # pivot depth behind the eye surface
LID_CLOSE_DEG = 10.0          # upper lid rotation that closes the eye
LID_D = LID_R * math.sin(math.radians(LID_CLOSE_DEG))
# eye opening: inner corner, outer corner (x, z), height of the upper / lower lid line over the corner-to-corner line
EYES = {
    'Left': dict(inner=(0.0235, 1.6127), outer=(0.0520, 1.6154), up=0.00375, low=0.00345, y=-0.094),
    'Right': dict(inner=(-0.0148, 1.6127), outer=(-0.0457, 1.6148), up=0.00430, low=0.00320, y=-0.096),
}
BROWS = {   # inner end, outer end (x, z), surface y
    'Left': dict(inner=(0.0290, 1.6345), outer=(0.0570, 1.6335), y=-0.095),
    'Right': dict(inner=(-0.0185, 1.6365), outer=(-0.0480, 1.6335), y=-0.097),
}
MOUTH = dict(left=(0.0313, 1.5456), right=(-0.0263, 1.5460), zc=1.5490, y=-0.102, yc=-0.086)
CHEEK = dict(x=0.047, z=1.578)
JAW_PIVOT = (0.0, -0.005, 1.600)


# head_sculpt.py (stage 1c) reshapes and scales the head: the constants above were read off the texture on the body-slimmed
# mesh, so they are carried through the same analytic map (features lie far from the collar, so the map is exact there)
def _carry():
    import head_sculpt as HSC
    m = lambda x, y, z: tuple(float(v) for v in HSC.map_pts([[x, y, z]])[0])   # noqa: E731
    hs = HSC.KW['HS']
    for E in EYES.values():
        ys = []
        for k in ('inner', 'outer'):
            nx, ny, nz = m(E[k][0], E['y'], E[k][1]); E[k] = (nx, nz); ys.append(ny)
        E['y'] = sum(ys) / 2; E['up'] *= hs; E['low'] *= hs
    for B in BROWS.values():
        ys = []
        for k in ('inner', 'outer'):
            nx, ny, nz = m(B[k][0], B['y'], B[k][1]); B[k] = (nx, nz); ys.append(ny)
        B['y'] = sum(ys) / 2
    ys = []
    for k in ('left', 'right'):
        nx, ny, nz = m(MOUTH[k][0], MOUTH['y'], MOUTH[k][1]); MOUTH[k] = (nx, nz); ys.append(ny)
    _, MOUTH['zc_y'], MOUTH['zc'] = m(0.0, MOUTH['y'], MOUTH['zc'])
    MOUTH['y'] = sum(ys) / 2
    MOUTH['yc'] = m(0.0, MOUTH['yc'], MOUTH['left'][1])[1]
    cx, cy, cz = m(CHEEK['x'], -0.085, CHEEK['z']); CHEEK['x'], CHEEK['z'] = cx, cz
    global JAW_PIVOT
    JAW_PIVOT = m(*JAW_PIVOT)


_carry()


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def surface_y(co, x, z):
    """y of the front surface at (x, z)"""
    m = co[:, 1] < -0.02
    d = (co[m, 0] - x) ** 2 + (co[m, 2] - z) ** 2
    return float(co[m][d.argmin(), 1])


def FACE_BONES(L, gl):
    """{name: (pivot, parent)}; the parent name is without prefix."""
    out = {}
    V = lambda *a: np.array(a, float)  # noqa: E731
    out['Jaw'] = (V(*JAW_PIVOT), 'Head')
    x0 = (MOUTH['left'][0] + MOUTH['right'][0]) / 2
    out['LipLower'] = (V(x0, MOUTH['y'] + 0.09, MOUTH['zc'] - 0.006), 'Jaw')
    out['LipUpper'] = (V(x0, MOUTH['y'] + 0.09, MOUTH['zc'] + 0.005), 'Head')
    for side, sg in (('Left', 1), ('Right', -1)):
        e = EYES[side]
        ex, ez = (e['inner'][0] + e['outer'][0]) / 2, (e['inner'][1] + e['outer'][1]) / 2
        out[side + 'EyelidUpper'] = (V(ex, e['y'] + LID_R, ez + 0.006), 'Head')   # above the eye: the closing lid tucks in ~2 mm
        out[side + 'EyelidLower'] = (V(ex, e['y'] + LID_R, ez - 0.004), 'Head')
        b = BROWS[side]
        out[side + 'Brow'] = (V((b['inner'][0] + b['outer'][0]) / 2, b['y'] + 0.09, (b['inner'][1] + b['outer'][1]) / 2), 'Head')
        c = MOUTH[side.lower()]
        out[side + 'MouthCorner'] = (V(c[0], MOUTH['yc'] + 0.085, c[1]), 'Head')
        out[side + 'Cheek'] = (V(sg * CHEEK['x'], -0.085 + 0.08, CHEEK['z']), 'Head')
    return out


def face_weights(W, co, e, names, joints, info, lm, gl):
    x, y, z = co.T
    n = len(co)
    ih = names.index(P + 'Head')
    front = info['skin'] & (y < 0.02)
    g_hair = info['geodesic'](co, e, info['hair'], 0.05)
    keep = np.where(front, ss(0.002, 0.014, g_hair), 0.0)      # fade to nothing at the hairline: hair stays rigid
    G = {}

    # ---- eyelids
    for side in ('Left', 'Right'):
        E = EYES[side]
        (xi, zi), (xo, zo) = E['inner'], E['outer']
        sg = 1 if xo > xi else -1
        xi, xo = xi - sg * 0.001, xo + sg * 0.001              # the model opening is a little larger than the painted one:
        hu, hl = E['up'] + 0.0006, E['low'] + 0.0004           # everything inside collapses onto the lower line
        xi_ = (x - xi) / (xo - xi)
        inside = (xi_ > 0) & (xi_ < 1) & (y < -0.06)
        bulge = np.clip(4 * xi_ * (1 - xi_), 0, 1)
        line = zi + (zo - zi) * xi_
        zu, zl = line + hu * bulge, line - hl * bulge
        opening = zu - zl
        assert opening.max() <= LID_D + 1e-6, 'eye opening larger than the lid travel'
        up = np.where(z <= zu, np.clip(z - zl, 0, None), opening * (1 - ss(0.0, 0.012, z - zu))) / LID_D
        G[side + 'EyelidUpper'] = np.where(inside, up, 0.0)
        t = np.clip((z - zl) / np.maximum(opening, 1e-6), 0, 1)
        low = np.where(z < zl, 1 - ss(0.0, 0.009, zl - z), 1 - t) * np.minimum(1.0, bulge * 1.5)
        G[side + 'EyelidLower'] = np.where(inside, low, 0.0)

    # ---- brows
    for side in ('Left', 'Right'):
        B = BROWS[side]
        a, b = np.array(B['inner']), np.array(B['outer'])
        ab = b - a
        p = np.stack([x, z], 1) - a
        t = p @ ab / (ab @ ab)
        over = np.maximum(np.maximum(-t, t - 1), 0) * np.linalg.norm(ab)
        dz = z - (a[1] + np.clip(t, 0, 1) * ab[1])
        r = np.sqrt((over / 0.017) ** 2 + (dz / np.where(dz > 0, 0.030, 0.010)) ** 2)
        G[side + 'Brow'] = (1 - ss(0.25, 1.0, r)) * (y < -0.05)

    # ---- mouth
    M = MOUTH
    x0 = (M['left'][0] + M['right'][0]) / 2
    half = (M['left'][0] - M['right'][0]) / 2
    zk = (M['left'][1] + M['right'][1]) / 2
    ax = np.abs(x - x0)
    zs = M['zc'] + (zk - M['zc']) * np.clip(ax / half, 0, 1) ** 2      # the lip seam
    s = z - zs
    out_ = np.clip(ax - half, 0, None)                                  # beyond the mouth corners
    z_line = zk + 0.55 * out_
    band = 0.0016 + 0.6 * out_
    jaw = np.where(out_ > 0, ss(0.5 * band, -band, z - z_line), ss(0.0004, -0.0016, s))
    jaw = jaw * (1 - ss(0.042, 0.078, ax)) * ss(-0.005, -0.055, y)
    lipl = jaw * (1 - ss(0.4, 1.0, np.sqrt(((x - x0) / 0.030) ** 2 + ((z - (M['zc'] - 0.0065)) / 0.012) ** 2)))
    lipu = ss(-0.001, 0.002, s) * (1 - ss(0.4, 1.0, np.sqrt(((x - x0) / 0.030) ** 2 + ((z - (M['zc'] + 0.005)) / 0.011) ** 2))) * (y < -0.07)
    G['Jaw'] = jaw - lipl
    G['LipLower'] = lipl
    G['LipUpper'] = lipu
    for side, sg in (('Left', 1), ('Right', -1)):
        c = M[side.lower()]
        cy = surface_y(co, c[0], c[1])
        r = np.linalg.norm(co - np.array([c[0], cy, c[1]]), axis=1)
        f = 1 - ss(0.2, 1.0, r / 0.024)
        for k in ('Jaw', 'LipLower', 'LipUpper'):
            G[k] = G[k] * (1 - f)
        G[side + 'MouthCorner'] = f
        cx, cz = sg * CHEEK['x'], CHEEK['z']
        r = np.linalg.norm(co - np.array([cx, surface_y(co, cx, cz), cz]), axis=1)
        G[side + 'Cheek'] = 0.8 * (1 - ss(0.2, 1.0, r / 0.034)) * (1 - f)

    tot = sum(G.values())
    scale = np.where(tot > 1, 1 / np.maximum(tot, 1e-9), 1.0) * keep
    head = W[:, ih].copy()
    used = np.zeros(n)
    for k, g in G.items():
        w = g * scale * head
        W[:, names.index(P + k)] += w
        used += w
    W[:, ih] = head - used
    print('FACE bones', len(G), 'vertices with face weights', int((used > 0.01).sum()))
    return W
