import * as THREE from 'three';
import type { Chapter, Ctx, Frame } from '../../world/types';
import { clamp01, css, damp, flag, inOutCubic, mix, seg, show, smooth } from '../../world/util';
import { BLEND, K, L, LAMP_0, LAMP_STEP, P0, P1, PLACES, STOPS, between, pOf, placeWeights, routeAt, stopAt, xOf, yearOf } from './data';
import { MAX_MARK, glowMaterial, layerMaterial, mistMaterial, roadMaterial, skyMaterial, waterMaterial, type LayerUniforms } from './layers';
import { makeRoute, type RouteApi } from './route';
import { EXIT, Rift, exitCopy, exitLine, exitOpen, exitWalk } from '../../world/Rift';

/**
 * The path so far. One long take: he walks a quay road from 2010 to 2025 through four places.
 * Every place is a diorama of painted layers at real depths (sky, far skyline, the far bank and its
 * reflection, the quay with props), so the tracking camera and the pointer both produce parallax.
 * The visitor can take the timeline and drag him along it, or pick a city on the chart.
 */

const group = new THREE.Group();
const ACCENT = new THREE.Color('#2fe0c2');
/** the next chapter's light, and the rift that leads there: a few steps on along the quay */
const ROSE = new THREE.Color('#ff5d8f');
const RIFT_DX = 2.8;
/** he stands at the end of the road from P1; the arrival beat holds until the exit starts here */
const OUT0 = 0.9;
const A = '/assets/path/';
const WATER_Y = -0.42;
const MARK_Z = -1.15;
const LAMP_Z = -1.42;
const LAMP_H = 3.3;

/* ------------------------------------------------------------------ places */

interface LayerSpec {
  h: number;
  z: number;
  /** how much the layer follows the camera: 0 = fixed in the world, 1 = at infinity */
  k: number;
  /** mirrored repeats of the painting across the plane */
  rep: number;
  feather: number;
  /** centre on the road, in road units; defaults to the place centre */
  cx?: number;
}
interface Spec {
  cx: number;
  /** where the horizon sits in the sky painting, 0 = bottom edge */
  horizon: number;
  far: LayerSpec;
  mid: LayerSpec;
}
// The Netherlands opens on the flat horizon alone; the canal houses arrive with the first jobs.
const SPEC: Spec[] = [
  { cx: 8, horizon: 0.23, far: { h: 4.6, z: -40, k: 0.84, rep: 2, feather: 0.1, cx: 5 }, mid: { h: 5.3, z: -18, k: 0.5, rep: 1, feather: 0.16, cx: 13.5 } },
  { cx: 25, horizon: 0.27, far: { h: 11, z: -40, k: 0.84, rep: 2, feather: 0.1 }, mid: { h: 3.9, z: -15, k: 0.45, rep: 2, feather: 0.14 } },
  { cx: 42.5, horizon: 0.1, far: { h: 16, z: -42, k: 0.84, rep: 2, feather: 0.1 }, mid: { h: 9.4, z: -19, k: 0.5, rep: 2, feather: 0.14 } },
  { cx: 62.5, horizon: 0.07, far: { h: 12.5, z: -40, k: 0.84, rep: 2, feather: 0.1 }, mid: { h: 4.9, z: -16, k: 0.45, rep: 2, feather: 0.14 } },
];
for (const s of SPEC) {
  s.cx *= K;
  s.far.cx = (s.far.cx ?? s.cx / K) * K;
  s.mid.cx = (s.mid.cx ?? s.cx / K) * K;
}


interface Layer {
  mesh: THREE.Mesh;
  refl: THREE.Mesh | null;
  u: LayerUniforms;
  ur: LayerUniforms | null;
  k: number;
  cx: number;
  ok: boolean;
}
interface Diorama {
  sky: THREE.Mesh;
  skyOk: boolean;
  far: Layer;
  mid: Layer;
}
const dioramas: Diorama[] = [];

/** near cut-outs standing on the quay (or between him and the lens when fg) */
interface SpriteSpec {
  tex: string;
  x: number;
  h: number;
  z?: number;
  sway?: number;
  flip?: boolean;
  fg?: boolean;
  y?: number;
  /** colour kept from the painting (the rest goes to the grade); default 0.7 */
  sat?: number;
  /** has painted lamps that should glow at night */
  lit?: boolean;
}
const SPRITES: SpriteSpec[] = [
  // the Netherlands
  { tex: 'near_nl_tree', x: -4.6, h: 6.4, sway: 0.05 },
  { tex: 'near_nl_tree', x: 2.3, h: 5.6, sway: 0.05, flip: true },
  { tex: 'near_nl_bikes', x: 5.9, h: 1.28, z: -1.55 },
  { tex: 'near_nl_tree', x: 9.3, h: 6.1, sway: 0.05 },
  { tex: 'near_nl_bikes', x: 13.1, h: 1.28, z: -1.55, flip: true },
  { tex: 'near_nl_tree', x: 16.4, h: 5.4, sway: 0.05, flip: true },
  { tex: 'near_nl_tree', x: 10.2, h: 9, fg: true, y: -1.2 },
  // Beijing
  { tex: 'near_bj_tree', x: 19.9, h: 5.6, sway: 0.04, sat: 0.5 },
  { tex: 'near_bj_gate', x: 21.4, h: 2.55, z: -1.6, lit: true, sat: 0.9 },
  { tex: 'near_bj_gate', x: 28.6, h: 2.55, z: -1.6, flip: true, lit: true, sat: 0.9 },
  { tex: 'near_bj_tree', x: 30.2, h: 6.2, sway: 0.04, flip: true, sat: 0.5 },
  { tex: 'near_nl_tree', x: 27.2, h: 9, fg: true, y: -1.4, flip: true },
  // Shenzhen
  { tex: 'near_sz_tree', x: 33.6, h: 5.2, sway: 0.03 },
  { tex: 'near_sz_rail', x: 37.3, h: 1.15, z: -1.6 },
  { tex: 'near_sz_rail', x: 41.0, h: 1.15, z: -1.6, flip: true },
  { tex: 'near_sz_rail', x: 44.3, h: 1.15, z: -1.6 },
  { tex: 'near_sz_tree', x: 47.9, h: 5.6, sway: 0.03, flip: true },
  { tex: 'near_sz_rail', x: 51.2, h: 1.15, z: -1.6, flip: true },
  { tex: 'near_sg_palm', x: 49.2, h: 9.5, fg: true, y: -1.0 },
  // Singapore
  { tex: 'near_sg_palm', x: 54.9, h: 6.6, sway: 0.07 },
  { tex: 'near_sg_plants', x: 58.2, h: 1.7, z: -1.5, sway: 0.02 },
  { tex: 'near_sg_palm', x: 61.9, h: 7.4, sway: 0.07, flip: true },
  { tex: 'near_sg_plants', x: 65.2, h: 1.9, z: -1.5, sway: 0.02, flip: true },
  { tex: 'near_sg_palm', x: 69.0, h: 6.8, sway: 0.07 },
  { tex: 'near_sg_plants', x: 72.4, h: 1.7, z: -1.5, sway: 0.02 },
  { tex: 'near_sg_plants', x: 57.4, h: 2.3, fg: true, y: -0.7 },
  { tex: 'near_sg_plants', x: 66.4, h: 2.5, fg: true, y: -0.8, flip: true },
];
interface Sprite {
  mesh: THREE.Mesh;
  u: LayerUniforms;
  x: number;
  fg: boolean;
  lit: boolean;
}
for (const s of SPRITES) s.x *= K;
const sprites: Sprite[] = [];

