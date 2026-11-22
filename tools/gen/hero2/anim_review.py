"""Stage 3 review: contact sheets, preview videos and mesh checks of the clips in hero_anim.blend. Blender 5.0, local only.

    blender -b -P hero2/anim_review.py -- src/hero2/hero_anim.blend src/hero2/anim sheet action=walk frames=0,4,8,12 \
            [views=front,side,q] [shot=body|torso|head|face|legs|feet|cx,cy,cz,size] [follow=RightHand] [cell=384] [tag=_a] [mode=clay]
    blender -b -P hero2/anim_review.py -- src/hero2/hero_anim.blend src/hero2/anim video action=walk [views=q,side] [shot=body]
            [repeat=2] [cell=480] [step=1]            (PNG frames + ffmpeg -> anim_<action><tag>.mp4)
    blender -b -P hero2/anim_review.py -- src/hero2/hero_anim.blend src/hero2/anim check action=think [frames=0,10,20] [pairs=...]

sheet: one row per view, one column per frame -> anim_<action><tag>.jpg. `follow` centres the camera on a bone (plus the
shot's cx,cy,cz as an offset), for close-ups of a hand or a foot that moves.
check: on the deformed mesh, per frame: the lowest vertex (floor), and for pairs of body parts how deep the vertices of
the first sit inside the surface of the second (negative = inside, metres) and the smallest gap between them.
"""
import os
import subprocess
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anim_lib as al  # noqa: E402
import rig_pose_tests as rp  # noqa: E402

P = al.P
VIEWS = {'front': (0, -1, 0), 'back': (0, 1, 0), 'side': (1, 0, 0), 'right': (-1, 0, 0), 'q': (0.6, -0.8, 0.15), 'qr': (-0.6, -0.8, 0.15),
         'qb': (0.6, 0.8, 0.2), 'qrb': (-0.6, 0.8, 0.2), 'top': (0, -0.001, 1), 'low': (0.5, -0.8, -0.35), 'lowr': (-0.5, -0.8, -0.35),
         'hq': (0.5, -0.6, 0.6), 'hqr': (-0.5, -0.6, 0.6), 'fq': (0.6, -0.8, 0.0), 'fqr': (-0.6, -0.8, 0.0)}
SHOTS = {'body': (0, 0, 0.9, 1.95), 'torso': (0, 0, 1.25, 1.05), 'upper': (0, 0, 1.3, 0.8), 'head': (0, -0.03, 1.56, 0.42),
         'face': (0.002, -0.05, 1.59, 0.2), 'legs': (0, 0, 0.5, 1.15), 'feet': (0, 0, 0.14, 0.75), 'hand': (0, 0, -0.06, 0.3),
         'hips': (0, 0, 0.92, 0.75), 'chin': (-0.03, -0.1, 1.42, 0.42)}

DEFAULT_PAIRS = {
    'idle': 'handL:legs,handR:legs,forearmL:torso,forearmR:torso,forearmL:legs,forearmR:legs',
    'walk': 'handL:legs,handR:legs,forearmL:torso,forearmR:torso,forearmL:legs,forearmR:legs,legL:legR,footL:footR,footL:legR,footR:legL',
    'wave': 'handR:head,forearmR:torso,handL:legs,forearmL:torso,upperR:torso',
    'think': 'handR:head,handR:torso,forearmR:torso,upperR:torso,handL:armR,handL:torso,forearmL:torso,forearmL:armR,armR:legs,armL:legs',
}


def args():
    a = sys.argv[sys.argv.index('--') + 1:]
    return [q for q in a if '=' not in q], dict(q.split('=', 1) for q in a if '=' in q)


def frames_of(kw, act):
    f0, f1 = [int(round(v)) for v in act.frame_range]
    if kw.get('frames'):
        out = []
        for part in kw['frames'].split(','):
            if ':' in part:
                q = [int(v) for v in part.split(':')]
                out.extend(range(q[0], q[1] + 1, q[2] if len(q) > 2 else 1))
            else:
                out.append(int(part))
        return out
    return list(range(f0, f1 + 1, int(kw.get('step', 1))))


def shot_of(kw):
    s = kw.get('shot', 'body')
    return SHOTS[s] if s in SHOTS else tuple(float(v) for v in s.split(','))


def place(cam, arm, shot, view, follow):
    cx, cy, cz, size = shot
    c = Vector((cx, cy, cz))
    if follow:
        c = c + arm.matrix_world @ arm.pose.bones[P + follow].head
    d = Vector(VIEWS[view]).normalized()
    cam.location = c + d * 5
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    cam.data.ortho_scale = size


def render_cell(sc, path, cell):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    px = np.array(img.pixels[:], np.float32).reshape(cell, cell, 4)
    bpy.data.images.remove(img)
    return px


def save_sheet(sc, cells, cols, out):
    cell = cells[0].shape[0]
    while len(cells) % cols:
        cells.append(np.ones((cell, cell, 4), np.float32))
    rows = [np.concatenate(cells[k:k + cols], 1) for k in range(0, len(cells), cols)]
    px = np.concatenate(rows[::-1], 0)
    res = bpy.data.images.new('sheet', px.shape[1], px.shape[0], alpha=False)
    res.pixels.foreach_set(px.ravel())
    res.filepath_raw = out
    res.file_format = 'JPEG'
    sc.render.image_settings.quality = 90
    res.save()
    bpy.data.images.remove(res)


