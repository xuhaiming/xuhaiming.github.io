"""Measure posed body widths: blender -b file.blend -P hero2/measure_width.py -- [action] [frame]"""
import sys, bpy, numpy as np
a = sys.argv[sys.argv.index('--')+1:]
act = a[0] if a else 'idle'; fr = int(a[1]) if len(a) > 1 else 0
arm = bpy.data.objects['Armature']; ob = bpy.data.objects['Hero']
if arm.animation_data:
    for t in arm.animation_data.nla_tracks: t.mute = True
    arm.animation_data.action = bpy.data.actions.get(act)
bpy.context.scene.frame_set(fr)
dg = bpy.context.evaluated_depsgraph_get(); me = ob.evaluated_get(dg).to_mesh()
co = np.array([v.co[:] for v in me.vertices])
x, y, z = co.T
def ext(m, nm): print('%-34s x %.3f..%.3f width %.3f' % (nm, x[m].min(), x[m].max(), x[m].max()-x[m].min()))
ext((z > 1.30) & (z < 1.50) & (np.abs(x) > 0.0) , 'z1.30-1.50 (bideltoid incl.)')
ext((z > 1.20) & (z < 1.30), 'z1.20-1.30 (upper chest/arm)')
ext((z > 1.0) & (z < 1.2), 'z1.0-1.2 (torso+arms)')
ext((z > 0.9) & (z < 1.0), 'z0.9-1.0 (hips/hands)')
ext((z > 0.7) & (z < 0.9), 'z0.7-0.9')
ext(z > 1.30, 'z>1.3 max')
print('hand tip z min of arm (z>0.5, |x|>.15):', z[(np.abs(x) > 0.15) & (z > 0.5)].min())
