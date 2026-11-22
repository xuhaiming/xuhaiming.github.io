"""Minimal BVH reader / writer / forward kinematics on numpy.

Shared by the system-Python tools (scan, prepare) and the Blender scripts (sheet, retarget).
Conventions: BVH space is kept as it comes from the CMU files: Y up, the figure faces +Z, its left is +X.
Rotations are 3x3 matrices, R[f, j] is the local rotation of joint j at frame f.
"""
import math
import numpy as np


class Bvh:
    def __init__(self):
        self.names = []
        self.parents = []          # index of the parent joint, -1 for the root
        self.offsets = None        # (J, 3)
        self.ends = {}             # joint index -> end site offset
        self.frame_time = 1 / 30
        self.pos = None            # (F, 3) root translation
        self.R = None              # (F, J, 3, 3) local rotations

    @property
    def fps(self):
        return 1.0 / self.frame_time

    def idx(self, name):
        return self.names.index(name)

    def copy(self):
        b = Bvh()
        b.names = list(self.names)
        b.parents = list(self.parents)
        b.offsets = self.offsets.copy()
        b.ends = {k: v.copy() for k, v in self.ends.items()}
        b.frame_time = self.frame_time
        b.pos = self.pos.copy()
        b.R = self.R.copy()
        return b

    def children(self, j):
        return [i for i, p in enumerate(self.parents) if p == j]


def axis_rot(axis, deg):
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    o, z = np.ones_like(a), np.zeros_like(a)
    if axis == 'X':
        m = [[o, z, z], [z, c, -s], [z, s, c]]
    elif axis == 'Y':
        m = [[c, z, s], [z, o, z], [-s, z, c]]
    else:
        m = [[c, -s, z], [s, c, z], [z, z, o]]
    return np.stack([np.stack(r, -1) for r in m], -2)


def load(path):
    with open(path, 'r') as fh:
        tok = fh.read().split()
    b = Bvh()
    chans = []            # per joint: list of channel names
    stack = []
    offs = []
    i = 0
    in_end = False
    while tok[i] != 'MOTION':
        t = tok[i]
        if t in ('ROOT', 'JOINT'):
            b.names.append(tok[i + 1])
            b.parents.append(stack[-1] if stack else -1)
            chans.append([])
            offs.append([0, 0, 0])
            cur = len(b.names) - 1
            i += 2
            pending = cur
        elif t == 'End':
            in_end = True
            i += 2
        elif t == '{':
            if not in_end:
                stack.append(pending)
            i += 1
        elif t == '}':
            if in_end:
                in_end = False
            else:
                stack.pop()
            i += 1
        elif t == 'OFFSET':
            v = np.array([float(tok[i + 1]), float(tok[i + 2]), float(tok[i + 3])])
            if in_end:
                b.ends[stack[-1]] = v
            else:
                offs[stack[-1]] = v
            i += 4
        elif t == 'CHANNELS':
            n = int(tok[i + 1])
            chans[stack[-1]] = tok[i + 2:i + 2 + n]
            i += 2 + n
        else:
            i += 1
    assert tok[i + 1] == 'Frames:'
    nf = int(tok[i + 2])
    assert tok[i + 3] == 'Frame' and tok[i + 4] == 'Time:'
    b.frame_time = float(tok[i + 5])
    data = np.array(tok[i + 6:], dtype=np.float64)
    nch = sum(len(c) for c in chans)
    data = data[:nf * nch].reshape(nf, nch)
    J = len(b.names)
    b.offsets = np.array(offs, dtype=np.float64)
    b.R = np.tile(np.eye(3), (nf, J, 1, 1))
    b.pos = np.zeros((nf, 3))
    c = 0
    for j in range(J):
        for ch in chans[j]:
            col = data[:, c]
            c += 1
            if ch.endswith('position'):
                if b.parents[j] == -1:
                    b.pos[:, 'XYZ'.index(ch[0])] = col
            else:
                b.R[:, j] = b.R[:, j] @ axis_rot(ch[0], col)
    return b


def euler_zyx(R):
    """Matrices (..., 3, 3) -> degrees (z, y, x) with R = Rz @ Ry @ Rx."""
    sy = -R[..., 2, 0]
    y = np.arcsin(np.clip(sy, -1, 1))
    z = np.arctan2(R[..., 1, 0], R[..., 0, 0])
    x = np.arctan2(R[..., 2, 1], R[..., 2, 2])
    return np.degrees(np.stack([z, y, x], -1))


