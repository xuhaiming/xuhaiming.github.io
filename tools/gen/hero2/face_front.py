"""render flat front view (and uv buffer) of the head from the atlas. python face_front.py [atlas.png] [out_prefix] [yaw]"""
import sys; sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from face_lib import *
atlas_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(W, "hero_basecolor.png")
pref = sys.argv[2] if len(sys.argv) > 2 else os.path.join(F, "front")
yaw = float(sys.argv[3]) if len(sys.argv) > 3 else 0
Image.MAX_IMAGE_PIXELS = None
atlas = np.asarray(Image.open(atlas_path).convert("RGB"), np.float32) / 255
P, UV, reg = load_mesh()
sel = np.where(P.mean(1)[:, 1] > 1.46)[0]
sel = sel[np.isin(reg[sel], [1, 2, 3, 6])]
v = View(yaw=yaw)
t = time.time()
rgb, mk, uvb, zb = render_view(P, UV, None, atlas, v, sel)
print("render", time.time() - t)
img = np.where(mk[..., None], rgb, 0.5)
Image.fromarray((img * 255 + .5).astype(np.uint8)).save(pref + ".png")
Image.fromarray((mk * 255).astype(np.uint8)).save(pref + "_mask.png")
