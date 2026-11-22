"""Blender: GLB -> point cloud for the site's portrait.
usage: blender -b -P glb_to_points.py -- <in.glb> <out.bin> [count]
Output: Int16 x, y, z, light per point. Position is centred and scaled so the
largest half-extent is 1, in three.js axes (Y up). Light mixes surface colour and form shading."""
import bpy, sys
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], argv[1]
count = int(argv[2]) if len(argv) > 2 else 56000

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.context.view_layer.objects.active = meshes[0]
for o in meshes:
    o.select_set(True)
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = obj.data
me.calc_loop_triangles()

nv, nt = len(me.vertices), len(me.loop_triangles)
co = np.empty(nv * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
tri = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("vertices", tri); tri = tri.reshape(-1, 3)
tloops = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("loops", tloops); tloops = tloops.reshape(-1, 3)

col = None
attr = me.color_attributes.active_color or (me.color_attributes[0] if len(me.color_attributes) else None)
if attr is not None:
    n = len(attr.data)
    c = np.empty(n * 4, np.float32); attr.data.foreach_get("color", c); c = c.reshape(-1, 4)[:, :3]
    col = c[tri] if attr.domain == "POINT" else c[tloops]  # (nt, 3, 3)
print("verts", nv, "tris", nt, "colour", None if attr is None else (attr.name, attr.domain))

a, b, c3 = co[tri[:, 0]], co[tri[:, 1]], co[tri[:, 2]]
cross = np.cross(b - a, c3 - a)
area = np.linalg.norm(cross, axis=1) * 0.5
normal = cross / np.maximum(np.linalg.norm(cross, axis=1, keepdims=True), 1e-12)

rng = np.random.default_rng(7)
pick = rng.choice(nt, size=count, p=area / area.sum())
u, v = rng.random(count), rng.random(count)
flip = u + v > 1
u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
w = 1 - u - v
pts = a[pick] * w[:, None] + b[pick] * u[:, None] + c3[pick] * v[:, None]
nrm = normal[pick]

if col is not None:
    rgb = col[pick, 0] * w[:, None] + col[pick, 1] * u[:, None] + col[pick, 2] * v[:, None]
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
else:
    luma = np.full(count, 0.6, np.float32)

# Blender is Z up, -Y forward. Light from front, above and slightly left.
light = np.array([-0.35, -0.75, 0.55], np.float32); light /= np.linalg.norm(light)
lambert = np.clip(nrm @ light, 0, 1)
lum = np.clip(0.5 * (luma / max(np.percentile(luma, 98), 1e-4)) + 0.5 * lambert, 0, 1)

lo, hi = pts.min(0), pts.max(0)
pts = (pts - (lo + hi) / 2) / ((hi - lo).max() / 2)
three = np.stack([pts[:, 0], pts[:, 2], -pts[:, 1]], 1)  # to Y up

order = rng.permutation(count)  # so taking every nth point still covers the whole bust
data = np.empty((count, 4), np.int16)
data[:, :3] = np.round(np.clip(three[order], -1, 1) * 32767)
data[:, 3] = np.round(lum[order] * 65535 - 32768)
data.tofile(out)
print("wrote", out, data.nbytes, "bytes", "extent", (hi - lo).round(3))
