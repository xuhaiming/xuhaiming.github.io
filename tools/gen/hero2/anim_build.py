"""Stage 3: build the four clips (idle, walk, wave, think) on the rig. Blender 5.0 headless, local only.

    blender -b -P hero2/anim_build.py -- src/hero2/hero_rig_mocaptest.blend src/hero2/hero_anim.blend [report=src/hero2/hero_anim.json]

Input: the rig with the retargeted mocap actions (stage 2, step c). Output: the same rig with four new actions,
one NLA track each (that is what anim_export.py turns into four glTF animations), and a JSON report with the
numbers the site needs (loop lengths, stride, ground speed) plus the checks (foot slide, head travel, seams).

How the clips are made (all sampled at 30 fps, quaternion keys, in place):
  idle   designed stance (feet, pelvis, upright chest, level head, arms) + what the mocap performer did AROUND his
         own mean pose (weight shift, sway, small arm drift), stretched to 8 s, + keyed breathing, blinks, fingers, face.
  walk   the mocap take: feet and timing untouched (so the stride is the retarget's), legs re-solved under a pelvis
         that is higher (straighter knees), steadier (less list and sway) and a designed counter-rotation; trunk
         upright, head level, arms partly symmetrised between left and right, elbows as clean hinges, relaxed hands.
  wave   hand-keyed right arm on idle frame 0 (IK targets + eased timing), idle life under an envelope.
  think  hand-keyed both arms on idle frame 0, contacts placed by IK (hand to chin, hand under elbow), then held.
The tunable numbers are the constants at the top of each build_* function.
"""
import json
import os
import sys

import bpy
import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anim_lib as al  # noqa: E402
from anim_lib import T, mv, rad, rot, rx, ry, rz  # noqa: E402

FPS = 30
S = np.diag([1.0, -1.0, -1.0])           # left <-> right for a local rotation: S @ B @ S


# ------------------------------------------------------------------ small helpers
def mean_rot(M):
    q = al.quat_continuous(al.mat2quat(M))
    return al.quat2mat(al.unit(q.mean(0)))


def drop_twist(M):
    """remove the part of a rotation that spins around the bone's own axis (local Y): amplifying the take's swing must not
    amplify its upper-arm twist, which wrings the sleeve like a candy wrapper"""
    q = al.mat2quat(M)
    ang = 2 * np.arctan2(q[..., 2], q[..., 0])
    return M @ T(ry(ang))


def clean_scalar(x, n_cycles=2, harmonics=3):
    """keep only the mean and the first few harmonics of the gait cycle: the swing becomes a smooth, steady rhythm"""
    x = np.asarray(x, float)
    F = np.fft.rfft(x, axis=0)
    keep = np.zeros(F.shape[0], bool)
    for h in range(harmonics + 1):
        if h * n_cycles < F.shape[0]:
            keep[h * n_cycles] = True
    F[~keep] = 0
    return np.fft.irfft(F, n=len(x), axis=0)


def clean_rot(M, n_cycles=2, harmonics=3):
    """same for a looping series of rotations (taken as rotation vectors around their mean)"""
    m = mean_rot(M)
    q = al.mat2quat(M @ T(m))
    vn = np.linalg.norm(q[..., 1:], axis=-1, keepdims=True)
    rv = q[..., 1:] / np.maximum(vn, 1e-12) * 2 * np.arctan2(vn, q[..., :1])
    rv = clean_scalar(rv, n_cycles, harmonics)
    ang = np.linalg.norm(rv, axis=-1)
    return rot(rv, ang) @ m


def dev(M, k=1.0):
    """what a rotation track does around its own mean, as world-side deltas, scaled by k"""
    d = M @ T(mean_rot(M))
    return d if k == 1.0 else al.scale_rot(d, k)


def close_loop(B, loc):
    return np.concatenate([B, B[:1]]), np.concatenate([loc, loc[:1]])


# ------------------------------------------------------------------ hands and face (local Euler degrees, README conventions)
CURL = {'Index': (16, 24, 15), 'Middle': (20, 28, 17), 'Ring': (24, 32, 19), 'Pinky': (28, 35, 21)}
THUMB_IN = 22.0
SPREAD = {'Index': 2.0, 'Middle': 0.0, 'Ring': -2.0, 'Pinky': -4.5}
THUMB = ((7, 0, 9), (9, 0, 0), (10, 0, 0))


def fingers(side, k=1.0, spread=1.0, thumb=1.0, per=None, thumb_pose=None, thumb_in=THUMB_IN):
    """relaxed hand scaled by k (array or scalar per frame). per: {'Index': factor, ...} extra per-finger factor.
    Returns {bone: (F, 3) euler degrees}"""
    k = np.atleast_1d(np.asarray(k, float))
    F = len(k)
    sg = 1.0 if side == 'Left' else -1.0
    out = {}
    for fn, c in CURL.items():
        kk = k * np.asarray((per or {}).get(fn, 1.0))
        for j in range(3):
            e = np.zeros((F, 3))
            e[:, 0] = c[j] * kk
            if j == 0:
                e[:, 2] = sg * SPREAD[fn] * spread
            out['%sHand%s%d' % (side, fn, j + 1)] = e
    tp = thumb_pose or THUMB
    kt = k * thumb
    for j in range(3):
        e = np.zeros((F, 3))
        e[:, 0] = tp[j][0] * kt
        e[:, 2] = sg * tp[j][2] * kt
        out['%sHandThumb%d' % (side, j + 1)] = e
    out[side + 'HandThumb1:in'] = np.full(F, float(thumb_in))
    return out


SMILE = {'MouthCorner': (-2.0, 2.5, 0), 'Cheek': (-1.5, 0, 0), 'EyelidLower': (-1.2, 0, 0)}     # the rig's tested full smile
BASE_SMILE = 0.22                                                                               # held in every clip


