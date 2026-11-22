"""Stage 3 helpers: a numpy model of the rig (FK, two-bone IK), rotation maths, reading / writing actions.

Conventions used by every anim_* script
  * Blender world = armature space: Z up, the character faces -Y, its left is +X.
  * A pose is (B, loc): B[f, bone] = the bone's local rotation from rest (what Blender calls the pose basis,
    3x3) and loc[f] = the hips bone's location channel.
  * D[f, bone] = "world delta": how far the bone has turned away from its rest orientation, in world axes.
    D_child = D_parent @ R_child @ B_child @ R_child.T (R = rest orientation), and a joint sits at
    pos_parent + D_parent @ (rest_head_child - rest_head_parent). Editing D of one bone leaves the world
    orientation of its children alone, which is what most of the clean-up wants.
"""
import math

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

P = 'mixamorig:'
FING = ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')
HELPERS = ('ArmHalf', 'ElbowHalf', 'KneeHalf', 'ForeArmTwist')
FACE = ['Jaw', 'LipUpper', 'LipLower'] + [s + n for n in ('EyelidUpper', 'EyelidLower', 'Brow', 'MouthCorner', 'Cheek')
                                         for s in ('Left', 'Right')]
X, Y, Z = np.eye(3)
rad = np.radians


# ------------------------------------------------------------------ rotations
def unit(v):
    v = np.asarray(v, float)
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-12)


def T(M):
    return np.swapaxes(M, -1, -2)


def mv(M, v):
    return np.einsum('...ij,...j->...i', M, v)


def rot(axis, ang):
    """Rodrigues. axis (..., 3) unit, ang (...) radians -> (..., 3, 3)"""
    axis = unit(axis)
    ang = np.asarray(ang, float)
    axis, ang = np.broadcast_arrays(axis, ang[..., None])
    ang = ang[..., 0]
    x, y, z = axis[..., 0], axis[..., 1], axis[..., 2]
    c, s = np.cos(ang), np.sin(ang)
    C = 1 - c
    return np.stack([np.stack([c + x * x * C, x * y * C - z * s, x * z * C + y * s], -1),
                     np.stack([y * x * C + z * s, c + y * y * C, y * z * C - x * s], -1),
                     np.stack([z * x * C - y * s, z * y * C + x * s, c + z * z * C], -1)], -2)


def rx(a):
    return rot(X, a)


def ry(a):
    return rot(Y, a)


def rz(a):
    return rot(Z, a)


def euler(deg):
    """Blender XYZ Euler in degrees (..., 3) -> matrix (X applied first)"""
    r = np.radians(np.asarray(deg, float))
    return rz(r[..., 2]) @ ry(r[..., 1]) @ rx(r[..., 0])


def to_euler(M):
    """inverse of euler(), degrees"""
    sy = -M[..., 2, 0]
    y = np.arcsin(np.clip(sy, -1, 1))
    x = np.arctan2(M[..., 2, 1], M[..., 2, 2])
    z = np.arctan2(M[..., 1, 0], M[..., 0, 0])
    return np.degrees(np.stack([x, y, z], -1))


def mat2quat(M):
    M = np.asarray(M, float)
    m = lambda i, j: M[..., i, j]  # noqa: E731
    tr = m(0, 0) + m(1, 1) + m(2, 2)
    cand = np.stack([1 + tr, 1 + m(0, 0) - m(1, 1) - m(2, 2), 1 - m(0, 0) + m(1, 1) - m(2, 2), 1 - m(0, 0) - m(1, 1) + m(2, 2)], -1)
    k = cand.argmax(-1)
    s = 2 * np.sqrt(np.maximum(np.take_along_axis(cand, k[..., None], -1)[..., 0], 1e-12))
    q0 = np.stack([s / 4, (m(2, 1) - m(1, 2)) / s, (m(0, 2) - m(2, 0)) / s, (m(1, 0) - m(0, 1)) / s], -1)
    q1 = np.stack([(m(2, 1) - m(1, 2)) / s, s / 4, (m(0, 1) + m(1, 0)) / s, (m(0, 2) + m(2, 0)) / s], -1)
    q2 = np.stack([(m(0, 2) - m(2, 0)) / s, (m(0, 1) + m(1, 0)) / s, s / 4, (m(1, 2) + m(2, 1)) / s], -1)
    q3 = np.stack([(m(1, 0) - m(0, 1)) / s, (m(0, 2) + m(2, 0)) / s, (m(1, 2) + m(2, 1)) / s, s / 4], -1)
    q = np.where((k == 0)[..., None], q0, np.where((k == 1)[..., None], q1, np.where((k == 2)[..., None], q2, q3)))
    q = unit(q)
    return np.where(q[..., :1] < 0, -q, q)


