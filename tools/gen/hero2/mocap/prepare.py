"""Turn the chosen raw CMU takes into clean site clips: idle, walk, wave (30 fps, in place).

    python -I prepare.py <raw cmu dir> <out dir> [walk=136_21] [idle=82_08] [wave=113_27]

Writes <out>/idle.bvh, walk.bvh, wave.bvh and <out>/manifest.json.

Every output BVH is in metres at the capture subject's real size, Y up, facing +Z, left = +X, floor at
y = 0 under the ball-of-foot joint, and has been re-rested: **all rotations zero = T-pose with flat feet**.
Loops store N + 1 frames, the last equal to the first.
"""
import json
import math
import os
import sys

import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bvh  # noqa: E402
import motion as mo  # noqa: E402
import scan_walks  # noqa: E402

CMU_UNIT = 0.0254 / 0.45          # the ASF files say "length 0.45": one unit is 1/0.45 inch
FPS = 30
LICENCE = ('CMU Graphics Lab Motion Capture Database, mocap.cs.cmu.edu: "This data is free for use in research '
           'and commercial projects worldwide." Created with funding from NSF EIA-0196217. BVH conversion by '
           'Bruce Hahne (cgspeed.com, 2010 release), fetched from the github.com/una-dinosauria/cmu-mocap mirror.')
LEGS = [('LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase'), ('RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase')]


def load_take(path, sigma):
    """Raw take -> (motion without the T-pose frame, low-passed at the native rate; T-pose global rotations)."""
    b = bvh.load(path)
    tp = b.copy()
    tp.R, tp.pos = b.R[:1], b.pos[:1]
    GT = bvh.fk(tp)[0][0]
    b.R, b.pos = b.R[1:], b.pos[1:]
    b.R = bvh.smooth_rot(b.R, sigma)
    b.pos = bvh.smooth(b.pos, sigma)
    return b, GT


def to_metres(b):
    b.offsets = b.offsets * CMU_UNIT
    b.ends = {k: v * CMU_UNIT for k, v in b.ends.items()}
    b.pos = b.pos * CMU_UNIT
    return b


def turn(b, yaw):
    """Rotate the whole motion about the vertical by -yaw (so heading `yaw` becomes +Z)."""
    M = mo.yaw_mat(np.array(-yaw))
    b.R[:, 0] = M @ b.R[:, 0]
    b.pos = b.pos @ M.T
    return b


def pose_feature(b, frames):
    """Joint positions and velocities in a hips-centred, heading-aligned frame, for comparing poses."""
    sel = b.copy()
    idx = np.clip(np.array(frames)[:, None] + np.array([-2, 0, 2])[None], 0, b.R.shape[0] - 1)
    out = []
    for col in range(3):
        sel.R, sel.pos = b.R[idx[:, col]], b.pos[idx[:, col]]
        G, P = bvh.fk(sel)
        fwd = G[:, 0] @ np.array([0, 0, 1.0])
        M = mo.yaw_mat(-mo.yaw_of(fwd))
        Q = P - P[:, :1]
        Q[..., 1] += P[:, :1, 1]
        out.append(np.einsum('fij,fkj->fki', M, Q))
    vel = (out[2] - out[0]) / (4 * b.frame_time)
    return out[1], vel


def close_loop(b):
    """Spread the mismatch between first and last frame linearly over the clip, so frame N == frame 0."""
    F = b.R.shape[0]
    s = np.linspace(-0.5, 0.5, F)
    D = mo.T(b.R[0]) @ b.R[-1]
    rv = bvh.mat2rotvec(D)                                   # (J, 3)
    b.R = b.R @ bvh.rotvec2mat(-s[:, None, None] * rv[None])
    b.pos = b.pos - s[:, None] * (b.pos[-1] - b.pos[0])[None]
    g = np.degrees(np.linalg.norm(rv, axis=1))
    return b, (float(g.max()), b.names[int(np.argmax(g))])


