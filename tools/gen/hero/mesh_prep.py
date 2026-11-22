"""Stage 3 (Blender): raw Trellis GLB -> clean, decimated, UV-mapped, textured, normalised mesh.
usage: blender -b -P mesh_prep.py -- <raw.glb> <out.blend> <basecolor.png> [tris=40000] [tex=2048] [yaw=0] [height=1.75]

Result (.blend): object "Hero" (low poly, one material, one base-colour texture) and object "HeroHi"
(the cleaned source mesh with vertex colours, kept for joint fitting). Blender axes: Z up, the
character faces -Y (which the glTF exporter turns into +Z), feet on z=0, centred on x/y, <height> tall.
yaw: degrees about the up axis applied to the raw mesh if Trellis did not return it facing the front."""
import bpy, sys, math, time
import numpy as np
from mathutils import Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
src, out_blend, tex_path = argv[:3]
opt = dict(a.split("=", 1) for a in argv[3:])
TRIS = int(opt.get("tris", 40000)); TEX = int(opt.get("tex", 2048))
YAW = float(opt.get("yaw", 0)); HEIGHT = float(opt.get("height", 1.75))
t0 = time.time()
def log(*a): print("[prep %5.1fs]" % (time.time() - t0), *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def load_raw_glb(path):
    """Read POSITION / COLOR_0 / indices straight from the Trellis GLB. Blender's importer drops the
    degenerate triangles of these meshes and then misaligns the per-corner colours, so it is bypassed."""
    import json, struct
    data = open(path, "rb").read()
    jlen = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + jlen])
    bin0 = 20 + jlen + 8
    def acc(i):
        a = j["accessors"][i]; bv = j["bufferViews"][a["bufferView"]]
        dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[a["componentType"]]
        nc = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
        off = bin0 + bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        arr = np.frombuffer(data, dt, a["count"] * nc, off).reshape(a["count"], nc)
        if a.get("normalized") or (dt != np.float32 and a["type"] != "SCALAR"):
            arr = arr.astype(np.float32) / np.iinfo(dt).max
        return arr
    prim = j["meshes"][0]["primitives"][0]
    pos = acc(prim["attributes"]["POSITION"]).astype(np.float32)
    col = acc(prim["attributes"]["COLOR_0"]).astype(np.float32)[:, :3]
    idx = acc(prim["indices"]).astype(np.int32).reshape(-1, 3)
    good = (idx[:, 0] != idx[:, 1]) & (idx[:, 1] != idx[:, 2]) & (idx[:, 0] != idx[:, 2])
    idx = idx[good]
    pos = np.stack([pos[:, 0], -pos[:, 2], pos[:, 1]], 1)   # glTF Y up -> Blender Z up
    me = bpy.data.meshes.new("HeroHi")
    me.vertices.add(len(pos)); me.vertices.foreach_set("co", pos.ravel())
    me.loops.add(idx.size); me.loops.foreach_set("vertex_index", idx.ravel())
    me.polygons.add(len(idx)); me.polygons.foreach_set("loop_start", np.arange(0, idx.size, 3, dtype=np.int32))
    me.update(calc_edges=True); me.validate()
    ca = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    ca.data.foreach_set("color", np.concatenate([col, np.ones((len(col), 1), np.float32)], 1).ravel())
    ob = bpy.data.objects.new("HeroHi", me); scene.collection.objects.link(ob)
    return ob

hi = load_raw_glb(src)
bpy.context.view_layer.objects.active = hi; hi.select_set(True)
hi.name = "HeroHi"
me = hi.data
log("imported verts", len(me.vertices), "polys", len(me.polygons), "colour", [(a.name, a.domain, a.data_type) for a in me.color_attributes])

# ---- clean: weld, drop small loose islands
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=max(hi.dimensions) * 2e-5)
bpy.ops.mesh.delete_loose()
bpy.ops.object.mode_set(mode="OBJECT")

def islands(me):
    nv = len(me.vertices)
    e = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", e); e = e.reshape(-1, 2)
    both = np.concatenate([e, e[:, ::-1]])
    order = np.argsort(both[:, 0], kind="stable")
    nbr = both[order, 1]
    start = np.searchsorted(both[order, 0], np.arange(nv + 1))
    label = np.full(nv, -1, np.int64)
    nbr_l, start_l = nbr.tolist(), start.tolist()
    lab = label.tolist(); n = 0
    for s in range(nv):
        if lab[s] != -1:
            continue
        lab[s] = n; stack = [s]
        while stack:
            v = stack.pop()
            for k in range(start_l[v], start_l[v + 1]):
                w = nbr_l[k]
                if lab[w] == -1:
                    lab[w] = n; stack.append(w)
        n += 1
    return np.array(lab), n

