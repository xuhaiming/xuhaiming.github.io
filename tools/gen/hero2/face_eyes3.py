"""Round 2 eyes: register the beautified eyes to the ORIGINAL eye shape (ECC affine on the front render), darken irises, project into the atlas.
python face_eyes3.py <in_atlas.png> <out_atlas.png>      (in_atlas = back-projected beautify result; original = hero_basecolor.png)
Writes face/w3/front_eyes3.png (front render crops for review)."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cv2
from face_lib import *
Image.MAX_IMAGE_PIXELS = None
WIN = [(690, 910), (1200, 1420)]; Y0, Y1 = 990, 1130
def lumf(c): return c @ np.array([.2126, .7152, .0722], np.float32)
def disk(r): y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r
def main(inp, out, dark=0.72):
    O = np.asarray(Image.open(os.path.join(W, "hero_basecolor.png")).convert("RGB"), np.float32) / 255
    A = np.asarray(Image.open(inp).convert("RGB"), np.float32) / 255
    P, UV, reg = load_mesh(); vt = np.load(os.path.join(F, "mesh.npz"))["vt"]
    v = View(); H = np.where(P.mean(1)[:, 1] > 1.46)[0]; H = H[np.isin(reg[H], [1, 2, 3, 6])]
    Ofr, mk, _, zb = render_view(P, UV, vt, O, v, H); Bfr = render_view(P, UV, vt, A, v, H)[0]
    E = Bfr.copy(); yy, xx = np.mgrid[:2048, :2048]
    wmask = np.zeros((2048, 2048), np.float32)
    for (x0, x1) in WIN:
        o = Ofr[Y0:Y1, x0:x1]; b = Bfr[Y0:Y1, x0:x1]
        go = cv2.GaussianBlur(lumf(o), (0, 0), 3).astype(np.float32); gb = cv2.GaussianBlur(lumf(b), (0, 0), 3).astype(np.float32)
        M = np.eye(2, 3, dtype=np.float32)
        cc, M = cv2.findTransformECC(go, gb, M, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-7), None, 5)
        print("ecc", round(cc, 3), M.round(3).tolist())
        wb = cv2.warpAffine(b, M, (x1 - x0, Y1 - Y0), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
        # eye mask = where the original is not plain skin around the eye: soft ellipse around the dark blob
        d = ndi.binary_opening(lumf(o) < .30, disk(7)); lab, n = ndi.label(d); sz = ndi.sum(d, lab, range(1, n + 1)); m = lab == np.argmax(sz) + 1
        ys, xs = np.nonzero(m); cx, cy = xs.mean(), ys.mean()
        gy, gx = np.mgrid[:Y1 - Y0, :x1 - x0]
        r = np.sqrt(((gx - cx) / 112.) ** 2 + ((gy - (cy - 4)) / 52.) ** 2)
        wm = np.clip((1.0 - r) / 0.3, 0, 1); wm = wm * wm * (3 - 2 * wm)
        # iris: dark, no blue catchlight
        iris = ndi.binary_opening(lumf(wb) < .38, disk(8)); lab, n = ndi.label(iris); sz = ndi.sum(iris, lab, range(1, n + 1)); iris = lab == np.argmax(sz) + 1
        iris = ndi.gaussian_filter(ndi.binary_closing(iris, disk(5)).astype(np.float32), 1.5)
        iris[:int(cy - 25)] = 0 if False else iris[:int(cy - 25)]
        c = wb.copy(); l = lumf(c)[..., None]
        c = np.where(iris[..., None] > 0, c, c)
        tint = np.array([1.0, 0.92, 0.85], np.float32)
        dk = c * dark; dk = np.minimum(dk, dk[..., :1] * 1.05)      # blue never above red: removes the cold reflection
        dk = dk * 0.6 + (l * dark * tint) * 0.4
        c = c * (1 - iris[..., None]) + dk * iris[..., None]
        E[Y0:Y1, x0:x1] = b * (1 - wm[..., None]) + c * wm[..., None]
        wmask[Y0:Y1, x0:x1] = np.maximum(wmask[Y0:Y1, x0:x1], wm)
    Image.fromarray((np.clip(E, 0, 1) * 255 + .5).astype(np.uint8)).save(os.path.join(F, "w3", "front_eyes3.png"))
    # project into atlas
    N = 4096; skin = np.where(np.isin(reg, [2, 3]))[0]
    pr = atlas_pass(P, UV, vt, v, skin, N, zb, 0.012)
    new = bilinear(blur_(E, 0.8), pr["px"], pr["py"])
    w = bilinear(wmask[..., None], pr["px"], pr["py"])[..., 0] * pr["vis"] * smooth_(.5, .8, pr["nz"])
    w = np.where(pr["mk"], ndi.gaussian_filter(w.astype(np.float32), 1.0), 0)
    res = A * (1 - w[..., None]) + new * w[..., None]
    Image.fromarray((np.clip(res, 0, 1) * 255 + .5).astype(np.uint8)).save(out); print("wrote", out, "texels", int((w > .5).sum()))
def blur_(img, s): return np.stack([ndi.gaussian_filter(img[..., c], s) for c in range(3)], -1)
def smooth_(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
if __name__ == "__main__": main(sys.argv[1], sys.argv[2])