/* ------------------------------------------------------------------ light over the walk */

interface Look {
  x: number;
  gain: number;
  tint: THREE.Color;
  haze: THREE.Color;
  hazeFar: number;
  hazeMid: number;
  night: number;
  stars: number;
  key: THREE.Color;
  keyI: number;
  rimI: number;
  bg: THREE.Color;
  glow: THREE.Color;
  cloud: number;
  deep: THREE.Color;
  wsky: THREE.Color;
  road: THREE.Color;
}
const look = (x: number, o: Record<string, string | number>): Look => ({
  x: x * K,
  gain: o.gain as number,
  tint: new THREE.Color(o.tint as string),
  haze: new THREE.Color(o.haze as string),
  hazeFar: o.hazeFar as number,
  hazeMid: o.hazeMid as number,
  night: o.night as number,
  stars: o.stars as number,
  key: new THREE.Color(o.key as string),
  keyI: o.keyI as number,
  rimI: o.rimI as number,
  bg: new THREE.Color(o.bg as string),
  glow: new THREE.Color(o.glow as string),
  cloud: o.cloud as number,
  deep: new THREE.Color(o.deep as string),
  wsky: new THREE.Color(o.wsky as string),
  road: new THREE.Color(o.road as string),
});
// one day across fifteen years: before dawn in the Netherlands, first light in Beijing,
// a long afternoon turning to dusk in Shenzhen, the lights of the evening in Singapore
const LOOKS: Look[] = [
  look(0, { gain: 0.62, tint: '#5d8f94', haze: '#0b3236', hazeFar: 0.34, hazeMid: 0.1, night: 1, stars: 1, key: '#a9dcd6', keyI: 1.5, rimI: 3.4, bg: '#02080a', glow: '#000000', cloud: 0.1, deep: '#020d10', wsky: '#12494a', road: '#14302f' }),
  look(15, { gain: 0.92, tint: '#86b6b4', haze: '#1c5753', hazeFar: 0.3, hazeMid: 0.1, night: 0.7, stars: 0.3, key: '#c4efe2', keyI: 1.9, rimI: 3.0, bg: '#031012', glow: '#0c3a30', cloud: 0.22, deep: '#03151a', wsky: '#2a7a70', road: '#1a3a38' }),
  look(25, { gain: 1.0, tint: '#b8c9b6', haze: '#3f7a6c', hazeFar: 0.5, hazeMid: 0.2, night: 0.5, stars: 0, key: '#ffe4bd', keyI: 2.3, rimI: 2.4, bg: '#06181a', glow: '#3a4a2a', cloud: 0.2, deep: '#061c1e', wsky: '#4a8a78', road: '#243f3a' }),
  look(40, { gain: 0.95, tint: '#9fc4c6', haze: '#236069', hazeFar: 0.3, hazeMid: 0.1, night: 0.75, stars: 0, key: '#cdeaf5', keyI: 2.0, rimI: 3.0, bg: '#041216', glow: '#10343a', cloud: 0.24, deep: '#03161c', wsky: '#2f7480', road: '#1b3940' }),
  look(50, { gain: 0.8, tint: '#7ba3aa', haze: '#143f4a', hazeFar: 0.26, hazeMid: 0.08, night: 1, stars: 0.2, key: '#b5d9ea', keyI: 1.7, rimI: 3.6, bg: '#030c10', glow: '#3a2414', cloud: 0.16, deep: '#020f14', wsky: '#1f5560', road: '#153038' }),
  look(62, { gain: 0.86, tint: '#6f9f98', haze: '#0d3a37', hazeFar: 0.24, hazeMid: 0.08, night: 1, stars: 0.9, key: '#a5e0cf', keyI: 1.6, rimI: 3.6, bg: '#020a0a', glow: '#062a26', cloud: 0.1, deep: '#020f0f', wsky: '#175048', road: '#143330' }),
  look(72, { gain: 0.9, tint: '#7aa39a', haze: '#123f3b', hazeFar: 0.24, hazeMid: 0.08, night: 1, stars: 0.8, key: '#ffd9d2', keyI: 1.8, rimI: 3.8, bg: '#040a0b', glow: '#4a1c2c', cloud: 0.12, deep: '#030f10', wsky: '#1b5049', road: '#173431' }),
];
const now = look(0, { gain: 1, tint: '#fff', haze: '#000', hazeFar: 0, hazeMid: 0, night: 0, stars: 0, key: '#fff', keyI: 1, rimI: 1, bg: '#000', glow: '#000', cloud: 0, deep: '#000', wsky: '#000', road: '#000' });
function lookAt(x: number) {
  let i = 0;
  while (i < LOOKS.length - 2 && x > LOOKS[i + 1].x) i++;
  const a = LOOKS[i];
  const b = LOOKS[i + 1];
  const t = smooth((x - a.x) / (b.x - a.x));
  now.gain = mix(a.gain, b.gain, t);
  now.hazeFar = mix(a.hazeFar, b.hazeFar, t);
  now.hazeMid = mix(a.hazeMid, b.hazeMid, t);
  now.night = mix(a.night, b.night, t);
  now.stars = mix(a.stars, b.stars, t);
  now.keyI = mix(a.keyI, b.keyI, t);
  now.rimI = mix(a.rimI, b.rimI, t);
  now.cloud = mix(a.cloud, b.cloud, t);
  now.tint.lerpColors(a.tint, b.tint, t);
  now.haze.lerpColors(a.haze, b.haze, t);
  now.key.lerpColors(a.key, b.key, t);
  now.bg.lerpColors(a.bg, b.bg, t);
  now.glow.lerpColors(a.glow, b.glow, t);
  now.deep.lerpColors(a.deep, b.deep, t);
  now.wsky.lerpColors(a.wsky, b.wsky, t);
  now.road.lerpColors(a.road, b.road, t);
}

/* ------------------------------------------------------------------ camera over the walk */

// [x, distance, height, aim height, sideways offset (+ = ahead of him, looking back), lead]
type Shot = [number, number, number, number, number, number];
const WIDE: Shot[] = [
  [0, 8.4, 1.25, 1.38, 0.6, 1.5],
  [12, 8.9, 1.1, 1.5, -0.4, 1.7],
  [25, 7.6, 1.5, 1.42, 1.7, 1.3],
  [36, 9.2, 0.85, 1.9, 0.2, 1.6],
  [47, 9.8, 0.7, 2.15, -0.9, 1.5],
  [60, 8.2, 1.35, 1.6, 1.0, 1.4],
  [72, 7.6, 1.45, 1.4, -0.6, 1.0],
];
const TALL: Shot[] = [
  [0, 9.6, 1.5, -0.1, 0.3, 0.35],
  [12, 10.2, 1.4, -0.05, -0.2, 0.4],
  [25, 9.2, 1.6, -0.15, 0.8, 0.3],
  [36, 10.6, 1.0, 0.1, 0.1, 0.4],
  [47, 11.0, 0.9, 0.15, -0.4, 0.4],
  [60, 9.8, 1.5, -0.05, 0.5, 0.35],
  [72, 9.4, 1.5, -0.1, -0.3, 0.2],
];
for (const s of [...WIDE, ...TALL]) s[0] *= K;
const shotNow: Shot = [0, 0, 0, 0, 0, 0];
function shotAt(list: Shot[], x: number) {
  let i = 0;
  while (i < list.length - 2 && x > list[i + 1][0]) i++;
  const a = list[i];
  const b = list[i + 1];
  const t = smooth((x - a[0]) / (b[0] - a[0]));
  for (let k = 1; k < 6; k++) shotNow[k] = mix(a[k], b[k], t);
  return shotNow;
}

