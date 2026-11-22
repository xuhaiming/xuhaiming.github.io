"""Stage 1b: normal shoulder / arm proportions. Smooth, masked deformation of the T-pose mesh (topology, UVs and
attributes untouched). Blender 5.0 headless, local only.

    blender -b -P hero2/body_slim.py -- src/hero2/backup/hero_mesh_orig.blend src/hero2/hero_mesh.blend [key=value ...]

Blender space (Z up, character's left is +X); all maps are symmetric in x. Steps:
 1. torso narrowing: |x| < 0.19 scaled by 1 - CH*w(z) (chest / jacket sides), w rises from the waist, drops at the collar
 2. everything outboard of the torso wall is shifted inward by the same amount plus a little more (shoulder joint in)
 3. sleeve thinning: cross-section of the arm scaled toward the arm axis (factor ARM at the upper arm, back to 1 at the elbow)
 4. arm stretch: upper arm and forearm lengthened a little (STRETCH 1.04), forearm slimmed (FORE), hands kept (HAND 1.0)
"""
import sys
import bpy
import numpy as np

kw = dict(CH=0.16, EXTRA=0.02, ARM=0.30, STRETCH=1.04, HAND=1.0, HANDR=0.0, FORE=0.20)
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
for q in a[2:]:
    k, v = q.split('=')
    kw[k] = float(v)


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


bpy.ops.wm.open_mainfile(filepath=src)
ob = bpy.data.objects['Hero']
me = ob.data
n = len(me.vertices)
co = np.empty(n * 3)
me.vertices.foreach_get('co', co)
co = co.reshape(n, 3)
WALL, JOINT, ELB, WR = 0.19, 0.24, 0.475, 0.688


def deform(P):
    """P (n,3) Blender-space points of the original T-pose -> slimmed points"""
    x0, y0, z0 = P.T
    ax_ = np.abs(x0)
    sg = np.sign(x0)
    fall = ss(1.50, 1.42, z0)
    wz = ss(1.0, 1.2, z0) * (fall + (1 - fall) * ss(0.12, 0.20, ax_))
    shift_t = kw['CH'] * np.minimum(ax_, WALL) * wz
    shift_o = (kw['CH'] * WALL * wz + kw['EXTRA'] * ss(0.19, 0.26, ax_) * wz) * (ax_ > WALL)
    yc = 0.045
    zc = 1.37 - (ax_ - 0.26) * 0.135
    yc = np.where(ax_ > 0.45, yc - (ax_ - 0.45) * 0.12, yc)       # the forearm axis drifts toward the back of the arm
    f = 1 - kw['ARM'] * ss(0.17, 0.25, ax_) * (1 - ss(0.40, 0.50, ax_)) * ss(1.16, 1.27, z0)
    f = f * (1 - kw['FORE'] * ss(0.45, 0.60, ax_) * (1 - ss(0.69, 0.745, ax_)) * ss(1.16, 1.27, z0))   # forearm and cuff slimmer, wrist ~0.055
    fh = 1 + kw['HANDR'] * ss(WR + 0.005, WR + 0.06, ax_)
    ysc = yc + (y0 - yc) * f
    zsc = zc + (z0 - zc) * f
    ysc = np.where(ax_ > WR, yc + (ysc - yc) * fh, ysc)
    zsc = np.where(ax_ > WR, 1.32 + (zsc - 1.32) * fh, zsc)
    xs = np.where(ax_ > JOINT, np.minimum(ax_, WR) - JOINT, 0.0) * (kw['STRETCH'] - 1)
    xs = xs + np.where(ax_ > WR, (ax_ - WR) * (kw['HAND'] - 1), 0.0)
    ax_new = np.where(ax_ <= WALL, ax_ - shift_t, ax_ - shift_o + xs)
    return np.stack([sg * ax_new, ysc, zsc], 1)


new_pts = deform(co)
new = new_pts
me.vertices.foreach_set('co', new.ravel())
me.update()
import json, os
LM_IN = os.path.join(os.path.dirname(os.path.abspath(src)), 'landmarks_orig.json')
if os.path.exists(LM_IN):
    lm = json.load(open(LM_IN))

    def g2b(p):
        return [p[0], -p[2], p[1]]

    def b2g(b):
        return [round(float(b[0]), 4), round(float(b[2]), 4), round(float(-b[1]), 4)]
    for ent in lm['landmarks'].values():
        p = ent['p']
        if isinstance(p[0], list):
            ent['p'] = [b2g(deform(np.array([g2b(q)]))[0]) for q in p]
        else:
            ent['p'] = b2g(deform(np.array([g2b(p)]))[0])
    lm['note_slim'] = 'landmarks of the original mesh mapped through body_slim.py deform()'
    json.dump(lm, open(os.path.join(os.path.dirname(os.path.abspath(out)), 'landmarks.json'), 'w'), indent=1)
    json.dump(lm, open(os.path.join(os.path.dirname(os.path.abspath(out)), 'landmarks_body.json'), 'w'), indent=1)   # input of head_sculpt.py
    print('landmarks written')

def xmap(v):
    s_ = kw['CH'] * WALL + kw['EXTRA'] * ss(0.19, 0.26, v)
    st = (min(v, WR) - JOINT) * (kw['STRETCH'] - 1) if v > JOINT else 0.0
    return v - s_ + st + (max(v - WR, 0) * (kw['HAND'] - 1))
print('new constants (z in wz=1 band): wall %.4f Arm joint x %.4f  ForeArm x %.4f  wrist x %.4f  finger tip ~%.4f' % (
    WALL * (1 - kw['CH']), xmap(JOINT), xmap(ELB), xmap(WR), xmap(0.828)))
print('bounds', new.min(0), new.max(0))
# checks
import bmesh
bm = bmesh.new(); bm.from_mesh(me)
print('boundary edges', sum(1 for e in bm.edges if e.is_boundary), 'non-manifold', sum(1 for e in bm.edges if not e.is_manifold))
bm.free()
bpy.ops.wm.save_as_mainfile(filepath=out)
