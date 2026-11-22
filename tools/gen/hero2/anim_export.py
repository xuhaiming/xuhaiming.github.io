"""Stage 3: export hero_anim.blend to hero_anim.glb and verify what came out. Blender 5.0 headless, local only.

    blender -b -P hero2/anim_export.py -- src/hero2/hero_anim.blend src/hero2/hero_anim.glb

glTF binary, +Y up, one skin, animations sampled at 30 fps (this bakes the constraint-driven helper bones), one
animation per action: idle, walk, wave, think. Constant translation / scale channels are dropped afterwards (only
the hips translate). Textures are embedded as stage 2 did (JPEG); the web stage compresses.
After the export the file is read back with plain numpy and checked against the .blend: names, lengths, joints,
helpers baked, loop seams, the one-shots' first (and the wave's last) pose against idle frame 0, joint positions of a
few frames against Blender's own evaluation. Prints ANIMGLB lines and writes <glb>.json.
"""
import json
import os
import struct
import sys

import bpy
import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anim_lib as al  # noqa: E402

CLIPS = ('idle', 'walk', 'wave', 'think')
LOOPS = ('idle', 'walk')


def read_glb(path):
    with open(path, 'rb') as fh:
        data = fh.read()
    jl = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + jl]), data[20 + jl + 8:]


def accessor(js, bin_, i):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    comp = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
    nc = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(bin_, dtype=np.dtype(comp).newbyteorder('<'), count=a['count'] * nc, offset=off).reshape(a['count'], nc)


def qmat(q):
    """glTF quaternion (x, y, z, w) -> matrix"""
    return al.quat2mat(np.concatenate([q[..., 3:], q[..., :3]], -1))


def prune_static(path):
    """drop translation / scale channels that only repeat the node's rest value (every bone but the hips): 74 channels
    per clip instead of 219. Only the JSON chunk is rewritten; the few bytes of key data they used stay in the buffer."""
    with open(path, 'rb') as fh:
        data = fh.read()
    jl = struct.unpack_from('<I', data, 12)[0]
    js = json.loads(data[20:20 + jl])
    rest_ = data[20 + jl:]
    bin_ = rest_[8:]
    dropped = 0
    for a in js.get('animations', []):
        keep = []
        for c in a['channels']:
            p = c['target']['path']
            if p in ('translation', 'scale'):
                v = accessor(js, bin_, a['samplers'][c['sampler']]['output'])
                n = js['nodes'][c['target']['node']]
                r = np.array(n.get(p, (0, 0, 0) if p == 'translation' else (1, 1, 1)), float)
                if np.abs(v - r).max() < 1e-6:
                    dropped += 1
                    continue
            keep.append(c)
        used = sorted({c['sampler'] for c in keep})
        remap = {o: k for k, o in enumerate(used)}
        a['samplers'] = [a['samplers'][o] for o in used]
        for c in keep:
            c['sampler'] = remap[c['sampler']]
        a['channels'] = keep
    out = json.dumps(js, separators=(',', ':')).encode('utf-8')
    out += b' ' * (-len(out) % 4)
    with open(path, 'wb') as fh:
        fh.write(data[:8] + struct.pack('<I', 12 + 8 + len(out) + len(rest_)) + struct.pack('<I', len(out)) + b'JSON' + out + rest_)
    return dropped


class Glb:
    def __init__(self, path):
        self.js, self.bin = read_glb(path)
        js = self.js
        self.nodes = js['nodes']
        self.parent = {}
        for i, n in enumerate(self.nodes):
            for c in n.get('children', []):
                self.parent[c] = i
        self.joints = js['skins'][0]['joints']
        self.name = {i: n.get('name', '') for i, n in enumerate(self.nodes)}
        self.anims = {}
        for a in js.get('animations', []):
            ch = {}
            for c in a['channels']:
                s = a['samplers'][c['sampler']]
                ch[(c['target']['node'], c['target']['path'])] = (accessor(js, self.bin, s['input'])[:, 0], accessor(js, self.bin, s['output']), s.get('interpolation', 'LINEAR'))
            self.anims[a['name']] = ch

    def sample(self, anim, t):
        """world position of every joint at time t (linear interpolation, like the site will do)"""
        ch = self.anims[anim]
        loc, rot = {}, {}
        for i, n in enumerate(self.nodes):
            loc[i] = np.array(n.get('translation', (0, 0, 0)), float)
            rot[i] = np.array(n.get('rotation', (0, 0, 0, 1)), float)
        for (node, path), (tt, vv, _) in ch.items():
            k = int(np.clip(np.searchsorted(tt, t, side='right') - 1, 0, len(tt) - 1))
            k2 = min(k + 1, len(tt) - 1)
            u = 0.0 if k2 == k else float((t - tt[k]) / (tt[k2] - tt[k]))
            u = min(max(u, 0.0), 1.0)
            if path == 'translation':
                loc[node] = vv[k] * (1 - u) + vv[k2] * u
            elif path == 'rotation':
                a, b = vv[k].astype(float), vv[k2].astype(float)
                if np.dot(a, b) < 0:
                    b = -b
                q = a * (1 - u) + b * u
                rot[node] = q / np.linalg.norm(q)
        world = {}

        def w(i):
            if i not in world:
                M = np.eye(4)
                M[:3, :3] = qmat(rot[i])
                M[:3, 3] = loc[i]
                world[i] = (w(self.parent[i]) @ M) if i in self.parent else M
            return world[i]
        return {self.name[i]: w(i)[:3, 3] for i in self.joints}, rot


