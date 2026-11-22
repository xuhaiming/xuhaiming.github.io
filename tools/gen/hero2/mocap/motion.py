"""Motion helpers shared by prepare.py (source skeleton) and retarget.py (target rig), numpy only.

Everything here works on a bvh.Bvh-like skeleton in BVH space (Y up, facing +Z, left = +X, metres):
offsets between joints, global rotations G[f, j] and joint positions P[f, j].
"""
import numpy as np

import bvh

UP = np.array([0.0, 1.0, 0.0])


def norm(v):
    return np.linalg.norm(v, axis=-1, keepdims=True)


def unit(v):
    return v / np.maximum(norm(v), 1e-12)


def mv(M, v):
    """Batched matrix @ vector."""
    return np.einsum('...ij,...j->...i', M, v)


def T(M):
    return np.swapaxes(M, -1, -2)


def locals_from_globals(b, G):
    R = np.empty_like(G)
    for j, p in enumerate(b.parents):
        R[:, j] = G[:, j] if p < 0 else T(G[:, p]) @ G[:, j]
    return R


def rerest(b, Gref):
    """Re-express the skeleton so the pose with global orientations Gref (J, 3, 3) becomes the zero pose.

    Joint positions of every frame stay exactly where they were.
    """
    G, _ = bvh.fk(b)
    o = b.copy()
    G2 = G @ T(Gref)[None]
    for j, p in enumerate(b.parents):
        if p >= 0:
            o.offsets[j] = Gref[p] @ b.offsets[j]
    for j, e in b.ends.items():
        o.ends[j] = Gref[j] @ e
    o.R = locals_from_globals(b, G2)
    return o


def yaw_of(v):
    """Heading angle (radians, about +Y) of a direction: 0 = +Z, positive toward +X."""
    return np.arctan2(v[..., 0], v[..., 2])


def yaw_mat(a):
    return bvh.axis_rot('Y', np.degrees(a))


def mean_rot(M):
    q = bvh.mat2quat(M)
    q = np.where(np.sum(q * q[:1], -1, keepdims=True) < 0, -q, q)
    return bvh.quat2mat(q.mean(0))


def slerp(A, B, w):
    """A toward B by weight w (w broadcastable to A's batch shape)."""
    rv = bvh.mat2rotvec(T(A) @ B)
    return A @ bvh.rotvec2mat(rv * np.asarray(w)[..., None])


def two_bone_ik(H, K, A, tgt, Gup):
    """Analytic two-bone IK, vectorised over frames.

    H, K, A: current root / mid / tip joint positions (F, 3); tgt: wanted tip position; Gup: global rotation of
    the upper bone (its -X axis is the fallback hinge so a straight knee still bends forward).
    Returns (Du, Dl): world rotations to apply as  G_up' = Du @ G_up,  G_low' = Du @ Dl @ G_low.
    """
    a = norm(K - H)[..., 0]
    b = norm(A - K)[..., 0]
    d = tgt - H
    c = np.clip(norm(d)[..., 0], np.abs(a - b) * 1.001 + 1e-6, (a + b) * 0.9995)
    u = (H - K) / a[..., None]
    w = (A - K) / b[..., None]
    th0 = np.arccos(np.clip(np.sum(u * w, -1), -1, 1))
    th1 = np.arccos(np.clip((a * a + b * b - c * c) / (2 * a * b), -1, 1))
    n = np.cross(u, w)
    s = norm(n)[..., 0]
    hinge = -mv(Gup, np.array([1.0, 0, 0]))
    hinge = unit(hinge - u * np.sum(hinge * u, -1, keepdims=True))
    wg = np.clip(s / 0.2, 0, 1)[..., None]
    n = unit(wg * n / np.maximum(s, 1e-9)[..., None] + (1 - wg) * hinge)
    Dl = bvh.rotvec2mat(n * (th1 - th0)[..., None])
    A1 = K + mv(Dl, A - K)
    Du = bvh.arc(A1 - H, d)
    return Du, Dl


def runs(mask):
    out, s = [], None
    for i, m in enumerate(mask):
        if m and s is None:
            s = i
        if not m and s is not None:
            out.append((s, i))
            s = None
    if s is not None:
        out.append((s, len(mask)))
    return out