def wrap_smooth(b, sigma):
    """Circular low-pass over a closed loop (frame N == frame 0)."""
    q = bvh.quat_continuous(bvh.mat2quat(b.R[:-1]))
    # make the wrap consistent too
    flip = np.sum(q[0] * q[-1], -1) < 0
    if flip.any():
        # a joint whose quaternion changed sign over the period: smooth it unwrapped instead
        pass
    qs = bvh.smooth(q, sigma, wrap=True)
    qs[:, flip] = q[:, flip]
    R = bvh.quat2mat(qs)
    b.R = np.concatenate([R, R[:1]], 0)
    p = bvh.smooth(b.pos[:-1], sigma, wrap=True)
    b.pos = np.concatenate([p, p[:1]], 0)
    return b


def flat_feet_rerest(b, masks):
    """Second re-rest, feet and toes only: zero rotation = the orientation they have while planted, with the
    heading (turn-out) taken out, i.e. sole flat on the floor pointing straight ahead."""
    G, _ = bvh.fk(b)
    J = len(b.names)
    Gref = np.tile(np.eye(3), (J, 1, 1))
    for (up, low, foot, toe), m in zip(LEGS, masks):
        _, P = bvh.fk(b)
        ay = P[:, b.idx(foot), 1]
        flat = m & (ay < np.percentile(ay[m], 30) + 0.01) if m.any() else m    # planted and heel down
        for name in (foot, toe):
            j = b.idx(name)
            mm = flat if name == foot else m
            sel = G[mm, j] if mm.sum() >= 3 else G[:, j]
            F0 = mo.mean_rot(sel)
            tip = b.ends[j] if j in b.ends else b.offsets[b.children(j)[0]]
            d = F0 @ tip
            Gref[j] = mo.yaw_mat(-mo.yaw_of(d)) @ F0
    return mo.rerest(b, Gref), Gref


def symmetrise_legs(b):
    """CMU skeletons are fitted per side and the two legs differ by a couple of centimetres. A rig has equal
    legs, so make them equal here (mirror-average) and let the IK re-solve onto the real foot paths."""
    mir = np.array([-1.0, 1, 1])
    for l, r in zip(LEGS[0], LEGS[1]):
        jl, jr = b.idx(l), b.idx(r)
        m = (b.offsets[jl] + b.offsets[jr] * mir) / 2
        b.offsets[jl], b.offsets[jr] = m, m * mir
        if jl in b.ends:
            m = (b.ends[jl] + b.ends[jr] * mir) / 2
            b.ends[jl], b.ends[jr] = m, m * mir
    return b


def effectors(b):
    """World paths of both feet: (ankle position, foot orientation, toe orientation) per leg."""
    G, P = bvh.fk(b)
    return [(P[:, b.idx(foot)].copy(), G[:, b.idx(foot)].copy(), G[:, b.idx(toe)].copy()) for _, _, foot, toe in LEGS]


def close_effectors(eff, sigma):
    """Loop-close the foot paths directly in world space (a few mm spread over the clip) instead of letting the
    joint-angle closure swing the whole leg, then give them the same circular smoothing as the body."""
    out = []
    for ank, Gf, Gt in eff:
        F = len(ank)
        s = np.linspace(-0.5, 0.5, F)
        ank = ank - s[:, None] * (ank[-1] - ank[0])[None]
        ank = bvh.smooth(ank[:-1], sigma, wrap=True)
        ank = np.concatenate([ank, ank[:1]], 0)
        rs = []
        for Gx in (Gf, Gt):
            rv = bvh.mat2rotvec(mo.T(Gx[0]) @ Gx[-1])
            Gx = Gx @ bvh.rotvec2mat(-s[:, None] * rv[None])
            q = bvh.smooth(bvh.quat_continuous(bvh.mat2quat(Gx[:-1])), sigma, wrap=True)
            Gx = bvh.quat2mat(q)
            rs.append(np.concatenate([Gx, Gx[:1]], 0))
        out.append((ank, rs[0], rs[1]))
    return out


