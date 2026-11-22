"""Stage 1e: bake base colour, tangent-space normal and metallic-roughness from the source mesh onto the low-poly atlas,
apply the hair fix, build the final material, save hero_mesh.blend and export hero_mesh.glb.
usage: blender -b -P hero2/s5_bake.py -- <hero_hi.blend> <hero_uv.blend> <out_dir> [res=4096] [ss=2] [glb_base=2048] [glb_normal=2048] [glb_mr=1024]

The transfer is a closest-point projection done here in numpy (not Cycles ray baking): every atlas texel is mapped to its
point on the low-poly surface, the nearest point on the 2M-triangle source is looked up in a BVH, and colour, MR and the
smooth source normal are read there. Closest-point lookup cannot shoot through the gaps between fingers or hair strands
the way cage rays do. Normals are converted to the MikkTSpace tangent frame of the low mesh (the one Blender, the glTF
exporter and three.js with exported tangents use). ss = supersampling per axis.
Outputs in <out_dir>: hero_basecolor.png, hero_normal.png, hero_mr.png (glTF packing: G roughness, B metallic),
hero_basecolor_nofix.png (before the hair fix, for comparison), hero_hairfix_mask.png, hero_mesh.blend, hero_mesh.glb."""
import bpy, sys, os, json, math
import numpy as np
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

pos, opt = args()
hi_path, uv_path, out_dir = (os.path.abspath(p) for p in pos[:3])
RES = int(opt.get("res", 4096)); SS = int(opt.get("ss", 2)); N = RES * SS
DILATE = int(opt.get("dilate", 24))

bpy.ops.wm.open_mainfile(filepath=hi_path)
hi = bpy.data.objects["HeroHi"]; hme = hi.data
with bpy.data.libraries.load(uv_path, link=False) as (src, dst):
    dst.objects = ["Hero"]
low = dst.objects[0]; bpy.context.scene.collection.objects.link(low); lme = low.data

# ------------------------------------------------------------------ low mesh: rasterise the atlas
lco = coords(lme).astype(np.float32)
npoly = len(lme.polygons)
lpv = np.empty(npoly * 3, np.int64); lme.polygons.foreach_get("vertices", lpv); lpv = lpv.reshape(-1, 3)
luv = np.empty(len(lme.loops) * 2, np.float64); lme.uv_layers[0].data.foreach_get("uv", luv); luv = luv.reshape(-1, 3, 2)
lme.calc_tangents(uvmap=lme.uv_layers[0].name)
ltan = np.empty(len(lme.loops) * 3, np.float32); lme.loops.foreach_get("tangent", ltan); ltan = ltan.reshape(-1, 3, 3)
lsign = np.empty(len(lme.loops), np.float32); lme.loops.foreach_get("bitangent_sign", lsign); lsign = lsign.reshape(-1, 3)
lnor = np.empty(len(lme.loops) * 3, np.float32); lme.loops.foreach_get("normal", lnor); lnor = lnor.reshape(-1, 3, 3)
freg = np.zeros(npoly, np.int32); lme.attributes["uv_region"].data.foreach_get("value", freg)