def main():
    a = sys.argv[sys.argv.index('--') + 1:]
    src, out = os.path.abspath(a[0]), os.path.abspath(a[1])
    bpy.ops.wm.open_mainfile(filepath=src)
    sc = bpy.context.scene
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_skins=True, export_tangents=True,
                              export_image_format='JPEG', export_jpeg_quality=85,
                              export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
                              export_all_influences=False, export_def_bones=False,
                              export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=True,
                              export_anim_slide_to_zero=False)
    dropped = prune_static(out)
    g = Glb(out)
    rep = dict(file=os.path.basename(out), file_mb=round(os.path.getsize(out) / 1e6, 2), skins=len(g.js['skins']), joints=len(g.joints),
               joint_names_match=sorted(g.name[i] for i in g.joints) == sorted(b.name for b in arm.data.bones),
               images=[dict(mime=i.get('mimeType'), kb=round(g.js['bufferViews'][i['bufferView']]['byteLength'] / 1024)) for i in g.js.get('images', [])],
               static_channels_dropped=dropped, animations={})
    ok = rep['joint_names_match'] and sorted(g.anims) == sorted(CLIPS)
    rep['animation_names'] = list(g.anims)
    total_ch = 0
    for name in CLIPS:
        ch = g.anims.get(name)
        if ch is None:
            continue
        act = bpy.data.actions[name]
        f1 = int(round(act.frame_range[1]))
        tmax = max(float(t.max()) for t, _, _ in ch.values())
        tmin = min(float(t.min()) for t, _, _ in ch.values())
        paths = {}
        for (_, p) in ch:
            paths[p] = paths.get(p, 0) + 1
        helpers = [k for k in ch if g.name[k[0]].endswith(al.HELPERS)]
        hmove = max((float(np.ptp(ch[k][1], axis=0).max()) for k in helpers), default=0.0)
        keys = sum(len(t) for t, _, _ in ch.values())
        dts = np.concatenate([np.diff(t) for t, _, _ in ch.values() if len(t) > 2])
        info = dict(channels=len(ch), by_path=paths, keys=keys, start=round(tmin, 4), duration=round(tmax, 4), frames=f1 + 1,
                    expected_duration=round(f1 / 30, 4), key_step=[round(float(dts.min()), 5), round(float(dts.max()), 5)],
                    interpolation=sorted({i for _, _, i in ch.values()}), helper_channels=len(helpers), helper_rotation_range=round(hmove, 4),
                    dense_channels=sum(1 for t, _, _ in ch.values() if len(t) > 2))
        ok &= abs(tmax - f1 / 30) < 1e-4 and tmin == 0.0 and len(helpers) >= 8 and hmove > 0.01
        # joint positions against Blender (glTF = Blender (x, z, -y))
        al.use_action(arm, act)
        worst = 0.0
        for f in sorted({0, f1 // 3, f1 // 2, f1}):
            sc.frame_set(f)
            P, _ = g.sample(name, f / 30)
            for b in arm.pose.bones:
                h = arm.matrix_world @ b.head
                worst = max(worst, float(np.linalg.norm(P[b.name] - np.array([h.x, h.z, -h.y]))))
        info['joint_position_error_vs_blend_mm'] = round(worst * 1000, 4)
        ok &= worst < 5e-4
        P0, R0 = g.sample(name, 0.0)
        P1, R1 = g.sample(name, tmax)
        Pi, Ri = g.sample('idle', 0.0)

        def gap(Ra, Rb, Pa, Pb):
            ang = max(float(np.degrees(2 * np.arccos(min(1.0, abs(float(np.dot(Ra[i], Rb[i]))))))) for i in g.joints)
            return round(ang, 5), round(max(float(np.linalg.norm(Pa[n] - Pb[n])) for n in Pa) * 1000, 5)
        if name in LOOPS:
            info['seam_max_joint_deg__max_pos_mm'] = gap(R0, R1, P0, P1)
            ok &= info['seam_max_joint_deg__max_pos_mm'][0] < 0.01
        else:
            info['first_frame_vs_idle0_deg__mm'] = gap(R0, Ri, P0, Pi)
            ok &= info['first_frame_vs_idle0_deg__mm'][0] < 0.01
            if name == 'wave':
                info['last_frame_vs_idle0_deg__mm'] = gap(R1, Ri, P1, Pi)
                ok &= info['last_frame_vs_idle0_deg__mm'][0] < 0.01
        total_ch += len(ch)
        rep['animations'][name] = info
        print('ANIMGLB', name, json.dumps(info))
    rep['animation_channels_total'] = total_ch
    prim = g.js['meshes'][0]['primitives'][0]
    rep['triangles'] = int(g.js['accessors'][prim['indices']]['count'] // 3)
    rep['vertices'] = int(g.js['accessors'][prim['attributes']['POSITION']]['count'])
    rep['attributes'] = sorted(prim['attributes'])
    rep['ok'] = bool(ok)
    print('ANIMGLB', json.dumps({k: v for k, v in rep.items() if k != 'animations'}))
    with open(out + '.json', 'w', newline='\n') as fh:
        json.dump(rep, fh, indent=1)
    if not ok:
        raise SystemExit('ANIMGLB: a check failed, see above')


if __name__ == '__main__':
    main()
