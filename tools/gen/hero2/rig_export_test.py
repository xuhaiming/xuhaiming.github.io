"""Stage 2 check: verify the skin weights of a rig .blend, export a test GLB and verify what came out. Blender 5.0.

    blender -b -P hero2/rig_export_test.py -- src/hero2/hero_rig_mocaptest.blend src/hero2/hero_rig_test.glb

With a file that carries actions (the mocap test) the animations are exported too, which shows that the
constraint-driven helper bones are baked into the clips. Prints RIGCHECK lines and writes <glb>.json.
Nothing is uploaded; the GLB is a local test file.
"""
import json
import os
import struct
import sys

import bpy
import numpy as np

P = 'mixamorig:'
HELPERS = ('ArmHalf', 'ElbowHalf', 'KneeHalf', 'ForeArmTwist')


def weight_checks(ob):
    me = ob.data
    n = len(me.vertices)
    names = [g.name for g in ob.vertex_groups]
    W = np.zeros((n, len(names)))
    for v in me.vertices:
        for g in v.groups:
            W[v.index, g.group] = g.weight
    co = np.empty(n * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(n, 3)
    x, z = co[:, 0], co[:, 2]
    hair = np.zeros(n, np.float32)
    me.attributes['hair'].data.foreach_get('value', hair)
    reg = np.zeros(len(me.polygons), np.int32)
    me.attributes['uv_region'].data.foreach_get('value', reg)
    has = np.zeros((n, 7), bool)
    for p in me.polygons:
        has[list(p.vertices), reg[p.index]] = True

    def cols(pred):
        return [i for i, nm in enumerate(names) if pred(nm[len(P):])]

    out = {}
    out['max_influences'] = int((W > 0).sum(1).max())
    out['worst_weight_sum_error'] = float(np.abs(W.sum(1) - 1).max())
    out['unweighted_vertices'] = int((W.sum(1) < 0.5).sum())
    limb = lambda s: cols(lambda b: b.startswith(s) and not b.endswith(('Eyelid', 'Brow', 'Cheek', 'MouthCorner')) and 'Eyelid' not in b  # noqa: E731
                          and 'Brow' not in b and 'Cheek' not in b and 'MouthCorner' not in b)
    wl, wr = W[:, limb('Left')].sum(1), W[:, limb('Right')].sum(1)
    out['right_side_vertices_on_left_limbs'] = int(((x < -0.04) & (wl > 0.02)).sum())
    out['left_side_vertices_on_right_limbs'] = int(((x > 0.04) & (wr > 0.02)).sum())
    legs_l = W[:, cols(lambda b: b.startswith('Left') and any(k in b for k in ('UpLeg', 'Leg', 'Knee', 'Foot', 'Toe')))].sum(1)
    legs_r = W[:, cols(lambda b: b.startswith('Right') and any(k in b for k in ('UpLeg', 'Leg', 'Knee', 'Foot', 'Toe')))].sum(1)
    out['leg_vertices_shared_by_both_legs_below_crotch'] = int(((legs_l > 0.02) & (legs_r > 0.02) & (z < 0.70)).sum())
    fing = {}
    for s in ('Left', 'Right'):
        for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'):
            fing[s + f] = W[:, cols(lambda b: b.startswith('%sHand%s' % (s, f)))].sum(1)
    F = np.array(list(fing.values()))
    out['vertices_on_two_fingers_over_5pct'] = int(((F > 0.05).sum(0) > 1).sum())
    out['vertices_on_two_fingers_over_20pct'] = int(((F > 0.20).sum(0) > 1).sum())
    out['finger_weights_outside_the_hands'] = int(((F.sum(0) > 0.01) & ~(has[:, 4] | has[:, 5])).sum())
    head = W[:, cols(lambda b: b in ('Head',))].sum(1)
    face = W[:, cols(lambda b: any(k in b for k in ('Jaw', 'Lip', 'Eyelid', 'Brow', 'Cheek', 'MouthCorner')))].sum(1)
    neck = W[:, cols(lambda b: b == 'Neck')].sum(1)
    hm = hair > 0.5
    out['hair_vertices'] = int(hm.sum())
    out['hair_vertices_not_fully_on_head'] = int((hm & (head < 0.999)).sum())
    collar = has[:, 6] & ~has[:, 2] & ~has[:, 3] & ~hm
    out['collar_vertices_following_head_or_neck'] = int((collar & (head + neck + face > 0.02)).sum())
    ears = (np.abs(x) > 0.074) & (z > 1.56) & (z < 1.64) & (has[:, 2] | has[:, 3])
    out['ear_vertices'] = int(ears.sum())
    out['ear_vertices_not_fully_on_head'] = int((ears & (head < 0.999)).sum())
    out['face_weight_on_hair'] = int((hm & (face > 0.001)).sum())
    return out


def read_glb(path):
    with open(path, 'rb') as fh:
        data = fh.read()
    jl = struct.unpack_from('<I', data, 12)[0]
    js = json.loads(data[20:20 + jl])
    bin_ = data[20 + jl + 8:]
    return js, bin_


def accessor(js, bin_, i):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    comp = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
    nc = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(bin_, dtype=np.dtype(comp).newbyteorder('<'), count=a['count'] * nc, offset=off).reshape(a['count'], nc)
    if a.get('normalized'):
        arr = arr / {'B': 255.0, 'H': 65535.0}[comp]
    return arr


def glb_checks(path, expect):
    js, bin_ = read_glb(path)
    out = {}
    skin = js['skins'][0]
    jn = [js['nodes'][i]['name'] for i in skin['joints']]
    out['skins'] = len(js['skins'])
    out['joints'] = len(jn)
    out['joint_names_survive'] = sorted(jn) == sorted(expect)
    out['missing_joints'] = sorted(set(expect) - set(jn))
    out['extra_joints'] = sorted(set(jn) - set(expect))
    prim = [p for m in js['meshes'] for p in m['primitives']]
    out['primitives'] = len(prim)
    attrs = sorted(prim[0]['attributes'])
    out['attributes'] = attrs
    out['influence_sets'] = sum(1 for a in attrs if a.startswith('JOINTS_'))
    w = accessor(js, bin_, prim[0]['attributes']['WEIGHTS_0']).astype(float)
    out['vertices'] = int(len(w))
    out['worst_weight_sum_error'] = float(np.abs(w.sum(1) - 1).max())
    out['triangles'] = int(js['accessors'][prim[0]['indices']]['count'] // 3)
    root = js['nodes'][js['scenes'][0]['nodes'][0]]
    out['scene_roots'] = [js['nodes'][i]['name'] for i in js['scenes'][0]['nodes']]
    pos = accessor(js, bin_, prim[0]['attributes']['POSITION'])
    out['bounds_min'], out['bounds_max'] = [round(float(v), 4) for v in pos.min(0)], [round(float(v), 4) for v in pos.max(0)]
    anims = {}
    for a in js.get('animations', []):
        tgt = {}
        for c in a['channels']:
            tgt.setdefault(js['nodes'][c['target']['node']]['name'], []).append(c['target']['path'])
        helpers = [n for n in tgt if n.endswith(HELPERS)]
        move = 0.0                                             # do the helper channels really carry motion?
        for c in a['channels']:
            if js['nodes'][c['target']['node']]['name'].endswith(HELPERS) and c['target']['path'] == 'rotation':
                move = max(move, float(np.ptp(accessor(js, bin_, a['samplers'][c['sampler']]['output']), axis=0).max()))
        t = accessor(js, bin_, a['samplers'][0]['input'])
        anims[a['name']] = dict(animated_nodes=len(tgt), helper_bones_baked=len(helpers), helper_rotation_range=round(move, 4), duration=round(float(t.max()), 4))
    out['animations'] = anims
    out['file_mb'] = round(os.path.getsize(path) / 1e6, 2)
    return out


def main():
    a = sys.argv[sys.argv.index('--') + 1:]
    src, out = os.path.abspath(a[0]), os.path.abspath(a[1])
    bpy.ops.wm.open_mainfile(filepath=src)
    ob = bpy.data.objects['Hero']
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    rep = dict(source=os.path.basename(src))
    rep['armature'] = dict(object=arm.name, location=list(arm.location), rotation=list(arm.rotation_euler), scale=list(arm.scale),
                           bones=len(arm.data.bones), roots=[b.name for b in arm.data.bones if b.parent is None],
                           all_inherit_rotation=all(b.use_inherit_rotation for b in arm.data.bones))
    rep['weights'] = weight_checks(ob)
    has_anim = len(bpy.data.actions) > 0
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_skins=True, export_tangents=True,
                              export_image_format='JPEG', export_jpeg_quality=85,
                              export_animations=has_anim, export_animation_mode='ACTIONS' if has_anim else 'ACTIONS',
                              export_force_sampling=True, export_all_influences=False, export_def_bones=False,
                              export_optimize_animation_size=False, export_anim_slide_to_zero=False)
    rep['glb'] = glb_checks(out, [b.name for b in arm.data.bones])
    for k in ('armature', 'weights', 'glb'):
        print('RIGCHECK', k, json.dumps(rep[k]))
    with open(out + '.json', 'w', newline='\n') as fh:
        json.dump(rep, fh, indent=1)


if __name__ == '__main__':
    main()
