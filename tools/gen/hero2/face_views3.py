"""Round 2: render a view of the v2 atlas and beautify it with Qwen Image Edit 2.1 (local ComfyUI).
python face_views3.py <yaw> <seed> <denoise> <tag> [atlas=face/hero_basecolor_v2.png]   -> face/vin3_<tag>.png/json, vout3_<tag>.png"""
import sys; sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from face_lib import *
from face_cand import qwen, HANDSOME
def run(yaw, seed, dn, tag, atlas_path=os.path.join(F, "hero_basecolor_v2.png"), prompt=HANDSOME):
    atlas = np.asarray(Image.open(atlas_path).convert("RGB"), np.float32) / 255
    P, UV, reg = load_mesh()
    head = np.where(P.mean(1)[:, 1] > 1.46)[0]; head = head[np.isin(reg[head], [1, 2, 3, 6])]
    v = View(yaw=yaw)
    rgb, mk, uvb, zb = render_view(P, UV, None, atlas, v, head)
    img = np.where(mk[..., None], rgb, .5)
    skin = head[np.isin(reg[head], [2, 3])]
    xy, _ = v.px(P[skin]); x0, y0 = xy.reshape(-1, 2).min(0); x1, y1 = xy.reshape(-1, 2).max(0)
    y1 = min(y1, 1750); y0 = max(y0 - 150, 0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; s = max(x1 - x0, y1 - y0) * 1.06
    box = [int(cx - s / 2), int(cy - s / 2), int(cx + s / 2), int(cy + s / 2)]
    box[0] = max(box[0], 0); box[1] = max(box[1], 0); box[2] = min(box[2], 2048); box[3] = min(box[3], 2048)
    print("box", box)
    Image.fromarray((img * 255 + .5).astype(np.uint8)).crop(box).save(os.path.join(F, f"vin3_{tag}.png"))
    json.dump(dict(yaw=yaw, box=box), open(os.path.join(F, f"vin3_{tag}.json"), "w"))
    qwen(os.path.join(F, f"vin3_{tag}.png"), os.path.join(F, f"vout3_{tag}.png"), seed, dn, prompt, 8, 1024)
if __name__ == "__main__":
    a = sys.argv; run(float(a[1]), int(a[2]), float(a[3]), a[4])
