"""Stand-in rig for testing retarget.py before the real character exists. Blender 5.0 headless.

    blender -b -P make_standin.py -- <out.blend> [pose=T|A] [rolls=odd]

Builds an armature with the Mixamo bone names (body, full finger chains, three face bones) for a 1.75 m
figure in T-pose, Z up, facing -Y, feet on z = 0, plus a blocky body: one box per bone, fully weighted to
that bone, left side red, right side blue. The boxes are deliberately not round (flat palms with a thumb
knob, kneecaps, a nose, wedge feet) so twist and wrong bend directions show in a render.

rolls=odd gives the limb bones arbitrary rolls, pose=A drops the arms 40 degrees: both are there to prove
the retarget does not depend on roll or on an exact T-pose.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

P = 'mixamorig:'


def args():
    a = sys.argv[sys.argv.index('--') + 1:]
    return [x for x in a if '=' not in x], dict(x.split('=', 1) for x in a if '=' in x)


def skeleton():
    """name -> (head, tail, parent). Left side only for limbs; mirrored below."""
    b = {}
    b['Hips'] = ((0, 0, 0.965), (0, 0, 1.06), None)
    b['Spine'] = ((0, 0, 1.06), (0, 0, 1.17), 'Hips')
    b['Spine1'] = ((0, 0, 1.17), (0, 0, 1.29), 'Spine')
    b['Spine2'] = ((0, 0, 1.29), (0, 0, 1.47), 'Spine1')
    b['Neck'] = ((0, 0, 1.47), (0, -0.01, 1.56), 'Spine2')
    b['Head'] = ((0, -0.01, 1.56), (0, -0.01, 1.75), 'Neck')
    b['Jaw'] = ((0, -0.03, 1.60), (0, -0.10, 1.57), 'Head')
    b['LeftEyelid'] = ((0.03, -0.09, 1.66), (0.03, -0.11, 1.66), 'Head')
    b['RightEyelid'] = ((-0.03, -0.09, 1.66), (-0.03, -0.11, 1.66), 'Head')
    L = {}
    L['Shoulder'] = ((0.03, 0, 1.42), (0.165, 0, 1.43), 'Spine2')
    L['Arm'] = ((0.165, 0, 1.43), (0.43, 0, 1.43), 'LeftShoulder')
    L['ForeArm'] = ((0.43, 0, 1.43), (0.68, 0, 1.43), 'LeftArm')
    L['Hand'] = ((0.68, 0, 1.43), (0.76, 0, 1.43), 'LeftForeArm')
    L['UpLeg'] = ((0.09, 0, 0.91), (0.09, -0.005, 0.50), 'Hips')
    L['Leg'] = ((0.09, -0.005, 0.50), (0.09, 0.02, 0.085), 'LeftUpLeg')
    L['Foot'] = ((0.09, 0.02, 0.085), (0.09, -0.12, 0.02), 'LeftLeg')
    L['ToeBase'] = ((0.09, -0.12, 0.02), (0.09, -0.20, 0.02), 'LeftFoot')
    fingers = {'Thumb': (0.705, -0.03, 1.425, 0.030, (0.75, -0.66, 0)), 'Index': (0.765, -0.03, 1.43, 0.030, (1, 0, 0)),
               'Middle': (0.77, -0.01, 1.43, 0.033, (1, 0, 0)), 'Ring': (0.765, 0.01, 1.43, 0.030, (1, 0, 0)),
               'Pinky': (0.755, 0.03, 1.43, 0.024, (1, 0, 0))}
    for f, (x, y, z, ln, d) in fingers.items():
        par = 'LeftHand'
        for i in (1, 2, 3):
            h = (x + d[0] * ln * (i - 1), y + d[1] * ln * (i - 1), z)
            t = (x + d[0] * ln * i, y + d[1] * ln * i, z)
            L['Hand%s%d' % (f, i)] = (h, t, par)
            par = 'LeftHand%s%d' % (f, i)
    for k, (h, t, p) in L.items():
        b['Left' + k] = (h, t, p)
        m = lambda v: (-v[0], v[1], v[2])
        b['Right' + k] = (m(h), m(t), p.replace('Left', 'Right') if p else p)
    return b


def box_dims(name):
    """Half extents (across the bone) and extras for the body blocks, in world axes of the T-pose."""
    n = name.replace('Left', '').replace('Right', '')
    table = {
        'Hips': (0.15, 0.09), 'Spine': (0.14, 0.085), 'Spine1': (0.15, 0.09), 'Spine2': (0.17, 0.095),
        'Neck': (0.045, 0.045), 'Head': (0.075, 0.09), 'Shoulder': (0.045, 0.04), 'Arm': (0.04, 0.045),
        'ForeArm': (0.028, 0.04), 'Hand': (0.012, 0.04), 'UpLeg': (0.07, 0.075), 'Leg': (0.05, 0.055),
    }
    return table.get(n)


def main():
    pos, kw = args()
    out = os.path.abspath(pos[0])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = 30
    arm = bpy.data.armatures.new('Armature')
    ob = bpy.data.objects.new('Armature', arm)
    sc.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    sk = skeleton()
    if kw.get('pose', 'T') == 'A':
        # drop the arms 40 degrees about the shoulder joint
        for side, sgn in (('Left', 1), ('Right', -1)):
            piv = Vector(sk[side + 'Arm'][0])
            M = Matrix.Rotation(math.radians(40 * sgn), 4, 'Y')
            for k in list(sk):
                if k.startswith(side) and any(s in k for s in ('Arm', 'Hand')):
                    h, t, p = sk[k]
                    sk[k] = (tuple(piv + M @ (Vector(h) - piv)), tuple(piv + M @ (Vector(t) - piv)), p)
    for name, (h, t, p) in sk.items():
        e = arm.edit_bones.new(P + name)
        e.head, e.tail = h, t
    for name, (h, t, p) in sk.items():
        e = arm.edit_bones[P + name]
        if p:
            e.parent = arm.edit_bones[P + p]
        if kw.get('rolls') == 'odd':
            n = name.replace('Left', '').replace('Right', '')
            odd = {'Arm': 70, 'ForeArm': -35, 'Hand': 120, 'UpLeg': 25, 'Leg': -160, 'Foot': 45, 'Spine1': 90, 'Head': 15}
            if n in odd:
                e.roll = math.radians(odd[n] * (1 if name.startswith('Left') else -1.3))
    bpy.ops.object.mode_set(mode='OBJECT')

    mats = {}
    for k, c in (('l', (0.85, 0.15, 0.12, 1)), ('r', (0.12, 0.3, 0.85, 1)), ('c', (0.55, 0.55, 0.58, 1)), ('t', (0.05, 0.05, 0.05, 1))):
        m = bpy.data.materials.new(k)
        m.diffuse_color = c
        mats[k] = m
    verts, faces, fmat, vgroup = [], [], [], []
    order = ['c', 'l', 'r', 't']

    def add(corners, bone, mat):
        base = len(verts)
        verts.extend(corners)
        vgroup.extend([bone] * 8)
        for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            faces.append(tuple(base + i for i in f))
            fmat.append(order.index(mat))

    def aabb(lo, hi, bone, mat):
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        add([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], bone, mat)

    def along(h, t, a, b_, bone, mat):
        """Box around the segment h->t with half extents a, b_ on the two axes across it (works for any direction)."""
        h, t = Vector(h), Vector(t)
        z = (t - h).normalized()
        ref = Vector((0, -1, 0)) if abs(z.y) < 0.9 else Vector((0, 0, 1))
        x = ref.cross(z).normalized()
        y = z.cross(x)
        c = []
        for p in (h, t):
            for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                c.append(tuple(p + x * sx * a + y * sy * b_))
        add(c, bone, mat)

    for name, (h, t, p) in sk.items():
        side = 'l' if name.startswith('Left') else 'r' if name.startswith('Right') else 'c'
        n = name.replace('Left', '').replace('Right', '')
        sx = 1 if side != 'r' else -1
        if n in ('Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'):
            a, d = box_dims(name)
            aabb((-a, -d + h[1], h[2] if n != 'Hips' else 0.90), (a, d + h[1], t[2]), name, 'c')
            if n == 'Head':
                aabb((-0.012, h[1] - d - 0.03, 1.63), (0.012, h[1] - d, 1.67), name, 't')           # nose
            if n == 'Spine2':
                aabb((-0.02, -d - 0.01, 1.30), (0.02, -d, 1.45), name, 't')                        # tie: marks the front
        elif n in ('Shoulder', 'Arm', 'ForeArm', 'UpLeg', 'Leg'):
            a, d = box_dims(name)
            along(h, t, a, d, name, side)
            if n == 'Leg':
                aabb((h[0] - 0.03, h[1] - 0.085, h[2] - 0.05), (h[0] + 0.03, h[1] - 0.05, h[2] + 0.03), name, 't')   # kneecap
            if n == 'ForeArm':
                # elbow point at the back so forearm twist and elbow direction can be seen
                hv, tv = Vector(h), Vector(t)
                z = (tv - hv).normalized()
                along(hv + Vector((0, 0.045, 0)), hv + Vector((0, 0.045, 0)) + z * 0.05, 0.02, 0.012, name, 't')
        elif n == 'Hand':
            along(h, Vector(t) + (Vector(t) - Vector(h)).normalized() * 0.01, 0.012, 0.042, name, side)        # flat palm
        elif n.startswith('Hand'):
            along(h, t, 0.007, 0.008, name, side)
        elif n == 'Foot':
            aabb((h[0] - 0.045, -0.12, 0.0), (h[0] + 0.045, 0.075, 0.07), name, side)                 # heel to ball, sole on the floor
            aabb((h[0] - 0.035, -0.03, 0.07), (h[0] + 0.035, 0.06, 0.11), name, side)                  # ankle block
        elif n == 'ToeBase':
            aabb((h[0] - 0.045, -0.21, 0.0), (h[0] + 0.045, -0.12, 0.04), name, 't')
    me = bpy.data.meshes.new('Body')
    me.from_pydata(verts, [], faces)
    for k in order:
        me.materials.append(mats[k])
    me.polygons.foreach_set('material_index', fmat)
    me.update()
    body = bpy.data.objects.new('Body', me)
    sc.collection.objects.link(body)
    groups = {}
    for i, bn in enumerate(vgroup):
        g = groups.get(bn) or body.vertex_groups.new(name=P + bn)
        groups[bn] = g
        g.add([i], 1.0, 'REPLACE')
    body.parent = ob
    mod = body.modifiers.new('Armature', 'ARMATURE')
    mod.object = ob
    bpy.ops.wm.save_as_mainfile(filepath=out)
    print('STANDIN', out, len(arm.bones), 'bones')


if __name__ == '__main__':
    main()