def face(F, smile=BASE_SMILE, blink=None, brow_up=0.0, frown=0.0, lids=0.0):
    """all arguments scalar or (F,) arrays. blink 0..1; brow_up 1 = the rig's full raise (-3.5); frown 1 = its full frown;
    lids = extra upper-lid closure in degrees (lowered gaze)."""
    z = np.zeros(F)
    smile, brow_up, frown, lids = (np.broadcast_to(np.asarray(v, float), (F,)) for v in (smile, brow_up, frown, lids))
    blink = z if blink is None else blink
    out = {}
    for s, sg in (('Left', 1.0), ('Right', -1.0)):
        mc = SMILE['MouthCorner']
        out[s + 'MouthCorner'] = np.stack([mc[0] * smile, sg * mc[1] * smile, z], -1)
        out[s + 'Cheek'] = np.stack([SMILE['Cheek'][0] * smile, z, z], -1)
        out[s + 'EyelidLower'] = np.stack([np.maximum(SMILE['EyelidLower'][0] * smile * (1 - blink) - 1.0 * blink, -1.4), z, z], -1)
        out[s + 'EyelidUpper'] = np.stack([np.minimum(10.0 * blink + lids * (1 - blink), 10.0), z, z], -1)
        out[s + 'Brow'] = np.stack([-3.5 * brow_up + 2.0 * frown, -sg * 1.5 * frown, sg * 5.0 * frown], -1)
    for n in ('Jaw', 'LipUpper', 'LipLower'):
        out[n] = np.zeros((F, 3))
    return out


def blinks(t, times, down=0.12, hold=0.035, up=0.18, period=None):
    """0..1 lid closure: closes in `down` s, opens in `up` s"""
    v = np.zeros_like(t)
    for t0 in times:
        tt = t - t0
        if period:
            tt = (tt + period / 2) % period - period / 2
        v = np.maximum(v, al.smoothstep(tt / down) * (1 - al.smoothstep((tt - down - hold) / up)))
    return v


def put_euler(rig, B, E):
    """'<bone>:in' entries (thumb swung in beside the index, degrees about the palm normal in the rest frame) go on top"""
    for name, e in E.items():
        if ':' not in name:
            B[:, rig.i(name)] = al.euler(e)
    for name, e in E.items():
        if name.endswith(':in'):
            j = rig.i(name[:-3])
            sg = 1.0 if name.startswith('Left') else -1.0
            B[:, j] = rig.R[j].T @ rz(rad(sg * e)) @ rig.R[j] @ B[:, j]
    return B


def arm_local(side, arm, flex, hand):
    """(F,3) / (F,) arrays in the LEFT arm's convention -> {bone index name: matrices}, mirrored for the right"""
    A, H = al.euler(arm), al.euler(hand)
    Fm = rz(rad(flex))
    if side == 'Right':
        A, H, Fm = S @ A @ S, S @ H @ S, S @ Fm @ S
    return {side + 'Arm': A, side + 'ForeArm': Fm, side + 'Hand': H}


def breath(t, period, t0=0.0, inhale=0.42):
    """0..1 chest volume: inhale over `inhale` of the period, slower exhale with a short rest at the bottom"""
    ph = ((t - t0) / period) % 1.0
    up = al.smoothstep(ph / inhale)
    down = 1 - al.smoother((ph - inhale) / (0.92 - inhale))
    return np.where(ph < inhale, up, down)


