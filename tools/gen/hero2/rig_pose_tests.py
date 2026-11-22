"""Stage 2 review: apply named test poses to the rig and render contact sheets. Blender 5.0 headless, local only.

    blender -b -P hero2/rig_pose_tests.py -- src/hero2/hero_rig.blend src/hero2 [only=shoulders,face_blink] [cell=512] [cols=4]
            [mode=diffuse|clay] [single="POSE:cx,cy,cz,size,dx,dy,dz;..."]
    blender -b -P hero2/rig_pose_tests.py -- src/hero2/hero_rig_mocaptest.blend src/hero2 action=walk frames=0,6,12,18,24,30
            [views=front,side,right,back,q,qb] [size=1.95] [cz=0.9] [tag=_x]      (frames of a baked action -> rig_mocap_walk.jpg)

Writes rig_<sheet>.jpg into the output folder. Cells run left to right, top to bottom in the order of SHEETS below
(the order is also printed). Poses are local XYZ Euler angles in degrees on the bones' own axes, i.e. exactly the
conventions documented in the README, so the sheets double as a check of those conventions. A pose written for the
Left side is mirrored to the Right with `mirror()` (same X, opposite Y and Z).
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

P = 'mixamorig:'
FING = ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')


def mirror(pose):
    out = dict(pose)
    for k, v in pose.items():
        if k.startswith('Left'):
            out['Right' + k[4:]] = (v[0], -v[1], -v[2])
    return out


def fingers(side, curl, spread=0.0, thumb=None, only=None):
    """curl: (j1, j2, j3) degrees for the four fingers; thumb: (j1, j2, j3)"""
    d = {}
    for i, f in enumerate(FING[1:]):
        if only and f not in only:
            continue
        sp = spread * (1.5 - i)
        d['%sHand%s1' % (side, f)] = (curl[0], 0, sp)
        d['%sHand%s2' % (side, f)] = (curl[1], 0, 0)
        d['%sHand%s3' % (side, f)] = (curl[2], 0, 0)
    if thumb:
        for k in range(3):
            v = thumb[k]
            d['%sHandThumb%d' % (side, k + 1)] = v if isinstance(v, tuple) else (v, 0, 0)
    return d


def both(fn, *a, **k):
    d = fn('Left', *a, **k)
    return mirror(d)


REST = {}
ARMS_DOWN = mirror({'LeftArm': (85, 0, 0)})
ARMS_45 = mirror({'LeftArm': (45, 0, 0)})
IDLE = mirror({'LeftArm': (76, 0, 8), 'LeftForeArm': (0, 0, 14), **fingers('Left', (16, 24, 14), thumb=(6, 8, 8))})
ARMS_UP = mirror({'LeftArm': (-70, 0, 0), 'LeftShoulder': (-12, 0, 0)})
WAVE = {'RightArm': (-20, 90, 0), 'RightShoulder': (-8, 0, 0), 'RightForeArm': (0, 0, -100), 'LeftArm': (85, 0, 0)}
ARMS_FWD = mirror({'LeftArm': (0, 0, 80)})
ARMS_BACK = mirror({'LeftArm': (60, 0, -35)})
ELBOW_120 = mirror({'LeftArm': (40, 0, 0), 'LeftForeArm': (0, 0, 120)})
ELBOW_90 = mirror({'LeftArm': (40, 0, 0), 'LeftForeArm': (0, 0, 90)})
TWIST_P = mirror({'LeftArm': (40, 0, 0), 'LeftHand': (0, 80, 0)})
TWIST_N = mirror({'LeftArm': (40, 0, 0), 'LeftHand': (0, -80, 0)})
STRIDE = {**ARMS_DOWN, 'LeftUpLeg': (-35, 0, 0), 'LeftLeg': (20, 0, 0), 'RightUpLeg': (35, 0, 0), 'RightLeg': (15, 0, 0),
          'LeftArm': (70, 0, -25), 'RightArm': (70, 0, -25)}
KNEE_120 = {**ARMS_DOWN, 'LeftUpLeg': (-60, 0, 0), 'LeftLeg': (120, 0, 0)}
KNEE_90 = {**ARMS_DOWN, 'LeftUpLeg': (-45, 0, 0), 'LeftLeg': (90, 0, 0), 'RightUpLeg': (20, 0, 0), 'RightLeg': (60, 0, 0)}
LEG_SIDE = {**ARMS_DOWN, 'LeftUpLeg': (0, 0, -30), 'RightFoot': (-25, 0, 0), 'RightToeBase': (30, 0, 0)}
TIPTOE = {**ARMS_DOWN, 'LeftFoot': (30, 0, 0), 'LeftToeBase': (-35, 0, 0), 'RightFoot': (-20, 0, 0)}
SPINE_FWD = {**ARMS_DOWN, 'Spine': (12, 0, 0), 'Spine1': (12, 0, 0), 'Spine2': (12, 0, 0)}
SPINE_TWIST = {**ARMS_45, 'Spine': (0, 12, 0), 'Spine1': (0, 12, 0), 'Spine2': (0, 12, 0)}
SPINE_SIDE = {**ARMS_45, 'Spine': (0, 0, 8), 'Spine1': (0, 0, 8), 'Spine2': (0, 0, 8)}
HEAD_L = {**ARMS_DOWN, 'Neck': (0, 20, 0), 'Head': (0, 40, 0)}
HEAD_R = {**ARMS_DOWN, 'Neck': (0, -20, 0), 'Head': (0, -40, 0)}
NOD_DN = {**ARMS_DOWN, 'Neck': (8, 0, 0), 'Head': (17, 0, 0)}
NOD_UP = {**ARMS_DOWN, 'Neck': (-8, 0, 0), 'Head': (-17, 0, 0)}
HEAD_TILT = {**ARMS_DOWN, 'Neck': (0, 0, 7), 'Head': (0, 0, 13)}
FIST = both(fingers, (80, 95, 70), thumb=((35, 0, 30), (30, 0, 0), (60, 0, 0)))
RELAX = both(fingers, (18, 26, 16), thumb=(6, 8, 10))
POINT = both(fingers, (80, 95, 70), thumb=((20, 0, 25), (25, 0, 0), (55, 0, 0)), only=('Middle', 'Ring', 'Pinky'))
SPREAD = both(fingers, (0, 0, 0), spread=10, thumb=((-10, 0, -15), 0, 0))
ONE = {f: mirror({'LeftHand%s1' % f: (60, 0, 0), 'LeftHand%s2' % f: (80, 0, 0), 'LeftHand%s3' % f: (50, 0, 0)}) for f in FING}
THUMB_OPP = mirror({'LeftHandThumb1': (35, 0, 35), 'LeftHandThumb2': (30, 0, 0), 'LeftHandThumb3': (40, 0, 0)})


def face(**k):
    """face controls by short name -> pose dict; L/R controls are given once and applied to both sides"""
    d = {}
    for name, v in k.items():
        v = v if isinstance(v, tuple) else (v, 0, 0)
        if name in ('Jaw', 'LipUpper', 'LipLower'):
            d[name] = v
        elif name.startswith(('Left', 'Right')):
            d[name] = v
        else:
            d['Left' + name] = v
            d['Right' + name] = (v[0], -v[1], -v[2])
    return d


BLINK, BLINK_H = face(EyelidUpper=10), face(EyelidUpper=5)
WINK = face(LeftEyelidUpper=9, LeftEyelidLower=-1.5, LeftCheek=-1.5)
SQUINT = face(EyelidUpper=2.5, EyelidLower=-2.5)
BROW_UP, BROW_UP_H = face(Brow=-3.5), face(Brow=-1.75)
FROWN, FROWN_H = face(Brow=(2, -1.5, 5)), face(Brow=(1, -0.75, 2.5))
SMILE, SMILE_H = face(MouthCorner=(-2, 2.5, 0), Cheek=-1.5, EyelidLower=-1.2), face(MouthCorner=(-1, 1.25, 0), Cheek=-0.75, EyelidLower=-0.6)
JAW, JAW_H = face(Jaw=3), face(Jaw=1.5)
TALK = face(Jaw=2, LipUpper=-1, LipLower=1)
HAPPY = face(MouthCorner=(-1.8, 2.2, 0), Cheek=-1.5, EyelidLower=-1.5, EyelidUpper=1.5, Brow=-1, Jaw=1)
WIDE = face(EyelidUpper=-2, Brow=-3)

# shots: (centre x, y, z; ortho size; direction from the target to the camera)
F, B_, L_, R_ = (0, -1, 0), (0, 1, 0), (1, 0, 0), (-1, 0, 0)
Q, QR, QB = (0.6, -0.8, 0.15), (-0.6, -0.8, 0.15), (0.6, 0.8, 0.2)
BODY = lambda d: (0, 0, 0.9, 1.95, *d)  # noqa: E731
TORSO = lambda d: (0, 0, 1.2, 1.0, *d)  # noqa: E731
SHL = lambda d: (0.2, 0, 1.3, 0.62, *d)  # noqa: E731
AL = lambda d: (0.4, -0.1, 1.25, 0.6, *d)  # noqa: E731
AL2 = lambda d: (0.5, 0, 1.12, 0.5, *d)  # noqa: E731
KN = lambda d: (0.15, -0.1, 0.55, 0.7, *d)  # noqa: E731
LEGS = lambda d: (0, 0, 0.5, 1.15, *d)  # noqa: E731
HEAD = lambda d: (0, 0, 1.56, 0.42, *d)  # noqa: E731
FACE = lambda d: (0.002, -0.05, 1.59, 0.19, *d)  # noqa: E731
EYES = lambda d: (0.002, -0.08, 1.622, 0.11, *d)  # noqa: E731
MOUTH = lambda d: (0.002, -0.08, 1.548, 0.11, *d)  # noqa: E731
FQ, FQR = (0.6, -0.8, 0.0), (-0.6, -0.8, 0.0)
HANDL = lambda d: (0.755, 0.01, 1.30, 0.2, *d)  # noqa: E731
HANDR = lambda d: (-0.755, 0.01, 1.30, 0.2, *d)  # noqa: E731
UP, DN = (0, -0.001, 1), (0, -0.001, -1)
HQ = (0.5, -0.6, 0.6)
HQD = (0.5, -0.6, -0.6)

SHEETS = {
    'rest': [(REST, BODY(F)), (REST, BODY(L_)), (REST, BODY(B_)), (REST, BODY(Q))],
    'shoulders': [(ARMS_45, TORSO(F)), (ARMS_DOWN, TORSO(F)), (ARMS_DOWN, TORSO(B_)), (ARMS_DOWN, TORSO(Q)),
                  (ARMS_DOWN, SHL(F)), (ARMS_DOWN, SHL(B_)), (ARMS_DOWN, SHL(L_)), (IDLE, TORSO(F)),
                  (ARMS_UP, TORSO(F)), (ARMS_UP, TORSO(B_)), (WAVE, TORSO(F)), (WAVE, TORSO(QR)),
                  (ARMS_FWD, TORSO(Q)), (ARMS_FWD, TORSO((0, -0.3, 1))), (ARMS_BACK, TORSO(QB)), (ARMS_BACK, TORSO(L_))],
    'armpit': [(ARMS_DOWN, SHL(F)), (ARMS_DOWN, SHL(B_)), (ARMS_DOWN, SHL(Q)), (ARMS_DOWN, SHL(QB)),
               (ARMS_UP, (0.25, 0, 1.45, 0.62, *F)), (ARMS_UP, (0.25, 0, 1.45, 0.62, *B_)), (ARMS_45, SHL(F)), (ARMS_45, SHL(B_))],
    'elbows': [(ELBOW_90, TORSO(F)), (ELBOW_120, TORSO(F)), (ELBOW_120, AL(F)), (ELBOW_120, AL(Q)),
               (ELBOW_120, AL((0, -0.3, 1))), (ELBOW_120, AL(B_)), (ELBOW_120, AL(L_)), (ELBOW_90, AL(Q)),
               (TWIST_P, AL2(F)), (TWIST_N, AL2(F)), (TWIST_P, AL2(Q)), (TWIST_N, AL2(Q)),
               (TWIST_P, AL2(B_)), (TWIST_N, AL2(B_)), (TWIST_P, AL2((0, -0.3, 1))), (TWIST_N, AL2((0, -0.3, 1)))],
    'legs': [(STRIDE, BODY(L_)), (STRIDE, LEGS(L_)), (STRIDE, LEGS(F)), (STRIDE, LEGS(B_)),
             (STRIDE, LEGS(Q)), (STRIDE, LEGS(R_)), (KNEE_120, LEGS(L_)), (KNEE_120, LEGS(Q)),
             (KNEE_120, KN(L_)), (KNEE_120, KN(F)), (KNEE_120, KN(Q)), (KNEE_120, KN(QB)),
             (KNEE_90, LEGS(L_)), (KNEE_90, LEGS(F)), (LEG_SIDE, LEGS(F)), (TIPTOE, (0, 0, 0.25, 0.6, *L_))],
    'torso': [(SPINE_FWD, TORSO(L_)), (SPINE_FWD, TORSO(Q)), (SPINE_TWIST, TORSO(F)), (SPINE_SIDE, TORSO(F)),
              (STRIDE, TORSO(F)), (STRIDE, (0, 0, 0.9, 0.7, *F)), (STRIDE, (0, 0, 0.9, 0.7, *L_)), (STRIDE, (0, 0, 0.9, 0.7, *B_))],
    'head': [(HEAD_L, HEAD(F)), (HEAD_R, HEAD(F)), (HEAD_L, HEAD(Q)), (HEAD_L, HEAD(B_)),
             (NOD_DN, HEAD(F)), (NOD_DN, HEAD(L_)), (NOD_UP, HEAD(F)), (NOD_UP, HEAD(L_)),
             (HEAD_TILT, HEAD(F)), (HEAD_TILT, HEAD(B_)), (HEAD_R, HEAD(L_)), (HEAD_R, HEAD(QR))],
    'hands': [(REST, HANDL(UP)), (RELAX, HANDL(HQ)), (RELAX, HANDL(F)), (RELAX, HANDL(DN)),
              (FIST, HANDL(HQ)), (FIST, HANDL(F)), (FIST, HANDL(DN)), (FIST, HANDL(UP)),
              (POINT, HANDL(HQ)), (POINT, HANDL(DN)), (SPREAD, HANDL(UP)), (THUMB_OPP, HANDL(DN)),
              (FIST, HANDR((-0.5, -0.6, 0.6))), (FIST, HANDR(DN)), (POINT, HANDR((-0.5, -0.6, 0.6))), (THUMB_OPP, HANDR(DN))],
    'fingers': [c for f in FING for c in ((ONE[f], HANDL(HQ)), (ONE[f], HANDL(DN)), (ONE[f], HANDL(F)), (ONE[f], HANDR((-0.5, -0.6, 0.6))))],
    'face_blink': [(REST, FACE(F)), (BLINK_H, FACE(F)), (BLINK, FACE(F)), (WINK, FACE(F)),
                   (SQUINT, FACE(F)), (SQUINT, EYES(F)), (WINK, EYES(F)), (BLINK, FACE(L_)),
                   (REST, FACE(FQ)), (BLINK_H, FACE(FQ)), (BLINK, FACE(FQ)), (BLINK, FACE(FQR)),
                   (REST, EYES(F)), (BLINK_H, EYES(F)), (BLINK, EYES(F)), (BLINK, EYES(FQ))],
    'face_brow': [(REST, FACE(F)), (BROW_UP_H, FACE(F)), (BROW_UP, FACE(F)), (BROW_UP, FACE(FQ)),
                  (WIDE, FACE(F)), (FROWN_H, FACE(F)), (FROWN, FACE(F)), (FROWN, FACE(FQ))],
    'face_mouth': [(REST, FACE(F)), (SMILE_H, FACE(F)), (SMILE, FACE(F)), (SMILE, FACE(FQ)),
                   (REST, FACE(FQ)), (JAW_H, FACE(F)), (JAW, FACE(F)), (JAW, FACE(FQ)),
                   (SMILE, MOUTH(F)), (JAW, MOUTH(F)), (JAW, FACE(L_)), (TALK, FACE(F)),
                   (HAPPY, FACE(F)), (HAPPY, FACE(FQ)), (HAPPY, FACE(FQR)), (SMILE, FACE(FQR))],
}


def args():
    a = sys.argv[sys.argv.index('--') + 1:]
    return [q for q in a if '=' not in q], dict(q.split('=', 1) for q in a if '=' in q)


def setup(mode):
    sc = bpy.context.scene
    ob = bpy.data.objects['Hero']
    for p in ob.data.polygons:
        p.use_smooth = True
    for m in ob.data.materials:
        b = m.node_tree.nodes.get('Principled BSDF')
        for k, v in (('Metallic', 0.0), ('Roughness', 0.85)):
            for l in list(b.inputs[k].links):
                m.node_tree.links.remove(l)
            b.inputs[k].default_value = v
    if mode == 'clay':
        cm = bpy.data.materials.new('clay')
        cm.use_nodes = True
        cm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.7, 0.7, 0.7, 1)
        ob.data.materials.clear()
        ob.data.materials.append(cm)
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.image_settings.file_format = 'PNG'
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.75 if mode != 'clay' else 0.35
    cam = bpy.data.objects.new('rc', bpy.data.cameras.new('rc'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.clip_end = 50
    sun = bpy.data.objects.new('rsun', bpy.data.lights.new('rsun', 'SUN'))
    sun.data.energy = 1.2 if mode != 'clay' else 3.0
    sc.collection.objects.link(sun)
    con = sun.constraints.new('COPY_ROTATION')
    con.target = cam
    if mode == 'clay':
        sun.rotation_euler = (0.5, 0.3, 0)
        con.mix_mode = 'BEFORE'
    return cam


def apply_pose(arm, pose):
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    for k, v in pose.items():
        pb = arm.pose.bones.get(P + k)
        if pb is None:
            continue                       # a control that was dropped
        pb.rotation_euler = Euler([math.radians(q) for q in v], 'XYZ')
    bpy.context.view_layer.update()


def main():
    pos, kw = args()
    src, outdir = os.path.abspath(pos[0]), os.path.abspath(pos[1])
    cell = int(kw.get('cell', 512))
    cols = int(kw.get('cols', 4))
    mode = kw.get('mode', 'diffuse')
    bpy.ops.wm.open_mainfile(filepath=src)
    sc = bpy.context.scene
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    arm.hide_render = True
    cam = setup(mode)
    sc.render.resolution_x = sc.render.resolution_y = cell
    only = kw['only'].split(',') if kw.get('only') else list(SHEETS)
    if kw.get('single'):                   # single=POSE:cx,cy,cz,size,dx,dy,dz[;POSE:...] -> one ad-hoc sheet "single"
        SHEETS['single'] = [(globals()[q.split(':')[0]], tuple(float(v) for v in q.split(':')[1].split(','))) for q in kw['single'].split(';')]
        only = ['single']
    names = {id(v): k for k, v in globals().items() if isinstance(v, dict) and k.isupper()}
    if kw.get('action'):                   # action=walk frames=0,6,12 [views=front,side,q] [size=1.95]: frames of a baked action
        act = bpy.data.actions[kw['action']]
        ad = arm.animation_data
        for tr in ad.nla_tracks:
            tr.mute = True
        ad.action = act
        try:
            if act.slots and ad.action_slot is None:
                ad.action_slot = act.slots[0]
        except AttributeError:
            pass
        frames = [int(q) for q in kw['frames'].split(',')]
        vd = {'front': F, 'side': L_, 'right': R_, 'back': B_, 'q': Q, 'qb': QB}
        size = float(kw.get('size', 1.95))
        cz = float(kw.get('cz', 0.9))
        SHEETS.clear()
        SHEETS['mocap_' + kw['action'] + kw.get('tag', '')] = [(f, (0, 0, cz, size, *vd[v])) for v in kw.get('views', 'front,side').split(',') for f in frames]
        only = list(SHEETS)
        cols = len(frames)
    for sheet in only:
        cells = []
        tmp = os.path.join(outdir, '_rig_cell.png')
        for pose, (cx, cy, cz, size, dx, dy, dz) in SHEETS[sheet]:
            if isinstance(pose, int):
                sc.frame_set(pose)
            else:
                apply_pose(arm, pose)
            d = Vector((dx, dy, dz)).normalized()
            cam.location = Vector((cx, cy, cz)) + d * 5
            cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
            cam.data.ortho_scale = size
            sc.render.filepath = tmp
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(tmp)
            cells.append(np.array(img.pixels[:], np.float32).reshape(cell, cell, 4))
            bpy.data.images.remove(img)
        os.remove(tmp)
        while len(cells) % cols:
            cells.append(np.ones((cell, cell, 4), np.float32))
        rows = [np.concatenate(cells[i:i + cols], 1) for i in range(0, len(cells), cols)]
        sheet_px = np.concatenate(rows[::-1], 0)
        res = bpy.data.images.new('sheet', sheet_px.shape[1], sheet_px.shape[0], alpha=False)
        res.pixels.foreach_set(sheet_px.ravel())
        out = os.path.join(outdir, 'rig_%s%s.jpg' % (sheet, '' if mode == 'diffuse' else '_' + mode))
        res.filepath_raw = out
        res.file_format = 'JPEG'
        sc.render.image_settings.quality = 90
        res.save()
        print('POSES', out, [names.get(id(p), '?') for p, _ in SHEETS[sheet]])
    if not kw.get('action'):
        apply_pose(arm, {})


if __name__ == '__main__':
    main()
