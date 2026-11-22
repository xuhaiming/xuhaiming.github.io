"""Measure every candidate walk take so the shortlist is not picked by eye alone.

    python -I scan_walks.py <dir with bvh> [take ...]

Prints one row per take (figures scaled to a 1.75 m body):
  dur     seconds of steady straight walking found
  cyc     number of full cycles in it, T = mean cycle time, Tsd = its spread
  v       ground speed m/s, stride = metres per cycle
  bob     vertical hips travel per cycle, cm
  sway    lateral hips travel, cm
  lean    mean forward lean of the trunk, degrees (0 = upright)
  roll    trunk side-to-side rocking, degrees peak to peak
  pyaw    pelvis yaw swing, degrees peak to peak (swagger shows up here and in roll)
  head    head pitch mean (+ = looking down) and head yaw wobble p2p, degrees
  armL/R  wrist fore-aft swing, cm
  elb     mean elbow bend, degrees
  asym    left/right step length mismatch, percent
  turn    heading change over the section, degrees
"""
import os
import sys
import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bvh  # noqa: E402


def heel_strikes(fwd_rel):
    """Indices of local maxima of the foot's forward offset from the hips."""
    x = bvh.smooth(fwd_rel, 1.5)
    idx = [i for i in range(2, len(x) - 2) if x[i] >= x[i - 1] and x[i] > x[i + 1] and x[i] > 0.3 * x.max()]
    out = []
    for i in idx:
        if out and i - out[-1] < 12:
            if x[i] > x[out[-1]]:
                out[-1] = i
        else:
            out.append(i)
    return out