tri_id = np.full((N, N), -1, np.int32)
bw1 = np.zeros((N, N), np.float32); bw2 = np.zeros((N, N), np.float32)
P = luv * N
overlap = 0
for t in range(npoly):
    a, b, c = P[t]
    x0 = max(int(math.floor(min(a[0], b[0], c[0]) - 0.5)), 0); x1 = min(int(math.ceil(max(a[0], b[0], c[0]) + 0.5)), N - 1)
    y0 = max(int(math.floor(min(a[1], b[1], c[1]) - 0.5)), 0); y1 = min(int(math.ceil(max(a[1], b[1], c[1]) + 0.5)), N - 1)
    d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
    if abs(d) < 1e-9 or x1 < x0 or y1 < y0: continue
    xs = np.arange(x0, x1 + 1) + 0.5; ys = (np.arange(y0, y1 + 1) + 0.5)[:, None]
    w1 = ((xs - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (ys - a[1])) / d
    w2 = ((b[0] - a[0]) * (ys - a[1]) - (xs - a[0]) * (b[1] - a[1])) / d
    inside = (w1 >= -1e-6) & (w2 >= -1e-6) & (w1 + w2 <= 1 + 1e-6)
    if not inside.any(): continue
    sub = tri_id[y0:y1 + 1, x0:x1 + 1]
    overlap += int((sub[inside] >= 0).sum())
    sub[inside] = t
    bw1[y0:y1 + 1, x0:x1 + 1][inside] = w1[inside]; bw2[y0:y1 + 1, x0:x1 + 1][inside] = w2[inside]
cov = tri_id >= 0
yy, xx = np.nonzero(cov)
T = tri_id[yy, xx]; W1 = bw1[yy, xx]; W2 = bw2[yy, xx]; W0 = 1 - W1 - W2
del bw1, bw2, tri_id
nt = len(T)
log("atlas", N, "covered texels", nt, "= %.1f%%" % (100 * nt / N / N), "texels written twice (uv overlaps)", overlap, "= %.2f%%" % (100 * overlap / nt))

def interp(vals):      # vals: (npoly, 3, k) per corner
    return vals[T, 0] * W0[:, None] + vals[T, 1] * W1[:, None] + vals[T, 2] * W2[:, None]
pos_l = interp(lco[lpv])
nor_l = interp(lnor); tan_l = interp(ltan); sgn = lsign[T, 0]
nor_ln = nor_l / np.maximum(np.linalg.norm(nor_l, axis=1, keepdims=True), 1e-9)

# ------------------------------------------------------------------ source mesh: closest point
hco = coords(hme).astype(np.float32)
htri = tri_array(hme)
hloop_tri = np.empty(len(hme.loop_triangles) * 3, np.int64); hme.loop_triangles.foreach_get("loops", hloop_tri); hloop_tri = hloop_tri.reshape(-1, 3)
huv = np.empty(len(hme.loops) * 2, np.float32); hme.uv_layers[0].data.foreach_get("uv", huv); huv = huv.reshape(-1, 2)
hvn = np.empty(len(hme.vertices) * 3, np.float32); hme.vertex_normals.foreach_get("vector", hvn); hvn = hvn.reshape(-1, 3)
hfix = np.zeros(len(hme.vertices), np.float32); hme.attributes["hairfix"].data.foreach_get("value", hfix)
hhair = np.zeros(len(hme.vertices), np.float32); hme.attributes["hair"].data.foreach_get("value", hhair)
log("building BVH over", len(htri), "triangles")
bvh = BVHTree.FromPolygons(hco.tolist(), htri.tolist(), all_triangles=True)
log("querying", nt, "points")
H = np.empty(nt, np.int64)
fn = bvh.find_nearest
CH = 2_000_000
for s in range(0, nt, CH):
    chunk = pos_l[s:s + CH].tolist()
    H[s:s + CH] = np.fromiter((fn(p)[2] for p in chunk), np.int64, count=len(chunk))
log("queried")

def bary_on(tri_idx, p):
    """barycentric coordinates of the point of triangle tri_idx closest to p (projection, clamped)"""
    A = hco[htri[tri_idx, 0]]; B = hco[htri[tri_idx, 1]]; C = hco[htri[tri_idx, 2]]
    v0 = (B - A).astype(np.float64); v1 = (C - A).astype(np.float64); v2 = (p - A).astype(np.float64)
    d00 = (v0 * v0).sum(1); d01 = (v0 * v1).sum(1); d11 = (v1 * v1).sum(1); d20 = (v2 * v0).sum(1); d21 = (v2 * v1).sum(1)
    den = np.maximum(d00 * d11 - d01 * d01, 1e-30)
    v = (d11 * d20 - d01 * d21) / den; w = (d00 * d21 - d01 * d20) / den
    u = 1 - v - w
    b = np.clip(np.stack([u, v, w], 1), 0, None); b /= np.maximum(b.sum(1, keepdims=True), 1e-9)
    return b.astype(np.float32)

def hi_normal(tri_idx, b):
    n = hvn[htri[tri_idx, 0]] * b[:, :1] + hvn[htri[tri_idx, 1]] * b[:, 1:2] + hvn[htri[tri_idx, 2]] * b[:, 2:]
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)