def fix_feet(b, belt, loop, lock, eff=None, knee_flex_to=None):
    """Pin planted feet (see motion.plant) and re-solve the legs. lock=True holds both feet completely still.
    eff: foot paths to aim for (default: where the feet are now)."""
    eff = eff or effectors(b)
    G, P = bvh.fk(b)
    F = b.R.shape[0]
    n = F - 1 if loop else F
    legs, targets, masks, slide, floors, pitch = [], [], [], [], [], []
    for (up, low, foot, toe), (ank, Gf, Gt) in zip(LEGS, eff):
        ju, jl, jf, jt = b.idx(up), b.idx(low), b.idx(foot), b.idx(toe)
        if lock:
            Gf = np.tile(mo.mean_rot(Gf), (F, 1, 1))
            Gt = np.tile(mo.mean_rot(Gt), (F, 1, 1))
        ball = ank + mo.mv(Gf, b.offsets[jt])
        if lock:
            fl = float(np.median(ball[:, 1]))
            tgt = np.tile(np.median(ank, 0), (F, 1))
            on = np.ones(F, bool)
            slide.append(float(np.linalg.norm(ank - tgt, axis=1).max()))
        else:
            off, on, fl = mo.plant(ball[:n], FPS, belt, loop)
            if loop:
                off = np.concatenate([off, off[:1]], 0)
                on = np.concatenate([on, on[:1]], 0)
            tgt = ank + off
            slide.append(float(np.linalg.norm(off[on][:, [0, 2]], axis=1).max()) if on.any() else 0.0)
        tgt[:, 1] -= fl                                # this foot's planted ball height becomes y = 0
        if not lock:
            L = np.linalg.norm(b.offsets[jl]) + np.linalg.norm(b.offsets[jf])
            hip = P[:, ju] - np.array([0, np.mean(floors + [fl]), 0])
            Gf, tgt, need = mo.pitch_to_reach(hip, tgt + mo.mv(Gf, b.offsets[jt]), Gf, b.offsets[jt], L, wrap=loop)
            pitch.append(float(np.degrees(need.max())))
        G[:, jf], G[:, jt] = Gf, Gt
        floors.append(fl)
        legs.append((ju, jl, jf))
        targets.append(tgt)
        masks.append(on)
    floor = float(np.mean(floors))
    P = P - np.array([0, floor, 0])
    pos = b.pos - np.array([0, floor, 0])
    if knee_flex_to is not None:
        # raise the pelvis (a constant) until the straighter knee is at knee_flex_to degrees
        ups = []
        for (ju, jl, jf), tgt in zip(legs, targets):
            a, c = np.linalg.norm(b.offsets[jl]), np.linalg.norm(b.offsets[jf])
            want = math.sqrt(a * a + c * c + 2 * a * c * math.cos(math.radians(knee_flex_to)))
            d = np.median(tgt, 0) - P[:, ju].mean(0)
            ups.append(math.sqrt(max(want * want - d[0] * d[0] - d[2] * d[2], 0)) - abs(d[1]))
        up_by = max(min(ups), 0.0)
        P = P + np.array([0, up_by, 0])
        pos = pos + np.array([0, up_by, 0])
        fix_feet.raised = up_by
    G2, pos, miss = mo.solve_legs(b, G, P, pos, legs, targets, FPS, max_drop=0.0)
    b.R = mo.locals_from_globals(b, G2)
    b.pos = pos
    return b, masks, slide, miss, max(pitch or [0.0])


def flatten_toes(b):
    """CMU toes are all but rigid with the foot, so they dig into the floor at heel-off. Keep the toe segment
    flat (heading of the foot, no pitch or roll) while the ball of the foot is near the floor."""
    G, P = bvh.fk(b)
    for _, _, foot, toe in LEGS:
        jf, jt = b.idx(foot), b.idx(toe)
        w = 1 - mo.smoothstep((P[:, jt, 1] - 0.02) / 0.05)
        flat = mo.yaw_mat(mo.yaw_of(G[:, jf] @ np.array([0, 0, 1.0])))
        G[:, jt] = mo.slerp(G[:, jt], flat, w)
    b.R = mo.locals_from_globals(b, G)
    return b


def skeleton_facts(b):
    """Sizes the retarget needs, from the (T-pose) rest skeleton."""
    rp = bvh.rest_positions(b)
    j = b.idx
    leg = [float(np.linalg.norm(b.offsets[j(low)]) + np.linalg.norm(b.offsets[j(foot)])) for _, low, foot, _ in LEGS]
    hip_h = float(np.mean([rp[j(up)][1] for up, _, _, _ in LEGS]) - np.mean([rp[j(t)][1] for _, _, _, t in LEGS]))
    ank_h = float(np.mean([rp[j(f)][1] for _, _, f, _ in LEGS]) - np.mean([rp[j(t)][1] for _, _, _, t in LEGS]))
    head_top = float(rp[j('Head')][1] + b.ends[j('Head')][1] - np.mean([rp[j(t)][1] for _, _, _, t in LEGS]))
    return dict(leg_length=round(float(np.mean(leg)), 4), hip_joint_height_above_ball=round(hip_h, 4),
                ankle_height_above_ball=round(ank_h, 4), head_end_height_above_ball=round(head_top, 4))


