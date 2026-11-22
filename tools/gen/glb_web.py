"""Optimise a GLB prop for the web with Blender (run it with any python; it launches Blender itself).

usage:
    python glb_web.py <in.glb> <out.glb> [--tris 20000] [--tex 1024] [--tex-format {jpeg,webp,png}]
                      [--quality 85] [--size 1.0] [--ground] [--preview out.png] [--no-normalise]

What it does: joins all meshes, decimates to at most --tris triangles, downsizes every texture so its
longest side is at most --tex, recentres the object on the origin and scales it so its largest
dimension is --size (default 1 = unit box; --ground puts the base at y = 0 instead of centring
vertically), then exports GLB (Y up, no Draco, no meshopt, no animation). Prints before/after stats.
--preview renders a quick 3/4 view PNG so the result can be checked without opening a viewer.
jpeg is the default texture format (smallest, universally supported); use png if the base colour
has alpha, webp for smaller files when the loader supports EXT_texture_webp (three.js does)."""
import json, os, subprocess, sys

BLENDER = os.environ.get("BLENDER", r"C:\Program Files\Blender Foundation\Blender 5.0\blender.exe")

try:
    import bpy  # noqa
    IN_BLENDER = True
except ImportError:
    IN_BLENDER = False


def parse(argv):
    import argparse
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src"); ap.add_argument("out")
    ap.add_argument("--tris", type=int, default=20000, help="maximum triangle count")
    ap.add_argument("--tex", type=int, default=1024, help="maximum texture side in px")
    ap.add_argument("--tex-format", choices=["jpeg", "webp", "png"], default="jpeg")
    ap.add_argument("--quality", type=int, default=85, help="jpeg/webp quality")
    ap.add_argument("--size", type=float, default=1.0, help="largest dimension after normalising")
    ap.add_argument("--ground", action="store_true", help="rest the object on y=0 instead of centring it vertically")
    ap.add_argument("--yaw", type=float, default=0.0, help="turn the object about the vertical axis by this many degrees (comfy_3d.py output faces -Z; use 180 to face +Z)")
    ap.add_argument("--no-normalise", action="store_true", help="keep the original position and scale")
    ap.add_argument("--preview", help="also render a PNG preview to this path")
    return ap.parse_args(argv)


def wrapper():
    a = parse(sys.argv[1:])
    if not os.path.isfile(a.src):
        sys.exit(f"error: not found: {a.src}")
    if not os.path.isfile(BLENDER):
        sys.exit(f"error: Blender not found at {BLENDER} (set the BLENDER env var)")
    argv = [os.path.abspath(a.src), os.path.abspath(a.out), "--tris", str(a.tris), "--tex", str(a.tex), "--tex-format", a.tex_format,
            "--quality", str(a.quality), "--size", str(a.size), "--yaw", str(a.yaw)]
    argv += ["--ground"] * a.ground + ["--no-normalise"] * a.no_normalise + (["--preview", os.path.abspath(a.preview)] if a.preview else [])
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    cmd = [BLENDER, "-b", "--factory-startup", "-P", os.path.abspath(__file__), "--"] + argv
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, errors="replace", timeout=900)
    except subprocess.TimeoutExpired:
        sys.exit("error: Blender timed out after 900s")
    lines = [l[6:] for l in p.stdout.splitlines() if l.startswith("[glb] ")]
    print("\n".join(lines))
    if p.returncode != 0 or not os.path.isfile(a.out) or not any(l.startswith("wrote") for l in lines):
        sys.exit("error: Blender failed:\n" + (p.stdout[-2500:] + "\n" + p.stderr[-2500:]))


def log(*a):
    print("[glb]", *a, flush=True)