# ------------------------------------------------------------------ idle
def build_idle(rig, src, info):
    N = 240                      # 8.0 s
    STANCE_X = 0.118             # ankle half-width (rest 0.165, walk track about 0.075)
    TOE_OUT = 4.0                # degrees on top of the 6 built into the rest pose
    HIPS = np.array([0.0, -0.030, 0.9000])
    PELVIS_PITCH, CHEST_PITCH = 1.0, -0.5
    ARM = (74.0, -2.0, 12.0)     # left Arm local Euler: X 78 = at the side (smaller = abducted), Y = swing (- forward), Z = turn inward
    FLEX = 13.0
    HAND = (7.0, 14.0, 3.0)
    BREATHS, B_CHEST, B_CLAV = 2, 1.5, 1.5
    SHIFT_X, SHIFT_ROLL, SHIFT_YAW = 0.0085, 1.1, 0.8   # slow weight shift (period = the whole 8 s): hips sideways (m), pelvis drop on the unloaded side, pelvis turn (degrees)
    HEAD_YAW, HEAD_PITCH = (1.7, 0.8), 0.7              # head micro-turns: amplitudes of the 8 s and 2.7 s components, nod with the breath (degrees)
    FING_L = {'Index': 1.08, 'Middle': 0.94, 'Ring': 1.05, 'Pinky': 1.12}     # the two hands are not the same: curl factor per finger
    FING_R = {'Index': 0.88, 'Middle': 1.04, 'Ring': 0.93, 'Pinky': 0.96}

    B0, loc0 = src
    D0, pos0 = rig.fk(B0, loc0)
    D0, pos0 = D0[:-1], pos0[:-1]
    N0 = len(D0)
    # start the loop where the performer is closest to his own mean (frame 0 is the pose every other clip blends with)
    i = rig.i
    cost = np.zeros(N0)
    for bn, w in (('Hips', 1.0), ('Spine2', 1.0), ('Head', 0.5), ('LeftArm', 0.3), ('RightArm', 0.3)):
        q = al.mat2quat(dev(D0[:, i(bn)]))
        cost += w * np.degrees(2 * np.arccos(np.clip(q[:, 0], -1, 1)))
    hp = pos0[:, 0] - pos0[:, 0].mean(0)
    cost += 200 * np.linalg.norm(hp, axis=1)
    vel = np.linalg.norm(np.roll(hp, -3, 0) - np.roll(hp, 3, 0), axis=1)
    cost += 400 * vel
    k0 = int(cost.argmin())
    s = k0 + np.arange(N) * N0 / N
    Dm = al.loop_sample(D0, s, True)
    hm = al.loop_sample(pos0[:, 0], s)
    Dm = np.stack([al.loop_smooth_rot(Dm[:, j], 2.0) for j in range(rig.n)], 1)
    hm = al.loop_smooth(hm, 2.0)
    Bm = rig.local(Dm)
    t = np.arange(N) / FPS
    dur = N / FPS

    D = Dm.copy()
    # pelvis + chest: designed posture, the performer's own motion around it
    D[:, i('Hips')] = dev(Dm[:, i('Hips')], 0.9) @ al.from_ypr(0, rad(PELVIS_PITCH), 0)
    tw = 2 * np.pi * t / (N / FPS)
    sh = np.sin(tw + 0.4)                                                             # +1 = weight on the character's left leg
    hips = HIPS + (hm - hm.mean(0)) * np.array([0.25, 0.8, 0.5])
    hips[:, 0] += SHIFT_X * sh
    hips[:, 2] -= 0.0018 * (1 - np.cos(2 * tw + 0.8))                                  # settles a little at each end of the shift
    D[:, i('Hips')] = al.from_ypr(rad(SHIFT_YAW * np.sin(tw - 0.7)), 0, rad(-SHIFT_ROLL * sh)) @ D[:, i('Hips')]
    chest0 = dev(Dm[:, i('Spine2')], 0.5) @ al.from_ypr(0, rad(CHEST_PITCH), 0)      # without breathing
    chest0 = al.from_ypr(rad(-0.6 * SHIFT_YAW * np.sin(tw - 0.7)), 0, rad(0.7 * SHIFT_ROLL * sh)) @ chest0     # the chest answers the pelvis
    amp = np.where((t // (dur / BREATHS)) % 2 == 0, 1.0, 0.86)
    br = breath(t, dur / BREATHS, t0=-0.35) * amp
    chest = chest0 @ rx(rad(-B_CHEST * br))
    D[:, i('Spine2')] = chest
    D[:, i('Spine')] = al.slerp(D[:, i('Hips')], chest0, 0.33)
    D[:, i('Spine1')] = al.slerp(D[:, i('Hips')], chest0, 0.67) @ rx(rad(-0.45 * B_CHEST * br))
    # head level, a little of the performer's looking about
    head = dev(Dm[:, i('Head')], 0.2)
    hy = rad(HEAD_YAW[0] * np.sin(tw + 2.0) + HEAD_YAW[1] * np.sin(3 * tw + 0.5))
    head = al.from_ypr(hy, rad(HEAD_PITCH * (br - 0.5) + 0.35 * np.sin(2 * tw + 1.2)), rad(0.5 * np.sin(tw + 0.2))) @ head
    D[:, i('Head')] = head
    D[:, i('Neck')] = al.slerp(chest0, head, 0.5)
    for sd, sg in (('Left', 1.0), ('Right', -1.0)):
        # collar bones rise with the breath; the arms hang from them and keep their own direction
        D[:, i(sd + 'Shoulder')] = chest @ ry(rad(-sg * B_CLAV * br))
        loc = arm_local(sd, np.tile(ARM, (N, 1)), np.full(N, FLEX), np.tile(HAND, (N, 1)))
        ja, jf, jh = i(sd + 'Arm'), i(sd + 'ForeArm'), i(sd + 'Hand')
        dm = T(mean_rot(Bm[:, ja])) @ Bm[:, ja]
        Ba = loc[sd + 'Arm'] @ al.scale_rot(dm, 0.55)
        D[:, ja] = chest0 @ rig.R[ja] @ Ba @ rig.R[ja].T
        D[:, jf] = D[:, ja] @ rig.R[jf] @ loc[sd + 'ForeArm'] @ rig.R[jf].T
        D[:, jh] = D[:, jf] @ rig.R[jh] @ loc[sd + 'Hand'] @ rig.R[jh].T
        # feet: planted, flat
        D[:, i(sd + 'Foot')] = rz(rad(sg * TOE_OUT))[None]
        D[:, i(sd + 'ToeBase')] = rz(rad(sg * TOE_OUT))[None]
    pos = rig.positions(D, hips)
    miss = 0.0
    for sd, sg in (('Left', 1.0), ('Right', -1.0)):
        ank = np.tile(np.array([sg * STANCE_X, rig.head[i(sd + 'Foot')][1] - 0.025, rig.head[i(sd + 'Foot')][2]]), (N, 1))
        miss = max(miss, rig.solve_leg(D, pos, sd, pos[:, i(sd + 'UpLeg')], ank))
    B = rig.local(D)
    # fingers: relaxed curl, each finger drifting on its own slow rhythm
    E = {}
    w = 2 * np.pi * t / dur
    for sd, ph in (('Left', 0.0), ('Right', 1.9)):
        per = {'Index': 1 + 0.07 * np.sin(w + ph), 'Middle': 1 + 0.06 * np.sin(2 * w + ph + 1.0),
               'Ring': 1 + 0.06 * np.sin(w + ph + 2.2), 'Pinky': 1 + 0.08 * np.sin(2 * w + ph + 3.0)}
        fing = FING_L if sd == 'Left' else FING_R
        per = {k: v * fing[k] for k, v in per.items()}
        E.update(fingers(sd, 1.0 + 0.035 * np.sin(w + ph + 0.6) + 0.02 * br, per=per, thumb=1 + 0.08 * np.sin(w + ph + 4.0)))
    bl = blinks(t, (1.45, 4.3, 6.55), period=dur)
    E.update(face(N, blink=bl))
    B = put_euler(rig, B, E)
    loc = rig.loc_from_hips(hips)
    info.update(frames=N + 1, duration=round(dur, 4), loop=True, mocap_start_frame=k0, leg_miss=round(miss, 5),
                blink_times=[1.45, 4.3, 6.55], breaths=BREATHS)
    return close_loop(B, loc)


# ------------------------------------------------------------------ walk
def probe_action(rig, clip):
    B, loc = clip
    act, _ = al.write_action(rig, '_probe', B, loc)
    al.use_action(rig.ob, act)
    return act


def probe_done(rig, act):
    rig.ob.animation_data.action = None
    bpy.data.actions.remove(act)


def sole_heights(rig, probe, clip):
    """lowest vertex of each shoe on the deformed mesh, per frame of a loop (without the repeated last frame)"""
    act = probe_action(rig, clip)
    sc = bpy.context.scene
    low = {'Left': [], 'Right': []}
    for f in range(len(clip[0]) - 1):
        sc.frame_set(f)
        z = probe.coords()[:, 2]
        for sd in low:
            low[sd].append(float(z[probe.mask('foot' + sd[0])].min()))
    probe_done(rig, act)
    return {sd: np.array(v) for sd, v in low.items()}


FOREARM_GAP = 0.0015       # think: the left forearm keeps at least this far off the jacket front (m)


def land_contacts(rig, probe, idle, info, rounds=5, target=0.0008):
    """think: build, look at the deformed mesh on the held pose, move the two contact targets until the right hand
    just touches the chin and the left palm just touches the right sleeve (no vertex inside), rebuild."""
    import anim_oneshots as one
    adj = dict(chin=np.zeros(3), under=np.zeros(3))
    sc = bpy.context.scene
    i = rig.i
    log = []
    for r in range(rounds + 1):
        inf = {}
        clip = one.build_think(rig, idle, inf, adj)
        act = probe_action(rig, clip)
        f = len(clip[0]) - 1
        sc.frame_set(f)
        co = probe.coords()
        D, _ = rig.fk(clip[0][f:f + 1], clip[1][f:f + 1])
        probe_done(rig, act)
        res = {}
        for key, a, b, bone in (('chin', 'handR', 'head', 'Head'), ('under', 'handL', 'armR', 'Spine2')):
            m = probe.pair(co, a, b)
            res[key] = (round(m['deep'] * 1000, 2), round(m['gap'] * 1000, 2))
            if r == rounds:
                continue
            if m['deep'] < 0:
                v = m['deep_to'] - m['deep_from']
                v = v + al.unit(v) * target
            else:
                v = m['gap_to'] - m['gap_from']
                v = v * (1 - target / max(m['gap'], 1e-6))
            adj[key] = adj[key] + 0.9 * (D[0, i(bone)].T @ v)
        log.append(res)
    # clearance pass: the left forearm lies across the jacket front, and the chest breathes under it. Per frame, how deep the
    # forearm is inside the torso, turned into a push of the left palm target (smoothed in time), a few rounds.
    F = len(clip[0])
    keyf = list(range(15, F, 3)) + [F - 1]
    push = np.zeros((F, 3))
    pushlog = []
    for r in range(9):
        adj['push'] = push
        inf = {}
        clip = one.build_think(rig, idle, inf, adj)
        act = probe_action(rig, clip)
        vec, dp = [], []
        for f in keyf:
            sc.frame_set(f)
            m = probe.pair(probe.coords(), 'forearmL', 'torso')
            D, _ = rig.fk(clip[0][f:f + 1], clip[1][f:f + 1])
            if m['deep'] < 0:
                vec.append(D[0, i('Spine2')].T @ (m['deep_to'] - m['deep_from'] + al.unit(m['deep_to'] - m['deep_from']) * 0.0024))
            elif m['gap'] < FOREARM_GAP and m['gap'] > 1e-5:        # not inside but closer than FOREARM_GAP: push it out to that gap
                vec.append(D[0, i('Spine2')].T @ (al.unit(m['gap_from'] - m['gap_to']) * (FOREARM_GAP - m['gap'])))
            else:
                vec.append(np.zeros(3))
            dp.append(m['deep'])
        probe_done(rig, act)
        pushlog.append(round(min(dp) * 1000, 2))
        vec = np.array(vec)
        add = np.stack([np.interp(np.arange(F), keyf, vec[:, k]) for k in range(3)], 1)
        push = push + 1.5 * add
        push = np.stack([np.convolve(np.pad(push[:, k], 3, mode='edge'), np.ones(7) / 7, 'valid') for k in range(3)], 1)
    adj['push'] = push
    clip = one.build_think(rig, idle, inf, adj)
    inf['left_forearm_deep_mm_per_round'] = pushlog
    inf['contact_rounds_deep_gap_mm'] = log
    inf['contact_adjust_m'] = {k: [round(float(x), 4) for x in v] for k, v in adj.items() if k != 'push'}
    inf['left_palm_push_max_mm'] = round(float(np.abs(push).max()) * 1000, 1)
    info.update(inf)
    return clip


def sole_lift(low, prev):
    """ankle height correction: a sole under the floor is lifted out; the supporting foot is also set down if it hovers"""
    L, R = low['Left'], low['Right']
    out = {}
    for sd, mine, other in (('Left', L, R), ('Right', R, L)):
        c = np.where(mine <= other, -mine, np.maximum(-mine, 0))        # supporting foot: exact; the other: only out of the floor
        c = np.clip(c, -0.008, 0.012)
        c = al.loop_smooth(c, 0.8)
        out[sd] = c + (prev[sd] if prev else 0)
    return out


def build_walk(rig, src, info, mocap_stats, lift=None):
    WIDEN = 0.040                # each foot moved outward (the take walks on a line; bulky shoes and trousers need room)
    BOB, FORE_AFT = 1.0, 0.5    # pelvis rise over the stance leg as a fraction of the straight-leg arc; fraction of the take's fore-aft pulse
    EXT = 0.9972                 # a leg never gets longer than this fraction of its full length (no knee lock, no pop)
    SWAY, LIST, PELVIS_YAW = 0.8, 0.9, 6.5
    CHEST_PITCH, CHEST_YAW, CHEST_ROLL = 2.5, 1.3, -0.6
    ARM_GAIN = 3.0              # swing amplitude of the arms around their own mean (the take's arms swing little)
    ARM_SYM = 0.85               # how far the two arms are pulled toward a common (mirrored, half a cycle apart) swing
    ARM_OUT, ARM_OUT_PEAK, ARM_BACK, ARM_TWIST = 14.0, 3.0, 11.0, -10.0   # ARM_OUT_PEAK: extra abduction at the swing peaks (clears thigh pouches)
    FLEX_MIN, FLEX_GAIN = 14.0, 1.1
    FORE_IN = float(os.environ.get('FORE_IN', '18'))
    CLAV_YAW = 6.0               # collar bone swings fore/aft with the arm (deg per unit of normalised swing); the arm keeps its own direction

    B0, loc0 = src
    D0, pos0 = rig.fk(B0, loc0)
    Dm, pm = D0[:-1], pos0[:-1]
    N = len(Dm)
    cyc = N / 2.0                # frames per gait cycle
    half = cyc / 2.0
    i = rig.i
    t = np.arange(N) / FPS
    ph = 2 * np.pi * np.arange(N) / cyc          # 0 at the left heel strike
    Bm = rig.local(Dm)
    D = Dm.copy()

    # ---- pelvis
    yaw, pitch, roll = al.ypr(Dm[:, 0])
    yaw2 = 0.35 * (yaw - yaw.mean()) - rad(PELVIS_YAW) * np.cos(ph)      # left hip forward at the left heel strike
    pitch2 = 0.5 * (pitch - pitch.mean())
    roll2 = LIST * (roll - roll.mean())
    D[:, 0] = al.from_ypr(yaw2, pitch2, roll2)
    hm = pm[:, 0]
    hips = hm.copy()
    hips[:, 0] = SWAY * (hm[:, 0] - hm[:, 0].mean())
    # ---- feet: the mocap ankles, moved apart
    ank = {}
    for sd, sg in (('Left', 1.0), ('Right', -1.0)):
        a = pm[:, i(sd + 'Foot')].copy()
        a[:, 0] += sg * WIDEN
        ank[sd] = a
    # ---- soles: per-frame ankle height correction measured on the deformed mesh by a first pass (see main)
    if lift is not None:
        for sd in ('Left', 'Right'):
            ank[sd][:, 2] += lift[sd]
    # ---- pelvis fore-aft: the take's slow drift across the two cycles goes, half of the per-step pulse stays, and the
    #      pelvis sits where the leading and the trailing leg share the reach at heel strike (straighter leading knee)
    yb = hm[:, 1] - hm[:, 1].mean()
    step = 0.5 * (yb + al.loop_sample(yb, np.arange(N) + cyc))            # what repeats every cycle
    y_base = hm[:, 1].mean() + FORE_AFT * step

    def limit(shift):
        zl = np.full(N, 9.0)
        for sd in ('Left', 'Right'):
            ju, jl, jf = i(sd + 'UpLeg'), i(sd + 'Leg'), i(sd + 'Foot')
            reach = np.linalg.norm(rig.head[jl] - rig.head[ju]) + np.linalg.norm(rig.head[jf] - rig.head[jl])
            off = mv(D[:, 0], rig.head[ju] - rig.head[0])
            h2 = (hips[:, 0] + off[:, 0] - ank[sd][:, 0]) ** 2 + (y_base + shift + off[:, 1] - ank[sd][:, 1]) ** 2
            zl = np.minimum(zl, ank[sd][:, 2] + np.sqrt(np.maximum((EXT * reach) ** 2 - h2, 0)) - off[:, 2])
        return zl
    shifts = np.linspace(-0.04, 0.05, 46)
    best = shifts[int(np.argmax([np.sort(limit(c))[:N // 5].mean() for c in shifts]))]
    hips[:, 1] = y_base + best
    # ---- pelvis height: at every double support as high as the legs allow (no knee lock, no pop); between them the
    #      a fraction of the arc a straight stance leg would give (the take itself walks with bent knees)
    zl = limit(best)
    zs = al.loop_smooth(zl, 1.0)
    anchors = [f for f in range(N) if zs[f] <= zs[f - 1] and zs[f] < zs[(f + 1) % N] and zs[f] < np.median(zs)]

    def through(vals):
        """periodic curve through the anchor frames with zero slope at each"""
        out = np.empty(N)
        for k, a in enumerate(anchors):
            b = anchors[(k + 1) % len(anchors)]
            n = (b - a) % N or N
            u = al.smoothstep(np.arange(n) / n)
            out[(a + np.arange(n)) % N] = vals[k] * (1 - u) + vals[(k + 1) % len(anchors)] * u
        return out
    z = through([zl[a] - 0.003 for a in anchors]) + BOB * (zs - through([zs[a] for a in anchors]))
    for _ in range(25):
        z = al.loop_smooth(np.minimum(z, zl - 0.002), 0.8)
    z = -np.log(np.exp(-350 * z) + np.exp(-350 * zl)) / 350        # soft: a leg eases onto full length and off it again
    hips[:, 2] = z
    # ---- trunk: upright, shoulders turning against the hips
    cy, cp, cr = al.ypr(Dm[:, i('Spine2')])
    chest = al.from_ypr(CHEST_YAW * (cy - cy.mean()), rad(CHEST_PITCH) + 0.4 * (cp - cp.mean()), CHEST_ROLL * (cr - cr.mean()) - 0.4 * roll2)
    chest = al.loop_smooth_rot(chest, 0.8)
    D[:, i('Spine2')] = chest
    _fr = np.arange(N)
    D[:, i('Spine')] = al.slerp(D[:, 0], al.loop_sample(chest, _fr - 1.5, True), 0.33)
    D[:, i('Spine1')] = al.slerp(D[:, 0], al.loop_sample(chest, _fr - 0.75, True), 0.67)
    hy, hp_, hr = al.ypr(Dm[:, i('Head')])
    head = al.from_ypr(0.25 * CHEST_YAW * (cy - cy.mean()), 0.25 * (hp_ - hp_.mean()), 0.3 * (hr - hr.mean()))
    head = al.loop_smooth_rot(head, 1.2)
    D[:, i('Head')] = head
    D[:, i('Neck')] = al.slerp(chest, head, 0.5)
    # ---- arms: the take's swing relative to the chest, pulled toward left/right symmetry, cleaned
    La, Ra = Bm[:, i('LeftArm')], Bm[:, i('RightArm')]
    zl_, zr_ = al.to_euler(Bm[:, i('LeftForeArm')])[:, 2], -al.to_euler(Bm[:, i('RightForeArm')])[:, 2]
    Lh, Rh = Bm[:, i('LeftHand')], Bm[:, i('RightHand')]
    fr = np.arange(N)

    def sym(L, R, rotation=True):
        """L and the mirrored R half a cycle later -> common track; returns (new L, new R in the left convention)"""
        Rs = al.loop_sample(R, fr + half, rotation)
        if rotation:
            c = al.slerp(L, Rs, 0.5)
            L2 = al.slerp(L, c, ARM_SYM)
            R2 = al.slerp(R, al.loop_sample(c, fr - half, True), ARM_SYM)
        else:
            c = 0.5 * (L + Rs)
            L2 = L + ARM_SYM * (c - L)
            R2 = R + ARM_SYM * (al.loop_sample(c, fr - half) - R)
        return L2, R2
    La2, Ra2 = sym(La, S @ Ra @ S)
    fl, fr_ = sym(zl_, zr_, rotation=False)
    Lh2, Rh2 = sym(Lh, S @ Rh @ S)
    E = {}
    swing = {}
    for sd, sg, A, flex, H in (('Left', 1.0, La2, fl, Lh2), ('Right', -1.0, Ra2, fr_, Rh2)):
        ja, jf, jh = i(sd + 'Arm'), i(sd + 'ForeArm'), i(sd + 'Hand')
        A = clean_rot(A)
        mA = mean_rot(A)
        A = drop_twist(al.scale_rot(A @ T(mA), ARM_GAIN) @ mA)
        # in the rest frame of the (left) arm: X = back, Y = out along the T-pose arm, Z = down
        swing_ = al.to_euler(A)[:, 1]
        swing_ = (swing_ - swing_.mean()) / max(np.abs(swing_ - swing_.mean()).max(), 1e-6)
        out_ = ARM_OUT + ARM_OUT_PEAK * np.abs(swing_) ** 1.5
        A = ry(rad(ARM_BACK)) @ rx(rad(-out_)) @ A @ ry(rad(ARM_TWIST + 3.0 * swing_))
        flex = clean_scalar(flex)
        flex = FLEX_MIN + FLEX_GAIN * (flex - flex.min())
        Hm = al.scale_rot(clean_rot(H, harmonics=2), 0.45) @ al.euler((5.0, 6.0, 0.0))
        Fm = ry(rad(FORE_IN)) @ rz(rad(flex)) @ ry(rad(-FORE_IN))     # the elbow bends a little inward, so the forearm does not splay out
        if sd == 'Right':
            A, Fm, Hm = S @ A @ S, S @ Fm @ S, S @ Hm @ S
        D[:, i(sd + 'Shoulder')] = chest @ rz(rad(sg * CLAV_YAW) * swing_)
        D[:, ja] = chest @ rig.R[ja] @ A @ rig.R[ja].T
        D[:, jf] = D[:, ja] @ rig.R[jf] @ Fm @ rig.R[jf].T
        D[:, jh] = D[:, jf] @ rig.R[jh] @ Hm @ rig.R[jh].T
        swing[sd] = flex
    # ---- legs
    # legs turn in: the take toes out 12-23 deg; thigh and knee turn in a little, the foot more (to about 5 deg out)
    for sd, sg, kf in (('Left', 1.0, 17.0), ('Right', -1.0, 10.0)):
        for bn, k in (('UpLeg', 6.0), ('Leg', 6.0), ('Foot', kf), ('ToeBase', kf)):
            D[:, i(sd + bn)] = rz(-sg * rad(k)) @ D[:, i(sd + bn)]
    pos = rig.positions(D, hips)
    miss = 0.0
    for sd in ('Left', 'Right'):
        miss = max(miss, rig.solve_leg(D, pos, sd, pos[:, i(sd + 'UpLeg')], ank[sd]))
    B = rig.local(D)
    info['knee_flex_deg_at_frames_0_18_36_55'] = {sd: [round(float(al.to_euler(B[f, i(sd + 'Leg')])[0]), 1) for f in (0, 18, 36, 55)] for sd in ('Left', 'Right')}
    # ---- hands: relaxed curl that closes a touch as the arm comes forward (elbow flexion leads it by a few frames)
    for sd in ('Left', 'Right'):
        f = swing[sd]
        g = (f - f.mean()) / max(np.ptp(f), 1e-6)
        g = al.loop_sample(g, np.arange(N) - 3.0)
        E.update(fingers(sd, 1.18 + 0.15 * g, thumb=1.1 + 0.1 * g, thumb_in=26.0))
    bl = blinks(t, (1.50,), period=N / FPS)
    E.update(face(N, blink=bl))
    B = put_euler(rig, B, E)
    loc = rig.loc_from_hips(hips)
    info.update(frames=N + 1, duration=round(N / FPS, 4), loop=True, cycles=2, cycle_duration=round(cyc / FPS, 4),
                stride_per_cycle=mocap_stats['stride_per_cycle'], ground_speed=round(mocap_stats['stride_per_cycle'] / (cyc / FPS), 4),
                starts_on='left heel strike', leg_miss=round(miss, 5), pelvis_shift_fore_aft=round(float(best), 4), double_support_frames=[int(a) for a in anchors], track_widened_each_side=WIDEN, blink_times=[1.5])
    return close_loop(B, loc)


# ------------------------------------------------------------------ measurements on the rig model
def measure(rig, name, B, loc, info):
    D, pos = rig.fk(B, loc)
    i = rig.i
    F = len(B)
    out = {}
    head_j = i('Head')
    hp = pos[:, head_j] + mv(D[:, head_j], np.array([0, 0, 0.10]))       # a point inside the skull
    y, p, r = [np.degrees(v) for v in al.ypr(D[:, head_j])]
    out['head_travel_mm'] = dict(vertical=round(float(np.ptp(hp[:, 2])) * 1000, 1), lateral=round(float(np.ptp(hp[:, 0])) * 1000, 1),
                                 fore_aft=round(float(np.ptp(hp[:, 1])) * 1000, 1))
    out['head_deg'] = dict(pitch=[round(float(p.min()), 2), round(float(p.max()), 2)], yaw=[round(float(y.min()), 2), round(float(y.max()), 2)],
                           roll=[round(float(r.min()), 2), round(float(r.max()), 2)])
    cy, cp, cr = [np.degrees(v) for v in al.ypr(D[:, i('Spine2')])]
    py, pp, pr = [np.degrees(v) for v in al.ypr(D[:, 0])]
    out['chest_deg'] = dict(pitch=[round(float(cp.min()), 2), round(float(cp.max()), 2)], yaw=[round(float(cy.min()), 2), round(float(cy.max()), 2)],
                            roll=[round(float(cr.min()), 2), round(float(cr.max()), 2)])
    out['pelvis_deg'] = dict(pitch=[round(float(pp.min()), 2), round(float(pp.max()), 2)], yaw=[round(float(py.min()), 2), round(float(py.max()), 2)],
                             roll=[round(float(pr.min()), 2), round(float(pr.max()), 2)])
    out['hips_mm'] = dict(bob=round(float(np.ptp(pos[:, 0, 2])) * 1000, 1), sway=round(float(np.ptp(pos[:, 0, 0])) * 1000, 1),
                          fore_aft=round(float(np.ptp(pos[:, 0, 1])) * 1000, 1))
    knee = {sd: al.to_euler(B[:, i(sd + 'Leg')])[:, 0] for sd in ('Left', 'Right')}
    out['knee_flex_deg'] = {sd.lower(): [round(float(k.min()), 1), round(float(k.max()), 1)] for sd, k in knee.items()}
    elbow = {'Left': al.to_euler(B[:, i('LeftForeArm')])[:, 2], 'Right': -al.to_euler(B[:, i('RightForeArm')])[:, 2]}
    out['elbow_flex_deg'] = {sd.lower(): [round(float(k.min()), 1), round(float(k.max()), 1)] for sd, k in elbow.items()}
    # smoothness: largest frame-to-frame change of any joint angle, and of its rate
    q = al.mat2quat(B[:, rig.keyed])
    dq = np.degrees(2 * np.arccos(np.clip(np.abs(np.sum(q[1:] * q[:-1], -1)), 0, 1)))
    j = np.unravel_index(dq.argmax(), dq.shape)
    out['max_joint_step_deg'] = [round(float(dq.max()), 2), rig.names[rig.keyed[j[1]]], int(j[0])]
    body = [k for k, jj in enumerate(rig.keyed) if not any(s_ in rig.names[jj] for s_ in ('Eyelid', 'Toe'))]
    acc = np.abs(dq[1:, body] - dq[:-1, body])
    j = np.unravel_index(acc.argmax(), acc.shape)
    out['max_step_change_deg'] = [round(float(acc.max()), 2), rig.names[rig.keyed[body[j[1]]]], int(j[0]) + 1]
    if info.get('loop'):
        Bq = al.mat2quat(B[:-1, rig.keyed])
        nxt = np.roll(Bq, -1, 0)
        step = np.degrees(2 * np.arccos(np.clip(np.abs(np.sum(Bq * nxt, -1)), 0, 1)))
        # velocity continuity at the seam: the step into frame 0 against the step out of it, compared with the clip's own worst
        acc = np.abs(step - np.roll(step, 1, 0))
        out['seam'] = dict(pose_gap_deg=round(float(np.degrees(2 * np.arccos(np.clip(np.abs(np.sum(al.mat2quat(B[0, rig.keyed]) * al.mat2quat(B[-1, rig.keyed]), -1)), 0, 1))).max()), 5),
                           step_change_at_seam_deg=round(float(acc[0].max()), 3), step_change_worst_elsewhere_deg=round(float(acc[1:].max()), 3))
    if name == 'walk':
        v = info['ground_speed']
        tt = np.arange(F) / FPS
        worst, speeds = 0.0, []
        wrist = {}
        for sd in ('Left', 'Right'):
            jt, jf = i(sd + 'ToeBase'), i(sd + 'Foot')
            ball, an = pos[:, jt], pos[:, jf]
            planted = (ball[:, 2] < rig.head[jt][2] + 0.004) & (an[:, 2] < rig.head[jf][2] + 0.01)
            g = ball.copy()
            g[:, 1] -= v * tt
            a = None
            runs = []
            for f in range(F + 1):
                on = f < F and planted[f]
                if on and a is None:
                    a = f
                if not on and a is not None:
                    runs.append((a, f))
                    a = None
            for a, b in runs:
                if b - a >= 3:
                    sg_ = g[a:b, :2]
                    worst = max(worst, float(np.linalg.norm(sg_ - sg_.mean(0), axis=1).max()))
                    speeds.append(float((ball[b - 1, 1] - ball[a, 1]) / ((b - 1 - a) / FPS)))
            w = pos[:, i(sd + 'Hand')] - pos[:, i(sd + 'Arm')]
            wrist[sd.lower()] = dict(fore_aft_vs_shoulder_m=[round(float(-w[:, 1].max()), 3), round(float(-w[:, 1].min()), 3)],
                                     lateral_vs_shoulder_m=[round(float(abs(w[:, 0]).min()), 3), round(float(abs(w[:, 0]).max()), 3)])
        out['flat_foot_max_slide_mm'] = round(worst * 1000, 2)
        out['planted_ball_speed_m_s'] = [round(s, 4) for s in speeds]
        out['wrist_swing'] = wrist
        out['ankle_track_half_width_m'] = [round(float(np.abs(pos[:, i(sd + 'Foot'), 0]).min()), 3) for sd in ('Left', 'Right')]
        out['lowest_joint_m'] = dict(ball=round(float(min(pos[:, i(sd + 'ToeBase'), 2].min() for sd in ('Left', 'Right'))), 4),
                                     ball_rest=round(float(rig.head[i('LeftToeBase')][2]), 4))
    return out


def same_pose(rig, Ba, la, Bb, lb):
    qa, qb = al.mat2quat(Ba[rig.keyed]), al.mat2quat(Bb[rig.keyed])
    ang = np.degrees(2 * np.arccos(np.clip(np.abs(np.sum(qa * qb, -1)), 0, 1)))
    return round(float(ang.max()), 6), round(float(np.abs(la - lb).max()) * 1000, 6)


def main():
    a = sys.argv[sys.argv.index('--') + 1:]
    pos_ = [q for q in a if '=' not in q]
    kw = dict(q.split('=', 1) for q in a if '=' in q)
    src, out = os.path.abspath(pos_[0]), os.path.abspath(pos_[1])
    rep_path = os.path.abspath(kw.get('report', os.path.splitext(out)[0] + '.json'))
    bpy.ops.wm.open_mainfile(filepath=src)
    with open(os.path.splitext(src)[0] + '.json') as fh:
        mstats = json.load(fh)['clips']
    sc = bpy.context.scene
    sc.render.fps, sc.render.fps_base = FPS, 1.0
    ob = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    rig = al.Rig(ob)
    mocap = {n: al.read_action(rig, bpy.data.actions[n]) for n in ('idle', 'walk')}
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act)
    for tr in list(ob.animation_data.nla_tracks):
        ob.animation_data.nla_tracks.remove(tr)

    import anim_oneshots as one
    probe = al.MeshProbe(bpy.data.objects['Hero'])
    clips, report = {}, dict(fps=FPS, clips={})
    info = {}
    clips['idle'] = build_idle(rig, mocap['idle'], info)
    report['clips']['idle'] = info
    info = {}
    clips['walk'] = build_walk(rig, mocap['walk'], info, mstats['walk'])
    lift = None
    for _ in range(2):                       # floor contact on the real mesh: measure the soles, correct the ankles, rebuild
        low = sole_heights(rig, probe, clips['walk'])
        lift = sole_lift(low, lift)
        info = {}
        clips['walk'] = build_walk(rig, mocap['walk'], info, mstats['walk'], lift)
    report['clips']['walk'] = info
    info['sole_correction_mm'] = {sd: [round(float(v.min()) * 1000, 1), round(float(v.max()) * 1000, 1)] for sd, v in lift.items()}
    info = {}
    clips['wave'] = one.build_wave(rig, clips['idle'], info)
    report['clips']['wave'] = info
    info = {}
    clips['think'] = land_contacts(rig, probe, clips['idle'], info)
    report['clips']['think'] = info
    acts = []
    B0, l0 = clips['idle']
    for name, (B, loc) in clips.items():
        info = report['clips'][name]
        info.update(measure(rig, name, B, loc, info))
        if name in ('wave', 'think'):
            info['first_frame_vs_idle0'] = dict(zip(('max_joint_deg', 'hips_mm'), same_pose(rig, B[0], loc[0], B0[0], l0[0])))
            info['second_frame_step_deg'] = same_pose(rig, B[1], loc[1], B[0], loc[0])[0]
            if name == 'wave':
                info['last_frame_vs_idle0'] = dict(zip(('max_joint_deg', 'hips_mm'), same_pose(rig, B[-1], loc[-1], B0[0], l0[0])))
                info['last_step_deg'] = same_pose(rig, B[-1], loc[-1], B[-2], loc[-2])[0]
        act, nkeys = al.write_action(rig, name, B, loc)
        info['keys'] = nkeys
        acts.append(act)
        print('ANIM', name, json.dumps(info))
    al.nla_tracks(ob, acts)
    for pb in ob.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    sc.frame_start, sc.frame_end = 0, max(int(c[0].shape[0]) for c in clips.values()) - 1
    sc.frame_set(0)
    with open(rep_path, 'w', newline='\n') as fh:
        json.dump(report, fh, indent=1)
    bpy.ops.wm.save_as_mainfile(filepath=out)
    print('ANIM saved', out)


if __name__ == '__main__':
    main()
