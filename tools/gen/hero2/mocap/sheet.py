"""Contact sheets for judging motion by eye. Blender 5.0 headless.

    blender -b -P sheet.py -- <take.bvh> <out.png> [start=1] [end=-1] [n=12] [frames=a,b,c] [cell=160x360]
                              [views=front,side] [travel=0] [wrap=0] [title=text]
    blender -b -P sheet.py -- <rig.blend> <out.png> action=walk [armature=Armature] [same options]

BVH mode draws a stick figure (left side red, right side blue, a nose peg on the head) straight from the
joint positions. Blend mode poses the armature with the named action and copies its skinned / bone-parented
meshes, so twist and skinning are visible. One row per view; each column is one frame, labelled with the
frame number. The figure is drawn in place unless travel=1. `side` shows the character's right side
(it faces the right edge of the image; the nose peg shows where the head points). `back`, `left`, `top` exist too.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bvh  # noqa: E402

COL = {'c': (0.25, 0.25, 0.28, 1), 'l': (0.85, 0.15, 0.12, 1), 'r': (0.12, 0.3, 0.85, 1),
       'g': (0.6, 0.6, 0.6, 1), 't': (0.05, 0.05, 0.05, 1), 'skin': (0.8, 0.65, 0.5, 1)}


def args():
    a = sys.argv[sys.argv.index('--') + 1:]
    pos = [x for x in a if '=' not in x]
    kw = dict(x.split('=', 1) for x in a if '=' in x)
    return pos, kw


def mat(name):
    m = bpy.data.materials.get('sheet_' + name)
    if not m:
        m = bpy.data.materials.new('sheet_' + name)
        m.diffuse_color = COL[name]
    return m


def box(a, b, w, d=None):
    """Prism from a to b, cross-section w x d. Returns (verts 8x3, quads)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = w if d is None else d
    z = b - a
    n = np.linalg.norm(z)
    if n < 1e-9:
        z, n = np.array([0, 0, 1.0]), 1e-4
    z = z / n
    ref = np.array([0, 0, 1.0]) if abs(z[2]) < 0.9 else np.array([1.0, 0, 0])
    x = np.cross(ref, z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    v = []
    for p in (a, b):
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            v.append(p + x * sx * w / 2 + y * sy * d / 2)
    f = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return np.array(v), f


def to_bl(p):
    """BVH (x, y up, z fwd) -> Blender (x, -z, y)."""
    p = np.asarray(p)
    return np.stack([p[..., 0], -p[..., 2], p[..., 1]], -1)


def side_of(name):
    if name.startswith('Left') or name.startswith('LH') or name.startswith('LT'):
        return 'l'
    if name.startswith('Right') or name.startswith('RH') or name.startswith('RT'):
        return 'r'
    return 'c'


def stick_frames(path, kw):
    """Returns (list of per-frame parts [(verts, faces, matname)], labels, height)."""
    b = bvh.load(path)
    F = b.R.shape[0]
    if 'frames' in kw:
        fr = [int(x) for x in kw['frames'].split(',')]
    elif 'cycle' in kw:
        # walk takes: one full cycle between left heel strikes (cycle=0 is the first steady one, -1 the middle)
        import scan_walks
        st = scan_walks.measure(path)['strikes']
        k = int(kw['cycle'])
        k = (len(st) - 1) // 2 if k < 0 else min(k, len(st) - 2)
        fr = [int(round(x)) for x in np.linspace(st[k], st[k + 1], int(kw.get('n', 12)))]
    else:
        s = int(kw.get('start', 1 if F > 2 else 0))
        e = int(kw.get('end', -1))
        e = F - 1 if e < 0 else min(e, F - 1)
        n = int(kw.get('n', 12))
        fr = [int(round(x)) for x in np.linspace(s, e, n)]
    sel = b.copy()
    sel.R, sel.pos = b.R[fr], b.pos[fr]
    G, P = bvh.fk(sel)
    ends = {j: P[:, j] + G[:, j] @ o for j, o in b.ends.items()}
    hips = P[:, 0].copy()
    # heading: direction of travel when the take travels, else where the hips face
    trav = hips[-1] - hips[0]
    trav[1] = 0
    if np.linalg.norm(trav) > 0.25 * abs(hips[:, 1]).mean():
        f = trav / np.linalg.norm(trav)
    else:
        f = (G[:, 0] @ np.array([0, 0, 1.0])).mean(0)
        f[1] = 0
        f /= np.linalg.norm(f)
    if kw.get('heading') == 'raw':
        f = np.array([0, 0, 1.0])
    yaw = math.atan2(f[0], f[2])
    Ry = bvh.axis_rot('Y', np.array(-math.degrees(yaw)))
    lo = min(ends[j][:, 1].min() for j in ends)
    lo = min(lo, P[:, :, 1].min())
    if 'floor' in kw:
        lo = float(kw['floor'])
    hi = max(ends[j][:, 1].max() for j in ends)
    if 'scale' in kw:
        scale = float(kw['scale'])
    else:
        # scale from the tallest moment of the whole take so sitting takes are not blown up
        Gt, Pt = bvh.fk(b)
        top = (Pt[:, b.idx('Head')] + Gt[:, b.idx('Head')] @ b.ends[b.idx('Head')])[:, 1]
        scale = 1.75 / (np.percentile(top, 98) - lo)
    travel = kw.get('travel', '0') == '1'
    frames = []
    for i in range(len(fr)):
        org = hips[i].copy() if not travel else hips[0].copy()
        org[1] = lo

        def tr(p):
            return to_bl(((p - org) @ Ry.T) * scale)

        parts = []
        th = 0.045
        for j, n in enumerate(b.names):
            p = b.parents[j]
            if p >= 0 and np.linalg.norm(b.offsets[j]) > 1e-6:
                v, fa = box(tr(P[i, p]), tr(P[i, j]), th)
                parts.append((v, fa, side_of(n)))
            if j in ends:
                v, fa = box(tr(P[i, j]), tr(ends[j][i]), th * (2.6 if n == 'Head' else 1))
                parts.append((v, fa, side_of(n)))
        hj = b.idx('Head')
        hc = (P[i, hj] + ends[hj][i]) / 2
        nose = hc + G[i, hj] @ np.array([0, 0, 1.0]) * (0.13 / scale)
        v, fa = box(tr(hc), tr(nose), 0.03)
        parts.append((v, fa, 't'))
        frames.append(parts)
    return frames, [str(x) for x in fr], 1.75


def blend_frames(kw):
    """Pose the armature with an action and copy the deformed meshes at each sampled frame."""
    sc = bpy.context.scene
    arm = bpy.data.objects.get(kw.get('armature', '')) or next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    act = bpy.data.actions[kw['action']]
    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = act
    try:
        if act.slots and arm.animation_data.action_slot is None:
            arm.animation_data.action_slot = act.slots[0]
    except AttributeError:
        pass
    s0, e0 = [int(round(x)) for x in act.frame_range]
    if 'frames' in kw:
        fr = [int(x) for x in kw['frames'].split(',')]
    else:
        s = int(kw.get('start', s0))
        e = int(kw.get('end', -1))
        e = e0 if e < 0 else e
        fr = [int(round(x)) for x in np.linspace(s, e, int(kw.get('n', 12)))]
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and (o.parent == arm or o.find_armature() == arm)]
    travel = kw.get('travel', '0') == '1'
    frames = []
    for f in fr:
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        hips = arm.evaluated_get(dg).pose.bones.get('mixamorig:Hips')
        org = np.zeros(3)
        if hips is not None and not travel:
            h = arm.matrix_world @ hips.head
            org = np.array([h.x, h.y, 0])
        parts = []
        for o in meshes:
            oe = o.evaluated_get(dg)
            me = oe.to_mesh()
            n = len(me.vertices)
            co = np.empty(n * 3)
            me.vertices.foreach_get('co', co)
            co = co.reshape(n, 3)
            M = np.array(oe.matrix_world)
            co = co @ M[:3, :3].T + M[:3, 3] - org
            by = {}
            for p in me.polygons:
                mname = o.material_slots[p.material_index].material.name if o.material_slots else 'c'
                by.setdefault(mname, []).append(tuple(p.vertices))
            for mname, fa in by.items():
                parts.append((co, fa, mname))
            oe.to_mesh_clear()
        frames.append(parts)
    return frames, [str(x) for x in fr], 1.75