def quat2mat(q):
    q = unit(q)
    w, x, y, z = q[..., 0], q[..., 1], q[..., 2], q[..., 3]
    return np.stack([np.stack([1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], -1),
                     np.stack([2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], -1),
                     np.stack([2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)], -1)], -2)


def qslerp(a, b, t):
    a, b = np.broadcast_arrays(np.asarray(a, float), np.asarray(b, float))
    t = np.broadcast_to(np.asarray(t, float), a.shape[:-1])[..., None]
    d = np.sum(a * b, -1, keepdims=True)
    b = np.where(d < 0, -b, b)
    d = np.clip(np.abs(d), 0, 1)
    th = np.arccos(d)
    s = np.sin(th)
    small = s < 1e-6
    s = np.where(small, 1, s)
    wa = np.where(small, 1 - t, np.sin((1 - t) * th) / s)
    wb = np.where(small, t, np.sin(t * th) / s)
    return unit(wa * a + wb * b)


def slerp(A, B, t):
    """matrices"""
    return quat2mat(qslerp(mat2quat(A), mat2quat(B), t))


def scale_rot(M, k):
    """rotation with the same axis and k times the angle"""
    return slerp(np.broadcast_to(np.eye(3), M.shape), M, k)


def arc(a, b):
    """shortest rotation taking unit vector a to b (..., 3)"""
    a, b = unit(a), unit(b)
    ax = np.cross(a, b)
    n = np.linalg.norm(ax, axis=-1)
    ang = np.arctan2(n, np.sum(a * b, -1))
    ax = np.where(n[..., None] < 1e-9, X, ax)
    return rot(ax, ang)


def frame(fwd, up):
    """orthonormal matrix with columns (side, fwd, up'): fwd exact, up as close as possible"""
    f = unit(fwd)
    s = unit(np.cross(f, up))
    u = np.cross(s, f)
    return np.stack([s, f, u], -1)


def ypr(D):
    """world delta -> yaw (+ = the nose turns toward +X, the character's left), pitch (+ = forward / down),
    roll (+ = the top leans toward +X, the character's left), radians. D = rz(yaw) @ rx(pitch) @ ry(roll)."""
    f = mv(D, -Y)
    yaw = np.arctan2(f[..., 0], -f[..., 1])
    D1 = rz(-yaw) @ D
    f1 = mv(D1, -Y)
    pitch = np.arctan2(-f1[..., 2], -f1[..., 1])
    D2 = rx(-pitch) @ D1
    u = mv(D2, Z)
    roll = np.arctan2(u[..., 0], u[..., 2])
    return yaw, pitch, roll


def from_ypr(yaw, pitch, roll):
    return rz(yaw) @ rx(pitch) @ ry(roll)


def quat_continuous(q):
    q = q.copy()
    for f in range(1, len(q)):
        flip = np.sum(q[f] * q[f - 1], -1) < 0
        q[f][flip] *= -1
    return q