Bc = np.empty((nt, 3), np.float32); nor_h = np.empty((nt, 3), np.float32); dist = np.empty(nt, np.float32)
for s in range(0, nt, CH):
    e = slice(s, s + CH)
    Bc[e] = bary_on(H[e], pos_l[e]); nor_h[e] = hi_normal(H[e], Bc[e])
    hp = hco[htri[H[e], 0]] * Bc[e, :1] + hco[htri[H[e], 1]] * Bc[e, 1:2] + hco[htri[H[e], 2]] * Bc[e, 2:]
    dist[e] = np.linalg.norm(hp - pos_l[e], axis=1)
log("projection distance mm: median %.3f p95 %.3f p99 %.3f max %.2f" % tuple(np.percentile(dist, [50, 95, 99, 100]) * 1000))
# texels whose nearest source point faces the other way (other side of a thin sheet): take the nearest front-facing one
bad = np.where((nor_h * nor_ln).sum(1) < 0.0)[0]
log("back-facing matches", len(bad), "= %.2f%%" % (100 * len(bad) / nt))
fixed = 0
fr = bvh.find_nearest_range
for i in bad.tolist():
    p = pos_l[i]; nl = nor_ln[i]; best = None
    for loc, nrm, idx, d in fr(p.tolist(), float(dist[i]) + 0.006):
        if nrm.x * nl[0] + nrm.y * nl[1] + nrm.z * nl[2] > 0.2 and (best is None or d < best[1]): best = (idx, d)
    if best: H[i] = best[0]; fixed += 1
if len(bad):
    Bc[bad] = bary_on(H[bad], pos_l[bad]); nor_h[bad] = hi_normal(H[bad], Bc[bad])
log("re-matched", fixed)
del bvh

# ------------------------------------------------------------------ sample the source textures
def image_px(colorspace):
    img = next(i for i in bpy.data.images if i.colorspace_settings.name == colorspace and i.size[0] > 1000)
    W, Hh = img.size
    px = np.empty(W * Hh * 4, np.float32); img.pixels.foreach_get(px)
    return px.reshape(Hh, W, 4)[:, :, :3].copy()

def half(px):
    return (px[0::2, 0::2] + px[1::2, 0::2] + px[0::2, 1::2] + px[1::2, 1::2]) * 0.25

def bilinear(px, uv):
    Hh, W = px.shape[:2]
    x = (uv[:, 0] % 1.0) * W - 0.5; y = (uv[:, 1] % 1.0) * Hh - 0.5
    x0 = np.floor(x).astype(np.int64); y0 = np.floor(y).astype(np.int64)
    fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    x1 = np.clip(x0 + 1, 0, W - 1); y1 = np.clip(y0 + 1, 0, Hh - 1); x0 = np.clip(x0, 0, W - 1); y0 = np.clip(y0, 0, Hh - 1)
    return (px[y0, x0] * (1 - fx) + px[y0, x1] * fx) * (1 - fy) + (px[y1, x0] * (1 - fx) + px[y1, x1] * fx) * fy

uv_h = np.empty((nt, 2), np.float32)
for s in range(0, nt, CH):
    e = slice(s, s + CH)
    uv_h[e] = huv[hloop_tri[H[e], 0]] * Bc[e, :1] + huv[hloop_tri[H[e], 1]] * Bc[e, 1:2] + huv[hloop_tri[H[e], 2]] * Bc[e, 2:]
