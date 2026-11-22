"""Round 2 back-projection: like face_build.py but the base is hero_basecolor_v2.png and the edits are the Qwen beautify outputs (vout3_*).
python face_build3.py <out_atlas.png> <front_edit.png> <vtag> ...     (writes face/weight3.npy)"""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import face_build as fb
from face_lib import *
fb.FRONT_OUT = "w3/front_v3_adj.png"
FRONT_BOX = [380, 450, 1680, 1750]
def main(out_png, front_png, vtags, lowmix=0.85):
    atlas = np.asarray(Image.open(os.path.join(F, "hero_basecolor_v2.png")).convert("RGB"), np.float32) / 255
    P, UV, reg = load_mesh(); vt = np.load(os.path.join(F, "mesh.npz"))["vt"]
    jobs = [(0.0, FRONT_BOX, front_png, True)]
    for t in vtags:
        j = json.load(open(os.path.join(F, f"vin3_{t}.json"))); jobs.append((j["yaw"], j["box"], os.path.join(F, f"vout3_{t}.png"), False))
    f0 = View(); H0 = np.where(P.mean(1)[:, 1] > 1.46)[0]; H0 = H0[np.isin(reg[H0], [1, 2, 3, 6])]
    zb0 = render_view(P, UV, vt, atlas, f0, H0)[3]
    iris3d = [[(cx / f0.res - .5) * f0.s + f0.c[0], f0.c[1] + (.5 - cy / f0.res) * f0.s, float(zb0[int(cy), int(cx)])] for cx, cy in fb.IRIS_FRONT]
    N = atlas.shape[0]
    acc = np.zeros_like(atlas); accw = np.zeros(atlas.shape[:2], np.float32); alpha = np.zeros_like(accw)
    for yaw, box, png, front in jobs:
        new, w, nz, pr, zb = fb.process_view(P, UV, vt, reg, atlas, yaw, box, png, front, iris3d, lowmix=lowmix)
        if front:
            fx, fy = pr["px"], pr["py"]; featb = np.zeros_like(w)
            for (x0, y0, x1, y1) in fb.FEATURE_BOXES:
                featb = np.maximum(featb, ((fx > x0) & (fx < x1) & (fy > y0) & (fy < y1)).astype(np.float32))
            featb = np.where(pr["mk"], ndi.gaussian_filter(featb * pr["mk"], 6), 0); featb = np.where(pr["vis"] | (featb > 0), featb, 0)
        else:
            w = w * (1 - featb)
        wp = w * nz ** 4
        acc += new * wp[..., None]; accw += wp; alpha = np.maximum(alpha, w)
        print("view", yaw, "texels", int((w > .5).sum()), flush=True)
    col = acc / np.maximum(accw, 1e-6)[..., None]
    res = atlas * (1 - alpha[..., None]) + col * alpha[..., None]
    Image.fromarray((np.clip(res, 0, 1) * 255 + .5).astype(np.uint8)).save(out_png)
    np.save(os.path.join(F, "w3", "weight3.npy"), alpha.astype(np.float16)); print("wrote", out_png)
if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