# ------------------------------------------------------------------ curves
def smoothstep(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def smoother(t):
    t = np.clip(t, 0, 1)
    return t * t * t * (t * (6 * t - 15) + 10)


def ease(t, a=2.0, b=2.0):
    """0..1 ease whose velocity is the bump t^a (1-t)^b: a < b starts briskly and settles slowly. C1 at both ends for a, b >= 1."""
    t = np.clip(np.asarray(t, float), 0, 1)
    g = np.linspace(0, 1, 2001)
    v = g ** a * (1 - g) ** b
    c = np.concatenate([[0], np.cumsum((v[1:] + v[:-1]) / 2)])
    return np.interp(t, g, c / c[-1])


def seg(t, t0, t1, a=2.0, b=2.0):
    """ease from 0 at time t0 to 1 at time t1"""
    return ease((np.asarray(t, float) - t0) / (t1 - t0), a, b)


def bump(t, t0, t1, t2, t3, a=2.0, b=2.0):
    """0 before t0, 1 between t1 and t2, 0 after t3"""
    return seg(t, t0, t1, a, b) * (1 - seg(t, t2, t3, a, b))


def loop_smooth(x, sigma):
    """circular gaussian low-pass along axis 0 (x holds N periodic samples, no duplicate end)"""
    k = np.arange(-int(4 * sigma) - 1, int(4 * sigma) + 2)
    w = np.exp(-0.5 * (k / sigma) ** 2)
    w /= w.sum()
    out = np.zeros_like(x, dtype=float)
    for kk, ww in zip(k, w):
        out += ww * np.roll(x, kk, axis=0)
    return out


def loop_smooth_rot(M, sigma):
    q = quat_continuous(mat2quat(M))
    if np.any(np.sum(q[0] * q[-1], -1) < 0):          # a sign flip across the seam would average badly
        return M
    return quat2mat(loop_smooth(q, sigma))


def loop_sample(x, pos, rotation=False):
    """periodic sampling of N samples at fractional positions pos (any shape (K,))"""
    n = len(x)
    pos = np.asarray(pos, float) % n
    i0 = np.floor(pos).astype(int) % n
    i1 = (i0 + 1) % n
    t = pos - np.floor(pos)
    if rotation:
        tt = t.reshape((-1,) + (1,) * (x.ndim - 3))
        return slerp(x[i0], x[i1], np.broadcast_to(tt, x[i0].shape[:-2]))
    tt = t.reshape((-1,) + (1,) * (x.ndim - 1))
    return x[i0] * (1 - tt) + x[i1] * tt


# ------------------------------------------------------------------ rig model
class Rig:
    def __init__(self, ob):
        self.ob = ob
        bones = sorted(ob.data.bones, key=lambda b: len(b.parent_recursive))
        self.bones = [b.name for b in bones]
        self.names = [b.name[len(P):] for b in bones]
        self.ix = {n: i for i, n in enumerate(self.names)}
        self.parent = [self.ix[b.parent.name[len(P):]] if b.parent else -1 for b in bones]
        self.R = np.array([np.array(b.matrix_local)[:3, :3] for b in bones])
        self.head = np.array([np.array(b.head_local) for b in bones])
        self.tail = np.array([np.array(b.tail_local) for b in bones])
        self.n = len(bones)
        self.helper = [i for i, n in enumerate(self.names) if n.endswith(HELPERS)]
        self.keyed = [i for i, n in enumerate(self.names) if not n.endswith(HELPERS)]

    def i(self, name):
        return self.ix[name]

    def subtree(self, name):
        r = self.ix[name]
        out = [r]
        for j in range(self.n):
            if self.parent[j] in out and j not in out:
                out.append(j)
        return out

    def chain(self, name):
        """the bone and its ancestors, root first"""
        j, out = self.ix[name], []
        while j >= 0:
            out.append(j)
            j = self.parent[j]
        return out[::-1]

    def rest_pose(self, F):
        return np.tile(np.eye(3), (F, self.n, 1, 1)), np.zeros((F, 3))

    def fk(self, B, loc):
        """-> D (F, n, 3, 3), pos (F, n, 3) joint (bone head) positions"""
        F = B.shape[0]
        D = np.empty_like(B)
        pos = np.empty((F, self.n, 3))
        for j in range(self.n):
            p = self.parent[j]
            L = self.R[j] @ B[:, j] @ self.R[j].T
            if p < 0:
                D[:, j] = L
                pos[:, j] = self.head[j] + loc @ self.R[j].T
            else:
                D[:, j] = D[:, p] @ L
                pos[:, j] = pos[:, p] + mv(D[:, p], self.head[j] - self.head[p])
        return D, pos

    def local(self, D):
        B = np.empty_like(D)
        for j in range(self.n):
            p = self.parent[j]
            L = D[:, j] if p < 0 else T(D[:, p]) @ D[:, j]
            B[:, j] = self.R[j].T @ L @ self.R[j]
        return B

    def positions(self, D, hips):
        """joint positions from world deltas and the hips joint path"""
        pos = np.empty((D.shape[0], self.n, 3))
        for j in range(self.n):
            p = self.parent[j]
            pos[:, j] = hips if p < 0 else pos[:, p] + mv(D[:, p], self.head[j] - self.head[p])
        return pos

    def loc_from_hips(self, hips):
        return (hips - self.head[0]) @ self.R[0]

    def follow(self, D, name, Dnew, skip=()):
        """set bone `name` to Dnew and carry its whole subtree along rigidly (bones in `skip` and below keep their world orientation)"""
        j = self.ix[name]
        delta = Dnew @ T(D[:, j])
        keep = set()
        for s in skip:
            keep |= set(self.subtree(s))
        for k in self.subtree(name):
            if k not in keep:
                D[:, k] = delta @ D[:, k]
        return D

    # ---- legs
    def solve_leg(self, D, pos, side, hip, ankle):
        """re-solve UpLeg / Leg so the ankle lands on `ankle` with the hip joint at `hip`. The knee stays a hinge and keeps
        its direction (the leg is turned by the shortest arc). Foot and toes keep their world orientation.
        Returns the largest miss (target out of reach)."""
        ju, jl, jf = self.ix[side + 'UpLeg'], self.ix[side + 'Leg'], self.ix[side + 'Foot']
        vu, vl = self.head[jl] - self.head[ju], self.head[jf] - self.head[jl]
        axis0 = self.R[jl][:, 0]                              # knee hinge (Leg local X) in rest
        Du, Dl = D[:, ju], D[:, jl]
        H = T(Du) @ Dl                                        # current hinge rotation, thigh frame
        flex0 = np.arctan2(np.einsum('i,fij,j->f', np.cross(axis0, unit(vl)), H, unit(vl)), np.einsum('i,fij,j->f', unit(vl), H, unit(vl)))
        want = np.linalg.norm(ankle - hip, axis=-1)
        reach = np.linalg.norm(vu) + np.linalg.norm(vl)
        miss = np.maximum(want - reach * 0.9995, 0)
        want = np.minimum(want, reach * 0.9995)
        # distance as a function of an extra flex angle: bisection (flex shortens the leg)
        lo, hi = -flex0 - 0.0, np.full_like(flex0, math.radians(150)) - flex0
        lo = np.minimum(lo, 0.0)

        def dist(d):
            return np.linalg.norm(vu + mv(rot(axis0, d) @ H, vl), axis=-1)
        for _ in range(40):
            mid = (lo + hi) / 2
            longer = dist(mid) > want
            lo = np.where(longer, mid, lo)
            hi = np.where(longer, hi, mid)
        d = (lo + hi) / 2
        H2 = rot(axis0, d) @ H
        c = mv(Du, vu + mv(H2, vl))
        A = arc(c, ankle - hip)
        D[:, ju] = A @ Du
        D[:, jl] = D[:, ju] @ H2
        return float(miss.max())

    # ---- arms
    def solve_arm(self, D, side, shoulder_pos, wrist, pole):
        """Arm / ForeArm from scratch: wrist on `wrist`, elbow as close to the direction `pole` (from the shoulder) as the
        hinge allows. The elbow is a pure hinge about the ForeArm's local Z. D[:, Shoulder] must be set. Returns elbow flexion (rad)."""
        ja, jf, jh = self.ix[side + 'Arm'], self.ix[side + 'ForeArm'], self.ix[side + 'Hand']
        va, vf = self.head[jf] - self.head[ja], self.head[jh] - self.head[jf]
        ax = self.R[jf][:, 2]
        sgn = 1.0 if side == 'Left' else -1.0                 # left flexes with +Z, right with -Z
        t = wrist - shoulder_pos
        want = np.linalg.norm(t, axis=-1)
        reach = np.linalg.norm(va) + np.linalg.norm(vf)
        want = np.clip(want, 0.08, reach * 0.999)
        lo, hi = np.zeros_like(want), np.full_like(want, math.radians(155))
        for _ in range(40):
            mid = (lo + hi) / 2
            longer = np.linalg.norm(va + mv(rot(ax, sgn * mid), vf), axis=-1) > want
            lo = np.where(longer, mid, lo)
            hi = np.where(longer, hi, mid)
        flex = (lo + hi) / 2
        H = rot(ax, sgn * flex)
        c = va + mv(H, vf)                                    # rest-frame shoulder -> wrist
        A = arc(c, t)
        # swivel about the shoulder-wrist line so the elbow points along the pole
        n = unit(t)
        e = mv(A, np.broadcast_to(va, c.shape))
        e_p = e - n * np.sum(e * n, -1, keepdims=True)
        p_p = pole - n * np.sum(pole * n, -1, keepdims=True)
        ang = np.arctan2(np.sum(np.cross(e_p, p_p) * n, -1), np.sum(e_p * p_p, -1))
        Da = rot(n, ang) @ A
        D[:, ja] = Da
        D[:, jf] = Da @ H
        return flex


def hand_frame(side, fingers, palm):
    """world delta for a hand whose fingers point along `fingers` and whose palm faces `palm` (rest: fingers along +-X, palm down)"""
    f0 = X if side == 'Left' else -X
    rest = np.stack([f0, -Z, np.cross(f0, -Z)], -1)
    f = unit(fingers)
    p = np.asarray(palm, float)
    p = unit(p - f * np.sum(p * f, -1, keepdims=True))
    now = np.stack([f, p, np.cross(f, p)], -1)
    return now @ rest.T


# ------------------------------------------------------------------ Blender side
def fcurves_of(act):
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


def use_action(ob, act):
    ad = ob.animation_data or ob.animation_data_create()
    for tr in ad.nla_tracks:
        tr.mute = True
    ad.action = act
    if act is not None and act.slots and ad.action_slot is None:
        ad.action_slot = act.slots[0]


def read_action(rig, act):
    """sample an action on every whole frame -> (B, loc)"""
    ob = rig.ob
    use_action(ob, act)
    sc = bpy.context.scene
    f0, f1 = [int(round(v)) for v in act.frame_range]
    F = f1 - f0 + 1
    B, loc = rig.rest_pose(F)
    for f in range(F):
        sc.frame_set(f0 + f)
        for j in rig.keyed:
            pb = ob.pose.bones[rig.bones[j]]
            m = np.array(pb.matrix_basis)
            B[f, j] = m[:3, :3]
            if j == 0:
                loc[f] = m[:3, 3]
    return B, loc


def write_action(rig, name, B, loc, bones=None, tol=1e-7):
    """quaternion keys on every frame (two keys where a bone does not move in this clip), hips location, linear interpolation"""
    ob = rig.ob
    F = B.shape[0]
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ad = ob.animation_data or ob.animation_data_create()
    ad.action = act
    slot = act.slots.new(id_type='OBJECT', name=ob.name)
    ad.action_slot = slot
    frames = np.arange(F, dtype=float)
    nkeys = 0

    def put(path, idx, vals, group):
        nonlocal nkeys
        fc = act.fcurve_ensure_for_datablock(ob, path, index=idx)
        if np.ptp(vals) < tol:
            fr, vv = frames[[0, -1]], vals[[0, -1]]
        else:
            fr, vv = frames, vals
        fc.keyframe_points.add(len(fr))
        fc.keyframe_points.foreach_set('co', np.stack([fr, vv], -1).ravel())
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
        fc.update()
        nkeys += len(fr)
        try:
            grp = fc.group
            if grp is None:
                bag = act.layers[0].strips[0].channelbag(slot)
                g = bag.groups.get(group) or bag.groups.new(group)
                fc.group = g
        except Exception:
            pass

    q = mat2quat(B)
    for j in (bones if bones is not None else rig.keyed):
        pb = ob.pose.bones[rig.bones[j]]
        pb.rotation_mode = 'QUATERNION'
        qq = quat_continuous(q[:, j][:, None])[:, 0]
        path = 'pose.bones["%s"].rotation_quaternion' % rig.bones[j]
        for c in range(4):
            put(path, c, qq[:, c], rig.bones[j])
    for c in range(3):
        put('pose.bones["%s"].location' % rig.bones[0], c, loc[:, c], rig.bones[0])
    act.use_frame_range = True
    act.frame_start, act.frame_end = 0, F - 1
    return act, nkeys


def nla_tracks(ob, acts):
    """one muted-free NLA track per action (this is what the glTF exporter turns into one animation each)"""
    ad = ob.animation_data
    ad.action = None
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)
    for act in acts:
        tr = ad.nla_tracks.new()
        tr.name = act.name
        st = tr.strips.new(act.name, 0, act)
        st.name = act.name
        try:
            if st.action_slot is None and act.slots:
                st.action_slot = act.slots[0]
        except AttributeError:
            pass


