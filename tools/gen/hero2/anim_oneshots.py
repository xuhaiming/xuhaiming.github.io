"""Stage 3: the two hand-keyed one-shots, wave and think. Used by anim_build.py.

Both start on idle frame 0. The body keeps the idle's own motion ("life") under an envelope that is 0 with zero slope at
the start (and, for the wave, at the end), so the first frame equals idle frame 0 exactly and nothing is frozen.
The acting arm(s) are not keyed joint by joint: each frame the wrist gets a target (a path from where it hangs in the
idle to the pose, in the chest's frame or attached to the chin / the other elbow), the elbow a direction, the hand an
orientation, and Rig.solve_arm turns that into shoulder and hinge-elbow rotations. Timing comes from al.seg / al.bump.
"""
import numpy as np

import anim_lib as al
from anim_lib import T, mv, rad

FPS = 30


def life(rig, idle, F, env):
    Bi, li = idle
    B = al.slerp(np.repeat(Bi[:1], F, 0), Bi[:F], env[:, None])
    loc = li[0] + (li[:F] - li[0]) * env[:, None]
    return B, loc


def add_local(rig, B, name, e):
    """extra local Euler rotation (F, 3) degrees on top of what the bone does"""
    j = rig.i(name)
    B[:, j] = B[:, j] @ al.euler(e)


def chest_local(rig, D, pos, p):
    """world point(s) -> the chest's frame (Spine2 joint + orientation), per frame"""
    j = rig.i('Spine2')
    return mv(T(D[:, j]), p - pos[:, j])


def chest_world(rig, D, pos, p):
    j = rig.i('Spine2')
    return pos[:, j] + mv(D[:, j], p)


def set_arm(rig, B, loc, side, wrist, pole, hand_D, exact):
    """solve one arm for every frame and write Arm / ForeArm / Hand into B. exact: (F,) weight, 0 keeps B as it is
    (used over the first / last frames so the clip meets idle frame 0 to the last bit). Returns the elbow flexion."""
    D, pos = rig.fk(B, loc)
    ja, jf, jh = rig.i(side + 'Arm'), rig.i(side + 'ForeArm'), rig.i(side + 'Hand')
    flex = rig.solve_arm(D, side, pos[:, ja], wrist, pole)
    D[:, jh] = hand_D
    Bn = rig.local(D)
    for j in (ja, jf, jh):
        B[:, j] = al.slerp(B[:, j], Bn[:, j], exact)
    return flex


def lerp_e(Ea, Eb, u):
    return {k: Ea[k] * (1 - u[:, None]) + Eb[k] * u[:, None] for k in Ea}


def finger_pose(side, curls, thumb, spread=1.0):
    """explicit curls {'Index': (j1, j2, j3), ...} and thumb ((x, z), (x, z), (x, z)) -> one-frame Euler dict"""
    import anim_build as ab
    sg = 1.0 if side == 'Left' else -1.0
    out = {}
    for fn, c in curls.items():
        for k in range(3):
            out['%sHand%s%d' % (side, fn, k + 1)] = np.array([[c[k], 0, sg * ab.SPREAD[fn] * spread if k == 0 else 0.0]])
    for k in range(3):
        out['%sHandThumb%d' % (side, k + 1)] = np.array([[thumb[k][0], 0, sg * thumb[k][1]]])
    return out


def idle_fingers(rig, idle, side):
    """the finger pose of idle frame 0 as Euler degrees"""
    return {rig.names[j]: al.to_euler(idle[0][:1, j]) for j in rig.subtree(side + 'Hand')[1:]}


def thumb_adduct(rig, B, side, deg):
    """swing the thumb toward the fingers in the plane of the palm (rest frame: about the vertical), on top of its Euler pose"""
    j = rig.i(side + 'HandThumb1')
    sg = 1.0 if side == 'Left' else -1.0
    B[:, j] = rig.R[j].T @ al.rz(rad(sg * deg)) @ rig.R[j] @ B[:, j]


def tile(E, F):
    return {k: np.repeat(v, F, 0) for k, v in E.items()}


