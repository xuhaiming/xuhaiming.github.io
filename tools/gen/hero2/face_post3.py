"""Round 2 retouch in atlas space (skin regions 2,3 only): dodge under-eye bags and nasolabial folds, even out blotchy chroma, slightly warmer tone,
very soft symmetric sculpt (cheekbones, nose bridge, jaw), procedural skin micro detail (pores / grain / fine lines; none on eyes, brows, lips).
python face_post3.py <in_atlas.png> <out_atlas.png> [pores=1.0] [warm=1.0] [sculpt=1.0] [seed=11]"""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from face_lib import *
from skimage import color
Image.MAX_IMAGE_PIXELS = None
CX = 1057.0
def ell(cx, cy, rx, ry, feather=0.35, res=2048):
    yy, xx = np.mgrid[:res, :res].astype(np.float32); r = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    t = np.clip((1 - r) / feather, 0, 1); return t * t * (3 - 2 * t)
def seg(x0, y0, x1, y1, w, res=2048):
    yy, xx = np.mgrid[:res, :res].astype(np.float32); d = np.array([x1 - x0, y1 - y0], np.float32); L = np.linalg.norm(d); d /= L
    t = np.clip(((xx - x0) * d[0] + (yy - y0) * d[1]) / L, 0, 1); dist = np.hypot(xx - (x0 + t * d[0] * L), yy - (y0 + t * d[1] * L))
    s = np.clip(1 - dist / w, 0, 1); return s * s * (3 - 2 * s)
def mir(f): return lambda x: 2 * CX - x
def lum(a): return a @ np.array([.2126, .7152, .0722], np.float32)
def blur(a, s): return ndi.gaussian_filter(a, s)
def mblur(img, w, s):     # masked (normalised) blur of (H,W,C) with weight w
    num = np.stack([ndi.gaussian_filter(img[..., c] * w, s) for c in range(img.shape[2])], -1); den = ndi.gaussian_filter(w, s)[..., None]
    return num / np.maximum(den, 1e-4)
