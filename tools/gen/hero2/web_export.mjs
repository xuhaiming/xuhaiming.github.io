// Stage 4: web export. Turns the animated source GLB into the two files the site loads:
//
//   public/assets/hero/hero.glb     laptops and desktops (tier 1, 2): base colour 2048, normal 2048, MR 1024
//   public/assets/hero/hero.m.glb   phones (tier 0):                  base colour 1024, normal 1024, MR 512
//
// usage (from the repo root):
//   node tools/gen/hero2/web_export.mjs [source.glb] [--out public/assets/hero] [--tex <dir with hero_*.png>]
//                                       [--base 2048,1024] [--normal 2048,1024] [--mr 1024,512]
//                                       [--q-base 94] [--q-normal 90] [--q-mr 88] [--no-phone] [--check-only]
//
// source defaults to tools/gen/src/hero2/hero_anim.glb. Textures come from the 4096 PNG masters next to the
// source (hero_basecolor.png, hero_normal.png, hero_mr.png) when they exist, so nothing is re-encoded from a
// JPEG; without them the images embedded in the source are used.
//
// What it does, and why:
//   geometry   positions stay float32 in metres (the site reads mesh space directly), snapped to a 1/16384 m
//              grid (0.06 mm) so the meshopt codec packs them well; normals and tangents 10 bit; UVs 14 bit
//              (a quarter of a texel of the 4096 atlas); weights 8 bit, renormalised; joints 8 bit.
//              Vertex order is optimised for the codec (the triangle list is kept, nothing is welded or dropped).
//   animation  channels that never leave the rest pose are dropped (three falls back to the rest pose),
//              redundant keys removed (resample), rotations stored as 16 bit quaternions by the meshopt filter.
//   textures   WebP. The atlas gives the face 4.5x the texel density of the clothes, so one uniform size
//              already favours the head.
// Afterwards it reads both files back and prints the size breakdown and the worst-case errors against the source.
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { cloneDocument, dedup, prune, quantize, reorder, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const valued = new Set(['out', 'tex', 'base', 'normal', 'mr', 'q-base', 'q-normal', 'q-mr']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && valued.has(argv[i - 1].slice(2))));
const SRC = resolve(positional[0] ?? join(ROOT, 'tools/gen/src/hero2/hero_anim.glb'));
const OUT = resolve(opt('out', join(ROOT, 'public/assets/hero')));
const TEX = resolve(opt('tex', dirname(SRC)));
const pair = (s) => s.split(',').map(Number);
const SIZES = { base: pair(opt('base', '2048,1024')), normal: pair(opt('normal', '2048,1024')), mr: pair(opt('mr', '1024,512')) };
const Q = { base: Number(opt('q-base', 94)), normal: Number(opt('q-normal', 90)), mr: Number(opt('q-mr', 88)) };
const MASTER = { base: 'hero_basecolor.png', normal: 'hero_normal.png', mr: 'hero_mr.png' };
const GRID = 16384;
const CLIPS = ['idle', 'walk', 'wave', 'think'];

if (!existsSync(SRC)) {
  console.error(`error: source not found: ${SRC}`);
  process.exit(1);
}
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const kib = (n) => `${(n / 1024).toFixed(0)} KiB`;
const quiet = { debug() {}, info() {}, warn: (m) => console.warn('  warn:', m), error: (m) => console.error('  error:', m) };

/** one texture slot of the material -> WebP bytes at `size` */
async function encode(kind, embedded, size) {
  const master = join(TEX, MASTER[kind]);
  const input = existsSync(master) ? master : Buffer.from(embedded);
  let img = sharp(input).removeAlpha().resize(size, size, { kernel: 'lanczos3', fit: 'fill' });
  if (kind === 'normal') {
    // a downscaled normal map is no longer unit length: renormalise before encoding
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) {
      const x = data[i] / 127.5 - 1;
      const y = data[i + 1] / 127.5 - 1;
      const z = data[i + 2] / 127.5 - 1;
      const l = Math.hypot(x, y, z) || 1;
      data[i] = Math.round((x / l + 1) * 127.5);
      data[i + 1] = Math.round((y / l + 1) * 127.5);
      data[i + 2] = Math.round((z / l + 1) * 127.5);
    }
    img = sharp(data, { raw: info });
  }
  return { bytes: await img.webp({ quality: Q[kind], effort: 6, smartSubsample: true }).toBuffer(), fromMaster: input === master };
}

function slots(doc) {
  const mat = doc.getRoot().listMaterials()[0];
  return { base: mat.getBaseColorTexture(), normal: mat.getNormalTexture(), mr: mat.getMetallicRoughnessTexture() };
}

