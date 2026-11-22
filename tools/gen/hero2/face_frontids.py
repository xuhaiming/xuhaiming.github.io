"""front view (2048, same camera as face_front.py) region-id buffer and 3D position buffer -> face/w3/front_ids.npz"""
import sys; sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from face_lib import *
P, UV, reg = load_mesh()
cen = P.mean(1)
sel = np.where(cen[:, 1] > 1.46)[0]; sel = sel[np.isin(reg[sel], [1, 2, 3, 6])]
lash = (reg == 1) & (cen[:, 2] > 0.03) & (cen[:, 1] > 1.595) & (cen[:, 1] < 1.652) & (np.abs(cen[:, 0] - 0.002) < 0.08)
v = View(); xy, z = v.px(P[sel])
rid = np.where(lash[sel], 7, reg[sel]).astype(np.float32)
out, mk, zb = raster(xy, np.repeat(rid[:, None, None], 3, 1), (2048, 2048), z)
pos, _, _ = raster(xy, P[sel], (2048, 2048), z)
np.savez_compressed(os.path.join(F, "w3", "front_ids.npz"), rid=np.rint(out[..., 0]).astype(np.uint8) * mk, pos=pos, mk=mk)
Image.fromarray((np.rint(out[..., 0]).astype(np.uint8) * 30)).crop((560, 800, 1560, 1200)).save(os.path.join(F, "w3", "ids_eyes.png"))