def main(inp, out, pores=1.0, warm=1.0, sculpt=1.0, seed=11):
    N = 4096
    A = np.asarray(Image.open(inp).convert("RGB"), np.float32) / 255
    d = np.load(os.path.join(F, "w3", "masks.npz")); rid, px, py, vis, nz = d["rid"], d["px"], d["py"], d["vis"], d["nz"]
    skin = np.isin(rid, [3, 4])            # rid = region + 1
    fw = vis * smooth(.1, .5, nz)          # texels the front view sees well
    P, UV, reg = load_mesh(); vt = np.load(os.path.join(F, "mesh.npz"))["vt"]
    cen = P.mean(1)
    def to_atlas(m): return bilinear(m[..., None].astype(np.float32), px, py)[..., 0] * fw
    # ---- front-space masks
    eyes = np.maximum(ell(800, 1058, 135, 72), ell(1312, 1060, 135, 72))
    brows = np.maximum(ell(765, 905, 175, 62), ell(1355, 905, 175, 62))
    lips = ell(1050, 1625, 255, 78)
    excl = np.clip(eyes + brows + lips, 0, 1)
    chin = ell(1050, 1735, 135, 60, .7)
    bags = np.maximum(ell(835, 1150, 85, 52), ell(1282, 1150, 85, 52))
    folds = np.maximum(seg(810, 1440, 745, 1595, 34), seg(1304, 1440, 1369, 1595, 34))
    exa = to_atlas(excl); ska = (skin & ~(exa > .3)).astype(np.float32)
    # lips in the atlas are skin texels too, but excluded from chroma evening / detail by exa
    Lab = color.rgb2lab(A)
    # ---- 1. dodge bags and folds on L, damp their chroma deviation
    sm = ndi.gaussian_filter(skin.astype(np.float32), 1.0)
    for nm, m, k in (("bags", bags, 0.85), ("folds", folds, 0.7), ("chin", chin, 0.9)):
        ma = to_atlas(m)
        Lb = mblur(Lab[..., :1], skin.astype(np.float32), 30)[..., 0]; Ls = mblur(Lab[..., :1], skin.astype(np.float32), 6)[..., 0]
        dod = np.clip(Lb - Ls, 0, 9)
        Lab[..., 0] += k * ma * dod
        for c in (1, 2):
            cb = mblur(Lab[..., c:c + 1], skin.astype(np.float32), 30)[..., 0]
            Lab[..., c] += 0.5 * ma * (cb - Lab[..., c])
    # ---- 2. chroma evening (blotchy redness), outside eyes/brows/lips
    wch = ska * (1 - exa)
    for c in (1, 2):
        cb = mblur(Lab[..., c:c + 1], wch + 1e-3, 22)[..., 0]
        Lab[..., c] += 0.55 * wch * (cb - Lab[..., c])
    # ---- 3. warmth
    Lab[..., 0] += warm * 1.2 * ska; Lab[..., 1] += warm * 0.8 * ska; Lab[..., 2] += warm * 1.2 * ska
    # ---- 4. sculpt (multiplicative on L; |dL| <= 2.5)
    sc = np.zeros((2048, 2048), np.float32)
    for sgn in (-1, 1):
        cx = CX + sgn * 345
        sc += 2.2 * ell(cx, 1240, 105, 60, .6)                         # cheekbone highlight
        sc += -2.2 * ell(CX + sgn * 560, 1560, 130, 150, .7)            # jaw / lower cheek falls off
        sc += -1.2 * ell(CX + sgn * 190, 1440, 80, 100, .7)             # beside the nose
    sc += 1.6 * ell(CX, 1180, 55, 160, .7)                              # nose bridge
    sc += 1.0 * ell(CX, 1750, 140, 70, .7)                              # chin front
    sca = to_atlas(sc); Lab[..., 0] += sculpt * sca
    # ---- 5. micro detail (L only, tiny chroma wobble)
    rng = np.random.default_rng(seed)
    g = lambda s: (lambda z: z / z.std())(ndi.gaussian_filter(rng.standard_normal((N, N)).astype(np.float32), s))
    grain = g(0.6); pore_n = g(1.1); pore = np.clip(-(pore_n - 1.1), 0, 3)      # sparse dark dots
    pore_bright = np.clip(g(1.6) - 1.4, 0, 3)
    fine = g(3.0) * 0.5 + g(7.0) * 0.5
    det = -3.2 * pore - 1.0 * pore_bright * -1 + 0.8 * grain + 0.9 * fine
    # fewer pores on forehead/temples than nose/cheeks: mild spatial modulation, none near hair/ears (those get grain only)
    mod = 0.6 + 0.4 * np.clip(g(60), -1.5, 1.5)
    wd = ska * (1 - exa) * pores
    Lab[..., 0] += wd * mod * det * 0.2
    Lab[..., 1] += wd * g(2.0) * 0.12 - wd * mod * np.minimum(det, 0) * 0.02; Lab[..., 2] += wd * g(2.0) * 0.12
    # stubble: sparse tiny dark dots in the beard zone (chin, jaw, upper lip), front-facing texels only
    beard = np.clip(ell(1050, 1700, 330, 170, .8) * 1.0 + ell(1050, 1520, 240, 60, .7) - lips, 0, 1)
    ba = to_atlas(beard) * (1 - exa); sd = np.clip(g(0.8) - 0.95, 0, 3)
    Lab[..., 0] -= 3.6 * ba * np.clip(sd, 0, 1.5) * pores; kk = 1 - 0.6 * ba * np.clip(sd, 0, 1); Lab[..., 1] *= kk; Lab[..., 2] *= kk
    res = A.copy(); rgb = np.clip(color.lab2rgb(Lab), 0, 1)
    wchg = skin.astype(np.float32)
    res = A * (1 - wchg[..., None]) + rgb * wchg[..., None]
    Image.fromarray((res * 255 + .5).astype(np.uint8)).save(out); print("wrote", out)
def smooth(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
if __name__ == "__main__":
    o = dict(x.split("=") for x in sys.argv[3:])
    main(sys.argv[1], sys.argv[2], float(o.get("pores", 1)), float(o.get("warm", 1)), float(o.get("sculpt", 1)), int(o.get("seed", 11)))