# ------------------------------------------------------------------ the deformed mesh: floor and contact checks
# body parts by the bone that carries most of a vertex
PARTS = {
    'handR': lambda b: b.startswith('RightHand'), 'handL': lambda b: b.startswith('LeftHand'),
    'forearmR': lambda b: b in ('RightForeArm', 'RightForeArmTwist'), 'forearmL': lambda b: b in ('LeftForeArm', 'LeftForeArmTwist'),
    'armR': lambda b: b in ('RightForeArm', 'RightForeArmTwist', 'RightElbowHalf', 'RightArm') or b.startswith('RightHand'),
    'armL': lambda b: b in ('LeftForeArm', 'LeftForeArmTwist', 'LeftElbowHalf', 'LeftArm') or b.startswith('LeftHand'),
    'upperR': lambda b: b in ('RightElbowHalf', 'RightArm'), 'upperL': lambda b: b in ('LeftElbowHalf', 'LeftArm'),
    'head': lambda b: b in ('Head', 'Neck') or any(k in b for k in ('Jaw', 'Lip', 'Eyelid', 'Brow', 'Cheek', 'MouthCorner')),
    'torso': lambda b: b in ('Hips', 'Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'LeftArmHalf', 'RightArmHalf'),
    'legL': lambda b: b in ('LeftUpLeg', 'LeftLeg', 'LeftKneeHalf'), 'legR': lambda b: b in ('RightUpLeg', 'RightLeg', 'RightKneeHalf'),
    'legs': lambda b: any(k in b for k in ('UpLeg', 'Leg', 'KneeHalf')) or b == 'Hips',
    'footL': lambda b: b in ('LeftFoot', 'LeftToeBase'), 'footR': lambda b: b in ('RightFoot', 'RightToeBase'),
}
RAYS = [Vector(d).normalized() for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1), (1, 1, 1), (-1, 1, 1), (1, -1, 1),
                                         (-1, -1, 1), (1, 1, -1), (-1, 1, -1), (1, -1, -1), (-1, -1, -1))]