/* ------------------------------------------------------------------ state */

let skyGeo: THREE.PlaneGeometry;
let unit: THREE.PlaneGeometry;
let water: THREE.Mesh;
let road: THREE.Mesh;
let kerb: THREE.Mesh;
const mists: { mesh: THREE.Mesh; z: number; a: number; drift: number }[] = [];
let keyL: THREE.DirectionalLight;
let rimL: THREE.DirectionalLight;
let hemi: THREE.HemisphereLight;
let lampL: THREE.PointLight;
let markL: THREE.PointLight;
let lampGlow: THREE.Points;
let lampFallback: THREE.InstancedMesh | null = null;
let poles: THREE.InstancedMesh;
let heads: THREE.InstancedMesh;
let headMat: THREE.MeshStandardMaterial;
let beacon: THREE.Points;
let motes: THREE.Points;
let rift: Rift;
let cloudsVid: HTMLVideoElement | null = null;
let waterVid: HTMLVideoElement | null = null;
const propMats: { m: THREE.MeshStandardMaterial; k: number }[] = [];

const weights = [1, 0, 0, 0];
const plant = new Float32Array(MAX_MARK);
const act = new Float32Array(MAX_MARK);
const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
const v = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const sc = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const pr = { x: 0, y: 0, z: 0 };

// DOM
let elHead: HTMLElement;
let elClock: HTMLElement;
let elTens: HTMLElement;
let elOnes: HTMLElement;
let elWhere: HTMLElement[] = [];
let elStops: HTMLElement[] = [];
let elTags: HTMLButtonElement[] = [];
let elRoute: HTMLElement;
let elEnd: HTMLElement;
let route: RouteApi;
let section: HTMLElement;
const cardW = new Float32Array(MAX_MARK);
let routeH = 0;
let clockR = 0;
let clockB = 0;
const cardOpen = new Int8Array(MAX_MARK).fill(-1);
const cardSeen = new Float32Array(MAX_MARK);

// interaction
let hover = -1;
let pinned = -1;
let closed = -1;
let openNow = -1;
let lastActive = -1;
let shotOpen = -1;
let sway = 0;
let warp = 0;
let lookX = 0;
let lookY = 0;

/* ------------------------------------------------------------------ build */

async function tryTex(ctx: Ctx, name: string, opts?: { repeat?: boolean }) {
  try {
    return await ctx.tex(`${A}${name}.webp`, opts);
  } catch {
    console.warn(`[path] missing ${name}.webp`);
    return null;
  }
}

function makeLayer(spec: LayerSpec, order: number, withRefl: boolean): Layer {
  const { rep, feather } = spec;
  const cx = spec.cx!;
  const mat = layerMaterial(null, { rep, feather });
  const mesh = new THREE.Mesh(unit, mat);
  mesh.position.set(cx, WATER_Y, spec.z);
  mesh.renderOrder = order;
  mesh.frustumCulled = false;
  mesh.visible = false;
  group.add(mesh);
  let refl: THREE.Mesh | null = null;
  let ur: LayerUniforms | null = null;
  if (withRefl) {
    const rm = layerMaterial(null, { rep, feather, refl: true });
    refl = new THREE.Mesh(unit, rm);
    refl.position.copy(mesh.position);
    refl.renderOrder = order + 1;
    refl.frustumCulled = false;
    refl.visible = false;
    group.add(refl);
    ur = rm.uniforms as LayerUniforms;
  }
  return { mesh, refl, u: mat.uniforms as LayerUniforms, ur, k: spec.k, cx, ok: false };
}

function fitLayer(l: Layer, tex: THREE.Texture | null, h: number, rep: number) {
  if (!tex) return;
  tex.wrapS = THREE.MirroredRepeatWrapping;
  tex.needsUpdate = true;
  const img = tex.image as { width: number; height: number };
  const w = (h * img.width) / img.height;
  l.mesh.scale.set(w * rep, h, 1);
  l.u.uMap.value = tex;
  if (l.refl && l.ur) {
    l.refl.scale.set(w * rep, -h, 1);
    l.ur.uMap.value = tex;
  }
  l.ok = true;
}

async function loadPlace(ctx: Ctx, i: number) {
  const id = PLACES[i].id;
  const d = dioramas[i];
  const [sky, far, mid] = await Promise.all([tryTex(ctx, `sky_${id}`), tryTex(ctx, `far_${id}`), tryTex(ctx, `mid_${id}`)]);
  if (sky) {
    sky.wrapS = THREE.MirroredRepeatWrapping;
    sky.needsUpdate = true;
    (d.sky.material as THREE.ShaderMaterial).uniforms.uMap.value = sky;
    d.skyOk = true;
  }
  fitLayer(d.far, far, SPEC[i].far.h, SPEC[i].far.rep);
  fitLayer(d.mid, mid, SPEC[i].mid.h, SPEC[i].mid.rep);
}

async function loadSprites(ctx: Ctx, from: number, to: number) {
  const names = [...new Set(SPRITES.filter((s) => s.x >= from && s.x < to).map((s) => s.tex))];
  const texs = new Map<string, THREE.Texture | null>();
  await Promise.all(names.map(async (n) => texs.set(n, await tryTex(ctx, n))));
  for (const s of SPRITES) {
    if (s.x < from || s.x >= to) continue;
    const tex = texs.get(s.tex);
    if (!tex) continue;
    const img = tex.image as { width: number; height: number };
    const mat = layerMaterial(tex, { sway: s.fg ? 0 : (s.sway ?? 0), blur: s.fg ? 3.2 : 0, sat: s.sat ?? 0.7 });
    const mesh = new THREE.Mesh(unit, mat);
    const w = (s.h * img.width) / img.height;
    mesh.scale.set(s.flip ? -w : w, s.h, 1);
    mesh.position.set(s.x, s.y ?? 0, s.fg ? 2.9 : (s.z ?? -1.5));
    mesh.renderOrder = s.fg ? 20 : -60;
    mesh.frustumCulled = false;
    group.add(mesh);
    sprites.push({ mesh, u: mat.uniforms as LayerUniforms, x: s.x, fg: !!s.fg, lit: !!s.lit });
  }
}

/** place copies of a generated prop along the road */
async function prop(ctx: Ctx, name: string, list: { x: number; z: number; s?: number; ry?: number; y?: number }[], dim = 1) {
  let g: Awaited<ReturnType<Ctx['glb']>>;
  try {
    g = await ctx.glb(`${A}${name}.glb`);
  } catch {
    console.warn(`[path] missing ${name}.glb`);
    return null;
  }
  let src: THREE.Mesh | null = null;
  g.scene.updateWorldMatrix(true, true);
  g.scene.traverse((o) => {
    const me = o as THREE.Mesh;
    if (me.isMesh && !src) src = me;
  });
  if (!src) return null;
  const mesh = src as THREE.Mesh;
  for (const it of list) it.x *= K;
  const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
  mat.envMapIntensity = 0.6;
  mat.metalness = Math.min(mat.metalness, 0.3);
  mat.roughness = Math.max(mat.roughness, 0.55);
  propMats.push({ m: mat, k: dim });
  const im = new THREE.InstancedMesh(mesh.geometry, mat, list.length);
  list.forEach((it, i) => {
    q.setFromAxisAngle(UP, it.ry ?? 0);
    sc.setScalar(it.s ?? 1);
    v.set(it.x, it.y ?? 0, it.z);
    m4.compose(v, q, sc).multiply(mesh.matrixWorld);
    im.setMatrixAt(i, m4);
  });
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false;
  group.add(im);
  return im;
}