def prep_walk(raw, take, out):
    path = os.path.join(raw, take + '.bvh')
    b, GT = load_take(path, sigma=2.0)                       # ~8 Hz at 120 fps
    src_fps = b.fps
    strikes = [s - 1 for s in scan_walks.measure(path)['strikes']]      # indices after dropping the T-pose frame
    # candidate loops: one or two cycles between left heel strikes; pick the best pose + velocity match
    cands = []
    for i in range(len(strikes)):
        for k in (1, 2):
            if i + k < len(strikes):
                s, e0 = strikes[i], strikes[i + k]
                es = list(range(e0 - 8, e0 + 9))
                p0, v0 = pose_feature(b, [s])
                p1, v1 = pose_feature(b, es)
                cost = np.sqrt(((p1 - p0) ** 2).sum(-1)).mean(-1) + 0.08 * np.sqrt(((v1 - v0) ** 2).sum(-1)).mean(-1)
                m = int(np.argmin(cost))
                cands.append((float(cost[m]) * CMU_UNIT, k, s, es[m]))
    for c in cands:
        print('  walk loop candidate: %d cycle(s), raw frames %d-%d, seam cost %.4f m' % (c[1], c[2] + 1, c[3] + 1, c[0]))
    two = [c for c in cands if c[1] == 2]
    one = [c for c in cands if c[1] == 1]
    best = min(two) if two and min(two)[0] < 1.5 * min(one)[0] + 0.01 else min(one)
    cost, ncyc, s, e = best
    b = mo.rerest(b, GT)
    b = to_metres(b)
    d = b.pos[e] - b.pos[s]
    yaw = float(mo.yaw_of(d))
    b = turn(b, yaw)
    true_dur = (e - s) / src_fps
    N = int(round(true_dur * FPS))
    b = bvh.sample(b, s + np.arange(N + 1) * (e - s) / N, FPS)
    stride_total = float(b.pos[-1, 2] - b.pos[0, 2])
    lateral_drift = float(b.pos[-1, 0] - b.pos[0, 0])
    b.pos[:, 2] -= stride_total * np.arange(N + 1) / N
    b.pos[:, 0] -= b.pos[:-1, 0].mean()
    b.pos[:, 2] -= b.pos[:-1, 2].mean()
    eff = close_effectors(effectors(b), 0.6)
    b = symmetrise_legs(b)
    b, gap = close_loop(b)
    b = wrap_smooth(b, 0.6)
    dur = N / FPS
    belt = stride_total / dur
    b, masks, slide, miss, pitch = fix_feet(b, belt, loop=True, lock=False, eff=eff)
    b, _ = flat_feet_rerest(b, masks)
    b = flatten_toes(b)
    b.R[-1], b.pos[-1] = b.R[0], b.pos[0]
    bvh.save(os.path.join(out, 'walk.bvh'), b)
    G, P = bvh.fk(b)
    hips = P[:, 0]
    head = P[:, b.idx('Head')]
    facts = skeleton_facts(b)
    info = dict(
        clip='walk', file='walk.bvh', source=take + '.bvh', source_frames=[s + 1, e + 1], source_fps=round(src_fps, 2),
        fps=FPS, frames=N + 1, duration=round(dur, 4), loop=True, cycles=ncyc,
        cycle_duration=round(dur / ncyc, 4), true_cycle_duration=round(true_dur / ncyc, 4),
        starts_on='left heel strike',
        stride_per_cycle=round(stride_total / ncyc, 4), ground_speed=round(belt, 4),
        stride_per_cycle_over_leg_length=round(stride_total / ncyc / facts['leg_length'], 4),
        heading_removed_deg=round(float(np.degrees(yaw)), 2), lateral_drift_removed=round(lateral_drift, 4),
        seam_cost_m=round(cost, 4), seam_max_joint_gap_deg=round(gap[0], 2),
        hips_bob=round(float(np.ptp(hips[:, 1])), 4), hips_sway=round(float(np.ptp(hips[:, 0])), 4),
        hips_fore_aft=round(float(np.ptp(hips[:, 2])), 4), head_bob=round(float(np.ptp(head[:, 1])), 4),
        contact_frames={'left': [int(i) for i in np.flatnonzero(masks[0])], 'right': [int(i) for i in np.flatnonzero(masks[1])]},
        max_slide_removed=round(max(slide), 4), max_ankle_miss_after_ik=round(miss, 4),
        max_extra_heel_lift_deg=round(pitch, 2), seam_gap_joint=gap[1],
        skeleton=facts,
        notes='Low-pass ~8 Hz at 120 fps, resampled to 30 fps with the cycle stretched to a whole number of frames, '
              'heading turned to +Z, forward travel removed as a constant speed (hips keep their real bob, sway and '
              'fore-aft pulse), loop gap spread linearly over the clip, light circular smoothing, ball of each '
              'planted foot pinned to the moving ground and legs re-solved with two-bone IK, toe segment kept flat '
              'while the ball of the foot is down. Legs made equal length (the CMU fit differs by 2 cm left to right); '
              'where the shorter leg cannot reach at toe-off the heel lifts a little more instead of the foot sliding.')
    return info