class MeshProbe:
    """the skinned mesh at the current frame: lowest points, and how body parts sit against each other"""

    def __init__(self, ob):
        self.ob = ob
        names = [g.name[len(P):] for g in ob.vertex_groups]
        self.nv = len(ob.data.vertices)
        self.dom = np.array([names[max(v.groups, key=lambda g: g.weight).group] for v in ob.data.vertices])
        self.polys = [tuple(p.vertices) for p in ob.data.polygons]
        self.pv = np.array([p + (p[-1],) * (4 - len(p)) for p in self.polys])
        self._mask = {}

    def mask(self, part):
        if part not in self._mask:
            fn = PARTS[part]
            self._mask[part] = np.array([fn(b) for b in self.dom])
        return self._mask[part]

    def coords(self):
        dg = bpy.context.evaluated_depsgraph_get()
        oe = self.ob.evaluated_get(dg)
        me = oe.to_mesh()
        co = np.empty(self.nv * 3)
        me.vertices.foreach_get('co', co)
        oe.to_mesh_clear()
        return co.reshape(self.nv, 3)

    def pair(self, co, a, b):
        """vertices of part a against the surface of part b. gap: smallest distance (with the two points);
        deep: most negative = deepest vertex of a inside b (with the vertex and its nearest surface point)."""
        vl = [Vector(c) for c in co]
        m = self.mask(b)
        tree = BVHTree.FromPolygons(vl, [self.polys[k] for k in np.nonzero(m[self.pv].all(1))[0]])
        out = dict(gap=9.0, gap_from=None, gap_to=None, deep=0.0, deep_from=None, deep_to=None)
        for k in np.nonzero(self.mask(a))[0]:
            loc, nrm, _, dist = tree.find_nearest(vl[k])
            if loc is None:
                continue
            if dist < out['gap']:
                out.update(gap=dist, gap_from=np.array(vl[k]), gap_to=np.array(loc))
            if dist < 0.08 and -dist < out['deep'] and (vl[k] - loc).dot(nrm) < 0:
                # really inside? most rays from the vertex must leave the other part through the back of a face
                back = 0
                for d in RAYS:
                    h, hn, _, _ = tree.ray_cast(vl[k], d, 0.4)
                    back += h is not None and hn.dot(d) > 0
                if back >= 0.7 * len(RAYS):
                    out.update(deep=-dist, deep_from=np.array(vl[k]), deep_to=np.array(loc))
        return out