# ------------------------------------------------------------------ wave
def build_wave(rig, idle, info):
    import anim_build as ab
    DUR = 2.8
    WRIST = np.array([-0.405, -0.20, 0.350])     # raised wrist in the chest frame (Spine2 joint at z 1.235): x right, -y forward
    POLE = np.array([-0.55, -0.35, -1.0])         # where the elbow points from the shoulder
    FINGERS_DIR, PALM = np.array([0.10, -0.10, 1.0]), np.array([0.12, -1.0, -0.05])
    SWAY, WAVES, T_WAVE = 0.050, 2.5, 0.70        # wrist travel each way, number of waves, when they start
    FREQ = 2.15
    LEAN = 12.0                                   # degrees the hand rocks at the wrist

    F = int(round(DUR * FPS)) + 1
    t = np.arange(F) / FPS
    i = rig.i
    env = al.bump(t, 0.0, 0.6, DUR - 0.75, DUR, 2, 2)
    B, loc = life(rig, idle, F, env)
    up = al.seg(t, 0.10, 0.74, 2.0, 3.0) * (1 - al.seg(t, 1.74, 2.40, 2.2, 3.2))
    t_end = T_WAVE + WAVES / FREQ
    wav = al.bump(t, T_WAVE - 0.12, T_WAVE + 0.18, t_end - 0.25, t_end + 0.12, 2, 2)
    osc = -np.sin(2 * np.pi * FREQ * (t - T_WAVE)) * wav                 # first move outward
    osc_lag = -np.sin(2 * np.pi * FREQ * (t - T_WAVE - 0.055)) * wav
    # body: a small greeting nod, head inclined toward the hand, chest opening a touch to the raised side
    nod = al.bump(t, 0.30, 0.62, 0.70, 1.15, 2, 2)
    held = al.bump(t, 0.25, 0.75, 1.9, 2.55, 2, 2)
    add_local(rig, B, 'Head', np.stack([4.2 * nod + 0.6 * held, 0.0 * held, 2.2 * held + 0.5 * osc_lag], -1))
    add_local(rig, B, 'Neck', np.stack([2.0 * nod + 0.3 * held, 0.0 * held, 1.0 * held], -1))
    add_local(rig, B, 'Spine2', np.stack([-0.4 * held, -1.2 * held, -0.9 * held], -1))
    add_local(rig, B, 'Spine1', np.stack([0 * held, -0.8 * held, -0.6 * held], -1))
    add_local(rig, B, 'RightShoulder', np.stack([-7.0 * up, 0 * up, 3.0 * up], -1))
    # right arm
    D, pos = rig.fk(B, loc)
    D0, pos0 = rig.fk(idle[0][:1], idle[1][:1])
    w0 = chest_local(rig, D0, pos0, pos0[:, i('RightHand')])[0]
    e0 = mv(T(D0[0, i('Spine2')]), pos0[0, i('RightForeArm')] - pos0[0, i('RightArm')])
    path = w0 + (WRIST - w0) * up[:, None] + np.sin(np.pi * up)[:, None] * np.array([-0.05, -0.07, 0.0])
    path = path + osc[:, None] * np.array([-SWAY, 0.004, 0.0]) - (np.abs(osc) * 0.008)[:, None] * np.array([0, 0, 1.0])
    pole = e0 + (al.unit(POLE) * np.linalg.norm(e0) - e0) * al.seg(up, 0.0, 0.8)[:, None]
    pole = pole + osc[:, None] * np.array([-0.03, 0, 0])
    Dc = D[:, i('Spine2')]
    exact = al.smoothstep(t / 0.1) * al.smoothstep((DUR - t) / 0.4)
    # the hand: its pose relative to the forearm goes from the idle's to the raised one (taken from the solved arm at the
    # top), and the wave itself is the wrist rocking sideways (Hand local Z), trailing the forearm
    Hw = np.broadcast_to(Dc @ al.hand_frame('Right', FINGERS_DIR, PALM), (F, 3, 3))
    flex = set_arm(rig, B, loc, 'Right', chest_world(rig, D, pos, path), mv(Dc, pole), Hw, exact)
    jh = i('RightHand')
    top = int(np.argmax(up - 10 * np.abs(osc)))
    uh = al.seg(up, 0.2, 1.0, 2, 2)
    rock = al.euler(np.stack([3.0 * np.abs(osc_lag), 0 * t, -LEAN * osc_lag], -1))
    B[:, jh] = al.slerp(np.broadcast_to(idle[0][0, jh], (F, 3, 3)), np.broadcast_to(B[top, jh], (F, 3, 3)), uh) @ rock
    # hands and face
    E0 = idle_fingers(rig, idle, 'Right')
    Eo = finger_pose('Right', {'Index': (4, 7, 5), 'Middle': (6, 9, 6), 'Ring': (8, 11, 7), 'Pinky': (10, 13, 8)}, ((-2, -4), (3, 0), (4, 0)), spread=0.75)
    uf = al.seg(up, 0.35, 1.0, 2, 2)
    E = lerp_e(tile(E0, F), tile(Eo, F), uf)
    for k in E:                                                         # fingertips trail a little as the hand rocks
        if k[-1] in '23' and 'Thumb' not in k:
            E[k][:, 0] += 2.5 * np.abs(osc_lag)
    smile = ab.BASE_SMILE + (0.78 - ab.BASE_SMILE) * al.bump(t, 0.22, 0.75, 1.85, 2.6, 2, 2.5)
    brow = 0.42 * al.bump(t, 0.28, 0.6, 1.5, 2.3, 2, 2.5)
    E.update(ab.face(F, smile=smile, blink=ab.blinks(t, (2.12,)), brow_up=brow))
    B = ab.put_euler(rig, B, E)
    hw = al.to_euler(B[:, i('RightHand')])
    info.update(frames=F, duration=DUR, loop=False, elbow_flex_max=round(float(np.degrees(flex.max())), 1),
                wrist_local_euler_range=[[round(float(v), 1) for v in hw.min(0)], [round(float(v), 1) for v in hw.max(0)]],
                waves=WAVES, wave_window_s=[T_WAVE, round(t_end, 2)], blink_times=[2.12])
    return B, loc