def best_idle_window(b, lo, hi, min_len, max_len, step):
    frames = list(range(lo, hi, step))
    p, v = pose_feature(b, frames)
    best = None
    for i, s in enumerate(frames):
        for k, e in enumerate(frames):
            if min_len <= e - s <= max_len:
                c = np.sqrt(((p[k] - p[i]) ** 2).sum(-1)).mean() + 0.3 * np.sqrt(((v[k] - v[i]) ** 2).sum(-1)).mean()
                if best is None or c < best[0]:
                    best = (float(c), s, e)
    return best


CALM = {'Neck': 0.15, 'Neck1': 0.15, 'Head': 0.15, 'LowerBack': 0.6, 'Spine': 0.6, 'Spine1': 0.6}


def head_yaw_range(b):
    G, _ = bvh.fk(b)
    f = G[:, b.idx('Head')] @ np.array([0, 0, 1.0])
    return float(np.degrees(np.ptp(np.unwrap(mo.yaw_of(f)))))


def knee_flex(b):
    _, P = bvh.fk(b)
    out = []
    for up, low, foot, _ in LEGS:
        u = P[:, b.idx(up)] - P[:, b.idx(low)]
        w = P[:, b.idx(foot)] - P[:, b.idx(low)]
        c = np.sum(u * w, 1) / np.linalg.norm(u, axis=1) / np.linalg.norm(w, axis=1)
        out.append(float(np.mean(180 - np.degrees(np.arccos(np.clip(c, -1, 1))))))
    return out


IDLE_KNEE_FLEX = 9.0


def stand_tall(b, eff, hip_ahead=0.06):
    """The CMU skeleton fit leaves this subject standing with the pelvis pushed forward and the knees bent
    20 to 28 degrees, which reads as a slouch. Move the pelvis back until the hip joints are `hip_ahead`
    metres in front of the ankles; fix_feet then raises it until the straighter knee is at IDLE_KNEE_FLEX
    degrees. The feet stay where they are (IK re-solves the legs); sway and breathing are untouched."""
    before = knee_flex(b)
    _, P = bvh.fk(b)
    info = dict(knee_flex_before_deg=[round(x, 1) for x in before])
    hz = np.mean([P[:, b.idx(up), 2].mean() - ank[:, 2].mean() for (up, _, _, _), (ank, _, _) in zip(LEGS, eff)])
    back = max(float(hz - hip_ahead), 0.0)
    b.pos[:, 2] -= back
    info.update(pelvis_moved_back=round(back, 4))
    return info


