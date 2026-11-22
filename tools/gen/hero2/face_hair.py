"""Hair surface: natural dark hair colour with fine strand variation (from the baked normal map), no skin-coloured patches.
python face_hair.py <in_atlas.png> <out_atlas.png> [amp=0.5] [base=0.075,0.064,0.058]"""
import sys; sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from face_lib import *
Image.MAX_IMAGE_PIXELS = None
def main(inp, out, amp=0.7, base=(0.072, 0.062, 0.056), seed=7):
    N = 4096
    a = np.asarray(Image.open(inp).convert("RGB"), np.float32) / 255
    nm = np.asarray(Image.open(os.path.join(W, "hero_normal.png")).convert("RGB"), np.float32) / 255 * 2 - 1
    P, UV, reg = load_mesh(); cen = P.mean(1)
    lash = (reg == 1) & (cen[:, 2] > 0.03) & (cen[:, 1] > 1.595) & (cen[:, 1] < 1.652) & (np.abs(cen[:, 0] - 0.002) < 0.08)
    sel = np.where((reg == 1) & ~lash & ~blob_tris(P, reg))[0]
    uvp = UV[sel].copy(); uvp[..., 1] = 1 - uvp[..., 1]; uvp *= N
    _, mk, _ = raster(uvp, np.ones((len(sel), 3, 1), np.float32), (N, N))
    rng = np.random.default_rng(seed)
    # strand streaks: signed slope of the normal map (changes sign across each strand), band-passed
    s = ndi.gaussian_filter(nm[..., 0], 1.0) - ndi.gaussian_filter(nm[..., 0], 6.0)
    s2 = ndi.gaussian_filter(nm[..., 1], 1.0) - ndi.gaussian_filter(nm[..., 1], 6.0)
    streak = s + 0.7 * s2; streak /= max(np.percentile(np.abs(streak[mk]), 95), 1e-4)
    low = ndi.gaussian_filter(rng.standard_normal((N, N)).astype(np.float32), 30); low /= low.std()
    grain = ndi.gaussian_filter(rng.standard_normal((N, N)).astype(np.float32), 0.8); grain /= grain.std()
    # fine hair lines: noise stretched along a slowly varying direction per area
    ang = ndi.gaussian_filter(rng.standard_normal((N // 8, N // 8)).astype(np.float32), 6) * 6.0
    ang = ndi.zoom(ang, 8, order=1)
    ln = ndi.gaussian_filter(rng.standard_normal((N, N)).astype(np.float32), (0.7, 7.0)); ln /= ln.std()
    ln2 = ndi.gaussian_filter(rng.standard_normal((N, N)).astype(np.float32), (7.0, 0.7)); ln2 /= ln2.std()
    lines = np.cos(ang) ** 2 * ln + np.sin(ang) ** 2 * ln2
    k = 1 + amp * (0.22 * np.clip(streak, -2, 2) + 0.25 * low + 0.18 * grain + 0.2 * lines)
    k = np.clip(k, 0.45, 1.9)
    col = np.array(base, np.float32)[None, None] * k[..., None]
    col[..., 2] *= 0.96 + 0.04 * np.clip(low, -2, 2)[...]      # tiny hue wander
    allp = UV.copy(); allp[..., 1] = 1 - allp[..., 1]; allp *= N
    _, anyt, _ = raster(allp, np.ones((len(allp), 3, 1), np.float32), (N, N))      # texels covered by any triangle (= not padding)
    pad = (ndi.maximum_filter(mk.astype(np.uint8), size=25) > 0) & ~anyt & ((a @ np.array([.2126, .7152, .0722], np.float32)) < 0.12)
    mk = mk | pad          # the 24 px padding of the hair islands takes the same colour (only where it was dark hair)
    res = a.copy()
    res[mk] = col[mk]
    Image.fromarray((np.clip(res, 0, 1) * 255 + .5).astype(np.uint8)).save(out)
    print("wrote", out, "hair texels", int(mk.sum()))
if __name__ == "__main__":
    o = dict(x.split("=") for x in sys.argv[3:])
    main(sys.argv[1], sys.argv[2], float(o.get("amp", .7)), tuple(float(v) for v in o["base"].split(",")) if "base" in o else (0.072, 0.062, 0.056))
