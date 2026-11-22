"""Shared helpers for the face texture pipeline (plain Python: numpy, PIL, scipy). Local only.
Mesh data comes from face_export.py (glTF space: +Y up, +Z front, character's left +X). Atlas image rows: row = (1 - v) * N."""
import numpy as np, os, json, time, urllib.request, urllib.parse
from PIL import Image
from scipy import ndimage as ndi

W = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "hero2")
F = os.path.join(W, "face")

def load_mesh():
    d = np.load(os.path.join(F, "mesh.npz"))
    return d["P"], d["UV"], d["region"]

def srgb2lin(c): return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
def lin2srgb(c): c = np.clip(c, 0, 1); return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)

def raster(xy, attr, size, depth=None):
    """xy (N,3,2) target pixel coords (pixel centres at +.5), attr (N,3,K), depth (N,3) or None. Returns (H,W,K) attrs, mask, depth.
    Nearest depth wins when depth is given (larger = nearer)."""
    Wd, Hd = size
    K = attr.shape[2]
    out = np.zeros((Hd, Wd, K), np.float32); zb = np.full((Hd, Wd), -1e9, np.float32); mk = np.zeros((Hd, Wd), bool)
    for i in range(len(xy)):
        p = xy[i]
        x0 = max(int(np.floor(p[:, 0].min() - .5)), 0); x1 = min(int(np.ceil(p[:, 0].max() + .5)), Wd - 1)
        y0 = max(int(np.floor(p[:, 1].min() - .5)), 0); y1 = min(int(np.ceil(p[:, 1].max() + .5)), Hd - 1)
        if x1 < x0 or y1 < y0: continue
        d = (p[1, 1] - p[2, 1]) * (p[0, 0] - p[2, 0]) + (p[2, 0] - p[1, 0]) * (p[0, 1] - p[2, 1])
        if abs(d) < 1e-9: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
        a = ((p[1, 1] - p[2, 1]) * (gx - p[2, 0]) + (p[2, 0] - p[1, 0]) * (gy - p[2, 1])) / d
        b = ((p[2, 1] - p[0, 1]) * (gx - p[2, 0]) + (p[0, 0] - p[2, 0]) * (gy - p[2, 1])) / d
        c = 1 - a - b
        e = -1e-4
        m = (a >= e) & (b >= e) & (c >= e)
        if not m.any(): continue
        if depth is not None:
            z = a * depth[i, 0] + b * depth[i, 1] + c * depth[i, 2]
            sub = zb[y0:y1 + 1, x0:x1 + 1]
            m &= z > sub
            if not m.any(): continue
            sub[m] = z[m]
        val = a[..., None] * attr[i, 0] + b[..., None] * attr[i, 1] + c[..., None] * attr[i, 2]
        out[y0:y1 + 1, x0:x1 + 1][m] = val[m]; mk[y0:y1 + 1, x0:x1 + 1] |= m
    return out, mk, zb

def bilinear(img, u, v):
    """img (H,W,C) float, u v in pixel coords (continuous, pixel centres at +.5)."""
    H, Wd = img.shape[:2]
    return np.stack([ndi.map_coordinates(img[..., c], [v - .5, u - .5], order=1, mode="nearest") for c in range(img.shape[2])], -1)

class View:
    """orthographic camera along -dir looking at centre; image x to the right, y up (glTF coords)."""
    def __init__(self, cx=0.0, cy=1.62, size=0.26, res=2048, yaw=0.0):
        self.c = np.array([cx, cy, 0.0]); self.s = size; self.res = res; self.yaw = np.radians(yaw)
        ca, sa = np.cos(self.yaw), np.sin(self.yaw)
        self.R = np.array([[ca, 0, -sa], [0, 1, 0], [sa, 0, ca]])    # world -> camera rotation about Y (yaw>0 turns the head towards +x side visible)
    def cam(self, P):   # P (...,3) -> camera coords
        return (P - self.c * np.array([1, 1, 0])) @ self.R.T
    def px(self, P):
        q = self.cam(P)
        return np.stack([(q[..., 0] / self.s + .5) * self.res, (.5 - (q[..., 1] - 0) / self.s) * self.res], -1), q[..., 2]
    def nrm(self, N): return N @ self.R.T

