"""Stage 2: build the armature and skin weights for the hero mesh. Blender 5.0 headless.

    blender -b -P hero2/rig_build.py -- src/hero2/hero_mesh.blend src/hero2/landmarks.json src/hero2/hero_rig.blend

Everything is procedural: joint positions come from landmarks.json (fingers, face) and from constants measured on
the mesh cross-sections (body); weights are functions of the rest position (the T-pose separates the limbs cleanly),
masked by the stage-1 attributes (`uv_region`, `hair`), then lightly smoothed over the mesh, limited to 4 influences
and normalised. Face bones take their share out of the Head weight with distance falloffs.

All coordinates in this file are Blender space: Z up, the character faces -Y, its left is +X.
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig_face import FACE_BONES, face_weights  # noqa: E402

P = 'mixamorig:'
V = lambda *a: np.array(a, float)  # noqa: E731


def ss(a, b, x):
    """smoothstep from a to b (a may be > b for a falling edge)"""
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def lin(a, b, x):
    return np.clip((x - a) / (b - a), 0.0, 1.0)


def unit(v):
    return v / np.linalg.norm(v)


# ------------------------------------------------------------------------------------------------ joints
# Body joints measured on the mesh cross-sections (see README "Stage 2"). x is given for the left side.
J = dict(
    Hips=V(0, 0.0, 0.900), Spine=V(0, 0.0, 0.985), Spine1=V(0, 0.0, 1.105), Spine2=V(0, 0.0, 1.235),
    Neck=V(0, 0.012, 1.462), Head=V(0, 0.0, 1.552), HeadTop=V(0, 0.0, 1.750),
    Shoulder=V(0.045, 0.035, 1.425), Arm=V(0.1936, 0.045, 1.375), ForeArm=V(0.4340, 0.042, 1.342),
    UpLeg=V(0.100, 0.0, 0.830), Leg=V(0.138, 0.008, 0.480), Foot=V(0.165, 0.025, 0.100),
    ToeBase=V(0.180, -0.095, 0.025), ToeTip=V(0.199, -0.180, 0.025),
)
FINGERS = ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')
# shoulder transition (torso -> half-rotation helper -> arm), |x| of the centre and half width, top and underside
# shoulder transition torso -> half-rotation helper -> arm: |x| where it starts and ends, at the top of the sleeve,
# at the height of the joint and on the underside. Seen from the front or the back the sleeve turns about the joint
# like a sheet in its own plane; the transition is a fan around the joint (long on the underside, where the sheet
# is compressed into the armpit, short at joint height) so that the sheet does not fold over itself.
SH_U = (-1.0, 0.0, 1.0)
SH_START = (0.189, 0.159, 0.122)
SH_END = (0.340, 0.245, 0.265)
ELBOW_H, KNEE_H = 0.050, 0.060           # half width of the elbow / knee blends along the limb
WRIST_X = 0.6555                          # slimmed mesh (body_slim.py, STRETCH 1.04); the scan's was 0.688


def gl(p):
    """landmark (glTF: x, y up, z front) -> Blender"""
    return V(p[0], -p[2], p[1])


def build_joints(lm):
    """Returns {bone: (head, tail, parent, x_axis)} in creation order. x_axis is the wanted local X (bend axis)."""
    L = lm['landmarks']
    out = {}

    def add(name, head, tail, parent, xaxis):
        out[P + name] = (np.array(head, float), np.array(tail, float), (P + parent) if parent else None, np.array(xaxis, float))

    X = V(1, 0, 0)
    add('Hips', J['Hips'], J['Spine'], None, X)
    add('Spine', J['Spine'], J['Spine1'], 'Hips', X)
    add('Spine1', J['Spine1'], J['Spine2'], 'Spine', X)
    add('Spine2', J['Spine2'], J['Spine2'] + V(0, 0, 0.14), 'Spine1', X)
    add('Neck', J['Neck'], J['Head'], 'Spine2', X)
    add('Head', J['Head'], J['HeadTop'], 'Neck', X)
    for name, (head, parent) in FACE_BONES(L, gl).items():
        add(name, head, head + V(0, 0, 0.03), parent, X)      # same rest orientation as Head
    for side, sg in (('Left', 1), ('Right', -1)):
        m = V(sg, 1, 1)
        s = side.lower()[0]
        xa = V(0, sg, 0)                                      # +X rotation lowers the arm / curls the fingers on both sides
        sh, arm, el = J['Shoulder'] * m, J['Arm'] * m, J['ForeArm'] * m
        wr = gl(L['wrist_' + s]['p'])
        wr[0] = sg * WRIST_X
        mid = gl(L['middle_%s_base' % s]['p'])
        add(side + 'Shoulder', sh, arm, 'Spine2', xa)
        add(side + 'Arm', arm, el, side + 'Shoulder', xa)
        add(side + 'ArmHalf', arm, arm + (el - arm) * 0.4, side + 'Shoulder', xa)          # helper: 50 % of Arm
        add(side + 'ForeArm', el, wr, side + 'Arm', xa)
        add(side + 'ElbowHalf', el, el + (wr - el) * 0.4, side + 'Arm', xa)                # helper: 50 % of ForeArm
        add(side + 'ForeArmTwist', el + (wr - el) * 0.55, wr, side + 'ForeArm', xa)        # helper: 50 % of the hand's twist
        add(side + 'Hand', wr, mid, side + 'ForeArm', xa)
        for f in FINGERS:
            fl = f.lower()
            tip = gl(L['%s_%s_tip' % (fl, s)]['p'])
            base = gl(L['%s_%s_base' % (fl, s)]['p'])
            j2 = gl(L['%s_%s_joint2' % (fl, s)]['p'])
            if f == 'Thumb':
                # landmarks give the thumb's MCP (base) and IP (joint2); the CMC sits near the wrist on the thumb side
                d = unit(tip - base)
                cmc = wr + V(sg * 0.012, -0.020, -0.012)
                pts = [cmc, base, j2, tip - d * 0.001]
                # the thumb nail faces up and away from the fingers; it flexes the other way, toward the palm
                flex = unit(V(sg * 0.50, 0.45, -0.74))
                fx = unit(np.cross(d, flex))
            else:
                j3 = gl(L['%s_%s_joint3' % (fl, s)]['p'])
                pts = [base, j2, j3, tip]
                fx = xa
            for k in range(3):
                add('%sHand%s%d' % (side, f, k + 1), pts[k], pts[k + 1], side + 'Hand' if k == 0 else '%sHand%s%d' % (side, f, k), fx)
        hip, kn, an, toe, tip = (J[k] * m for k in ('UpLeg', 'Leg', 'Foot', 'ToeBase', 'ToeTip'))
        add(side + 'UpLeg', hip, kn, 'Hips', X)
        add(side + 'Leg', kn, an, side + 'UpLeg', X)
        add(side + 'KneeHalf', kn, kn + (an - kn) * 0.4, side + 'UpLeg', X)                # helper: 50 % of Leg
        add(side + 'Foot', an, toe, side + 'Leg', X)
        add(side + 'ToeBase', toe, tip, side + 'Foot', X)
    return out


# helper bones: (helper, source, axes) -> Copy Rotation, local space, influence 0.5
HELPERS = [(s + h, s + src, ax) for s in ('Left', 'Right')
           for h, src, ax in (('ArmHalf', 'Arm', 'XYZ'), ('ElbowHalf', 'ForeArm', 'XYZ'), ('KneeHalf', 'Leg', 'XYZ'), ('ForeArmTwist', 'Hand', 'Y'))]


def make_armature(joints):
    arm = bpy.data.armatures.new('Armature')
    ob = bpy.data.objects.new('Armature', arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (head, tail, parent, xa) in joints.items():
        b = arm.edit_bones.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        y = unit(tail - head)
        z = np.cross(xa, y)
        b.align_roll(Vector(unit(z)))
        if parent:
            b.parent = arm.edit_bones[parent]
        b.use_connect = False
        b.use_deform = True
    bpy.ops.object.mode_set(mode='OBJECT')
    for h, src, ax in HELPERS:
        pb = ob.pose.bones[P + h]
        c = pb.constraints.new('COPY_ROTATION')
        c.name = 'half of ' + src
        c.target, c.subtarget = ob, P + src
        c.owner_space = c.target_space = 'LOCAL'
        c.use_x, c.use_y, c.use_z = 'X' in ax, 'Y' in ax, 'Z' in ax
        if ax == 'Y':
            c.euler_order = 'YXZ'            # twist about the bone first, swing after: Y is the twist of the hand
        c.influence = 0.5
    for pb in ob.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    arm.display_type = 'STICK'
    return ob


# ------------------------------------------------------------------------------------------------ mesh helpers
def mesh_arrays(me):
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(n, 3)
    e = np.empty(len(me.edges) * 2, np.int64)
    me.edges.foreach_get('vertices', e)
    e = e.reshape(-1, 2)
    hair = np.zeros(n, np.float32)
    me.attributes['hair'].data.foreach_get('value', hair)
    reg = np.zeros(len(me.polygons), np.int32)
    me.attributes['uv_region'].data.foreach_get('value', reg)
    cv = np.empty(len(me.loops), np.int64)
    me.loops.foreach_get('vertex_index', cv)
    ls = np.empty(len(me.polygons), np.int64)
    me.polygons.foreach_get('loop_start', ls)
    lt = np.empty(len(me.polygons), np.int64)
    me.polygons.foreach_get('loop_total', lt)
    face_of_loop = np.repeat(np.arange(len(me.polygons)), lt)
    has = np.zeros((n, 7), bool)                       # vertex touches a face of region r
    has[cv, reg[face_of_loop]] = True
    return co, e, hair, has


def adjacency(n, e):
    both = np.concatenate([e, e[:, ::-1]])
    order = np.argsort(both[:, 0], kind='stable')
    return both[order, 1], np.searchsorted(both[order, 0], np.arange(n + 1))


def smooth(W, nbr, start, mask, it, lam=0.5):
    """Laplacian smoothing of the weight rows of the vertices in mask."""
    cnt = np.diff(start)[:, None]
    for _ in range(it):
        avg = np.add.reduceat(W[nbr], start[:-1], axis=0) / cnt
        W[mask] = W[mask] * (1 - lam) + avg[mask] * lam
    return W


def geodesic(co, e, src, cap=0.2):
    """Edge-path distance from the vertex set src (bool), capped."""
    d = np.where(src, 0.0, cap)
    ln = np.linalg.norm(co[e[:, 0]] - co[e[:, 1]], axis=1)
    for _ in range(400):
        old = d.copy()
        np.minimum.at(d, e[:, 0], d[e[:, 1]] + ln)
        np.minimum.at(d, e[:, 1], d[e[:, 0]] + ln)
        if np.abs(old - d).max() < 1e-6:
            break
    return d


def seg_dist(p, a, b):
    ab = b - a
    t = np.clip((p - a) @ ab / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


# ------------------------------------------------------------------------------------------------ weights
def body_weights(co, e, hair, has, joints, names):
    n = len(co)
    idx = {nm: i for i, nm in enumerate(names)}
    W = np.zeros((n, len(names)))
    x, y, z = co.T

    def put(name, w):
        W[:, idx[P + name]] += w

    is_hair = hair > 0.5
    skin = (has[:, 2] | has[:, 3]) & ~is_hair                 # head / neck skin
    cloth = has[:, 0] | has[:, 6]
    hand_l, hand_r = has[:, 4], has[:, 5]

    # ---- limb memberships
    mem = {}
    for side, sg in (('Left', 1), ('Right', -1)):
        s = sg * x
        # arm: transition centre and width depend on where around the sleeve the vertex sits (top / underside)
        u = np.clip((z - J['Arm'][2]) / 0.065, -1, 1)
        s0, s1 = np.interp(u, SH_U, SH_START), np.interp(u, SH_U, SH_END)
        c = (s0 + s1) / 2
        a_torso = 1 - lin(s0, c, s)
        a_arm = lin(c, s1, s)
        a_torso = np.where(z < 1.20, 1.0, a_torso)
        a_arm = np.where(z < 1.20, 0.0, a_arm)
        mem[side + 'arm'] = (a_torso, a_arm)
        # leg: the boundary follows the groin crease, high on the outside of the hip and low at the crotch
        zc = 0.715 + 0.115 * lin(0.0, 0.19, s)
        lg = 1 - ss(zc - 0.055, zc + 0.055, z)
        lg = lg * ss(-0.025, 0.025, s)
        mem[side + 'leg'] = lg

    arm_any = (1 - mem['Leftarm'][0]) + (1 - mem['Rightarm'][0])
    leg_any = mem['Leftleg'] + mem['Rightleg']
    torso = np.clip(1 - arm_any - leg_any, 0, 1)

    # ---- spine chain (torso share)
    zs = [J[k][2] for k in ('Spine', 'Spine1', 'Spine2')]
    hw = 0.06
    up0, up1, up2 = (ss(q - hw, q + hw, z) for q in zs)
    w_hips, w_sp, w_sp1, w_sp2 = 1 - up0, up0 - up1, up1 - up2, up2.copy()
    # neck and head: only skin and hair leave the chest; the collar and everything else stays on Spine2
    d = z - (1.528 + 0.385 * y)                               # signed height above the jaw-to-nape plane
    g = geodesic(co, e, cloth & ~skin & ~is_hair, 0.2)        # distance over the surface from the clothes
    off = np.where(skin, ss(0.004, 0.045, g), 0.0)            # how far the skin has left the chest
    off = np.where(is_hair | (skin & (d > 0.03)), 1.0, off)
    w_head = off * np.where(is_hair, 1.0, ss(-0.035, 0.015, d))
    w_neck = off - w_head
    w_sp2 = w_sp2 * (1 - off)
    w_sp1 = w_sp1 * (1 - off)
    # clavicle: the shoulder block of the jacket
    cl = ss(0.07, 0.15, np.abs(x)) * ss(1.24, 1.32, z) * (1 - off)
    for side, sg in (('Left', 1), ('Right', -1)):
        k = cl * (sg * x > 0)
        put(side + 'Shoulder', torso * (w_sp2 + w_sp1) * k)
    put('Hips', torso * w_hips)
    put('Spine', torso * w_sp)
    put('Spine1', torso * w_sp1 * (1 - cl))
    put('Spine2', torso * w_sp2 * (1 - cl))
    put('Neck', torso * w_neck)
    put('Head', torso * w_head)

    # ---- arms
    for side, sg in (('Left', 1), ('Right', -1)):
        s = sg * x
        a_torso, a_arm = mem[side + 'arm']
        limb = 1 - a_torso                                    # everything that is not torso on this side
        limb = limb * (s > 0)
        half = np.clip(1 - a_torso - a_arm, 0, 1) * (s > 0)
        arm = a_arm * (s > 0)
        put(side + 'ArmHalf', half)
        sh, el, wr = (joints[P + side + k][0] for k in ('Arm', 'ForeArm', 'Hand'))
        ax = unit(wr - sh)
        t = (co - el) @ ax
        e_up = lin(-ELBOW_H, 0, t)                            # 0 on the upper arm, 1 at the elbow
        e_dn = lin(0, ELBOW_H, t)                             # 1 on the forearm
        put(side + 'Arm', arm * (1 - e_up))
        put(side + 'ElbowHalf', arm * (e_up - e_dn))
        fore = arm * e_dn
        hand = hand_l if sg > 0 else hand_r
        w_hand = np.where(hand, ss(WRIST_X - 0.006, WRIST_X + 0.014, s), 0.0)
        tw = ss(0.51, 0.66, s)
        put(side + 'ForeArm', fore * (1 - w_hand) * (1 - tw))
        put(side + 'ForeArmTwist', fore * (1 - w_hand) * tw)
        hw_ = fore * w_hand
        # fingers
        fw = finger_weights(co, hand & (hw_ > 0), joints, side)
        tot = np.zeros(n)
        for name, w in fw.items():
            W[:, idx[name]] += hw_ * w
            tot += w
        put(side + 'Hand', hw_ * (1 - tot))

    # ---- legs
    for side, sg in (('Left', 1), ('Right', -1)):
        lg = mem[side + 'leg']
        hip, kn, an, toe = (joints[P + side + k][0] for k in ('UpLeg', 'Leg', 'Foot', 'ToeBase'))
        ax = unit(an - hip)
        t = (co - kn) @ ax
        k_up, k_dn = lin(-KNEE_H, 0, t), lin(0, KNEE_H, t)
        w_foot = 1 - ss(0.085, 0.185, z)
        fd = unit((joints[P + side + 'ToeBase'][1] - toe) * V(1, 1, 0))
        w_toe = ss(-0.020, 0.025, (co - toe) @ fd) * (z < 0.13)
        put(side + 'UpLeg', lg * (1 - k_up))
        put(side + 'KneeHalf', lg * (k_up - k_dn))
        put(side + 'Leg', lg * k_dn * (1 - w_foot))
        put(side + 'Foot', lg * k_dn * w_foot * (1 - w_toe))
        put(side + 'ToeBase', lg * k_dn * w_foot * w_toe)
    W /= W.sum(1, keepdims=True)
    return W, dict(skin=skin, hair=is_hair, cloth=cloth, hand=hand_l | hand_r, neck_off=off, geodesic=geodesic)


def finger_weights(co, mask, joints, side):
    """Per-finger weights inside the hand (fractions of the hand's share). Each vertex is labelled with the nearest
    finger ray (carpus -> knuckle -> tip); the finger takes over from the Hand across the knuckle and the phalanges
    blend across the joints."""
    n = len(co)
    out = {}
    wr = joints[P + side + 'Hand'][0]
    ids = np.nonzero(mask)[0]
    p = co[ids]
    dist = []
    for f in FINGERS:
        b1 = joints['%s%sHand%s1' % (P, side, f)]
        b3 = joints['%s%sHand%s3' % (P, side, f)]
        dd = seg_dist(p, b1[0], b3[1])
        if f != 'Thumb':
            dd = np.minimum(dd, seg_dist(p, wr + (b1[0] - wr) * 0.25, b1[0]))
        dist.append(dd)
    dist = np.array(dist)
    lab = dist.argmin(0)
    for fi, f in enumerate(FINGERS):
        b = [joints['%s%sHand%s%d' % (P, side, f, k)] for k in (1, 2, 3)]
        sel = lab == fi
        q = p[sel]
        w1 = np.zeros(len(q))
        if f == 'Thumb':
            # metacarpal: takes over from the palm with distance from its axis and along it
            ax = unit(b[0][1] - b[0][0])
            t = (q - b[0][0]) @ ax
            L1 = np.linalg.norm(b[0][1] - b[0][0])
            near = 1 - ss(0.012, 0.024, seg_dist(q, b[0][0], b[2][1]))
            on = ss(-0.004, 0.012, t) * near
            h = 0.005
        else:
            ax = unit(b[2][1] - b[0][0])
            t = (q - b[0][0]) @ ax
            on = ss(-0.007, 0.006, t)
            h = 0.0045
        # joints 2 and 3: blend across the knuckle along the phalanx axis
        ax = unit(b[2][1] - b[1][0])
        t2 = (q - b[1][0]) @ ax
        t3 = (q - b[2][0]) @ ax
        u2 = ss(-h, h, t2)
        u3 = ss(-h, h, t3)
        for k, w in enumerate((on * (1 - u2), on * (u2 - u3), on * u3)):
            full = np.zeros(n)
            full[ids[sel]] = w
            out['%s%sHand%s%d' % (P, side, f, k + 1)] = full
    return out


def limit4(W):
    order = np.argsort(-W, axis=1)[:, :4]
    keep = np.zeros_like(W, bool)
    np.put_along_axis(keep, order, True, 1)
    W = np.where(keep & (W > 0.004), W, 0.0)
    return W / W.sum(1, keepdims=True)


def main():
    a = sys.argv[sys.argv.index('--') + 1:]
    src, lm_path, out = (os.path.abspath(q) for q in a[:3])
    bpy.ops.wm.open_mainfile(filepath=src)
    with open(lm_path) as fh:
        lm = json.load(fh)
    ob = bpy.data.objects['Hero']
    me = ob.data
    joints = build_joints(lm)
    names = list(joints)
    co, e, hair, has = mesh_arrays(me)
    nbr, start = adjacency(len(co), e)
    W, info = body_weights(co, e, hair, has, joints, names)

    # smoothing: clothes and limbs a little more, hands lightly (keeps fingers apart: smoothing follows the mesh), the
    # head not at all (hair and ears stay rigid), the neck skin a little
    x, y, z = co.T
    head_rigid = info['hair'] | (info['skin'] & (W[:, names.index(P + 'Head')] > 0.999))
    body = ~info['hand'] & ~head_rigid
    W = smooth(W, nbr, start, body, 4)
    W = smooth(W, nbr, start, body & (np.abs(x) > 0.12) & (np.abs(x) < 0.42) & (z > 1.2), 8)
    W = smooth(W, nbr, start, info['hand'], 2, 0.5)
    # smoothing must not leak the head into the clothes: the collar follows the chest, hair and ears the head
    pin = info['cloth'] & ~info['skin'] & ~info['hair']
    for nm in ('Neck', 'Head'):
        W[pin, names.index(P + nm)] = 0.0
    W /= W.sum(1, keepdims=True)
    W = face_weights(W, co, e, names, joints, info, lm, gl)
    W = limit4(W)

    arm = make_armature(joints)
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    for j, nm in enumerate(names):
        vg = ob.vertex_groups.new(name=nm)
        col = W[:, j]
        nz = np.nonzero(col)[0]
        for i in nz:
            vg.add((int(i),), float(col[i]), 'REPLACE')
    ob.parent = arm
    for m in list(ob.modifiers):
        ob.modifiers.remove(m)
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    used = (W > 0).sum(0)
    print('RIG joints', len(names), 'max influences', int((W > 0).sum(1).max()), 'unweighted bones', [names[i] for i in np.nonzero(used == 0)[0]])
    bpy.ops.wm.save_as_mainfile(filepath=out)
    rep = dict(joints=len(names), bones=names, vertices_per_bone={nm: int(used[i]) for i, nm in enumerate(names)})
    with open(os.path.splitext(out)[0] + '_report.json', 'w', newline='\n') as fh:
        json.dump(rep, fh, indent=1)
    print('RIG saved', out)


if __name__ == '__main__':
    main()