def save(path, b):
    out = ['HIERARCHY']

    def rec(j, d):
        t = '\t' * d
        out.append('%s%s %s' % (t, 'ROOT' if b.parents[j] == -1 else 'JOINT', b.names[j]))
        out.append(t + '{')
        o = b.offsets[j]
        out.append('%s\tOFFSET %.5f %.5f %.5f' % (t, o[0], o[1], o[2]))
        if b.parents[j] == -1:
            out.append(t + '\tCHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation')
        else:
            out.append(t + '\tCHANNELS 3 Zrotation Yrotation Xrotation')
        for c in b.children(j):
            rec(c, d + 1)
        if j in b.ends:
            e = b.ends[j]
            out.append(t + '\tEnd Site')
            out.append(t + '\t{')
            out.append('%s\t\tOFFSET %.5f %.5f %.5f' % (t, e[0], e[1], e[2]))
            out.append(t + '\t}')
        out.append(t + '}')

    rec(0, 0)
    order = []

    def walk(j):
        order.append(j)
        for c in b.children(j):
            walk(c)

    walk(0)
    F = b.R.shape[0]
    e = unwrap_deg(euler_zyx(b.R))
    out.append('MOTION')
    out.append('Frames: %d' % F)
    out.append('Frame Time: %.7f' % b.frame_time)
    for f in range(F):
        row = ['%.4f' % v for v in b.pos[f]]
        for j in order:
            row += ['%.4f' % v for v in e[f, j]]
        out.append(' '.join(row))
    with open(path, 'w', newline='\n') as fh:
        fh.write('\n'.join(out) + '\n')


def unwrap_deg(e):
    return np.degrees(np.unwrap(np.radians(e), axis=0))


def fk(b, R=None, pos=None):
    """Global rotations G (F, J, 3, 3) and joint positions P (F, J, 3)."""
    R = b.R if R is None else R
    pos = b.pos if pos is None else pos
    F, J = R.shape[:2]
    G = np.empty_like(R)
    P = np.empty((F, J, 3))
    for j in range(J):
        p = b.parents[j]
        if p < 0:
            G[:, j] = R[:, j]
            P[:, j] = pos + b.offsets[j]
        else:
            G[:, j] = G[:, p] @ R[:, j]
            P[:, j] = P[:, p] + G[:, p] @ b.offsets[j]
    return G, P


def end_pos(b, G, P, name):
    j = b.idx(name)
    return P[:, j] + G[:, j] @ b.ends[j]


def rest_positions(b):
    """Joint positions with all rotations zero and the root at the origin."""
    J = len(b.names)
    P = np.zeros((J, 3))
    for j in range(J):
        p = b.parents[j]
        P[j] = b.offsets[j] if p < 0 else P[p] + b.offsets[j]
    return P


# --- quaternions (w, x, y, z) -------------------------------------------------------------------

def mat2quat(M):
    M = np.asarray(M)
    sh = M.shape[:-2]
    M = M.reshape(-1, 3, 3)
    q = np.empty((M.shape[0], 4))
    tr = M[:, 0, 0] + M[:, 1, 1] + M[:, 2, 2]
    q[:, 0] = 1 + tr
    q[:, 1] = 1 + M[:, 0, 0] - M[:, 1, 1] - M[:, 2, 2]
    q[:, 2] = 1 - M[:, 0, 0] + M[:, 1, 1] - M[:, 2, 2]
    q[:, 3] = 1 - M[:, 0, 0] - M[:, 1, 1] + M[:, 2, 2]
    k = np.argmax(q, 1)
    out = np.empty_like(q)
    for c in range(4):
        m = k == c
        if not m.any():
            continue
        A = M[m]
        s = 2 * np.sqrt(np.maximum(q[m, c], 1e-12))
        if c == 0:
            o = [s / 4, (A[:, 2, 1] - A[:, 1, 2]) / s, (A[:, 0, 2] - A[:, 2, 0]) / s, (A[:, 1, 0] - A[:, 0, 1]) / s]
        elif c == 1:
            o = [(A[:, 2, 1] - A[:, 1, 2]) / s, s / 4, (A[:, 0, 1] + A[:, 1, 0]) / s, (A[:, 0, 2] + A[:, 2, 0]) / s]
        elif c == 2:
            o = [(A[:, 0, 2] - A[:, 2, 0]) / s, (A[:, 0, 1] + A[:, 1, 0]) / s, s / 4, (A[:, 1, 2] + A[:, 2, 1]) / s]
        else:
            o = [(A[:, 1, 0] - A[:, 0, 1]) / s, (A[:, 0, 2] + A[:, 2, 0]) / s, (A[:, 1, 2] + A[:, 2, 1]) / s, s / 4]
        out[m] = np.stack(o, -1)
    out /= np.linalg.norm(out, axis=-1, keepdims=True)
    return out.reshape(sh + (4,))