def prep_idle(raw, take, out, window):
    path = os.path.join(raw, take + '.bvh')
    b, GT = load_take(path, sigma=7.0)                       # ~2.3 Hz: keeps breathing and sway, drops marker buzz
    src_fps = b.fps
    lo, hi = window
    cost, s, e = best_idle_window(b, lo, hi, int(4.5 * src_fps), int(7.5 * src_fps), 6)
    print('  idle window raw frames %d-%d (%.2f s), seam cost %.4f m' % (s + 1, e + 1, (e - s) / src_fps, cost * CMU_UNIT))
    b = mo.rerest(b, GT)
    b = to_metres(b)
    G, _ = bvh.fk(b)
    fwd = (G[s:e, 0] @ np.array([0, 0, 1.0])).mean(0)
    yaw = float(mo.yaw_of(fwd))
    b = turn(b, yaw)
    N = int(round((e - s) / src_fps * FPS))
    b = bvh.sample(b, s + np.arange(N + 1) * (e - s) / N, FPS)
    head_yaw_before = head_yaw_range(b)
    # the subject looks far left and right before walking off: keep a fraction of each joint's departure
    # from its mean pose, then turn the neck so the head faces straight ahead on average
    for name, keep in CALM.items():
        j = b.idx(name)
        m = mo.mean_rot(b.R[:, j])
        b.R[:, j] = mo.slerp(np.tile(m, (N + 1, 1, 1)), b.R[:, j], np.full(N + 1, keep))
    G, _ = bvh.fk(b)
    hj, nj = b.idx('Head'), b.idx('Neck')
    psi = float(mo.yaw_of((G[:, hj] @ np.array([0, 0, 1.0])).mean(0)))
    b.R[:, nj] = mo.T(G[:, b.parents[nj]]) @ mo.yaw_mat(np.array(-psi)) @ G[:, nj]
    eff = close_effectors(effectors(b), 3.0)
    b = symmetrise_legs(b)
    b, gap = close_loop(b)
    b = wrap_smooth(b, 3.0)                                  # ~1.3 Hz: irons the seam, sway and breathing are slower
    posture = stand_tall(b, eff)
    b, masks, slide, miss, _ = fix_feet(b, 0.0, loop=True, lock=True, eff=eff, knee_flex_to=IDLE_KNEE_FLEX)
    posture['pelvis_raised'] = round(fix_feet.raised, 4)
    # centre: midpoint of the ankles on the origin
    G, P = bvh.fk(b)
    mid = (P[:, b.idx('LeftFoot')] + P[:, b.idx('RightFoot')]).mean(0) / 2
    b.pos[:, 0] -= mid[0]
    b.pos[:, 2] -= mid[2]
    b, _ = flat_feet_rerest(b, masks)
    b.R[-1], b.pos[-1] = b.R[0], b.pos[0]
    posture['knee_flex_after_deg'] = [round(x, 1) for x in knee_flex(b)]
    bvh.save(os.path.join(out, 'idle.bvh'), b)
    G, P = bvh.fk(b)
    hips = P[:, 0]
    info = dict(
        clip='idle', file='idle.bvh', source=take + '.bvh', source_frames=[s + 1, e + 1], source_fps=round(src_fps, 2),
        fps=FPS, frames=N + 1, duration=round(N / FPS, 4), loop=True,
        heading_removed_deg=round(float(np.degrees(yaw)), 2), seam_cost_m=round(cost * CMU_UNIT, 4),
        seam_max_joint_gap_deg=round(gap[0], 2),
        hips_bob=round(float(np.ptp(hips[:, 1])), 4), hips_sway=round(float(np.ptp(hips[:, 0])), 4),
        hips_fore_aft=round(float(np.ptp(hips[:, 2])), 4),
        head_travel=round(float(np.ptp(P[:, b.idx('Head')], axis=0).max()), 4),
        hand_travel=round(float(max(np.ptp(P[:, b.idx('LeftHand')], axis=0).max(), np.ptp(P[:, b.idx('RightHand')], axis=0).max())), 4),
        head_yaw_range_deg=dict(source=round(head_yaw_before, 1), kept=round(head_yaw_range(b), 1)),
        posture=posture,
        max_foot_drift_removed=round(max(slide), 4), max_ankle_miss_after_ik=round(miss, 4),
        seam_gap_joint=gap[1], skeleton=skeleton_facts(b),
        notes='Standing part of the take before the subject walks off. Low-pass ~2.3 Hz, best-matching window '
              'searched, loop gap spread linearly, both feet locked to the floor (position and orientation) with '
              'legs re-solved by IK, hips keep their real sway. The subject looks far left and right before walking off, so neck and '
              'head keep 15 % and the spine 60 % of their departure from the mean pose, and the head is turned '
              'to face straight ahead on average. Legs made equal length; posture corrected (see "posture"): '
              'pelvis moved back and up so the knees are no longer bent 20+ degrees.')
    return info, b


