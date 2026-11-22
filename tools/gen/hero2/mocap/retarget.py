"""Bake the prepared mocap clips onto a Mixamo-named armature as actions idle / walk / wave. Blender 5.0.

    blender -b <rig.blend> -P retarget.py -- clips=<dir with manifest.json> out=<result.blend>
            [armature=<object name>] [report=<file.json>] [only=walk,idle] [nla=1] [max_drop=0.03]

What it does, per clip:
  * rotations: the prepared BVH has zero rotation = T-pose, so each joint's global rotation is "how far this
    body part has turned away from the T-pose". The same world-space turn is applied to the matching rig bone
    and converted into the bone's own rest frame, so bone rolls do not matter. Upper and lower arms and legs
    (and hands) get an extra shortest-arc correction from the rig's rest direction to the mocap T-pose direction, so an
    A-pose or slightly bent rest pose still ends up pointing where the performer's limb pointed.
  * hips: the source hip-joint path is scaled by (rig leg length / source leg length).
  * feet: the ball of each foot follows the scaled source ball path (already pinned to the ground by
    prepare.py), the ankle is placed from it with the rig's own foot shape, and the legs are re-solved with
    two-bone IK. Feet keep the mocap orientation (flat while planted).
  * fingers: no finger data in the mocap, so a relaxed static curl; the waving hand opens while it is up.
  * bones the mocap does not cover (face, extra twist bones, anything unknown) are left untouched.

Writes one action per clip (fake user set, and one NLA track per action unless nla=0) and a JSON report with
the real stride and ground speed on this rig.
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bvh  # noqa: E402
import motion as mo  # noqa: E402

C = np.array([[1.0, 0, 0], [0, 0, -1], [0, 1, 0]])      # BVH space (Y up, +Z fwd) -> Blender world (Z up, -Y fwd)

# rig bone -> source joint(s). Two joints = average of their rotations.
BODY = {
    'Hips': ['Hips'], 'Spine': ['LowerBack'], 'Spine1': ['Spine'], 'Spine2': ['Spine1'],
    'Neck': ['Neck', 'Neck1'], 'Head': ['Head'],
}
for _s in ('Left', 'Right'):
    for _b in ('Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase'):
        BODY[_s + _b] = [_s + _b]
ALIGN = ('Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg')       # bones whose rest direction is matched to the mocap T-pose
FINGERS = ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')
# degrees of curl per joint (1, 2, 3) for a relaxed hand and for an open, waving hand
CURL = {
    'relaxed': {'Thumb': (8, 10, 8), 'Index': (14, 22, 14), 'Middle': (18, 26, 16), 'Ring': (22, 30, 18), 'Pinky': (26, 32, 20)},
    'open': {'Thumb': (2, 3, 2), 'Index': (3, 5, 3), 'Middle': (4, 6, 4), 'Ring': (5, 8, 5), 'Pinky': (7, 10, 6)},
}
HEEL_BACK = 0.055                                        # how far behind the ankle the heel touches down, metres


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return dict(x.split('=', 1) for x in a if '=' in x)


class Rig:
    """The armature seen as a BVH-like skeleton in BVH space (world metres), from the hips down the tree."""

    def __init__(self, ob):
        self.ob = ob
        hips = [b for b in ob.data.bones if b.name.endswith('Hips')]
        if not hips:
            raise SystemExit('retarget: no bone ending in "Hips" in armature %s' % ob.name)
        self.prefix = hips[0].name[:-4]
        self.bones = [hips[0]] + list(hips[0].children_recursive)
        self.names = [b.name[len(self.prefix):] if b.name.startswith(self.prefix) else b.name for b in self.bones]
        index = {b.name: i for i, b in enumerate(self.bones)}
        Mw = np.array(ob.matrix_world)
        self.Mw = Mw
        self.wscale = float(np.linalg.norm(Mw[:3, 0]))
        self.Rw = Mw[:3, :3] / self.wscale
        self.B2W = self.Rw.T @ C                          # BVH space -> armature space (rotation only)
        sk = bvh.Bvh()
        sk.names = self.names
        sk.parents = [-1] + [index[b.parent.name] for b in self.bones[1:]]
        heads = np.array([Mw[:3, :3] @ np.array(b.head_local) + Mw[:3, 3] for b in self.bones]) @ C   # world -> BVH: v @ C == C.T @ v
        tails = np.array([Mw[:3, :3] @ np.array(b.tail_local) + Mw[:3, 3] for b in self.bones]) @ C
        self.heads, self.tails = heads, tails
        sk.offsets = np.array([heads[i] - (heads[p] if p >= 0 else heads[i]) for i, p in enumerate(sk.parents)])
        sk.ends = {}
        sk.frame_time = 1 / 30
        sk.pos = np.zeros((1, 3))
        sk.R = np.tile(np.eye(3), (1, len(self.bones), 1, 1))
        self.sk = sk
        self.rest = np.array([np.array(b.matrix_local)[:3, :3] for b in self.bones])    # armature space, includes roll

    def idx(self, name):
        return self.names.index(name)

    def has(self, name):
        return name in self.names

    def child_dir(self, name, child):
        return mo.unit(self.heads[self.idx(child)] - self.heads[self.idx(name)])


def check_rig(rig):
    """Assumptions the maths relies on. Returns a list of warnings (empty = fine)."""
    w = []
    need = list(BODY)
    miss = [n for n in need if not rig.has(n)]
    if miss:
        raise SystemExit('retarget: armature lacks bones: ' + ', '.join(rig.prefix + m for m in miss))
    h = rig.heads
    up = h[rig.idx('Head')] - h[rig.idx('Hips')]
    if mo.unit(up)[1] < 0.95:
        w.append('spine is not vertical in world space (expected Z up)')
    left = h[rig.idx('LeftUpLeg')] - h[rig.idx('RightUpLeg')]
    if mo.unit(left)[0] < 0.95:
        w.append('LeftUpLeg is not on +X of RightUpLeg (expected the figure to face -Y in Blender)')
    toe = h[rig.idx('LeftToeBase')] - h[rig.idx('LeftFoot')]
    if toe[2] <= 0:
        w.append('toes do not point toward -Y: the figure seems to face the wrong way')
    for s in ('Left', 'Right'):
        d = rig.child_dir(s + 'Arm', s + 'ForeArm')
        a = math.degrees(math.acos(min(1, abs(d[0]))))
        if a > 12:
            w.append('%sArm rest is %.0f degrees off horizontal (not a T-pose): arm directions are corrected, '
                     'but shoulder, hand and finger twist then assume the hand was only swung down, not rolled' % (s, a))
        f = rig.tails[rig.idx(s + 'Foot')] - h[rig.idx(s + 'Foot')]
        if abs(math.degrees(math.atan2(f[0], f[2]))) > 12:
            w.append('%sFoot rest is turned out: feet are assumed to point straight ahead and lie flat in the rest pose' % s)
    lo = min(h[rig.idx('LeftToeBase')][1], h[rig.idx('RightToeBase')][1])
    if lo < -0.01 or lo > 0.08:
        w.append('toe joints are %.3f m above world z = 0: the floor is assumed to be z = 0 in the rest pose' % lo)
    ht = rig.tails[rig.idx('Head')][1]
    if not 1.5 < ht < 2.0:
        w.append('head top at %.2f m: expected a figure about 1.75 m tall (works anyway, stride scales with leg length)' % ht)
    for b in rig.bones:
        if not b.use_inherit_rotation:
            w.append('bone %s does not inherit rotation: unsupported' % b.name)
    return w


def finger_curl(rig, D, env):
    """World-delta rotations for finger bones: hand rotation times a curl toward the palm.
    env: None, or (F,) 0..1 opening of the right hand."""
    F = D.shape[0]
    down = np.array([0, -1.0, 0])
    for side in ('Left', 'Right'):
        hj = rig.idx(side + 'Hand')
        for fn in FINGERS:
            tot_r, tot_o = 0.0, 0.0
            for k in (1, 2, 3, 4):
                name = '%sHand%s%d' % (side, fn, k)
                if not rig.has(name):
                    continue
                j = rig.idx(name)
                d = mo.unit(rig.tails[j] - rig.heads[j])
                ax = np.cross(d, down)
                if np.linalg.norm(ax) < 1e-6:            # finger already points down (A-pose): curl about the arm's forward axis
                    ax = np.array([0, 0, 1.0]) * (1 if side == 'Left' else -1)
                ax = mo.unit(ax)
                kk = min(k, 3) - 1
                tot_r += math.radians(CURL['relaxed'][fn][kk]) * (0.5 if k == 4 else 1)
                tot_o += math.radians(CURL['open'][fn][kk]) * (0.5 if k == 4 else 1)
                if env is not None and side == 'Right':
                    ang = tot_r + (tot_o - tot_r) * env
                else:
                    ang = np.full(F, tot_r)
                D[:, j] = D[:, hj] @ bvh.rotvec2mat(ax[None] * ang[:, None])
    return D


def retarget_clip(rig, src, info, max_drop):
    """Returns (D (F, B, 3, 3) world-delta rotations in BVH space, hips head path (F, 3) in BVH space, stats)."""
    sk = rig.sk
    Gs, Ps = bvh.fk(src)
    F = Gs.shape[0]
    B = len(sk.names)
    D = np.tile(np.eye(3), (F, B, 1, 1))
    driven = np.zeros(B, bool)
    for name, joints in BODY.items():
        j = rig.idx(name)
        g = Gs[:, src.idx(joints[0])]
        if len(joints) == 2:
            g = mo.slerp(g, Gs[:, src.idx(joints[1])], np.full(F, 0.5))
        base = name.replace('Left', '').replace('Right', '')
        if base in ALIGN:
            side = name[:-len(base)]
            if base == 'Hand':
                mid = side + 'HandMiddle1'
                d_t = rig.child_dir(name, mid) if rig.has(mid) else mo.unit(rig.tails[j] - rig.heads[j])
                d_s = mo.unit(src.offsets[src.idx(side + 'HandIndex1')]) * np.array([1.0, 0, 0])
                d_t = d_t * np.array([1.0, 1.0, 0])          # only the droop is corrected, not where the knuckle sits
            else:
                child = {'Arm': 'ForeArm', 'ForeArm': 'Hand', 'UpLeg': 'Leg', 'Leg': 'Foot'}[base]
                d_t = rig.child_dir(name, side + child)
                d_s = mo.unit(src.offsets[src.idx(side + child)])
            g = g @ bvh.arc(d_t, d_s)
        D[:, j] = g
        driven[j] = True
    # undriven bones follow their parent for now (fingers are set below, the rest stays that way)
    for j, p in enumerate(sk.parents):
        if not driven[j] and p >= 0:
            D[:, j] = D[:, p]
    env = None
    if info['clip'] == 'wave':
        hy = Ps[:, src.idx('RightHand'), 1]
        env = mo.smoothstep((hy - hy[0]) / max(hy.max() - hy[0], 1e-6) / 0.6)
    D = finger_curl(rig, D, env)
    fing = np.array([('Hand' in n and n[-1].isdigit()) for n in sk.names])
    driven |= fing
    for j, p in enumerate(sk.parents):
        if not driven[j] and p >= 0:
            D[:, j] = D[:, p]

    # --- sizes
    def leg_len(s, a, b_, c):
        return float(np.linalg.norm(s.offsets[s.idx(b_)]) + np.linalg.norm(s.offsets[s.idx(c)]))
    Ls = np.mean([leg_len(src, s + 'UpLeg', s + 'Leg', s + 'Foot') for s in ('Left', 'Right')])
    Lt = np.mean([leg_len(sk, s + 'UpLeg', s + 'Leg', s + 'Foot') for s in ('Left', 'Right')])
    r = Lt / Ls
    srest = bvh.rest_positions(src)
    a_s = float(np.mean([srest[src.idx(s + 'Foot')][1] - srest[src.idx(s + 'ToeBase')][1] for s in ('Left', 'Right')]))
    ws = float(srest[src.idx('LeftUpLeg')][0] - srest[src.idx('RightUpLeg')][0]) / 2
    h = rig.heads
    a_t = float(np.mean([h[rig.idx(s + 'Foot')][1] for s in ('Left', 'Right')]))
    wt = float(h[rig.idx('LeftUpLeg')][0] - h[rig.idx('RightUpLeg')][0]) / 2
    xc = float(h[rig.idx('LeftUpLeg')][0] + h[rig.idx('RightUpLeg')][0]) / 2
    zc = float(h[rig.idx('Hips')][2])

    # --- hips: scaled source hip-joint midpoint
    Hs = (Ps[:, src.idx('LeftUpLeg')] + Ps[:, src.idx('RightUpLeg')]) / 2
    Ht = np.stack([xc + r * Hs[:, 0], a_t + r * (Hs[:, 1] - a_s), zc + r * Hs[:, 2]], -1)
    hj = rig.idx('Hips')
    mid_rest = (h[rig.idx('LeftUpLeg')] + h[rig.idx('RightUpLeg')]) / 2 - h[hj]
    hips = Ht - mo.mv(D[:, hj], mid_rest)

    # --- feet. Two ways to place the ankle, which agree exactly while the foot is flat:
    #   ankle: the ankle follows the scaled source ankle path, so hip-knee-ankle is the performer's leg.
    #          Used while the foot is flat, in the air, and at heel strike (toes still up).
    #   ball: the ball of the foot follows the scaled source ball path (shifted by the difference in foot
    #          length so both agree when flat) and the ankle comes from the rig's own foot shape. Used at
    #          heel-off, when the foot pivots on the ball: no sliding, toes stay on the floor.
    # The weight follows which end of the source foot is higher.
    tb = sk.copy()
    tb.R = mo.locals_from_globals(sk, D)
    tb.pos = hips - sk.offsets[0]
    _, P = bvh.fk(tb)
    legs, targets, heel_lift = [], [], 0.0
    for s, sgn in (('Left', 1), ('Right', -1)):
        ju, jl, jf, jt = (rig.idx(s + n) for n in ('UpLeg', 'Leg', 'Foot', 'ToeBase'))
        Bs = Ps[:, src.idx(s + 'ToeBase')]
        As = Ps[:, src.idx(s + 'Foot')]
        side = np.array([xc + sgn * (wt - r * ws), 0, zc])
        foot_t = h[jt] - h[jf]                                            # rig ankle -> ball, rest (flat)
        foot_s = srest[src.idx(s + 'ToeBase')] - srest[src.idx(s + 'Foot')]   # source ankle -> ball, rest (flat)
        a_side = float(-foot_s[1])                                        # this foot's own flat ankle height
        heading = mo.yaw_mat(mo.yaw_of(mo.mv(D[:, jf], np.array([0, 0, 1.0]))))   # the foot's turn-out, per frame
        shift = mo.mv(heading, (foot_t - r * foot_s) * np.array([1.0, 0, 1.0]))  # the rig's foot is longer or shorter
        ball = side + r * Bs + np.array([0, h[jt][1], 0]) + shift
        ank_ball = ball - mo.mv(D[:, jf], foot_t)
        ank_direct = side + r * As + np.array([0, h[jf][1] - r * a_side, 0])
        u = (As[:, 1] - a_side) - Bs[:, 1]                                  # > 0 heel up, < 0 toes up (source metres)
        wb = mo.smoothstep(0.5 + u / 0.03)[:, None]
        ank = wb * ank_ball + (1 - wb) * ank_direct
        heel_rest = np.array([0.0, -h[jf][1], -HEEL_BACK])                # from the ankle to the heel's floor contact
        heel_y = ank[:, 1] + mo.mv(D[:, jf], heel_rest)[:, 1]
        ball_y = ank[:, 1] + mo.mv(D[:, jf], foot_t)[:, 1] - h[jt][1]
        lift = np.maximum(-np.minimum(heel_y, ball_y), 0)
        if lift.max() > 1e-4:
            lift = mo.envelope(lift, 1.0, wrap=bool(info.get('loop')))
        ank[:, 1] += lift
        # out of reach with this rig's leg: lift the heel a little more rather than slide or dip
        L = float(np.linalg.norm(sk.offsets[jl]) + np.linalg.norm(sk.offsets[jf]))
        D[:, jf], ank, need = mo.pitch_to_reach(P[:, ju], ank + mo.mv(D[:, jf], foot_t), D[:, jf], foot_t, L,
                                                wrap=bool(info.get('loop')))
        heel_lift = max(heel_lift, float(np.degrees(need.max())))
        legs.append((ju, jl, jf))
        targets.append(ank)
    D, pos, miss = mo.solve_legs(sk, D, P, tb.pos, legs, targets, 30, max_drop=max_drop, wrap=bool(info.get('loop')))
    drop = float((tb.pos - pos)[:, 1].max())
    hips = pos + sk.offsets[0]
    # toes: never let the toe tip go under its rest height (the rig's toe is not the performer's)
    tb.R = mo.locals_from_globals(sk, D)
    tb.pos = pos
    _, P = bvh.fk(tb)
    for s in ('Left', 'Right'):
        jf, jt = rig.idx(s + 'Foot'), rig.idx(s + 'ToeBase')
        tipv = rig.tails[jt] - h[jt]
        flat = mo.yaw_mat(mo.yaw_of(mo.mv(D[:, jf], np.array([0, 0, 1.0]))))
        best = D[:, jt].copy()
        done = np.zeros(F, bool)
        for wgt in np.linspace(0, 1, 11):
            cand = mo.slerp(D[:, jt], flat, np.full(F, wgt))
            ok = ((P[:, jt, 1] + mo.mv(cand, tipv)[:, 1]) >= rig.tails[jt][1] - 0.001) & ~done
            best[ok] = cand[ok]
            done |= ok
        best[~done] = flat[~done]
        D[:, jt] = bvh.quat2mat(bvh.smooth(bvh.quat_continuous(bvh.mat2quat(best)), 0.5, wrap=False))
    if info.get('loop'):
        D[-1], hips[-1] = D[0], hips[0]
    stats = dict(leg_ratio=round(float(r), 4), rig_leg_length=round(float(Lt), 4), ankle_miss=round(miss, 4),
                 hips_drop=round(drop, 4), extra_heel_lift_deg=round(heel_lift, 2))
    if 'stride_per_cycle' in info:
        stats['stride_per_cycle'] = round(float(info['stride_per_cycle'] * r), 4)
        stats['cycle_duration'] = info['cycle_duration']
        stats['ground_speed'] = round(float(info['stride_per_cycle'] * r / info['cycle_duration']), 4)
    return D, hips, stats


def action_fcurves(act):
    if hasattr(act, 'layers') and len(act.layers):
        out = []
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    out.extend(bag.fcurves)
        return out
    return list(act.fcurves)


def bake(rig, name, D, hips, fps, frame0=0):
    """Write the motion as an action of quaternion keys (plus hips location) on the rig."""
    ob = rig.ob
    F = D.shape[0]
    sk = rig.sk
    Dl = np.empty_like(D)
    for j, p in enumerate(sk.parents):
        Dl[:, j] = D[:, j] if p < 0 else mo.T(D[:, p]) @ D[:, j]
    # into armature space, then into each bone's rest frame (this is where bone roll is absorbed)
    W = rig.B2W
    q = np.empty((F, len(sk.names), 4))
    for j in range(len(sk.names)):
        A = W @ Dl[:, j] @ W.T
        Mr = rig.rest[j]
        q[:, j] = bvh.quat_continuous(bvh.mat2quat(Mr.T @ A @ Mr))
    # hips location: displacement from rest, armature space, in the hips bone's rest frame
    dp = (hips - rig.heads[0]) @ C.T                       # BVH -> world
    dp = dp @ rig.Rw / rig.wscale                          # world -> armature space
    loc = dp @ rig.rest[0]                                 # == rest[0].T @ dp
    hb = rig.bones[0]
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    if not ob.animation_data:
        ob.animation_data_create()
    ob.animation_data.action = act
    ident = np.array([1.0, 0, 0, 0])
    moving = [j for j in range(len(sk.names)) if np.abs(q[:, j] - ident).max() > 1e-6]
    for j in moving:
        ob.pose.bones[rig.bones[j].name].rotation_mode = 'QUATERNION'
    static = [j for j in moving if np.abs(q[:, j] - q[:1, j]).max() < 1e-7]
    for f in range(F):
        for j in moving:
            if j in static and 0 < f < F - 1:
                continue
            pb = ob.pose.bones[rig.bones[j].name]
            pb.rotation_quaternion = Quaternion(q[f, j])
            pb.keyframe_insert('rotation_quaternion', frame=frame0 + f, group=pb.name)
        pb = ob.pose.bones[hb.name]
        pb.location = Vector(loc[f])
        pb.keyframe_insert('location', frame=frame0 + f, group=pb.name)
    for fc in action_fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    try:
        act.use_frame_range = True
        act.frame_start, act.frame_end = frame0, frame0 + F - 1
    except AttributeError:
        pass
    return act


def measure(rig, act, info, stats):
    """Read the baked action back through Blender's own evaluation and measure the feet."""
    ob = rig.ob
    sc = bpy.context.scene
    ob.animation_data.action = act
    try:
        if act.slots and ob.animation_data.action_slot is None:
            ob.animation_data.action_slot = act.slots[0]
    except AttributeError:
        pass
    f0, f1 = [int(round(x)) for x in act.frame_range]
    names = ['LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot', 'Hips', 'Head', 'LeftLeg', 'RightLeg', 'LeftUpLeg', 'RightUpLeg']
    path = {n: [] for n in names}
    toe_tail = {'LeftToeBase': [], 'RightToeBase': []}
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        oe = ob.evaluated_get(dg)
        for n in names:
            pb = oe.pose.bones[rig.prefix + n]
            path[n].append(np.array(oe.matrix_world @ pb.head))
            if n in toe_tail:
                toe_tail[n].append(np.array(oe.matrix_world @ pb.tail))
    path = {k: np.array(v) for k, v in path.items()}
    out = {}
    belt = stats.get('ground_speed', 0.0)
    n = f1 - f0 + 1
    t = np.arange(n) / 30.0
    worst_slide, low_ball, low_tip = 0.0, 1e9, 1e9
    for s in ('Left', 'Right'):
        ball = path[s + 'ToeBase'].copy()
        rest_h = float(rig.heads[rig.idx(s + 'ToeBase')][1])
        # Blender world: forward is -Y, so the ground under an in-place walk moves toward +Y
        gw = ball.copy()
        gw[:, 1] -= belt * t                                 # position on the ground (ground moves +Y at belt speed)
        ank_rest = float(rig.heads[rig.idx(s + 'Foot')][1])
        planted = (ball[:, 2] < rest_h + 0.004) & (path[s + 'Foot'][:, 2] < ank_rest + 0.01)   # flat on the floor
        for a, b_ in mo.runs(planted):
            if b_ - a >= 3:
                seg = gw[a:b_, :2]
                worst_slide = max(worst_slide, float(np.linalg.norm(seg - seg.mean(0), axis=1).max()))
        tip_rest = float(rig.tails[rig.idx(s + 'ToeBase')][1])
        low_ball = min(low_ball, float(ball[:, 2].min() - rest_h))
        low_tip = min(low_tip, float(np.array(toe_tail[s + 'ToeBase'])[:, 2].min() - tip_rest))
        knee, hip, ank = path[s + 'Leg'], path[s + 'UpLeg'], path[s + 'Foot']
        # knee in front of the hip-ankle line (forward = -Y)
        mid = hip + (ank - hip) * (np.sum((knee - hip) * (ank - hip), 1) / np.sum((ank - hip) ** 2, 1))[:, None]
        out[s.lower() + '_knee_forward_min'] = round(float((mid[:, 1] - knee[:, 1]).min()), 4)
    out['flat_foot_max_drift'] = round(worst_slide, 4)
    out['ball_lowest_vs_rest_height'] = round(low_ball, 4)
    out['toe_tip_lowest_vs_rest_height'] = round(low_tip, 4)
    out['hips_bob'] = round(float(np.ptp(path['Hips'][:, 2])), 4)
    out['hips_sway'] = round(float(np.ptp(path['Hips'][:, 0])), 4)
    out['hips_fore_aft'] = round(float(np.ptp(path['Hips'][:, 1])), 4)
    out['head_bob'] = round(float(np.ptp(path['Head'][:, 2])), 4)
    if info.get('loop'):
        out['loop_seam_max_joint_jump'] = round(float(max(np.linalg.norm(v[-1] - v[0]) for v in path.values())), 6)
        # acceleration across the seam compared with the largest acceleration anywhere else in the clip (<= 1 is invisible)
        worst = 0.0
        for v in path.values():
            acc = np.linalg.norm(v[2:] - 2 * v[1:-1] + v[:-2], axis=1)
            seam = np.linalg.norm(v[1] - 2 * v[0] + v[-2])
            worst = max(worst, float(seam / max(acc.max(), 1e-6)))
        out['loop_seam_accel_vs_clip_max'] = round(worst, 3)
    return out