def quat2mat(q):
    q = np.asarray(q)
    q = q / np.linalg.norm(q, axis=-1, keepdims=True)
    w, x, y, z = q[..., 0], q[..., 1], q[..., 2], q[..., 3]
    M = np.empty(q.shape[:-1] + (3, 3))
    M[..., 0, 0] = 1 - 2 * (y * y + z * z)
    M[..., 0, 1] = 2 * (x * y - w * z)
    M[..., 0, 2] = 2 * (x * z + w * y)
    M[..., 1, 0] = 2 * (x * y + w * z)
    M[..., 1, 1] = 1 - 2 * (x * x + z * z)
    M[..., 1, 2] = 2 * (y * z - w * x)
    M[..., 2, 0] = 2 * (x * z - w * y)
    M[..., 2, 1] = 2 * (y * z + w * x)
    M[..., 2, 2] = 1 - 2 * (x * x + y * y)
    return M


def quat_continuous(q):
    """Flip signs along axis 0 so neighbouring frames lie in the same hemisphere."""
    q = q.copy()
    d = np.sum(q[1:] * q[:-1], -1)
    flip = np.cumprod(np.where(d < 0, -1.0, 1.0), 0)
    q[1:] *= flip[..., None]
    return q


def rotvec2mat(v):
    v = np.asarray(v, dtype=np.float64)
    a = np.linalg.norm(v, axis=-1)
    small = a < 1e-12
    ax = v / np.where(small, 1, a)[..., None]
    h = a / 2
    q = np.concatenate([np.cos(h)[..., None], ax * np.sin(h)[..., None]], -1)
    return quat2mat(q)


def mat2rotvec(M):
    q = mat2quat(M)
    q = np.where(q[..., :1] < 0, -q, q)
    s = np.linalg.norm(q[..., 1:], axis=-1)
    a = 2 * np.arctan2(s, q[..., 0])
    return q[..., 1:] / np.where(s < 1e-12, 1, s)[..., None] * a[..., None]


def arc(a, b):
    """Shortest rotation matrix taking direction a onto direction b (broadcasts)."""
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    a = a / np.linalg.norm(a, axis=-1, keepdims=True)
    b = b / np.linalg.norm(b, axis=-1, keepdims=True)
    a, b = np.broadcast_arrays(a, b)
    v = np.cross(a, b)
    s = np.linalg.norm(v, axis=-1)
    c = np.sum(a * b, -1)
    ang = np.arctan2(s, c)
    # antiparallel: any perpendicular axis
    perp = np.cross(a, np.where(np.abs(a[..., :1]) < 0.9, [1.0, 0, 0], [0, 1.0, 0]))
    perp /= np.linalg.norm(perp, axis=-1, keepdims=True)
    ax = np.where((s < 1e-9)[..., None], perp, v / np.where(s < 1e-9, 1, s)[..., None])
    return rotvec2mat(ax * ang[..., None])


def resample(b, fps, start=0, end=None):
    """Linear (nlerp) resample of frames [start, end] (source frame indices, floats allowed) to `fps`."""
    end = b.R.shape[0] - 1 if end is None else end
    dur = (end - start) * b.frame_time
    n = int(round(dur * fps))
    t = start + np.arange(n + 1) / fps / b.frame_time
    t = np.clip(t, 0, b.R.shape[0] - 1)
    return sample(b, t, fps)


def sample(b, t, fps):
    """Sample at fractional source frame indices t."""
    i0 = np.clip(np.floor(t).astype(int), 0, b.R.shape[0] - 2)
    a = (t - i0)[:, None]
    q = quat_continuous(mat2quat(b.R))
    qq = q[i0] * (1 - a[..., None]) + q[i0 + 1] * a[..., None]
    o = b.copy()
    o.R = quat2mat(qq)
    o.pos = b.pos[i0] * (1 - a) + b.pos[i0 + 1] * a
    o.frame_time = 1.0 / fps
    return o


def gauss_kernel(sigma):
    r = max(1, int(math.ceil(3 * sigma)))
    x = np.arange(-r, r + 1)
    k = np.exp(-0.5 * (x / sigma) ** 2)
    return k / k.sum()


def smooth(x, sigma, wrap=False):
    """Gaussian low-pass along axis 0. sigma in frames; -3 dB at about 0.133 * fps / sigma Hz."""
    if sigma <= 0:
        return x.copy()
    k = gauss_kernel(sigma)
    r = len(k) // 2
    if wrap:
        xp = np.concatenate([x[-r:], x, x[:r]], 0)
    else:
        # reflect about the end values (odd reflection keeps slopes)
        xp = np.concatenate([2 * x[:1] - x[r:0:-1], x, 2 * x[-1:] - x[-2:-r - 2:-1]], 0)
    out = np.zeros_like(x, dtype=np.float64)
    for i, w in enumerate(k):
        out += w * xp[i:i + x.shape[0]]
    return out


def smooth_rot(R, sigma, wrap=False):
    q = quat_continuous(mat2quat(R))
    return quat2mat(smooth(q, sigma, wrap))
