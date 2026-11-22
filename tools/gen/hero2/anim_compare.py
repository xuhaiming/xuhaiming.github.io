"""Stage 1b / 3 review: T-pose proportion sheet of a mesh, for comparing the original scan with the slimmed one.
    blender -b -P hero2/anim_compare.py -- <blend> <out.png> [cell=420]
Cells: whole body front; arm front (left arm, T-pose); left hand from above; left hand from the side; wrist-to-cuff from the front (zoomed)."""
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig_pose_tests as rp  # noqa: E402

a = sys.argv[sys.argv.index('--') + 1:]
src, out = os.path.abspath(a[0]), os.path.abspath(a[1])
kw = dict(q.split('=') for q in a[2:])
cell = int(kw.get('cell', 420))
bpy.ops.wm.open_mainfile(filepath=src)
sc = bpy.context.scene
cam = rp.setup('diffuse')
sc.render.resolution_x = sc.render.resolution_y = cell
shots = [((0, 0, 0.9), (0, -1, 0), 1.95), ((0.45, 0, 1.33), (0, -1, 0), 0.62), ((0.72, 0.0, 1.3), (0, 0, 1), 0.34),
         ((0.72, 0.0, 1.3), (-1, 0, 0), 0.34), ((0.72, 0.0, 1.3), (0, -1, 0), 0.34)]
tmp = out + '.cell.png'
cells = []
for c, d, size in shots:
    d = Vector(d).normalized()
    cam.location = Vector(c) + d * 5
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    cam.data.ortho_scale = size
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp)
    cells.append(np.array(img.pixels[:], np.float32).reshape(cell, cell, 4))
    bpy.data.images.remove(img)
os.remove(tmp)
px = np.concatenate(cells, 1)
res = bpy.data.images.new('s', px.shape[1], px.shape[0], alpha=False)
res.pixels.foreach_set(px.ravel())
res.filepath_raw = out
res.file_format = 'PNG'
res.save()
print('COMPARE', out)