def clean_mask(mask, gap=2, short=3):
    m = mask.copy()
    r = runs(m)
    for (s0, e0), (s1, e1) in zip(r, r[1:]):
        if s1 - e0 <= gap:
            m[e0:s1] = True
    for s, e in runs(m):
        if e - s < short:
            m[s:e] = False
    return m


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def plant(ball, fps, belt=0.0, loop=False, floor=None, h_thr=0.03, v_thr=0.08, ramp=4):
    """Foot planting. `ball` (F, 3) is the ball-of-foot joint path of an in-place clip whose ground moves
    backward at `belt` m/s. Wherever the ball is on the floor and still (relative to the ground), it is pinned
    to one spot on the ground and to the floor height; the correction fades over `ramp` frames either side.
    The speed threshold is tight on purpose: it catches the flat-foot phase only, so the real forward roll of
    the ball joint during heel-off is left alone.

    For loop=True the F frames are one period (last frame NOT a copy of the first) and contacts may wrap.
    Returns (offset (F, 3) to add to the ankle and ball, contact mask (F,), floor height).
    """
    F = len(ball)
    reps = 3 if loop else 1
    b = np.concatenate([ball] * reps, 0)
    n = len(b)
    t = np.arange(n) / fps
    bw = b.copy()
    bw[:, 2] += belt * t
    vel = np.linalg.norm(np.gradient(bw, axis=0), axis=1) * fps
    if floor is None:
        floor = np.percentile(ball[:, 1], 5)
    on = clean_mask((b[:, 1] < floor + h_thr) & (vel < v_thr))
    if on.any():
        floor = float(np.median(b[on, 1]))             # the height the planted ball actually sits at
    off = np.zeros((n, 3))
    rs = runs(on)
    for s, e in rs:
        pin = np.median(bw[s:e], 0)
        pin[1] = floor
        off[s:e] = pin - bw[s:e]
    for k in range(n):
        if on[k]:
            continue
        prev = [r for r in rs if r[1] <= k]
        nxt = [r for r in rs if r[0] > k]
        v = np.zeros(3)
        if prev:
            e = prev[-1][1]
            v += smoothstep(1 - (k - (e - 1)) / (ramp + 1)) * off[e - 1]
        if nxt:
            s = nxt[0][0]
            v += smoothstep(1 - (s - k) / (ramp + 1)) * off[s]
        off[k] = v
    # never below the floor
    low = floor - (b[:, 1] + off[:, 1])
    off[:, 1] += np.maximum(low, 0)
    if loop:
        off, on = off[F:2 * F], on[F:2 * F]
    return off, on, floor


def reach_drop(hip, tgt, length, slack=0.998):
    """How far the hips must come down so every leg can reach its ankle target. hip/tgt: lists of (F, 3)."""
    F = hip[0].shape[0]
    drop = np.zeros(F)
    for _ in range(4):
        need = np.zeros(F)
        for h, t, L in zip(hip, tgt, length):
            d = t - (h - drop[:, None] * UP)
            dist = np.linalg.norm(d, axis=1)
            ex = np.maximum(dist - slack * L, 0)
            need = np.maximum(need, ex / np.maximum(-d[:, 1] / np.maximum(dist, 1e-9), 0.5))
        drop += need
    return drop


def envelope(x, sigma, wrap=False):
    """Smooth upper envelope: smooth, then lift so it is never below x, a few times."""
    y = x.copy()
    for _ in range(6):
        y = np.maximum(bvh.smooth(y, sigma, wrap), x)
    return y


def pitch_to_reach(hip, ball, Gfoot, foot_vec, length, slack=0.999, wrap=False):
    """When a leg cannot reach its ankle while the ball of the foot stays put, lift the heel a little more
    (rotate the foot about the ball, toes down) instead of dragging the foot or dropping the hips.

    hip, ball: (F, 3). Gfoot: (F, 3, 3). foot_vec: ankle -> ball in the foot's zero pose. Returns (Gfoot', ankle).
    """
    F = hip.shape[0]
    axis = mv(Gfoot, np.array([1.0, 0, 0]))
    grid = np.radians(np.arange(0, 30.01, 0.25))
    need = np.full(F, grid[-1])
    done = np.zeros(F, bool)
    for d in grid:
        Rd = bvh.rotvec2mat(axis * d)
        ank = ball - mv(Rd @ Gfoot, foot_vec)
        ok = (np.linalg.norm(ank - hip, axis=1) <= slack * length) & ~done
        need[ok] = d
        done |= ok
    if need.max() > 0:
        need = envelope(need, 0.8, wrap)
    G2 = bvh.rotvec2mat(axis * need[:, None]) @ Gfoot
    return G2, ball - mv(G2, foot_vec), need


def solve_legs(b, G, P, pos, legs, targets, fps, max_drop=0.0, wrap=False):
    """Two-bone IK so each ankle sits on its target, keeping the foot (and toe) world orientation.

    legs: list of (up, low, foot) joint indices. targets: list of (F, 3). G, P from fk; pos = root path.
    If a target is out of reach the hips may come down by at most max_drop (smoothed); beyond that the leg
    just straightens toward the target. Returns (G', pos', largest remaining ankle miss).
    """
    hips = [P[:, up] for up, _, _ in legs]
    Ls = [np.linalg.norm(b.offsets[low]) + np.linalg.norm(b.offsets[foot]) for _, low, foot in legs]
    drop = np.zeros(P.shape[0])
    if max_drop > 0:
        drop = np.minimum(reach_drop(hips, targets, Ls), max_drop)
        if drop.max() > 1e-5:
            drop = envelope(drop, fps * 0.1, wrap)
    sh = drop[:, None] * UP
    pos = pos - sh
    G = G.copy()
    miss = 0.0
    for (up, low, foot), tgt, L in zip(legs, targets, Ls):
        H, K, A = P[:, up] - sh, P[:, low] - sh, P[:, foot] - sh
        Du, Dl = two_bone_ik(H, K, A, tgt, G[:, up])
        G[:, up] = Du @ G[:, up]
        G[:, low] = Du @ Dl @ G[:, low]
        miss = max(miss, float(np.maximum(np.linalg.norm(tgt - H, axis=1) - 0.9995 * L, 0).max()))
    return G, pos, miss
