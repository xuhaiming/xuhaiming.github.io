"""Render 3/4 views, auto crop around the skin, run the Klein edit. python face_views.py <yaw> <seed> <denoise> <tag>"""
import sys; sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from face_lib import *
from face_edit import edit
PROMPT = ("A sharp high resolution studio portrait photograph of this same man, identical face, identical eye shape, nose, brows, ears and mouth in exactly the same positions. "
 "Flat even soft lighting without shadows, no specular highlights. Crisp dark brown irises with pupils, defined natural eyebrows made of individual hairs, natural eyelashes, "
 "healthy even skin with fine natural skin texture, natural lips with a relaxed very slight friendly closed-mouth smile, short natural black hair with fine individual strands.")
def crop_for(P, reg, v, mask_px):
    ys, xs = np.where(mask_px); return xs.min(), ys.min(), xs.max(), ys.max()
def run(yaw, seed, dn, tag, prompt=PROMPT):
    atlas = np.asarray(Image.open(os.path.join(W, "hero_basecolor.png")).convert("RGB"), np.float32) / 255
    P, UV, reg = load_mesh()
    head = np.where(P.mean(1)[:, 1] > 1.46)[0]; head = head[np.isin(reg[head], [1, 2, 3, 6])]
    v = View(yaw=yaw)
    rgb, mk, uvb, zb = render_view(P, UV, None, atlas, v, head)
    img = np.where(mk[..., None], rgb, .5)
    skin = head[np.isin(reg[head], [2, 3])]
    xy, _ = v.px(P[skin]); x0, y0 = xy.reshape(-1, 2).min(0); x1, y1 = xy.reshape(-1, 2).max(0)
    y1 = min(y1, 1750); y0 = max(y0 - 150, 0)       # a little hair above, neck stops at the collar
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; s = max(x1 - x0, y1 - y0) * 1.06
    box = [int(cx - s / 2), int(cy - s / 2), int(cx + s / 2), int(cy + s / 2)]
    box[0] = max(box[0], 0); box[1] = max(box[1], 0); box[2] = min(box[2], 2048); box[3] = min(box[3], 2048)
    print("box", box)
    Image.fromarray((img * 255 + .5).astype(np.uint8)).crop(box).save(os.path.join(F, f"vin_{tag}.png"))
    json.dump(dict(yaw=yaw, box=box), open(os.path.join(F, f"vin_{tag}.json"), "w"))
    n = min(box[2] - box[0], 1536)
    edit(os.path.join(F, f"vin_{tag}.png"), os.path.join(F, f"vout_{tag}.png"), seed, dn, prompt, 16, n)
if __name__ == "__main__":
    a = sys.argv; run(float(a[1]), int(a[2]), float(a[3]), a[4])
