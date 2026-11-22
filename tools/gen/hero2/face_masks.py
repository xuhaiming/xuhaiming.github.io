"""Atlas masks for round 2: region ids per texel, front-view coordinates of each texel, eye/brow/mouth/face masks. -> face/w3/masks.npz"""
import sys; sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from face_lib import *
Image.MAX_IMAGE_PIXELS = None
N = 4096
atlas = np.asarray(Image.open(os.path.join(W, "hero_basecolor.png")).convert("RGB"), np.float32) / 255
P, UV, reg = load_mesh(); vt = np.load(os.path.join(F, "mesh.npz"))["vt"]
uvp = UV.copy(); uvp[..., 1] = 1 - uvp[..., 1]; uvp *= N
cen = P.mean(1)
# region id image (nearest tri wins arbitrary): 0 none, region+1
rid, mk, _ = raster(uvp, np.repeat(reg[:, None, None] + 1, 3, 1).astype(np.float32), (N, N))
rid = np.rint(rid[..., 0]).astype(np.uint8)
# front-view coordinates of every face-island/head-skin texel
v = View()
head = np.where(cen[:, 1] > 1.46)[0]; head = head[np.isin(reg[head], [1, 2, 3, 6])]
zb = render_view(P, UV, vt, atlas, v, head)[3]
skin = np.where(np.isin(reg, [2, 3]))[0]
pr = atlas_pass(P, UV, vt, v, skin, N, zb, 0.012)
# 3D position per texel (x,y,z) for skin: interpolate
pos, mk2, _ = raster(uvp[skin], P[skin], (N, N))
nrm = vertex_normals_per_corner(P, vt)[skin]
nn, _, _ = raster(uvp[skin], nrm, (N, N))
np.savez_compressed(os.path.join(F, "w3", "masks.npz"), rid=rid, cover=mk, skin=mk2, px=pr["px"].astype(np.float32), py=pr["py"].astype(np.float32),
                    vis=pr["vis"], nz=pr["nz"].astype(np.float32), pos=pos.astype(np.float32), nrm=nn.astype(np.float32))
print("done", np.bincount(rid.ravel()))