const lampXs: number[] = [];
// the first lamp stands one step in, so the title beat is lit by the sky alone
for (let x = LAMP_0 + LAMP_STEP; x < L + LAMP_STEP * 2; x += LAMP_STEP) lampXs.push(x);

async function loadProps(ctx: Ctx) {
  const lamps = await prop(
    ctx,
    'lamp',
    lampXs.map((x, i) => ({ x: x / K, z: LAMP_Z, s: LAMP_H, ry: i * 1.7 })),
  );
  if (lamps && lampFallback) lampFallback.visible = false;
  await Promise.all([
    prop(ctx, 'bicycle', [
      { x: 7.0, z: -1.0, s: 1.8, ry: Math.PI / 2 + 0.3 },
      { x: 15.3, z: -1.15, s: 1.8, ry: -Math.PI / 2 + 0.2 },
    ]),
    prop(ctx, 'lion', [
      { x: 23.6, z: -1.35, s: 1.05, ry: 0.35 },
      { x: 26.4, z: -1.35, s: 1.05, ry: -0.35 },
    ], 0.5),
    prop(ctx, 'bollard', [
      { x: 34.9, z: -1.45, s: 0.62, ry: 0.4 },
      { x: 40.2, z: -1.45, s: 0.62, ry: 2.1 },
      { x: 45.2, z: -1.45, s: 0.62, ry: 1.0 },
      { x: 50.4, z: -1.45, s: 0.62, ry: 3.0 },
    ]),
    // the generated palm is a stylised model: kept small and deep in shadow, as planting between the sprites
    prop(
      ctx,
      'palm',
      [
        { x: 56.6, z: -1.5, s: 2.5, ry: 0.4 },
        { x: 63.3, z: -1.55, s: 2.9, ry: 2.4 },
        { x: 70.7, z: -1.5, s: 2.4, ry: 4.0 },
      ],
      0.3,
    ),
    prop(
      ctx,
      'signpost',
      STOPS.map((s, i) => ({ x: s.x / K + 0.42, z: MARK_Z - 0.28, s: 1.5, ry: Math.PI - 0.25 + (i % 2) * 0.3 })),
    ),
  ]);
}

function buildMarkers() {
  // a slim pole with a lantern in the chapter colour; the lantern is the anchor of the label
  const pg = new THREE.CylinderGeometry(0.018, 0.026, 1, 8);
  pg.translate(0, 0.5, 0);
  poles = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: '#0e1c1d', roughness: 0.45, metalness: 0.7 }), STOPS.length);
  headMat = new THREE.MeshStandardMaterial({ color: '#06201c', emissive: ACCENT, emissiveIntensity: 2.2, roughness: 0.3 });
  heads = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.085, 0), headMat, STOPS.length);
  heads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(STOPS.length * 3).fill(1), 3);
  poles.frustumCulled = heads.frustumCulled = false;
  group.add(poles, heads);

  // points climbing each pole and lifting off the lantern: the stop being written into the record
  const per = 70;
  const n = STOPS.length * per;
  const P = new Float32Array(n * 3);
  const S = new Float32Array(n);
  const I = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = Math.floor(i / per);
    P[i * 3] = STOPS[s].x;
    P[i * 3 + 1] = 0;
    P[i * 3 + 2] = MARK_Z;
    S[i] = Math.random();
    I[i] = s;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));
  g.setAttribute('aMark', new THREE.BufferAttribute(I, 1));
  beacon = new THREE.Points(
    g,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uAct: { value: act }, uPlant: { value: plant }, uCol: { value: ACCENT.clone() } },
      vertexShader: /* glsl */ `
        uniform float uTime, uPx; uniform float uAct[${MAX_MARK}]; uniform float uPlant[${MAX_MARK}];
        attribute float aSeed, aMark; varying float vA;
        void main() {
          int i = int(aMark + 0.5);
          float a = uAct[i], pl = uPlant[i];
          float life = fract(aSeed * 7.31 + uTime * (0.1 + aSeed * 0.14));
          float h = life * (2.6 + a * 2.6);
          float ang = aSeed * 40.0 + uTime * (0.6 + aSeed) + h * 1.4;
          float r = 0.05 + 0.2 * aSeed * smoothstep(2.3, 4.6, h) + 0.34 * (1.0 - smoothstep(0.0, 0.5, h)) * aSeed;
          vec3 p = position + vec3(cos(ang) * r, h * pl, sin(ang) * r);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (0.9 + aSeed * 1.5) * (0.5 + a) * (5.0 / -mv.z);
          vA = pl * (0.12 + a * 0.88) * smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.55, 1.0, life));
        }`,
      fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uCol * smoothstep(0.5, 0.05, d) * vA * 1.5, 1.0); }',
    }),
  );
  beacon.frustumCulled = false;
  beacon.renderOrder = -20;
  group.add(beacon);
}

function buildLamps() {
  // until the generated lamp arrives: a plain post so the light has a source
  const pg = new THREE.CylinderGeometry(0.03, 0.05, LAMP_H, 8);
  pg.translate(0, LAMP_H / 2, 0);
  lampFallback = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: '#0c1617', roughness: 0.5, metalness: 0.6 }), lampXs.length);
  lampXs.forEach((x, i) => lampFallback!.setMatrixAt(i, m4.makeTranslation(x, 0, LAMP_Z)));
  lampFallback.frustumCulled = false;
  group.add(lampFallback);

  const P = new Float32Array(lampXs.length * 3);
  const S = new Float32Array(lampXs.length);
  const Z = new Float32Array(lampXs.length);
  lampXs.forEach((x, i) => {
    P[i * 3] = x;
    P[i * 3 + 1] = LAMP_H * 0.9;
    P[i * 3 + 2] = LAMP_Z + 0.24;
    S[i] = (i * 0.6180339) % 1;
    Z[i] = 230;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(Z, 1));
  lampGlow = new THREE.Points(g, glowMaterial());
  lampGlow.frustumCulled = false;
  lampGlow.renderOrder = -30;
  group.add(lampGlow);
}