VIEWS = {  # rotation about Z applied to the figure before the camera (at -Y, looking +Y) sees it
    'front': 0, 'side': 90, 'back': 180, 'left': -90,
}


def build(frames, labels, kw, out):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    sc = bpy.context.scene
    views = kw.get('views', 'front,side').split(',')
    cw, ch = [int(x) for x in kw.get('cell', '160x360').split('x')]
    H = float(kw.get('fit', 2.05))            # metres of height shown per row
    W = H * cw / ch
    n = len(frames)
    col = sc.collection
    matcache = {}

    def get_mat(name):
        if name in COL:
            return mat(name)
        return bpy.data.materials.get(name) or mat('c')

    for r, view in enumerate(views):
        z0 = -r * H
        for i, parts in enumerate(frames):
            x0 = (i + 0.5) * W
            if view == 'top':
                Rm = np.array(Matrix.Rotation(math.radians(90), 3, 'X'))
                off = np.array([x0, 0, z0 + H * 0.5])
            else:
                Rm = np.array(Matrix.Rotation(math.radians(VIEWS[view]), 3, 'Z'))
                off = np.array([x0, 0, z0 + 0.12])
            verts, faces, mids, mats = [], [], [], []
            base = 0
            for v, fa, mname in parts:
                v2 = v @ Rm.T + off
                verts.append(v2)
                faces += [tuple(base + k for k in f) for f in fa]
                if mname not in mats:
                    mats.append(mname)
                mids += [mats.index(mname)] * len(fa)
                base += len(v)
            me = bpy.data.meshes.new('f')
            me.from_pydata(np.concatenate(verts).tolist(), [], faces)
            for mname in mats:
                me.materials.append(get_mat(mname))
            me.polygons.foreach_set('material_index', mids)
            me.update()
            col.objects.link(bpy.data.objects.new('f', me))
            if r == 0:
                cu = bpy.data.curves.new('t', 'FONT')
                cu.body = labels[i]
                cu.size = 0.11
                cu.align_x = 'CENTER'
                t = bpy.data.objects.new('t', cu)
                t.location = (x0, -3, H - 0.14)
                t.rotation_euler = (math.radians(90), 0, 0)
                cu.materials.append(mat('t'))
                col.objects.link(t)
        if view != 'top':
            v, fa = box((0, 0.5, z0 + 0.115), (n * W, 0.5, z0 + 0.115), 0.012, 0.01)
            me = bpy.data.meshes.new('g')
            me.from_pydata(v.tolist(), [], fa)
            me.materials.append(mat('g'))
            col.objects.link(bpy.data.objects.new('g', me))
    if kw.get('title'):
        cu = bpy.data.curves.new('t', 'FONT')
        cu.body = kw['title'] + '   rows: ' + ', '.join(views)
        cu.size = 0.09
        t = bpy.data.objects.new('t', cu)
        t.location = (0.05, -3, H - 0.3)
        t.rotation_euler = (math.radians(90), 0, 0)
        cu.materials.append(mat('t'))
        col.objects.link(t)
    cam = bpy.data.cameras.new('c')
    cam.type = 'ORTHO'
    tw, th = n * W, len(views) * H
    cam.ortho_scale = max(tw, th)
    co = bpy.data.objects.new('c', cam)
    co.location = (tw / 2, -20, H - th / 2)
    co.rotation_euler = (math.radians(90), 0, 0)
    cam.clip_end = 100
    col.objects.link(co)
    sc.camera = co
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_shadows = False
    sh.show_cavity = True
    sh.show_object_outline = True
    sc.display.render_aa = '8'
    if not sc.world:
        sc.world = bpy.data.worlds.new('w')
    sc.world.use_nodes = False
    sc.world.color = (0.93, 0.93, 0.91)
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x = n * cw
    sc.render.resolution_y = len(views) * ch
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = os.path.abspath(out)
    bpy.ops.render.render(write_still=True)
    print('SHEET', out, sc.render.resolution_x, sc.render.resolution_y)


def main():
    pos, kw = args()
    src, out = pos[0], pos[1]
    if src.lower().endswith('.blend'):
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src))
        frames, labels, _ = blend_frames(kw)
    else:
        frames, labels, _ = stick_frames(src, kw)
    build(frames, labels, kw, out)


if __name__ == '__main__':
    main()