def main():
    kw = args()
    if 'clips' not in kw:
        raise SystemExit(__doc__)
    cdir = os.path.abspath(kw['clips'])
    with open(os.path.join(cdir, 'manifest.json')) as fh:
        man = json.load(fh)
    arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    ob = bpy.data.objects.get(kw.get('armature', '')) or (arms[0] if arms else None)
    if ob is None:
        raise SystemExit('retarget: no armature in this file')
    sc = bpy.context.scene
    sc.render.fps = 30
    sc.render.fps_base = 1.0
    for pb in ob.pose.bones:                                # start from the rest pose
        pb.matrix_basis = Matrix.Identity(4)
    rig = Rig(ob)
    warns = check_rig(rig)
    for w in warns:
        print('RETARGET WARNING:', w)
    only = kw.get('only', '').split(',') if kw.get('only') else None
    report = dict(armature=ob.name, bone_prefix=rig.prefix, warnings=warns, clips={})
    made = []
    for info in man['clips']:
        name = info['clip']
        if only and name not in only:
            continue
        src = bvh.load(os.path.join(cdir, info['file']))
        D, hips, stats = retarget_clip(rig, src, info, float(kw.get('max_drop', 0.03)))
        act = bake(rig, name, D, hips, info['fps'])
        stats.update(frames=int(D.shape[0]), duration=info['duration'], loop=bool(info.get('loop')))
        stats.update(measure(rig, act, info, stats))
        report['clips'][name] = stats
        made.append(act)
        print('RETARGET', name, json.dumps(stats))
    if kw.get('nla', '1') == '1':
        ad = ob.animation_data
        ad.action = None
        for act in made:
            tr = ad.nla_tracks.get(act.name)
            if tr:
                ad.nla_tracks.remove(tr)
            tr = ad.nla_tracks.new()
            tr.name = act.name
            st = tr.strips.new(act.name, int(act.frame_range[0]), act)
            st.name = act.name
    for pb in ob.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    sc.frame_set(0)
    if kw.get('report'):
        with open(os.path.abspath(kw['report']), 'w', newline='\n') as fh:
            json.dump(report, fh, indent=1)
    if kw.get('out'):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(kw['out']))
        print('RETARGET saved', kw['out'])


if __name__ == '__main__':
    main()