def tri_normals(P):
    n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]); return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)

def vertex_normals_per_corner(P, vt):
    """area-weighted smooth normals per corner (N,3,3), welded by vertex index vt."""
    nv = vt.max() + 1; fn = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    acc = np.zeros((nv, 3)); 
    for k in range(3): np.add.at(acc, vt[:, k], fn)
    acc /= np.maximum(np.linalg.norm(acc, axis=1, keepdims=True), 1e-12)
    return acc[vt]

def render_view(P, UV, vt, atlas, view, sel):
    """render the selected triangles through the atlas, flat. Returns rgb (H,W,3) float sRGB, mask, uv buffer (H,W,2) in 0..1, depth."""
    N = atlas.shape[0]
    xy, z = view.px(P[sel]); 
    attr = UV[sel]
    out, mk, zb = raster(xy, attr, (view.res, view.res), z)
    u = out[..., 0] * N; v = (1 - out[..., 1]) * N
    rgb = bilinear(atlas, u, v)
    return rgb, mk, out, zb

def atlas_pass(P, UV, vt, view, sel, N, zb, ZTOL=0.004):
    """for atlas texels covered by selected triangles: screen position, facing weight, visibility. Returns dict of (N,N) arrays."""
    xy, z = view.px(P[sel]); 
    nc = vertex_normals_per_corner(P, vt)[sel]
    nz = view.nrm(nc)[..., 2:3]
    uvp = UV[sel].copy(); uvp[..., 1] = 1 - uvp[..., 1]; uvp *= N
    attr = np.concatenate([xy, z[..., None], nz], -1)      # x, y, z, nz
    out, mk, _ = raster(uvp, attr, (N, N), None)
    px, py, pz, nzv = out[..., 0], out[..., 1], out[..., 2], out[..., 3]
    ix = np.clip(px.astype(int), 0, view.res - 1); iy = np.clip(py.astype(int), 0, view.res - 1)
    zbuf = ndi.maximum_filter(zb, size=3)         # tolerate 1 px offsets
    vis = mk & (px > 0) & (px < view.res) & (py > 0) & (py < view.res) & (pz > zbuf[iy, ix] - ZTOL)
    return dict(px=px, py=py, vis=vis, nz=nzv, mk=mk)

# ---------------------------------------------------------------- ComfyUI
HOST = "http://127.0.0.1:8188"
COMFY_INPUT = r"C:\projects\ComfyUI\input"
def _post(path, data):
    req = urllib.request.Request(HOST + path, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))
def run_graph(g, out_node):
    try: pid = _post("/prompt", {"prompt": g})["prompt_id"]
    except urllib.error.HTTPError as e: raise RuntimeError(e.read().decode()[:3000])
    while True:
        hist = json.load(urllib.request.urlopen(HOST + "/history/" + pid))
        if pid in hist: break
        time.sleep(1)
    ent = hist[pid]
    if ent.get("status", {}).get("status_str") != "success": raise RuntimeError(json.dumps(ent.get("status"))[:3000])
    im = ent["outputs"][out_node]["images"][0]
    q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im["subfolder"], "type": im["type"]})
    import io
    return Image.open(io.BytesIO(urllib.request.urlopen(HOST + "/view?" + q).read())).convert("RGB")

def blob_tris(P, reg, X=-0.0141, Y=1.6832, R=0.0085):
    """hair-region sliver on the forehead (hole in the hair mask): treated as skin by face_build.py and left alone by face_hair.py"""
    c = P.mean(1)
    return (reg == 1) & (c[:, 2] > 0.05) & (np.hypot(c[:, 0] - X, c[:, 1] - Y) < R)
