"""Back-project edited views onto the atlas (skin regions) and write the new base colour atlas.
python face_build.py <out_atlas.png> <front_edit.png> [<vtag> ...]      (vtag = tag of a face_views.py run: vin_<tag>.json + vout_<tag>.png)
Front edit = 1300 px crop at (380,450) of the 2048 front render (face_edit.py output, any size). Everything local, plain numpy."""
import sys; sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from face_lib import *
Image.MAX_IMAGE_PIXELS = None
FEATURE_BOXES = [(560, 780, 1500, 1260), (700, 1380, 1350, 1700)]   # front px: eyes + brows, mouth
FRONT_OUT = "front_v2.png"             # name of the saved adjusted front render (face_build3 changes it)
BLOBS = [(913, 526, 30)]                 # front px: dark speck on the forehead (hole in the hair mask)
IRIS_FRONT = [(380 + 415 * 1300 / 1280, 450 + 598 * 1300 / 1280), (380 + 920 * 1300 / 1280, 450 + 600 * 1300 / 1280)]
def smooth(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def blur(img, s): return np.stack([ndi.gaussian_filter(img[..., c], s) for c in range(img.shape[2])], -1)
def lum(img): return img @ np.array([.2126, .7152, .0722], np.float32)
def fill(img, mask, s=6):
    w = (~mask).astype(np.float32); num = blur(img * w[..., None], s); den = ndi.gaussian_filter(w, s)[..., None]
    return np.where(mask[..., None], num / np.maximum(den, 1e-4), img)
def fix_catchlights(img, centres, r=27, thr=0.5):
    """remove baked specular dots inside the irises (centres in image px; works for front view and atlas alike)"""
    yy, xx = np.mgrid[:img.shape[0], :img.shape[1]]
    m = np.zeros(img.shape[:2], bool); iris = np.zeros_like(m)
    for cx, cy in centres:
        d2 = (xx - cx) ** 2 + (yy - cy) ** 2
        m |= (d2 < r * r) & (lum(img) > thr); iris |= d2 < (r + 4) ** 2
    m = ndi.binary_dilation(m, iterations=4)
    dark = iris & ~m & (lum(img) < thr * .7)
    w = dark.astype(np.float32); num = blur(img * w[..., None], 7); den = ndi.gaussian_filter(w, 7)[..., None]
    out = img.copy(); f = num / np.maximum(den, 1e-4); out[m] = f[m]; return out

def process_view(P, UV, vt, reg, atlas, yaw, box, edit_png, front, iris3d, lowsig=70.0, lowmix=0.8, ztol=0.012):
    N = atlas.shape[0]
    head = np.where(P.mean(1)[:, 1] > 1.46)[0]; head = head[np.isin(reg[head], [1, 2, 3, 6])]
    v = View(yaw=yaw)
    orig, mk, uvb, zb = render_view(P, UV, vt, atlas, v, head)
    bw, bh = box[2] - box[0], box[3] - box[1]
    E = np.asarray(Image.open(edit_png).convert("RGB").resize((bw, bh), Image.LANCZOS), np.float32) / 255
    full = orig.copy(); full[box[1]:box[3], box[0]:box[2]] = E
    adj = np.clip(full + lowmix * (blur(orig, lowsig) - blur(full, lowsig)), 0, 1)
    yy, xx = np.mgrid[:orig.shape[0], :orig.shape[1]]
    if front:
        adj = fix_catchlights(adj, IRIS_FRONT)
    else:
        c2, _ = v.px(np.array(iris3d)); adj = fix_catchlights(adj, [tuple(c) for c in c2], r=24, thr=0.6)
    if front:
        for (bx, by, br) in BLOBS:
            m = ndi.binary_dilation(((xx - bx) ** 2 + (yy - by) ** 2 < br * br) & (lum(adj) < .3), iterations=6)
            adj = fill(adj, m, 10)
    mc = np.zeros(orig.shape[:2], np.float32); mc[box[1]:box[3], box[0]:box[2]] = 1
    mc = np.minimum(ndi.gaussian_filter(ndi.binary_erosion(mc > 0, iterations=50).astype(np.float32), 25), 1)
    d = np.abs(lum(blur(adj, 3)) - lum(blur(orig, 3)))
    guard = 1 - smooth(.12, .28, d)                    # hairline: do not drag hair colour onto skin
    if front:
        eb = ndi.gaussian_filter(((xx > 560) & (xx < 1500) & (yy > 780) & (yy < 1260)).astype(np.float32), 20)
        guard = guard * (1 - eb) + eb
    for (bx, by, br) in BLOBS:
        guard = np.maximum(guard, ndi.gaussian_filter((((xx - bx) ** 2 + (yy - by) ** 2) < (br * 1.3) ** 2).astype(np.float32), 6))
    pix_w = mc * guard
    if front: Image.fromarray((adj * 255 + .5).astype(np.uint8)).save(os.path.join(F, FRONT_OUT))
    cen = P.mean(1)
    lash = (reg == 1) & (cen[:, 2] > 0.03) & (cen[:, 1] > 1.595) & (cen[:, 1] < 1.652) & (np.abs(cen[:, 0] - 0.002) < 0.08)
    bt = blob_tris(P, reg)
    print("blob tris", int(bt.sum()))
    skin = np.where(np.isin(reg, [2, 3]) | lash | bt)[0]
    pr = atlas_pass(P, UV, vt, v, skin, N, zb, ztol)
    new = bilinear(blur(adj, 0.8), pr["px"], pr["py"])     # atlas density is about 0.56 of this render: prefilter against aliasing
    w = pr["vis"] * smooth(.15, .6, pr["nz"]) * bilinear(pix_w[..., None], pr["px"], pr["py"])[..., 0]
    w = np.where(pr["mk"], ndi.gaussian_filter(w.astype(np.float32), 1.2), 0)
    return new, w, np.clip(pr["nz"], 0, 1), pr, zb

def main(out_png, front_png, vtags):
    atlas = np.asarray(Image.open(os.path.join(W, "hero_basecolor.png")).convert("RGB"), np.float32) / 255
    N = atlas.shape[0]
    P, UV, reg = load_mesh(); vt = np.load(os.path.join(F, "mesh.npz"))["vt"]
    jobs = [(0.0, [380, 450, 1680, 1750], front_png, True)]
    for t in vtags:
        j = json.load(open(os.path.join(F, f"vin_{t}.json"))); jobs.append((j["yaw"], j["box"], os.path.join(F, f"vout_{t}.png"), False))
    f0 = View(); H0 = np.where(P.mean(1)[:, 1] > 1.46)[0]; H0 = H0[np.isin(reg[H0], [1, 2, 3, 6])]
    zb0 = render_view(P, UV, vt, atlas, f0, H0)[3]
    iris3d = [[(cx / f0.res - .5) * f0.s + f0.c[0], f0.c[1] + (.5 - cy / f0.res) * f0.s, float(zb0[int(cy), int(cx)])] for cx, cy in IRIS_FRONT]
    print("iris 3d", iris3d)
    acc = np.zeros_like(atlas); accw = np.zeros(atlas.shape[:2], np.float32); alpha = np.zeros_like(accw)
    for yaw, box, png, front in jobs:
        new, w, nz, pr, zb = process_view(P, UV, vt, reg, atlas, yaw, box, png, front, iris3d)
        if front:     # eyes, brows, mouth come from the front view only (side edits move the lids slightly)
            fx, fy = pr["px"], pr["py"]
            fb = np.zeros_like(w)
            for (x0, y0, x1, y1) in FEATURE_BOXES:
                fb = np.maximum(fb, ((fx > x0) & (fx < x1) & (fy > y0) & (fy < y1)).astype(np.float32))
            fb = np.where(pr["mk"], ndi.gaussian_filter(fb * pr["mk"], 6), 0)
            fb = np.where(pr["vis"] | (fb > 0), fb, 0)
        else:
            w = w * (1 - fb)
        wp = w * nz ** 4
        acc += new * wp[..., None]; accw += wp; alpha = np.maximum(alpha, w)
        print("view", yaw, "texels", int((w > .5).sum()))
    col = acc / np.maximum(accw, 1e-6)[..., None]
    res = atlas * (1 - alpha[..., None]) + col * alpha[..., None]
    Image.fromarray((np.clip(res, 0, 1) * 255 + .5).astype(np.uint8)).save(out_png)
    np.save(os.path.join(F, "weight.npy"), alpha.astype(np.float16))
    print("wrote", out_png)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