function buildMotes(ctx: Ctx) {
  // what hangs in the air changes with the place: mist, falling ginkgo leaves, harbour drizzle, fireflies
  const n = [240, 520, 820][ctx.tier];
  const P = new Float32Array(n * 3);
  const S = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    P[i * 3] = Math.random() * 30;
    P[i * 3 + 1] = Math.random() * 7;
    P[i * 3 + 2] = -9 + Math.random() * 12.5;
    S[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));
  motes = new THREE.Points(
    g,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPx: { value: 1 },
        uCamX: { value: 0 },
        uW: { value: new THREE.Vector4(1, 0, 0, 0) },
        uA: { value: 1 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime, uPx, uCamX; uniform vec4 uW; attribute float aSeed; varying vec3 vC; varying float vA;
        void main() {
          // per place: fall speed, size, blink, colour
          float fall = dot(uW, vec4(0.03, 0.34, 1.9, -0.02));
          float size = dot(uW, vec4(1.5, 2.3, 0.75, 1.9));
          float blink = uW.w;
          vec3 col = vec3(0.55, 0.9, 0.84) * uW.x + vec3(1.0, 0.78, 0.3) * uW.y + vec3(0.62, 0.86, 1.0) * uW.z + vec3(0.78, 1.0, 0.42) * uW.w;
          vec3 p = position;
          p.x = mod(p.x - uCamX * 1.0 + sin(uTime * 0.25 + aSeed * 20.0) * (0.5 + uW.y * 0.9), 30.0) - 15.0 + uCamX;
          p.y = mod(p.y - uTime * fall * (0.6 + aSeed * 0.8), 7.0);
          p.z += sin(uTime * 0.2 + aSeed * 50.0) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * size * (0.6 + aSeed * 1.3) * (5.0 / -mv.z);
          float tw = mix(1.0, pow(0.5 + 0.5 * sin(uTime * (1.2 + aSeed * 2.4) + aSeed * 90.0), 6.0) * 2.6, blink);
          float sparse = mix(1.0, step(0.55, fract(aSeed * 13.7)), max(uW.y, uW.w));
          vA = (0.2 + 0.8 * aSeed) * smoothstep(0.0, 0.6, p.y) * smoothstep(7.0, 5.0, p.y) * tw * sparse;
          vC = col;
        }`,
      fragmentShader: 'uniform float uA; varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC * smoothstep(0.5, 0.0, d) * vA * uA * 0.55, 1.0); }',
    }),
  );
  motes.frustumCulled = false;
  motes.renderOrder = -10;
  group.add(motes);
}

async function init(ctx: Ctx, el: HTMLElement) {
  section = el;
  const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  elHead = $('.p-head');
  elClock = $('.p-clock');
  elTens = $('.p-tens');
  elOnes = $('.p-ones');
  elWhere = Array.from(el.querySelectorAll<HTMLElement>('.p-where span'));
  elStops = Array.from(el.querySelectorAll<HTMLElement>('.p-stop'));
  elTags = Array.from(el.querySelectorAll<HTMLButtonElement>('.p-tag'));
  elRoute = $('.p-route');
  elEnd = $('.p-end');
  elTens.innerHTML = '<b>1</b><b>2</b>';
  elOnes.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<b>${d}</b>`).join('');

  // ---- interaction wiring ----
  elTags.forEach((b, i) => {
    b.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && (hover = i));
    b.addEventListener('pointerleave', () => hover === i && (hover = -1));
    b.addEventListener('focus', () => b.matches(':focus-visible') && (hover = i));
    b.addEventListener('blur', () => hover === i && (hover = -1));
    b.addEventListener('click', () => {
      if (i === openNow && (pinned === i || i === lastActive)) {
        // the minus closes it, and it stays closed until he reaches the next stop
        pinned = -1;
        closed = i;
        hover = -1;
        return;
      }
      pinned = i;
      closed = -1;
      // tapping a marker that is not the current one also walks him to it
      if (i !== lastActive) ctx.goTo('path', pOf(STOPS[i].x - 1.2));
    });
  });
  $('.p-back').addEventListener('click', () => ctx.goTo('systems', 0.02));
  route = makeRoute(elRoute, {
    walk: (p) => ctx.goTo('path', p),
    scrub: (p) => {
      // instant version of ctx.goTo, so the road follows the thumb without a tween in between
      const vh = innerHeight;
      const first = !(section.previousElementSibling as HTMLElement | null)?.classList.contains('chapter');
      const last = !(section.nextElementSibling as HTMLElement | null)?.classList.contains('chapter');
      const span = Math.max(1, last ? section.offsetHeight - vh : section.offsetHeight);
      const w = Math.min(vh * 0.42, span * 0.2);
      const inW = first ? 0 : w;
      const outW = last ? 0 : w;
      const top = section.getBoundingClientRect().top + scrollY;
      window.scrollTo({ top: top + inW + clamp01(p) * (span - inW - outW) + 2, behavior: 'instant' as ScrollBehavior });
    },
  });
  const actQ = new URLSearchParams(location.search).get('act') ?? '';
  if (actQ.startsWith('open-')) shotOpen = Number(actQ.slice(5));
  if (actQ === 'drag') route.hold(true);
  const lk = /look(-?[\d.]+),(-?[\d.]+)/.exec(actQ);
  if (lk) {
    lookX = Number(lk[1]);
    lookY = Number(lk[2]);
  }

  // ---- lights ----
  keyL = new THREE.DirectionalLight('#ffffff', 2);
  rimL = new THREE.DirectionalLight(ACCENT, 3);
  hemi = new THREE.HemisphereLight('#9fe6da', '#041012', 0.5);
  lampL = new THREE.PointLight('#ffb46a', 0, 9, 1.6);
  markL = new THREE.PointLight(ACCENT, 0, 6, 1.8);
  group.add(keyL, keyL.target, rimL, rimL.target, hemi, lampL, markL);

  rift = new Rift(ctx, { color: ROSE, height: 3.6, width: 1.25, light: 3, floor: 0.18 });
  rift.object3D.position.set(L + RIFT_DX, 0, -0.1);
  // facing back along the quay, turned a little toward the camera
  // facing back along the quay, turned a little toward the camera
  rift.object3D.rotation.y = -0.62;
  group.add(rift.object3D);

  // ---- the diorama ----
  unit = new THREE.PlaneGeometry(1, 1);
  unit.translate(0, 0.5, 0);
  skyGeo = new THREE.PlaneGeometry(150, 56);
  skyGeo.translate(0, 28, 0);
  for (let i = 0; i < PLACES.length; i++) {
    const s = SPEC[i];
    const skyMat = skyMaterial(null);
    skyMat.uniforms.uHorizon.value = s.horizon;
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.set(0, 1.2 - s.horizon * 56, -64);
    sky.renderOrder = -100 + i;
    sky.frustumCulled = false;
    sky.visible = false;
    group.add(sky);
    dioramas.push({
      sky,
      skyOk: false,
      far: makeLayer(s.far, -90, ctx.tier > 0),
      mid: makeLayer(s.mid, -80, true),
    });
  }

  const wg = new THREE.PlaneGeometry(190, 66);
  wg.rotateX(-Math.PI / 2);
  wg.translate(0, 0, -33 - 1.8);
  water = new THREE.Mesh(wg, waterMaterial());
  water.position.y = WATER_Y;
  water.renderOrder = -75;
  water.frustumCulled = false;
  group.add(water);

  const rg = new THREE.PlaneGeometry(190, 7);
  rg.rotateX(-Math.PI / 2);
  rg.translate(0, 0, 1.7);
  road = new THREE.Mesh(rg, roadMaterial());
  road.frustumCulled = false;
  group.add(road);
  kerb = new THREE.Mesh(new THREE.BoxGeometry(190, 0.5, 0.16), new THREE.MeshStandardMaterial({ color: '#0b1717', roughness: 0.7, metalness: 0.1 }));
  kerb.position.set(0, -0.17, -1.86);
  kerb.frustumCulled = false;
  group.add(kerb);

  for (const [z, a, drift, order] of [
    [-28, 0.42, 0.05, -85],
    [-9, 0.3, 0.11, -70],
    [-2.6, 0.16, 0.19, -65],
  ]) {
    const mm = mistMaterial();
    mm.uniforms.uSeed.value = z * 3.1;
    const mesh = new THREE.Mesh(unit, mm);
    const d = 9 - z;
    mesh.scale.set(d * 1.9, d * 0.34, 1);
    mesh.position.set(0, WATER_Y - 0.1, z);
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    group.add(mesh);
    mists.push({ mesh, z, a, drift });
  }

  buildMarkers();
  buildLamps();
  buildMotes(ctx);

  // ---- assets: the first place before the first frame, the rest behind it ----
  const roadTex = tryTex(ctx, 'tex_road', { repeat: true });
  const first = [loadPlace(ctx, 0), loadSprites(ctx, -100, PLACES[0].b), roadTex];
  const media = async () => {
    const wu = (water.material as THREE.ShaderMaterial).uniforms;
    if (ctx.tier === 0) {
      const [c, w] = await Promise.all([tryStill(ctx, 'clouds'), tryStill(ctx, 'water')]);
      for (const d of dioramas) (d.sky.material as THREE.ShaderMaterial).uniforms.uClouds.value = c;
      wu.uRip.value = w;
      wu.uHasRip.value = w ? 1 : 0;
      return;
    }
    const [c, w] = await Promise.all([ctx.video(`${A}clouds.mp4`, { poster: `${A}clouds.jpg` }), ctx.video(`${A}water.mp4`, { poster: `${A}water.jpg` })]);
    for (const t of [c.tex, w.tex]) {
      t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
    }
    cloudsVid = c.el;
    waterVid = w.el;
    for (const d of dioramas) (d.sky.material as THREE.ShaderMaterial).uniforms.uClouds.value = c.tex;
    wu.uRip.value = w.tex;
    wu.uHasRip.value = 1;
    if (group.visible) play(true);
  };
  const rest = async () => {
    await Promise.all([loadPlace(ctx, 1), loadSprites(ctx, PLACES[1].a, PLACES[1].b), loadProps(ctx), media()]);
    await Promise.all([loadPlace(ctx, 2), loadSprites(ctx, PLACES[2].a, PLACES[2].b)]);
    await Promise.all([loadPlace(ctx, 3), loadSprites(ctx, PLACES[3].a, 1000)]);
  };
  await Promise.all(first);
  (road.material as THREE.ShaderMaterial).uniforms.uMap.value = await roadTex;
  if (ctx.shot) {
    // capture mode: whatever is in frame at the pinned progress must be there in the first second
    const q = new URLSearchParams(location.search);
    const sx = xOf(Number(q.get('p') ?? 0.5));
    placeWeights(sx, weights);
    const need: Promise<unknown>[] = [loadProps(ctx), media()];
    for (let i = 1; i < PLACES.length; i++) {
      if (weights[i] > 0 || Math.abs(sx - PLACES[i].a) < 9 || Math.abs(sx - PLACES[i].b) < 9) need.push(loadPlace(ctx, i), loadSprites(ctx, PLACES[i].a, i === PLACES.length - 1 ? 1000 : PLACES[i].b));
    }
    await Promise.all(need).catch((e) => console.warn('[path]', e));
  } else void rest().catch((e) => console.warn('[path]', e));
}