UPPER_DELTA = ['LowerBack', 'Spine', 'Spine1', 'Neck', 'Neck1', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm',
               'LeftHand']
ARM_ABS = ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']


def prep_wave(raw, take, out, idle, window, ref_frame):
    """Upper body of the wave take layered on the first idle frame; legs and hips stay on the idle pose."""
    path = os.path.join(raw, take + '.bvh')
    w, GT = load_take(path, sigma=3.0)                       # ~5 Hz
    src_fps = w.fps
    w = mo.rerest(w, GT)
    s, e = window
    N = int(round((e - s) / src_fps * FPS))
    ref = w.R[ref_frame].copy()
    w = bvh.sample(w, s + np.arange(N + 1) * (e - s) / N, FPS)
    o = idle.copy()
    o.R = np.tile(idle.R[:1], (N + 1, 1, 1, 1))
    o.pos = np.tile(idle.pos[:1], (N + 1, 1))
    t = np.arange(N + 1) / FPS
    dur = N / FPS
    env = mo.smoothstep(t / 0.30) * mo.smoothstep((dur - t) / 0.45)
    for name in UPPER_DELTA:
        j = o.idx(name)
        D = mo.T(ref[j])[None] @ w.R[:, j]
        k = 0.6 if name in ('Neck', 'Neck1', 'Head') else 1.0
        o.R[:, j] = o.R[:, j] @ mo.slerp(np.tile(np.eye(3), (N + 1, 1, 1)), D, env * k)
    for name in ARM_ABS:
        j = o.idx(name)
        o.R[:, j] = mo.slerp(o.R[:, j], w.R[:, j], env)
    bvh.save(os.path.join(out, 'wave.bvh'), o)
    G, P = bvh.fk(o)
    hand = P[:, o.idx('RightHand')]
    peak = int(np.argmax(hand[:, 1]))
    info = dict(
        clip='wave', file='wave.bvh', source=take + '.bvh', source_frames=[s + 1, e + 1], source_fps=round(src_fps, 2),
        fps=FPS, frames=N + 1, duration=round(dur, 4), loop=False,
        lower_body_from='first frame of idle.bvh, held',
        hand_peak_frame=peak, hand_peak_height=round(float(hand[peak, 1]), 4),
        skeleton=skeleton_facts(o),
        notes='Composite: right arm rotations taken as they are from the wave take, spine / head / left arm as '
              'their change from the take\'s own settled standing pose, all faded in over 0.30 s and out over '
              '0.45 s onto the first idle frame; hips, legs and feet are the first idle frame held still. '
              'First and last frame equal the first idle frame exactly.')
    return info


def main():
    pos = [a for a in sys.argv[1:] if '=' not in a]
    kw = dict(a.split('=', 1) for a in sys.argv[1:] if '=' in a)
    raw, out = pos[0], pos[1]
    os.makedirs(out, exist_ok=True)
    clips = []
    print('walk')
    clips.append(prep_walk(raw, kw.get('walk', '136_21'), out))
    print('idle')
    info, idle = prep_idle(raw, kw.get('idle', '82_08'), out, (10, 800))
    clips.append(info)
    print('wave')
    clips.append(prep_wave(raw, kw.get('wave', '113_27'), out, idle, (21, 321), 345))
    man = dict(
        licence=LICENCE,
        space='BVH: Y up, facing +Z, character left = +X, metres at the capture subject\'s real size, floor y = 0 '
              'under the ball-of-foot joint. Zero rotations = T-pose with flat feet pointing straight ahead.',
        clips=clips,
        missing=dict(think='No usable take in the CMU database (the only "thinker" take, 74_12, is seated). '
                           'Keyframe it on top of the first idle frame.'))
    with open(os.path.join(out, 'manifest.json'), 'w', newline='\n') as fh:
        json.dump(man, fh, indent=1)
    for c in clips:
        print(json.dumps({k: v for k, v in c.items() if k not in ('contact_frames', 'notes')}))


if __name__ == '__main__':
    main()