def in_blender():
    import bpy
    import numpy as np
    import math
    from mathutils import Matrix, Vector
    a = parse(sys.argv[sys.argv.index("--") + 1:])

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=a.src)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        log("error: no mesh in file"); sys.exit(1)
    for o in bpy.context.scene.objects:
        o.select_set(o.type == "MESH")
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    # unparent (keeping the world transform), then bake the transform into the vertices
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = Matrix.Rotation(math.radians(a.yaw), 4, "Z") @ world  # Blender Z = glTF Y (up)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.context.scene.objects):
        if o != obj:
            bpy.data.objects.remove(o, do_unlink=True)
    me = obj.data

    def tri_count():
        me.calc_loop_triangles()
        return len(me.loop_triangles)

    t_before, v_before = tri_count(), len(me.vertices)
    log(f"in:  {t_before} tris, {v_before} verts, {os.path.getsize(a.src) / 1e6:.2f} MB, "
        f"textures {[tuple(i.size) for i in bpy.data.images if i.size[0]]}, colour attributes {len(me.color_attributes)}")

    if t_before > a.tris:
        mod = obj.modifiers.new("dec", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = a.tris / t_before
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        me = obj.data

    for img in bpy.data.images:
        w, h = img.size
        if w and max(w, h) > a.tex:
            k = a.tex / max(w, h)
            img.scale(max(1, round(w * k)), max(1, round(h * k)))
            img.pack()

    n = len(me.vertices)
    co = np.empty(n * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    lo, hi = co.min(0), co.max(0)
    if not a.no_normalise:
        centre = (lo + hi) / 2
        if a.ground:
            centre[2] = lo[2]  # Blender is Z up; exported as Y up
        co = (co - centre) * (a.size / max((hi - lo).max(), 1e-9))
        me.vertices.foreach_set("co", co.ravel()); me.update()
        lo, hi = co.min(0), co.max(0)
    for p in me.polygons:
        p.use_smooth = True

    has_vcol = len(me.color_attributes) > 0
    has_tex = any(i.size[0] for i in bpy.data.images)
    kw = dict(filepath=a.out, export_format="GLB", use_selection=False, export_apply=True, export_yup=True, export_animations=False,
              export_draco_mesh_compression_enable=False, export_cameras=False, export_lights=False, export_extras=False,
              export_image_format={"jpeg": "JPEG", "webp": "WEBP", "png": "AUTO"}[a.tex_format],
              export_image_quality=a.quality, export_jpeg_quality=a.quality)
    if has_vcol and not has_tex:
        kw.update(export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in kw.items() if k in props})

    size_xyz = [round(float(hi[0] - lo[0]), 3), round(float(hi[2] - lo[2]), 3), round(float(hi[1] - lo[1]), 3)]  # three.js axes
    stats = dict(tris=tri_count(), verts=len(me.vertices), mb=round(os.path.getsize(a.out) / 1e6, 2), size_xyz=size_xyz,
                 textures=[[i.name, i.size[0], i.size[1]] for i in bpy.data.images if i.size[0]], vertex_colors=has_vcol and not has_tex)
    log(f"out: {stats['tris']} tris, {stats['verts']} verts, {stats['mb']} MB, bounding box (x, y up, z) {size_xyz}, "
        f"textures {[(t[1], t[2]) for t in stats['textures']]} as {a.tex_format}")
    log("stats " + json.dumps(stats))

    if a.preview:
        sc = bpy.context.scene
        sc.render.engine = "BLENDER_WORKBENCH"
        sh = sc.display.shading
        sh.light = "STUDIO"; sh.color_type = "TEXTURE" if has_tex else "VERTEX" if has_vcol else "MATERIAL"
        sh.show_cavity = False
        sc.display.render_aa = "8"
        sc.render.resolution_x = sc.render.resolution_y = 768
        sc.render.film_transparent = False
        sc.world = bpy.data.worlds.new("w"); sc.world.color = (0.05, 0.05, 0.06)
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
        c = Vector(((lo + hi) / 2).tolist()); r = float(np.linalg.norm(hi - lo)) / 2
        cam.data.lens = 60
        cam.location = c + Vector((0.55, -0.75, 0.38)).normalized() * (r * 3.6)
        cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.clip_start, cam.data.clip_end = r * 0.01, r * 100
        sc.render.image_settings.file_format = "PNG"
        sc.render.filepath = a.preview
        bpy.ops.render.render(write_still=True)
        log("preview " + a.preview)
    log("wrote " + a.out)


if IN_BLENDER:
    in_blender()
else:
    wrapper()