# ------------------------------------------------------------------ think
def build_think(rig, idle, info, adj=None):
    import anim_build as ab
    DUR = 3.0
    CHIN = np.array([-0.004, -0.098, -0.062])     # where the index knuckle goes, relative to the Head joint, in the head's frame
    R_FINGERS, R_PALM = np.array([0.30, 0.38, 1.0]), np.array([1.0, 0.25, -0.35])
    R_POLE = np.array([0.15, -0.95, -0.50])
    R_CURL = {'Index': (52, 78, 42), 'Middle': (64, 86, 50), 'Ring': (68, 88, 52), 'Pinky': (70, 88, 52)}
    R_THUMB = ((4, 0), (8, 0), (10, 0))
    R_THUMB_IN = 42.0                             # thumb swung in beside the index (degrees about the palm normal)
    L_FINGERS, L_PALM = np.array([-1.0, -0.10, 0.05]), np.array([0.0, 0.75, 0.66])
    L_POLE = np.array([0.30, -0.50, -1.0])
    L_UNDER = np.array([0.045, -0.015, -0.066])   # left palm centre relative to the right elbow joint (chest frame)
    L_CURL = {'Index': (20, 30, 18), 'Middle': (24, 34, 20), 'Ring': (28, 36, 22), 'Pinky': (30, 38, 22)}
    L_THUMB = ((4, 4), (8, 0), (8, 0))

    if adj:                                        # contact corrections found on the mesh (anim_build.land_contacts)
        CHIN, L_UNDER = CHIN + adj['chin'], L_UNDER + adj['under']
        if adj.get('push') is not None:
            L_UNDER = L_UNDER + adj['push']        # (F, 3) per-frame clearance of the left forearm from the jacket (anim_build.land_contacts)
    F = int(round(DUR * FPS)) + 1
    t = np.arange(F) / FPS
    i = rig.i
    env = al.seg(t, 0.0, 0.9, 2, 2)
    B, loc = life(rig, idle, F, env)
    uR = al.seg(t, 0.06, 0.82, 2.0, 3.2)
    uL = al.seg(t, 0.20, 0.96, 2.0, 3.0)
    uB = al.seg(t, 0.10, 0.95, 2.0, 2.6)          # body
    uH = al.seg(t, 0.28, 1.02, 2.0, 2.6)          # head
    # a slow drift while it holds, so the pose breathes instead of freezing
    drift = np.sin(2 * np.pi * (t - 1.0) / 3.4) * al.seg(t, 1.0, 1.8)
    add_local(rig, B, 'Spine1', np.stack([1.4 * uB, 0.8 * uB, 0.3 * uB], -1))
    add_local(rig, B, 'Spine2', np.stack([1.8 * uB, 1.2 * uB, 0.5 * uB], -1))
    add_local(rig, B, 'Neck', np.stack([2.2 * uH + 0.25 * drift, 1.6 * uH, 1.4 * uH], -1))
    add_local(rig, B, 'Head', np.stack([4.4 * uH + 0.45 * drift, 3.4 * uH + 0.3 * drift, 2.8 * uH], -1))
    add_local(rig, B, 'RightShoulder', np.stack([-3.0 * uR, 0 * uR, -20.0 * uR], -1))
    add_local(rig, B, 'LeftShoulder', np.stack([0.0 * uL, 0 * uL, 16.0 * uL], -1))
    D0, pos0 = rig.fk(idle[0][:1], idle[1][:1])
    c0 = D0[0, i('Spine2')]
    exact = al.smoothstep(t / 0.1)
    # fingers first: the right hand's contact point depends on the index curl
    ER = lerp_e(tile(idle_fingers(rig, idle, 'Right'), F), tile(finger_pose('Right', R_CURL, R_THUMB, spread=0.3), F), al.seg(uR, 0.2, 1.0))
    EL = lerp_e(tile(idle_fingers(rig, idle, 'Left'), F), tile(finger_pose('Left', L_CURL, L_THUMB, spread=0.6), F), al.seg(uL, 0.2, 1.0))
    # Each arm is solved a few times: the hand's pose relative to the forearm is interpolated from the idle's to the one
    # the pose asks for (so the wrist turns the short way round), and the wrist target is then recomputed from where the
    # hand really is, so the contact point lands exactly.
    Bi = idle[0][0]

    def arm(side, u, fingers_dir, palm_dir, pole_dir, mid_pole, via, goal_fn, tip_fn):
        jh, ja, jf = i(side + 'Hand'), i(side + 'Arm'), i(side + 'ForeArm')
        v0 = mv(T(c0), pos0[0, jh] - pos0[0, ja])
        reach = np.linalg.norm(rig.head[jf] - rig.head[ja]) + np.linalg.norm(rig.head[jh] - rig.head[jf])
        e0 = mv(T(c0), pos0[0, jf] - pos0[0, ja])
        Hf = al.hand_frame(side, fingers_dir, palm_dir)
        pole = e0 + (al.unit(pole_dir) * np.linalg.norm(e0) - e0) * al.seg(u, 0.0, 0.75)[:, None]
        pole = pole + np.sin(np.pi * u)[:, None] * mid_pole * np.linalg.norm(e0)   # on the way the elbow swings out and back, never through the wrist line
        uh = al.seg(u, 0.0, 1.0)
        flex = None
        for it in range(4):
            D, pos = rig.fk(B, loc)
            Dc = D[:, i('Spine2')]
            want = Dc @ Hf                                           # the hand orientation the pose asks for
            hand_now = want if it == 0 else D[:, jh]
            goal = goal_fn(D, pos, Dc) - mv(hand_now, tip_fn())
            # the wrist travels on an arc about the shoulder (direction: start -> via -> goal, length blended and drawn in
            # a little on the way), so it swings round the front of the body and is always within reach
            sh = pos[:, ja]
            v1 = mv(T(Dc), goal - sh)
            k = al.seg(u, 0.7, 1.0)[:, None]                         # early on aim at where the goal will be, later track it live
            v1 = v1[-1] * (1 - k) + v1 * k
            r0, r1 = np.linalg.norm(v0), np.linalg.norm(v1, axis=-1)
            uu = u[:, None]
            d = al.unit((1 - uu) ** 2 * al.unit(v0) + 2 * uu * (1 - uu) * al.unit(via) * 0.9 + uu ** 2 * al.unit(v1))
            r = (r0 + (r1 - r0) * u) * (1 - 0.20 * np.sin(np.pi * u))
            cap = r0 + (0.965 * reach - r0) * al.smoothstep(u / 0.2)     # never out of reach; soft, so the elbow does not snap
            r = -np.log(np.exp(-160 * r) + np.exp(-160 * cap)) / 160 if r0 < 0.965 * reach else np.minimum(r, np.maximum(cap, r0 * (1 - u) + 0.965 * reach * u))
            path = sh + mv(Dc, d * r[:, None])
            flex = set_arm(rig, B, loc, side, path, mv(Dc, pole), want, exact)
            B[:, jh] = al.slerp(np.broadcast_to(Bi[jh], (F, 3, 3)), np.broadcast_to(B[-1, jh], (F, 3, 3)), uh)
        return flex

    # ---- right arm: index knuckle to the chin
    jh, j1, j2 = i('RightHand'), i('RightHandIndex1'), i('RightHandIndex2')
    knuckle = (rig.head[j1] - rig.head[jh]) + mv(rig.R[j1] @ al.euler(ER['RightHandIndex1']) @ rig.R[j1].T, rig.head[j2] - rig.head[j1])
    flexR = arm('Right', uR, R_FINGERS, R_PALM, R_POLE, np.array([-0.7, 0.6, 0.0]), np.array([-0.15, -0.85, -0.5]),
                lambda D, pos, Dc: pos[:, i('Head')] + mv(D[:, i('Head')], CHIN), lambda: knuckle)
    # ---- left arm: folded across, palm under the right elbow
    jl, jm = i('LeftHand'), i('LeftHandMiddle1')
    palm = np.broadcast_to(0.62 * (rig.head[jm] - rig.head[jl]), (F, 3))
    flexL = arm('Left', uL, L_FINGERS, L_PALM, L_POLE, np.array([0.7, 0.6, 0.0]), np.array([-0.05, -0.85, -0.55]),
                lambda D, pos, Dc: pos[:, i('RightForeArm')] + mv(Dc, L_UNDER), lambda: palm)
    # ---- face: brows a little drawn, the smile mostly gone, lids a touch lower; blinks on the gaze change and once in the hold
    E = dict(ER)
    E.update(EL)
    E.update(ab.face(F, smile=ab.BASE_SMILE * (1 - 0.7 * uH), blink=ab.blinks(t, (0.46, 2.02)), frown=0.36 * uH, lids=1.3 * uH))
    B = ab.put_euler(rig, B, E)
    thumb_adduct(rig, B, 'Right', R_THUMB_IN * al.seg(uR, 0.2, 1.0))
    hr, hl = al.to_euler(B[-1, i('RightHand')]), al.to_euler(B[-1, i('LeftHand')])
    Df, pf = rig.fk(B[-1:], loc[-1:])
    info.update(frames=F, duration=DUR, loop=False, pose_reached_s=0.9,
                elbow_flex_deg=dict(right=round(float(np.degrees(flexR[-1])), 1), left=round(float(np.degrees(flexL[-1])), 1)),
                wrist_local_euler=dict(right=[round(float(v), 1) for v in hr], left=[round(float(v), 1) for v in hl]),
                held_pose_m={n: [round(float(v), 3) for v in pf[0, i(n)]] for n in ('RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand')},
                blink_times=[0.46, 2.02])
    return B, loc