def do_sheet(sc, arm, cam, act, kw, outdir):
    cell = int(kw.get('cell', 384))
    sc.render.resolution_x = sc.render.resolution_y = cell
    frames = frames_of(kw, act)
    views = kw.get('views', 'front,side').split(',')
    shot = shot_of(kw)
    tmp = os.path.join(outdir, '_cell%d.png' % os.getpid())
    cells = []
    for v in views:
        for f in frames:
            sc.frame_set(f)
            place(cam, arm, shot, v, kw.get('follow'))
            cells.append(render_cell(sc, tmp, cell))
    os.remove(tmp)
    out = os.path.join(outdir, 'anim_%s%s.jpg' % (act.name, kw.get('tag', '')))
    save_sheet(sc, cells, int(kw.get('cols', len(frames))), out)
    print('REVIEW sheet', out, 'rows=', views, 'frames=', frames)


def do_video(sc, arm, cam, act, kw, outdir):
    cell = int(kw.get('cell', 480))
    views = kw.get('views', 'q,side').split(',')
    shot = shot_of(kw)
    frames = frames_of(kw, act)
    loop = kw.get('loop', '1') == '1'
    if loop and len(frames) > 1 and int(kw.get('repeat', 2)) > 1:
        frames = frames[:-1]                              # the last frame of a loop repeats the first
    fdir = os.path.join(outdir, '_frames_%s%s' % (act.name, kw.get('tag', '')))
    os.makedirs(fdir, exist_ok=True)
    sc.render.resolution_x = sc.render.resolution_y = cell
    tmp = os.path.join(outdir, '_cell%d.png' % os.getpid())
    for n, f in enumerate(frames):
        sc.frame_set(f)
        cells = []
        for v in views:
            place(cam, arm, shot, v, kw.get('follow'))
            cells.append(render_cell(sc, tmp, cell))
        px = np.concatenate(cells, 1)
        res = bpy.data.images.new('fr', px.shape[1], px.shape[0], alpha=False)
        res.pixels.foreach_set(px.ravel())
        res.filepath_raw = os.path.join(fdir, '%04d.png' % n)
        res.file_format = 'PNG'
        res.save()
        bpy.data.images.remove(res)
    os.remove(tmp)
    out = os.path.join(outdir, 'anim_%s%s.mp4' % (act.name, kw.get('tag', '')))
    rep = int(kw.get('repeat', 2)) - 1
    fps = 30 / int(kw.get('step', 1))
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-stream_loop', str(rep), '-framerate', str(fps), '-i', os.path.join(fdir, '%04d.png'),
           '-pix_fmt', 'yuv420p', '-crf', '20', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', out]
    subprocess.run(cmd, check=True)
    for fn in os.listdir(fdir):
        os.remove(os.path.join(fdir, fn))
    os.rmdir(fdir)
    print('REVIEW video', out, 'frames', len(frames), 'x', rep + 1)


def do_check(sc, arm, ob, act, kw):
    probe = al.MeshProbe(ob)
    pairs = [q.split(':') for q in kw.get('pairs', DEFAULT_PAIRS.get(act.name, '')).split(',') if q]
    frames = frames_of(kw, act)
    worst = {tuple(p): (0.0, -1, 9.0, -1) for p in pairs}
    floor = []
    for f in frames:
        sc.frame_set(f)
        co = probe.coords()
        floor.append(float(co[:, 2].min()))
        for a, b in pairs:
            r = probe.pair(co, a, b)
            w = worst[(a, b)]
            worst[(a, b)] = (min(w[0], r['deep']), f if r['deep'] < w[0] else w[1], min(w[2], r['gap']), f if r['gap'] < w[2] else w[3])
            if kw.get('verbose'):
                print('CHECK f%03d %s in %s: deepest %.1f mm, smallest gap %.1f mm' % (f, a, b, r['deep'] * 1000, r['gap'] * 1000))
    print('CHECK %s floor: lowest vertex %.1f mm (frame %d), highest lowest-vertex %.1f mm' % (
        act.name, min(floor) * 1000, frames[int(np.argmin(floor))], max(floor) * 1000))
    for (a, b), w in worst.items():
        print('CHECK %s %-9s in %-6s deepest %6.1f mm at frame %3d | smallest gap %5.1f mm at frame %3d' % (act.name, a, b, w[0] * 1000, w[1], w[2] * 1000, w[3]))


def main():
    pos, kw = args()
    src, outdir, mode = os.path.abspath(pos[0]), os.path.abspath(pos[1]), pos[2]
    os.makedirs(outdir, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=src)
    sc = bpy.context.scene
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    ob = bpy.data.objects['Hero']
    arm.hide_render = True
    act = bpy.data.actions[kw['action']]
    al.use_action(arm, act)
    if mode == 'check':
        do_check(sc, arm, ob, act, kw)
        return
    cam = rp.setup(kw.get('mode', 'diffuse'))
    (do_sheet if mode == 'sheet' else do_video)(sc, arm, cam, act, kw, outdir)


if __name__ == '__main__':
    main()