def measure(path):
    b = bvh.load(path)
    step = max(1, int(round(b.fps / 30)))
    tp = b.copy()
    tp.R, tp.pos = b.R[:1], b.pos[:1]
    G0, P0 = bvh.fk(tp)
    height = bvh.end_pos(tp, G0, P0, 'Head')[0, 1] - min(bvh.end_pos(tp, G0, P0, 'LeftToeBase')[0, 1],
                                                         bvh.end_pos(tp, G0, P0, 'RightToeBase')[0, 1])
    s = 1.75 / height
    b.R, b.pos = b.R[1::step], b.pos[1::step]
    fps = 1.0 / (b.frame_time * step)
    G, P = bvh.fk(b)
    P = P * s
    F = P.shape[0]
    J = {n: b.idx(n) for n in b.names}
    hips = P[:, J['Hips']]
    hs = bvh.smooth(hips, fps * 0.35)
    vel = np.gradient(hs, axis=0) * fps
    vel[:, 1] = 0
    speed = np.linalg.norm(vel, axis=1)
    med = np.median(speed[speed > 0.3]) if (speed > 0.3).any() else 0
    ok = np.abs(speed - med) < 0.2 * med
    # longest run of steady speed
    best, cur, st = (0, 0), 0, 0
    for i in range(F + 1):
        if i < F and ok[i]:
            if cur == 0:
                st = i
            cur += 1
        else:
            if cur > best[1] - best[0]:
                best = (st, st + cur)
            cur = 0
    a, e = best
    if e - a < fps * 1.5:
        return None
    hd = vel[a:e] / np.maximum(speed[a:e, None], 1e-6)
    ang = np.unwrap(np.arctan2(hd[:, 0], hd[:, 2]))
    turn = np.degrees(ang.max() - ang.min())
    f = hd.mean(0)
    f /= np.linalg.norm(f)
    lat = np.array([f[2], 0, -f[0]])      # character's left when facing f
    up = np.array([0, 1.0, 0])

    def rel(name):
        return P[a:e, J[name]] - hips[a:e]

    lf = heel_strikes(rel('LeftFoot') @ f)
    rf = heel_strikes(rel('RightFoot') @ f)
    if len(lf) < 2:
        return None
    cyc = np.diff(lf) / fps
    T = cyc.mean()
    dist = (hips[a + lf[-1]] - hips[a + lf[0]]) @ f
    v = dist / ((lf[-1] - lf[0]) / fps)
    stride = dist / (len(lf) - 1)
    seg = slice(a + lf[0], a + lf[-1] + 1)
    n = np.arange(seg.stop - seg.start)
    hy = hips[seg, 1]
    bob = np.mean([np.ptp(hy[lf[i] - lf[0]:lf[i + 1] - lf[0] + 1]) for i in range(len(lf) - 1)]) * 100
    hl = hips[seg] @ lat
    hl = hl - np.polyval(np.polyfit(n, hl, 1), n)
    sway = np.ptp(bvh.smooth(hl, 1)) * 100
    tr = P[seg, J['Neck']] - hips[seg]
    lean = np.degrees(np.arctan2(tr @ f, tr @ up))
    rollv = np.degrees(np.arctan2(tr @ lat, tr @ up))
    pel = G[seg, J['Hips']] @ np.array([0, 0, 1.0])
    pyaw = np.degrees(np.arctan2(pel @ lat, pel @ f))
    hu = G[seg, J['Head']] @ np.array([0, 1.0, 0])
    hf = G[seg, J['Head']] @ np.array([0, 0, 1.0])
    hpitch = np.degrees(np.arctan2(hu @ f, hu @ up))
    hyaw = np.degrees(np.arctan2(hf @ lat, hf @ f))

    def swing(side):
        w = (P[seg, J[side + 'Hand']] - P[seg, J[side + 'Arm']]) @ f
        return np.ptp(bvh.smooth(w, 1)) * 100

    def elbow(side):
        u = P[seg, J[side + 'Arm']] - P[seg, J[side + 'ForeArm']]
        w = P[seg, J[side + 'Hand']] - P[seg, J[side + 'ForeArm']]
        c = np.sum(u * w, 1) / np.linalg.norm(u, axis=1) / np.linalg.norm(w, axis=1)
        return 180 - np.degrees(np.arccos(np.clip(c, -1, 1)))

    # step lengths: L strike -> next R strike vs R strike -> next L strike
    ev = sorted([(i, 'L') for i in lf] + [(i, 'R') for i in rf])
    sl = {'L': [], 'R': []}
    for (i0, s0), (i1, s1) in zip(ev, ev[1:]):
        if s0 != s1:
            sl[s1].append((hips[a + i1] - hips[a + i0]) @ f)
    asym = 0
    if sl['L'] and sl['R']:
        mL, mR = np.mean(sl['L']), np.mean(sl['R'])
        asym = abs(mL - mR) / (mL + mR) * 200
    return dict(dur=(e - a) / fps, cyc=len(lf) - 1, T=T, Tsd=cyc.std(), v=v, stride=stride, bob=bob, sway=sway,
                lean=lean.mean(), roll=np.ptp(rollv), pyaw=np.ptp(pyaw), hpitch=hpitch.mean(), hyaw=np.ptp(hyaw),
                armL=swing('Left'), armR=swing('Right'), elb=(elbow('Left').mean() + elbow('Right').mean()) / 2,
                asym=asym, turn=turn, strikes=[1 + (a + i) * step for i in lf], fps=b.fps if step == 1 else fps * step)


def main():
    d = sys.argv[1]
    takes = sys.argv[2:] or sorted(f[:-4] for f in os.listdir(d) if f.endswith('.bvh'))
    print('take      dur cyc    T   Tsd    v  stride  bob sway  lean roll pyaw  head(p,yaw)  armL armR  elb asym turn')
    for t in takes:
        try:
            m = measure(os.path.join(d, t + '.bvh'))
        except Exception as ex:  # a broken take should not stop the scan
            print('%-8s error %s' % (t, ex))
            continue
        if not m:
            print('%-8s no steady straight walk' % t)
            continue
        print('%-8s %4.1f %3d %5.2f %4.2f %5.2f %5.2f %5.1f %4.1f %5.1f %4.1f %4.1f  %5.1f %4.1f  %5.0f %4.0f %4.0f %4.0f %4.0f'
              % (t, m['dur'], m['cyc'], m['T'], m['Tsd'], m['v'], m['stride'], m['bob'], m['sway'], m['lean'],
                 m['roll'], m['pyaw'], m['hpitch'], m['hyaw'], m['armL'], m['armR'], m['elb'], m['asym'], m['turn']))


if __name__ == '__main__':
    main()