lab, n = islands(me)
counts = np.bincount(lab, minlength=n)
keep = counts >= max(200, counts.max() * 0.02)
log("islands", n, "kept", int(keep.sum()), "largest", int(counts.max()), "dropped verts", int(counts[~keep].sum()))
if not keep.all():
    sel = ~keep[lab]
    for p in me.polygons: p.select = False
    for ed in me.edges: ed.select = False
    me.vertices.foreach_set("select", sel)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="VERT")
    bpy.ops.mesh.delete(type="VERT")
    bpy.ops.object.mode_set(mode="OBJECT")

# ---- orient, scale, ground, centre
def coords(me):
    c = np.empty(len(me.vertices) * 3, np.float64); me.vertices.foreach_get("co", c); return c.reshape(-1, 3)
if YAW:
    me.transform(Matrix.Rotation(math.radians(YAW), 4, "Z"))
co = coords(me)
s = HEIGHT / (co[:, 2].max() - co[:, 2].min())
me.transform(Matrix.Scale(s, 4))
co = coords(me)
legs = co[co[:, 2] < co[:, 2].min() + 0.35 * HEIGHT]
cx = (legs[:, 0].min() + legs[:, 0].max()) / 2         # centre x on the stance, not on the arm span
torso = co[(co[:, 2] > co[:, 2].min() + 0.5 * HEIGHT) & (np.abs(co[:, 0] - cx) < 0.12)]
cy = (torso[:, 1].min() + torso[:, 1].max()) / 2        # centre depth on the trunk
me.transform(Matrix.Translation((-cx, -cy, -co[:, 2].min())))
me.update()
co = coords(me)
log("normalised bounds", co.min(0).round(3), co.max(0).round(3))

# ---- low poly copy
bpy.ops.object.select_all(action="DESELECT")
hi.select_set(True); bpy.context.view_layer.objects.active = hi
bpy.ops.object.duplicate()
low = bpy.context.view_layer.objects.active
low.name = "Hero"; low.data.name = "Hero"
low.data.calc_loop_triangles()
ntri = len(low.data.loop_triangles)
mod = low.modifiers.new("dec", "DECIMATE"); mod.ratio = min(1.0, TRIS / ntri)
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.mesh.delete_loose()
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.fill_holes(sides=12)
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.quads_convert_to_tris()
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.shade_smooth()
low.data.calc_loop_triangles()
log("low poly verts", len(low.data.vertices), "tris", len(low.data.loop_triangles))

# ---- bake the vertex colours of the source onto one base-colour texture
def emit_mat(obj):
    mat = bpy.data.materials.new("hi_emit"); mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial"); e = nt.nodes.new("ShaderNodeEmission"); a = nt.nodes.new("ShaderNodeVertexColor")
    a.layer_name = obj.data.color_attributes[0].name
    nt.links.new(a.outputs["Color"], e.inputs["Color"]); nt.links.new(e.outputs["Emission"], o.inputs["Surface"])
    obj.data.materials.clear(); obj.data.materials.append(mat)
emit_mat(hi)

img = bpy.data.images.new("hero_basecolor", TEX, TEX, alpha=False)
img.generated_color = (0.05, 0.05, 0.06, 1)
mat = bpy.data.materials.new("Hero"); mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
bsdf.inputs["Roughness"].default_value = 0.78
bsdf.inputs["Metallic"].default_value = 0.0
low.data.materials.clear(); low.data.materials.append(mat)
nt.nodes.active = tex; tex.select = True

scene.render.engine = "CYCLES"
scene.cycles.samples = 4
scene.cycles.device = "CPU"
scene.render.bake.use_selected_to_active = True
scene.render.bake.cage_extrusion = 0.012
scene.render.bake.max_ray_distance = 0.03
scene.render.bake.margin = 12
bpy.ops.object.select_all(action="DESELECT")
hi.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active = low
log("baking", TEX)
bpy.ops.object.bake(type="EMIT")
img.filepath_raw = tex_path; img.file_format = "PNG"; img.save()
img.pack()
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
for a in list(low.data.color_attributes):
    low.data.color_attributes.remove(a)
log("baked", tex_path)

hi.hide_render = True; hi.hide_viewport = True
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
# a static GLB of the low poly for a quick look
bpy.ops.object.select_all(action="DESELECT"); low.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_blend.replace(".blend", ".glb"), use_selection=True, export_image_format="JPEG", export_jpeg_quality=88)
log("saved", out_blend)