/** drop channels that never leave the node's rest value, and constant scale channels */
function dropStill(doc) {
  let dropped = 0;
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode();
      const path = ch.getTargetPath();
      const s = ch.getSampler();
      const out = s?.getOutput();
      if (!node || !out || path === 'weights') continue;
      const rest = path === 'translation' ? node.getTranslation() : path === 'rotation' ? node.getRotation() : node.getScale();
      const n = rest.length;
      const el = [];
      let still = true;
      const cubic = s.getInterpolation() === 'CUBICSPLINE';
      for (let i = 0; i < out.getCount() && still; i++) {
        if (cubic && i % 3 !== 1) continue;
        out.getElement(i, el);
        // q and -q are the same rotation
        const sign = path === 'rotation' && el[0] * rest[0] + el[1] * rest[1] + el[2] * rest[2] + el[3] * rest[3] < 0 ? -1 : 1;
        for (let k = 0; k < n; k++) if (Math.abs(el[k] * sign - rest[k]) > (path === 'scale' ? 2e-3 : 2e-5)) still = false;
      }
      if (still) {
        ch.dispose();
        dropped++;
      }
    }
    for (const s of anim.listSamplers()) if (!s.listParents().some((p) => p.propertyType === 'AnimationChannel')) s.dispose();
  }
  return dropped;
}