async function tryStill(ctx: Ctx, name: string) {
  try {
    const t = await ctx.tex(`${A}${name}.jpg`, { repeat: true });
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.needsUpdate = true;
    return t;
  } catch {
    return null;
  }
}

function play(on: boolean) {
  for (const el of [cloudsVid, waterVid]) {
    if (!el) continue;
    if (on) void el.play().catch(() => {});
    else el.pause();
  }
}

/* ------------------------------------------------------------------ frame */

const backOut = (t: number) => {
  t = clamp01(t);
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

function update(f: Frame, ctx: Ctx) {
  const { p, io, t, dt } = f;
  const hero = ctx.hero;
  const narrow = ctx.size.narrow;
  const x = xOf(p);
  const title = 1 - smooth(seg(p, 0.03, P0 + 0.015));
  const arrive = smooth(seg(p, P1 - 0.01, P1 + 0.035));
  placeWeights(x, weights);
  const mistK = between(x);
  lookAt(x);

  // ---- hero ----
  // after the arrival he turns and walks on along the quay, into the rift
  const hx = x + exitWalk(p, OUT0, RIFT_DX);
  hero.root.position.set(hx, 0, 0);
  hero.root.rotation.y = mix(mix(mix(Math.PI / 2, 0.5, title), 0.45, arrive), Math.PI / 2, smooth(seg(p, OUT0, OUT0 + 0.015)));
  hero.walkTo(hx);
  hero.form = 1 - io;
  hero.scatter = 1 - io;
  hero.tint.copy(ACCENT);
  hero.tintMix = 0.7;
  hero.push = 1;
  hero.shadow = 0.85 * io;

  // ---- camera: tracks beside him; the shot changes with the place; the pointer leans it ----
  const s = shotAt(narrow ? TALL : WIDE, x);
  let dist = s[1];
  let camY = s[2];
  let aimY = s[3];
  let off = s[4];
  let lead = s[5];
  // title beat: three-quarter from the front, him on the right of the headline
  const tW = narrow ? 0 : 1;
  dist = mix(dist, narrow ? 8.4 : 6.6, title);
  camY = mix(camY, 1.45, title);
  aimY = mix(aimY, narrow ? 1.5 : 1.12, title);
  off = mix(off, 2.4, title);
  lead = mix(lead, -1.9 * tW, title);
  // arrival: he stops and the camera comes round to face him, the city behind
  dist = mix(dist, narrow ? 8.6 : 7.0, arrive);
  camY = mix(camY, 1.5, arrive);
  aimY = mix(aimY, narrow ? 0.3 : 0.62, arrive);
  off = mix(off, 1.6, arrive);
  lead = mix(lead, -0.75 * tW, arrive);

  // without a pointer (touch, or nothing moved yet) the view breathes on its own
  const idle = ctx.pointer.seen || ctx.still ? 0 : 1;
  sway += (idle - sway) * damp(1.5, dt);
  const lx = ctx.shot ? lookX : ctx.still ? 0 : ctx.pointer.x * (1 - sway) + Math.sin(t * 0.23) * 0.35 * sway;
  const ly = ctx.shot ? lookY : ctx.still ? 0 : ctx.pointer.y * (1 - sway) + Math.sin(t * 0.17 + 1) * 0.2 * sway;
  const aimX = x + lead;
  camPos.set(aimX + off + lx * (narrow ? 0.7 : 1.25), camY + ly * 0.45, dist);
  camAim.set(aimX - lx * 0.35, aimY - ly * 0.12, 0);
  // the exit: round behind his shoulder, the rift ahead in the middle of the frame
  const ex = smooth(seg(p, EXIT.cam[0] - 0.01, EXIT.cam[1] + 0.005));
  if (ex > 0) {
    // stay on this side of the quay (the city stays behind), just slide over to centre the rift
    camPos.lerp(v.set(L + RIFT_DX - (narrow ? 0.9 : 1.1) + lx * 0.4, (narrow ? 1.8 : 1.65) + ly * 0.2, narrow ? 8.6 : 6.8), ex);
    // on a phone the closing line sits under him: the view only tilts up to the rift (which lowers
    // him in the frame) once that line has faded, so his feet never walk across it
    const exY = narrow ? smooth(seg(p, EXIT.copy[1] - 0.012, EXIT.cam[1] + 0.005)) : ex;
    const ay = camAim.y;
    camAim.lerp(v.set(L + RIFT_DX - (narrow ? 0.5 : 0.7), narrow ? 1.25 : 1.5, -0.1), ex);
    camAim.y = mix(ay, narrow ? 1.25 : 1.5, exY);
  }
  // travelling fast (a hard scroll, or the timeline in hand) opens the lens a little
  const hurry = Math.max(route.dragging ? 0.7 : 0, smooth(seg(Math.abs(f.vel), 0.12, 0.7)));
  warp += (hurry - warp) * damp(hurry > warp ? 6 : 2.2, dt);
  ctx.camera.fov = (narrow ? 44 : 35) + (ctx.still ? 0 : warp * 5);
  ctx.camera.position.copy(camPos);
  ctx.camera.lookAt(camAim);
  const camX = camPos.x;
  const px = ctx.size.dpr * (ctx.size.h / 900);

  // ---- the rift: a far hair line down the quay as he arrives, splitting as he walks to it ----
  rift.update(exitOpen(p), t, ctx, exitLine(p));
  rift.cross(hero);

  // ---- light ----
  keyL.color.copy(now.key);
  keyL.intensity = now.keyI;
  keyL.position.set(x - 3.5, 2.8, 7);
  keyL.target.position.set(x, 1, 0);
  rimL.intensity = now.rimI * 1.15;
  rimL.position.set(x + 3.5, 3.2, -6);
  rimL.target.position.set(x, 1.1, 0);
  hemi.intensity = 0.2 + (1 - now.night) * 0.22;
  hemi.color.copy(now.haze).lerp(ACCENT, 0.25).multiplyScalar(1.6);
  // the nearest street lamp throws warm light on him as he passes under it
  const li = Math.max(1, Math.round((x - LAMP_0) / LAMP_STEP));
  const lxp = LAMP_0 + li * LAMP_STEP;
  lampL.position.set(lxp, LAMP_H * 0.88, LAMP_Z + 0.35);
  lampL.intensity = now.night * 2.4 * (0.92 + 0.08 * Math.sin(t * 3.1 + li * 4));

  // ---- milestones ----
  const active = x > 0.3 ? stopAt(x) : -1;
  if (active !== lastActive) {
    lastActive = active;
    pinned = -1;
    closed = -1;
  }
  let open = ctx.shot && shotOpen >= 0 ? shotOpen : hover >= 0 ? hover : pinned >= 0 ? pinned : title > 0.5 || arrive > 0.6 ? -1 : active;
  if (open === closed) open = -1;
  openNow = open;
  let nearest = 0;
  for (let i = 0; i < STOPS.length; i++) {
    const st = STOPS[i];
    // planted as he comes up to it, and it stays planted behind him
    const pl = clamp01((x - (st.x - 4.4)) / 2.0);
    plant[i] = pl;
    const want = i === open ? 1 : i === active ? 0.55 : 0.16;
    act[i] += (want - act[i]) * damp(5, dt);
    const grow = backOut(pl);
    const h = 2.42 * grow;
    m4.makeScale(1, Math.max(0.001, h), 1).setPosition(st.x, 0, MARK_Z);
    poles.setMatrixAt(i, m4);
    const bob = Math.sin(t * 1.3 + i * 2.1) * 0.03;
    q.setFromAxisAngle(UP, t * (0.5 + act[i] * 1.6) + i);
    sc.setScalar(Math.max(0.001, smooth(seg(pl, 0.6, 1)) * (0.85 + act[i] * 0.6)));
    v.set(st.x, h + 0.16 + bob, MARK_Z);
    m4.compose(v, q, sc);
    heads.setMatrixAt(i, m4);
    const e = 0.35 + act[i] * 1.4;
    heads.instanceColor!.setXYZ(i, e, e, e);
    if (Math.abs(st.x - x) < Math.abs(STOPS[nearest].x - x)) nearest = i;
  }
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  heads.instanceColor!.needsUpdate = true;
  markL.position.set(STOPS[nearest].x, 2.3, MARK_Z + 0.5);
  markL.intensity = plant[nearest] * (0.4 + act[nearest] * 1.8);
  const bu = (beacon.material as THREE.ShaderMaterial).uniforms;
  bu.uTime.value = t;
  bu.uPx.value = px;

  // ---- sky, far, far bank ----
  let firstSky = true;
  for (let i = 0; i < dioramas.length; i++) {
    const d = dioramas[i];
    const w = weights[i];
    const on = w > 0.003;
    d.sky.visible = on && d.skyOk;
    if (d.sky.visible) {
      const su = (d.sky.material as THREE.ShaderMaterial).uniforms;
      su.uA.value = firstSky ? 1 : w;
      firstSky = false;
      su.uGain.value = now.gain;
      su.uTime.value = t;
      su.uShift.value = camX * 0.0016;
      su.uStars.value = now.stars;
      su.uCloudAmt.value = now.cloud;
      su.uCloudCol.value.copy(now.haze).lerp(ACCENT, 0.35).multiplyScalar(2.2);
      su.uGlow.value.copy(now.glow).multiplyScalar(0.55 + arrive * 0.9);
      d.sky.position.x = camX;
    }
    for (const l of [d.far, d.mid]) {
      const far = l === d.far;
      const vis = on && l.ok;
      l.mesh.visible = vis;
      if (l.refl) l.refl.visible = vis;
      if (!vis) continue;
      const lxw = l.cx + (camX - l.cx) * l.k;
      l.mesh.position.x = lxw;
      const u = l.u;
      u.uA.value = far ? w : smooth(w);
      u.uTint.value.copy(now.tint).multiplyScalar(far ? 0.92 : 1);
      u.uHaze.value.copy(now.haze);
      u.uHazeAmt.value = Math.min(0.95, (far ? now.hazeFar : now.hazeMid) + mistK * (far ? 0.4 : 0.34));
      u.uLights.value = now.night * (far ? 1.7 : 2.6);
      u.uTime.value = t;
      if (l.refl && l.ur) {
        l.refl.position.x = lxw;
        const r = l.ur;
        r.uA.value = u.uA.value;
        r.uTint.value.copy(u.uTint.value);
        r.uHaze.value.copy(now.haze);
        r.uHazeAmt.value = Math.min(0.95, u.uHazeAmt.value + 0.12);
        r.uLights.value = u.uLights.value * 1.2;
        r.uTime.value = t;
      }
    }
  }

  // ---- water, road, mist ----
  const wu = (water.material as THREE.ShaderMaterial).uniforms;
  water.position.x = camX;
  wu.uTime.value = t;
  wu.uDeep.value.copy(now.deep);
  wu.uSky.value.copy(now.wsky).lerp(now.haze, mistK * 0.6);
  wu.uSpark.value.copy(now.wsky).lerp(ACCENT, 0.3).multiplyScalar(1.7);
  wu.uCam.value.copy(camPos);
  wu.uLamp.value = now.night;
  const ru = (road.material as THREE.ShaderMaterial).uniforms;
  road.position.x = camX;
  kerb.position.x = camX;
  ru.uTime.value = t;
  ru.uTint.value.copy(now.road);
  ru.uFog.value.copy(now.bg).lerp(now.haze, 0.25);
  ru.uSheen.value.copy(now.wsky);
  ru.uLamp.value = now.night * 0.9;
  ru.uCam.value.copy(camPos);
  ru.uHero.value.set(x, 0, 0);
  for (let i = 0; i < STOPS.length; i++) {
    ru.uMarkX.value[i] = STOPS[i].x;
    ru.uMarkA.value[i] = plant[i] * (0.3 + act[i] * 0.7);
  }
  for (const m of mists) {
    const mu = (m.mesh.material as THREE.ShaderMaterial).uniforms;
    m.mesh.position.x = camX;
    mu.uTime.value = t;
    mu.uShift.value = camX * m.drift;
    mu.uCol.value.copy(now.haze).multiplyScalar(1.5);
    mu.uA.value = Math.min(1, m.a + mistK * 0.75 + (1 - now.night) * 0.1);
  }

  // ---- quay cut-outs ----
  for (const sp of sprites) {
    const near = Math.abs(sp.x - camX) < 26;
    sp.mesh.visible = near;
    if (!near) continue;
    const u = sp.u;
    u.uTime.value = t;
    if (sp.fg) {
      // close to the lens: dark, soft, sliding past quickly
      u.uTint.value.copy(now.tint).multiplyScalar(0.16);
      u.uHaze.value.copy(now.bg);
      u.uHazeAmt.value = 0.35;
      // and it thins out as it crosses him, so he is never hidden
      u.uA.value = (1 - title) * (1 - arrive) * (narrow ? 0.0 : 0.96) * (0.12 + 0.88 * smooth(seg(Math.abs(sp.x - x * 0.72 - camX * 0.28), 0.5, 2.2)));
    } else {
      u.uTint.value.copy(now.tint).multiplyScalar(0.8);
      u.uHaze.value.copy(now.haze);
      u.uHazeAmt.value = 0.05 + mistK * 0.2;
      u.uLights.value = sp.lit ? now.night * 2.4 : 0;
    }
  }
  for (const pm of propMats) pm.m.color.copy(now.tint).multiplyScalar(pm.k);

  const gu = (lampGlow.material as THREE.ShaderMaterial).uniforms;
  gu.uTime.value = t;
  gu.uPx.value = px;
  gu.uA.value = now.night * 1.9;
  const mo = (motes.material as THREE.ShaderMaterial).uniforms;
  mo.uTime.value = ctx.still ? 0 : t;
  mo.uPx.value = px;
  mo.uCamX.value = camX;
  mo.uW.value.set(weights[0], weights[1], weights[2], weights[3]);

  ctx.bg.copy(now.bg);
  ctx.fog.color.copy(now.bg).lerp(now.haze, 0.5);
  ctx.fog.density = 0.012 + mistK * 0.02;
  ctx.post.bloom = 0.72 + warp * 0.12;
  ctx.post.threshold = 1.1;
  ctx.post.vignette = 0.55;
  ctx.post.exposure = 1.05;
  ctx.scene.environmentIntensity = 0.5 + (1 - now.night) * 0.25;

  // ---- overlay ----
  show(elHead, title * (1 - smooth(seg(p, 0.03, 0.055))) + (title > 0.999 ? 0 : 0));
  const clock = smooth(seg(p, 0.045, 0.075));
  show(elClock, clock * exitCopy(p));
  const yr = yearOf(x) - 2010;
  const whole = Math.min(15, Math.floor(yr + 1e-6));
  const roll = whole >= 15 ? 0 : smooth((yr - whole - 0.82) / 0.18);
  const ones = (whole % 10) + roll;
  const tens = Math.floor(whole / 10) + (whole % 10 === 9 ? roll : 0);
  css(elOnes, 'transform', `translate3d(0, ${(-ones * 100) / 11}%, 0)`);
  css(elTens, 'transform', `translate3d(0, ${(-tens * 100) / 2}%, 0)`);
  for (let i = 0; i < elWhere.length; i++) {
    css(elWhere[i], 'opacity', smooth(seg(weights[i], 0.35, 0.65)));
    css(elWhere[i], 'transform', `translate3d(0, ${((1 - smooth(seg(weights[i], 0.35, 0.65))) * (x > SPEC[i].cx ? -0.5 : 0.5)).toFixed(3)}em, 0)`);
  }

  const W = ctx.size.w;
  const H = ctx.size.h;
  const cardsLeft = 1 - smooth(seg(p, P1 - 0.025, P1 + 0.004));
  for (let i = 0; i < elStops.length; i++) {
    const st = STOPS[i];
    const el = elStops[i];
    const isOpen = i === open;
    if (cardOpen[i] !== (isOpen ? 1 : 0)) {
      cardOpen[i] = isOpen ? 1 : 0;
      flag(el, 'open', isOpen);
      elTags[i].setAttribute('aria-expanded', String(isOpen));
      cardW[i] = 0;
    }
    flag(el, 'now', i === active);
    flag(el, 'past', st.b <= x);
    v.set(st.x, 2.42 * Math.min(1, plant[i] * 1.2) + 0.2, MARK_Z);
    ctx.project(v, pr);
    const inView = pr.z < 1 && pr.x > -60 && pr.x < W + 60;
    // a docked card (phone) no longer depends on its marker being in frame
    const want = narrow && isOpen ? clock * (1 - arrive) : inView ? smooth(seg(plant[i], 0.55, 1)) * clock * (1 - arrive) : 0;
    cardSeen[i] += (want - cardSeen[i]) * damp(12, dt);
    // on arrival the card is gone (by scroll, not by a lagging fade) before the closing line comes in
    const a = Math.min(ctx.shot ? want : cardSeen[i], cardsLeft);
    show(el, a);
    if (a < 0.01) continue;
    if (!cardW[i]) cardW[i] = el.offsetWidth;
    // keep the card inside the frame; the stem still points at the lantern
    const pad = narrow ? 12 : 20;
    const dock = narrow && isOpen;
    flag(el, 'dock', dock);
    if (dock) {
      // on a phone the open card leaves its marker and sits above the route panel, clear of the figure
      css(el, 'transform', `translate3d(${pad}px, ${(H - routeH - 14).toFixed(1)}px, 0) translateY(-100%)`);
    } else {
      // on desktop the year counter owns the top-left corner: cards stop at its edge and let go of a
      // marker that has gone too far behind it
      const minL = narrow ? pad : pr.y < clockB + 110 ? clockR + 28 : pad;
      const left = Math.min(Math.max(pr.x - 22, minL), Math.max(pad, W - cardW[i] - pad));
      const top = Math.max(narrow ? 150 : 120, Math.min(pr.y, H - 40));
      const gone = smooth(seg(left - pr.x, 30, 150));
      if (gone > 0.001) show(el, a * (1 - gone));
      css(el, 'transform', `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0) translateY(-100%)`);
      css(el, '--ax', `${Math.max(14, pr.x - left).toFixed(1)}px`);
    }
    css(el, 'zIndex', isOpen ? '3' : i === active ? '2' : '1');
  }

  show(elRoute, smooth(seg(p, 0.012, 0.04)) * exitCopy(p));
  route.update(x, routeAt(x), yearOf(x), Math.max(0, active), dt);
  show(elEnd, smooth(seg(p, P1 + 0.008, P1 + 0.03)) * exitCopy(p));
}

function resize() {
  route?.resize();
  if (elClock) {
    const r = elClock.getBoundingClientRect();
    clockR = r.right;
    clockB = r.bottom;
  }
  routeH = elRoute ? elRoute.offsetHeight + parseFloat(getComputedStyle(elRoute).bottom || '0') : 0;
  cardW.fill(0);
}

const chapter: Chapter = {
  id: 'path',
  group,
  init,
  update,
  resize,
  enter: () => play(true),
  leave: () => play(false),
};
export default chapter;

// kept for the route module's spacing maths and for readers: half-width of a place hand-over
export { BLEND };