# clothes are minified a lot in the atlas: read them from a half-size copy of the source texture to avoid aliasing
is_body = freg[T] == 0
def sample(colorspace):
    px = image_px(colorspace); out = np.empty((nt, 3), np.float32)
    for s in range(0, nt, CH):
        out[s:s + CH] = bilinear(px, uv_h[s:s + CH])
    px2 = half(px); del px
    idx = np.where(is_body)[0]
    for s in range(0, len(idx), CH):
        out[idx[s:s + CH]] = bilinear(px2, uv_h[idx[s:s + CH]])
    return out
col = sample("sRGB"); log("sampled base colour")
mr = sample("Non-Color"); log("sampled metallic-roughness")
fixm = hfix[htri[H, 0]] * Bc[:, 0] + hfix[htri[H, 1]] * Bc[:, 1] + hfix[htri[H, 2]] * Bc[:, 2]
hairm = hhair[htri[H, 0]] * Bc[:, 0] + hhair[htri[H, 1]] * Bc[:, 1] + hhair[htri[H, 2]] * Bc[:, 2]

# ------------------------------------------------------------------ hair fix: patches on the hair that were left skin-coloured
pure_hair = (hairm > 0.99) & (fixm < 0.01)
hair_col = np.median(col[pure_hair], 0); hair_mr = np.median(mr[pure_hair], 0)
def sstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
lum = col @ np.array([0.299, 0.587, 0.114], np.float32)
hair_lum = float(np.median(lum[pure_hair]))
# (a) the patches found on the source mesh, (b) anything inside the hair mask that is still clearly lighter than hair
# (brownish strand tips that were dark enough to count as hair but not black)
m = np.maximum(sstep(fixm, 0.1, 0.5), sstep(hairm, 0.5, 0.9) * sstep(lum, 1.5 * hair_lum, 2.8 * hair_lum))[:, None]
target = hair_col[None, :] * (0.92 + 0.25 * np.clip(lum, 0, 1))[:, None]       # keeps a trace of the strand shading
col_nofix = col.copy()
col = col * (1 - m) + target * m
mr = mr * (1 - m) + hair_mr[None, :] * m
log("hair colour", hair_col.round(4), "hair MR", hair_mr.round(3), "texels changed", int((m[:, 0] > 0.02).sum()))

# ------------------------------------------------------------------ tangent-space normal
Bt = sgn[:, None] * np.cross(nor_l, tan_l)
det = (np.cross(tan_l, Bt) * nor_l).sum(1)
det = np.where(np.abs(det) < 1e-9, 1e-9, det)[:, None]
tn = np.stack([(np.cross(Bt, nor_l) * nor_h).sum(1), (np.cross(nor_l, tan_l) * nor_h).sum(1), (np.cross(tan_l, Bt) * nor_h).sum(1)], 1) / det
del Bt, tan_l
tn[tn[:, 2] < 0.05, 2] = 0.05                                                 # never point into the surface
tn /= np.maximum(np.linalg.norm(tn, axis=1, keepdims=True), 1e-9)
log("tangent normal z: median %.3f p5 %.3f" % tuple(np.percentile(tn[:, 2], [50, 5])))