async function build(src, variant) {
  const doc = cloneDocument(src);
  doc.setLogger(quiet);
  const root = doc.getRoot();

  // ---- textures
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const tex = slots(doc);
  let fromMaster = true;
  for (const kind of ['base', 'normal', 'mr']) {
    const t = tex[kind];
    if (!t) continue;
    const r = await encode(kind, t.getImage(), SIZES[kind][variant]);
    fromMaster &&= r.fromMaster;
    t.setImage(r.bytes).setMimeType('image/webp').setName(`hero_${kind}`).setURI('');
  }

  // ---- geometry
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const a = pos.getArray();
      for (let i = 0; i < a.length; i++) a[i] = Math.round(a[i] * GRID) / GRID;
      pos.setArray(a);
    }
  const dropped = dropStill(doc);
  await doc.transform(
    dedup(),
    resample({ tolerance: 1e-4 }),
    quantize({ pattern: /^(NORMAL|TANGENT|TEXCOORD_\d+|JOINTS_\d+|WEIGHTS_\d+)$/, quantizeNormal: 10, quantizeTexcoord: 14, quantizeWeight: 8, normalizeWeights: true }),
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    prune({ keepAttributes: true, keepLeaves: true }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  return { doc, dropped, fromMaster };
}

/** byte sizes of a written GLB by what the bytes are for */
function breakdown(file) {
  const d = readFileSync(file);
  const jl = d.readUInt32LE(12);
  const j = JSON.parse(d.subarray(20, 20 + jl).toString('utf8'));
  const viewBytes = (i) => {
    const bv = j.bufferViews[i];
    return bv.extensions?.EXT_meshopt_compression?.byteLength ?? bv.byteLength;
  };
  const use = new Map();
  const mark = (acc, what) => acc !== undefined && j.accessors[acc].bufferView !== undefined && use.set(j.accessors[acc].bufferView, what);
  for (const a of j.animations ?? [])
    for (const s of a.samplers) {
      mark(s.input, 'animation');
      mark(s.output, 'animation');
    }
  for (const m of j.meshes ?? [])
    for (const p of m.primitives) {
      mark(p.indices, 'geometry');
      for (const k in p.attributes) mark(p.attributes[k], 'geometry');
    }
  for (const s of j.skins ?? []) mark(s.inverseBindMatrices, 'skin');
  const out = { total: d.length, json: jl, geometry: 0, animation: 0, skin: 0, images: {} };
  for (const [bv, what] of use) out[what] += viewBytes(bv);
  for (const img of j.images ?? []) out.images[img.name ?? '?'] = viewBytes(img.bufferView);
  return out;
}

/** read a written file back and compare it with the source */
async function check(file, src) {
  const doc = await io.read(file);
  const prim = (d) => d.getRoot().listMeshes()[0].listPrimitives()[0];
  const a = prim(src);
  const b = prim(doc);
  const n = a.getAttribute('POSITION').getCount();
  const res = { vertices: b.getAttribute('POSITION').getCount(), triangles: b.getIndices().getCount() / 3, joints: doc.getRoot().listSkins()[0].listJoints().length };
  // the vertex order changed: match by snapped position, then the nearest uv among the vertices that share it (seams)
  const key = (p) => `${Math.round(p[0] * GRID)},${Math.round(p[1] * GRID)},${Math.round(p[2] * GRID)}`;
  const map = new Map();
  const p = [];
  const u = [];
  const uvA = a.getAttribute('TEXCOORD_0');
  for (let i = 0; i < n; i++) {
    const k = key(a.getAttribute('POSITION').getElement(i, p));
    if (map.has(k)) map.get(k).push(i);
    else map.set(k, [i]);
  }
  const match = (p, u) => {
    const list = map.get(key(p));
    if (!list) return undefined;
    let best = list[0];
    let bd = Infinity;
    const t = [];
    for (const i of list) {
      uvA.getElement(i, t);
      const d = Math.abs(t[0] - u[0]) + Math.abs(t[1] - u[1]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  let posErr = 0;
  let uvErr = 0;
  let nrmErr = 0;
  let wErr = 0;
  let wSum = 0;
  let unmatched = 0;
  let jointMismatch = 0;
  const q = [];
  const v = [];
  const jointsA = src.getRoot().listSkins()[0].listJoints().map((x) => x.getName());
  const jointsB = doc.getRoot().listSkins()[0].listJoints().map((x) => x.getName());
  for (let i = 0; i < res.vertices; i++) {
    b.getAttribute('POSITION').getElement(i, p);
    b.getAttribute('TEXCOORD_0').getElement(i, u);
    const s = match(p, u);
    if (s === undefined) {
      unmatched++;
      continue;
    }
    a.getAttribute('POSITION').getElement(s, q);
    posErr = Math.max(posErr, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
    a.getAttribute('TEXCOORD_0').getElement(s, v);
    uvErr = Math.max(uvErr, Math.abs(u[0] - v[0]), Math.abs(u[1] - v[1]));
    b.getAttribute('NORMAL').getElement(i, p);
    a.getAttribute('NORMAL').getElement(s, q);
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    nrmErr = Math.max(nrmErr, Math.acos(Math.min(1, (p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / l)));
    const wa = new Map();
    const wb = new Map();
    a.getAttribute('JOINTS_0').getElement(s, p);
    a.getAttribute('WEIGHTS_0').getElement(s, q);
    for (let k = 0; k < 4; k++) if (q[k] > 0) wa.set(jointsA[p[k]], (wa.get(jointsA[p[k]]) ?? 0) + q[k]);
    b.getAttribute('JOINTS_0').getElement(i, p);
    b.getAttribute('WEIGHTS_0').getElement(i, q);
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      sum += q[k];
      if (q[k] > 0) wb.set(jointsB[p[k]], (wb.get(jointsB[p[k]]) ?? 0) + q[k]);
    }
    wSum = Math.max(wSum, Math.abs(sum - 1));
    for (const [name, w] of wa) {
      const d = Math.abs(w - (wb.get(name) ?? 0));
      wErr = Math.max(wErr, d);
      if (d > 0.02) jointMismatch++;
    }
  }
  Object.assign(res, { unmatched, posErrMm: posErr * 1000, uvErrTexels4096: uvErr * 4096, normalErrDeg: (nrmErr * 180) / Math.PI, weightErr: wErr, weightSumErr: wSum, jointMismatch });
  res.attributes = b.listSemantics().join(' ');
  res.clips = {};
  for (const an of doc.getRoot().listAnimations()) {
    let dur = 0;
    let keys = 0;
    for (const s of an.listSamplers()) {
      const inp = s.getInput();
      dur = Math.max(dur, inp.getMax([])[0]);
      keys += inp.getCount();
    }
    res.clips[an.getName()] = { duration: +dur.toFixed(4), channels: an.listChannels().length, keys };
  }
  res.textures = {};
  for (const t of doc.getRoot().listTextures()) res.textures[t.getName()] = `${t.getSize()?.join('x')} ${t.getMimeType()}`;
  return res;
}

const src = await io.read(SRC);
src.setLogger(quiet);
console.log(`source  ${SRC}  (${(statSync(SRC).size / 2 ** 20).toFixed(2)} MiB)`);
const names = src.getRoot().listAnimations().map((a) => a.getName());
console.log(`clips   ${names.join(', ')}`);
const missing = CLIPS.filter((c) => !names.includes(c));
if (missing.length) console.warn(`  warn: missing clip(s): ${missing.join(', ')} (the site falls back to idle for a missing pose)`);

const variants = [['hero.glb', 0], ...(flag('no-phone') ? [] : [['hero.m.glb', 1]])];
mkdirSync(OUT, { recursive: true });
for (const [name, variant] of variants) {
  const file = join(OUT, name);
  if (!flag('check-only')) {
    const { doc, dropped, fromMaster } = await build(src, variant);
    await io.write(file, doc);
    console.log(`\nwrote   ${file}   (textures from ${fromMaster ? 'the PNG masters' : 'the images embedded in the source'}; ${dropped} still channels dropped)`);
  } else console.log(`\nfile    ${file}`);
  const b = breakdown(file);
  console.log(`  total      ${(b.total / 2 ** 20).toFixed(2)} MiB (${b.total} bytes)`);
  console.log(`  geometry   ${kib(b.geometry)}   animation ${kib(b.animation)}   skin ${kib(b.skin)}   json ${kib(b.json)}`);
  for (const k in b.images) console.log(`  ${k.padEnd(12)} ${kib(b.images[k])}`);
  const c = await check(file, src);
  console.log(`  mesh       ${c.vertices} vertices, ${c.triangles} triangles, ${c.joints} joints; ${c.attributes}`);
  console.log(`  textures   ${Object.entries(c.textures).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`  errors     position ${c.posErrMm.toFixed(3)} mm, uv ${c.uvErrTexels4096.toFixed(2)} texels of 4096, normal ${c.normalErrDeg.toFixed(2)} deg, weight ${c.weightErr.toFixed(4)}, weight sum ${c.weightSumErr.toFixed(4)}; unmatched vertices ${c.unmatched}, weights off by > 0.02: ${c.jointMismatch}`);
  for (const k in c.clips) console.log(`  clip ${k.padEnd(6)} ${c.clips[k].duration} s, ${c.clips[k].channels} channels, ${c.clips[k].keys} keys`);
}