# ------------------------------------------------------------------ assemble, downsample, dilate, save
def to_image(vals, fill):
    k = vals.shape[1]
    full = np.zeros((N, N, k), np.float32); full[yy, xx] = vals
    w = cov.astype(np.float32)
    if SS > 1:
        full = full.reshape(RES, SS, RES, SS, k).sum((1, 3)); w = w.reshape(RES, SS, RES, SS).sum((1, 3))
        full /= np.maximum(w, 1)[:, :, None]
    have = w > 0
    for _ in range(DILATE):                                                  # edge padding
        if have.all(): break
        acc = np.zeros_like(full); cnt = np.zeros((RES, RES), np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            sh = np.roll(np.roll(full * have[:, :, None], dy, 0), dx, 1); sc = np.roll(np.roll(have, dy, 0), dx, 1).astype(np.float32)
            if dy == 1: sh[0] = 0; sc[0] = 0
            if dy == -1: sh[-1] = 0; sc[-1] = 0
            if dx == 1: sh[:, 0] = 0; sc[:, 0] = 0
            if dx == -1: sh[:, -1] = 0; sc[:, -1] = 0
            acc += sh; cnt += sc
        new = (~have) & (cnt > 0)
        full[new] = acc[new] / cnt[new][:, None]; have = have | new
    full[~have] = np.array(fill, np.float32)
    return full

def save(name, arr, colorspace):
    img = bpy.data.images.get(name) or bpy.data.images.new(name, RES, RES, alpha=False)
    img.colorspace_settings.name = colorspace
    rgba = np.concatenate([np.clip(arr, 0, 1), np.ones((RES, RES, 1), np.float32)], 2)
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = os.path.join(out_dir, name + ".png"); img.file_format = "PNG"; img.save()
    log("wrote", img.filepath_raw)
    return img

nimg = to_image(tn, (0, 0, 1)); nimg /= np.maximum(np.linalg.norm(nimg, axis=2, keepdims=True), 1e-9)
img_n = save("hero_normal", nimg * 0.5 + 0.5, "Non-Color"); del nimg
save("hero_basecolor_nofix", to_image(col_nofix, tuple(hair_col)), "sRGB")
save("hero_hairfix_mask", to_image(np.repeat(m, 3, 1), (0, 0, 0)), "Non-Color")
img_c = save("hero_basecolor", to_image(col, tuple(hair_col)), "sRGB")
img_mr = save("hero_mr", to_image(mr, (0, 0.6, 0)), "Non-Color")
for nme in ("hero_basecolor_nofix", "hero_hairfix_mask"): bpy.data.images.remove(bpy.data.images[nme])

# ------------------------------------------------------------------ final material and files
mat = bpy.data.materials.new("Hero"); mat.use_nodes = True
ntree = mat.node_tree; bsdf = ntree.nodes["Principled BSDF"]
def tex(img, x, y):
    n = ntree.nodes.new("ShaderNodeTexImage"); n.image = img; n.location = (x, y); return n
tc = tex(img_c, -700, 300); tm = tex(img_mr, -700, 0); tnn = tex(img_n, -700, -300)
sep = ntree.nodes.new("ShaderNodeSeparateColor"); sep.location = (-380, 0)
nm = ntree.nodes.new("ShaderNodeNormalMap"); nm.location = (-380, -300); nm.uv_map = lme.uv_layers[0].name
ntree.links.new(tc.outputs["Color"], bsdf.inputs["Base Color"])
ntree.links.new(tm.outputs["Color"], sep.inputs["Color"])
ntree.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"]); ntree.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
ntree.links.new(tnn.outputs["Color"], nm.inputs["Color"]); ntree.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
lme.materials.clear(); lme.materials.append(mat)
for p in lme.polygons: p.use_smooth = True
low["stage"] = "hero2 stage 1 mesh"
bpy.data.objects.remove(hi)
for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
    for d in list(blk):
        if d.users == 0: blk.remove(d)
for img in (img_c, img_mr, img_n): img.pack()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "hero_mesh.blend"))
log("saved hero_mesh.blend")

# GLB at the web target sizes (the PNG masters stay next to it)
for img, key, dflt in ((img_c, "glb_base", 2048), (img_n, "glb_normal", 2048), (img_mr, "glb_mr", 1024)):
    s = int(opt.get(key, dflt))
    if s != RES: img.scale(s, s)
activate(low)
bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, "hero_mesh.glb"), use_selection=True, export_format="GLB",
                          export_image_format="JPEG", export_jpeg_quality=92, export_tangents=True, export_yup=True,
                          export_apply=False, export_animations=False, export_cameras=False, export_lights=False)
log("exported hero_mesh.glb", os.path.getsize(os.path.join(out_dir, "hero_mesh.glb")) // 1024, "KiB")
