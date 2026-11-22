import * as THREE from 'three';
import type { Chapter, Ctx, Frame } from '../../world/types';
import { mix, seg, show, smooth } from '../../world/util';
import { createBench } from './bench';
import { createMarket } from './market';
import { AMBER, SODIUM, TUNGSTEN, beam, glow, type Station } from './shared';
import { createStudio } from './studio';
import { EXIT, Rift, exitCopy, exitLine, exitOpen, exitWalk } from '../../world/Rift';

/**
 * Scale. Three earlier bodies of work, each a small lit set on one dark street: a photo studio
 * (Trustana), a night market of storefronts (Shopee) and a labelling bench (Tencent). The hero walks
 * from one to the next; every set is playable. Amber, tungsten and sodium light on near-black.
 */

const group = new THREE.Group();
const X_MARKET = 8.5;
const X_BENCH = 20.5;

// the beats along p
const STUDIO: [number, number] = [0, 0.285];
const WALK1: [number, number] = [0.285, 0.395];
const MARKET: [number, number] = [0.375, 0.625];
const WALK2: [number, number] = [0.615, 0.735];
const BENCH: [number, number] = [0.72, 0.9];
// then he walks off the bench into the rift to the next chapter
const OUT: [number, number] = [0.9, 1];
const TEAL = new THREE.Color('#2fe0c2');
const BG = new THREE.Color('#070503');
const FOG = new THREE.Color('#0a0603');
const LAMP_I = [26, 30, 14];
const LAMP_ANGLE = [0.5, 1.0, 0.7];
// beside, not under, the last street lamp (x 28), so its head never hangs over the rift
const RIFT = new THREE.Vector3(X_BENCH + 6.0, 0, -1.6);
/** from the bench stop straight through the rift */
const OUT_LEN = Math.hypot(RIFT.x - (X_BENCH + 2.0), RIFT.z + 1.0);
const OUT_TO = new THREE.Vector3(X_BENCH + 2.0, 0, -1.0).add(new THREE.Vector3(RIFT.x - (X_BENCH + 2.0), 0, RIFT.z + 1.0).multiplyScalar(1.3));

// where the hero stands in each world (x, z) and which way he faces
const STOPS = [
  { x: -1.2, z: 1.0, face: 1.95 },
  { x: X_MARKET - 0.7, z: 3.85, face: 2.5 },
  { x: X_BENCH + 2.0, z: -1.0, face: -0.45 },
];

interface Shot {
  pos: [number, number, number];
  aim: [number, number, number];
  fov: number;
}
// camera per world: [wide, narrow]
const SHOTS: [Shot, Shot][] = [
  [
    { pos: [0.1, 1.62, 6.4], aim: [-0.42, 1.5, 0], fov: 35 },
    { pos: [-0.2, 1.5, 8.4], aim: [-0.2, 0.05, 0], fov: 40 },
  ],
  [
    { pos: [X_MARKET - 1.1, 3.3, 9.8], aim: [X_MARKET + 0.5, 1.05, -1.2], fov: 35 },
    { pos: [X_MARKET + 0.1, 2.7, 13.8], aim: [X_MARKET + 0.1, 0.95, 0], fov: 44 },
  ],
  [
    { pos: [X_BENCH + 0.85, 1.9, 8.3], aim: [X_BENCH + 1.0, 1.82, 0], fov: 35 },
    { pos: [X_BENCH + 0.9, 1.75, 8.8], aim: [X_BENCH + 0.9, 1.0, 0], fov: 40 },
  ],
];

let stations: Station[] = [];
let floor: THREE.Mesh;
let dust: THREE.Points;
let key: THREE.DirectionalLight;
let rim: THREE.DirectionalLight;
let lamp: THREE.SpotLight;
let warm: THREE.PointLight;
let intro: HTMLElement | null = null;
let rift: Rift;
const halos: THREE.Mesh[] = [];
const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const POSTS = [-5.2, 3.9, 16.4, 28];
const POST_Z = -2.6;
const LAMPS = [new THREE.Vector3(-1.9, 2.15, 0.45), new THREE.Vector3(X_MARKET + 0.5, 4.2, 2.5), new THREE.Vector3(X_BENCH + 0.9, 3.2, 0.9)];
const LAMP_AIM = [new THREE.Vector3(0.2, 1.0, -0.2), new THREE.Vector3(X_MARKET + 1, 0.8, -1.5), new THREE.Vector3(X_BENCH + 0.9, 0.9, 0.2)];

function init(ctx: Ctx, el: HTMLElement) {
  intro = el.querySelector<HTMLElement>('.s-intro');

  /* light: a warm key that travels with the hero, an amber rim, one tungsten lamp that belongs to the set he is in */
  key = new THREE.DirectionalLight('#ffe2bd', 2.2);
  rim = new THREE.DirectionalLight(AMBER, 3.2);
  lamp = new THREE.SpotLight(TUNGSTEN, 60, 14, 0.62, 0.7, 1.6);
  warm = new THREE.PointLight(SODIUM, 12, 12, 1.8);
  const hemi = new THREE.HemisphereLight('#ffcf9a', '#0a0705', 0.32);
  group.add(key, key.target, rim, rim.target, lamp, lamp.target, warm, hemi);

  /* the street: dark, a little wet, pools of sodium light where the sets stand */
  const fg = new THREE.PlaneGeometry(120, 60);
  fg.rotateX(-Math.PI / 2);
  floor = new THREE.Mesh(
    fg,
    new THREE.ShaderMaterial({
      uniforms: {
        uHero: { value: new THREE.Vector3() },
        uPool: { value: [new THREE.Vector4(0, 0, 3.2, 0), new THREE.Vector4(X_MARKET + 1, -1.2, 6.5, 0), new THREE.Vector4(X_BENCH + 1, 0.2, 4.2, 0)] },
        uPost: { value: POSTS.map((x) => new THREE.Vector3(x, POST_Z + 1.5, 0)) },
        uCol: { value: SODIUM.clone() },
        uT: { value: 0 },
        uA: { value: 1 },
      },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */ `
        uniform vec3 uHero, uCol; uniform vec4 uPool[3]; uniform vec3 uPost[4]; uniform float uT, uA; varying vec3 vW;
        float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
        float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          vec2 p = vW.xz;
          float n = noise(p * 1.7) * 0.6 + noise(p * 6.0) * 0.3 + noise(p * 23.0) * 0.1;
          float wet = smoothstep(0.42, 0.7, noise(p * 0.55 + 3.0));
          float light = 0.0;
          for (int i = 0; i < 3; i++) {
            vec2 d = p - uPool[i].xy;
            light += exp(-dot(d, d) / (uPool[i].z * uPool[i].z)) * uPool[i].w;
          }
          // paving joints
          vec2 g = abs(fract(p * vec2(0.5, 0.9) + vec2(floor(p.y * 0.9) * 0.5, 0.0)) - 0.5);
          float joint = smoothstep(0.485, 0.5, max(g.x, g.y));
          vec3 base = vec3(0.022, 0.017, 0.013) * (0.6 + n * 0.8) * (1.0 - joint * 0.5);
          for (int i = 0; i < 4; i++) {
            vec2 d = p - uPost[i].xy;
            light += exp(-dot(d, d) / 3.2) * 0.8;
          }
          vec3 col = base * (0.1 + light * 2.4) * mix(vec3(1.0), uCol * 1.6, 0.75);
          // wet patches pick up the lamps as a soft sheen
          col += uCol * wet * light * (0.06 + 0.05 * n);
          // he carries a little light with him
          vec2 dh = p - uHero.xz;
          col += uCol * exp(-dot(dh, dh) * 0.35) * 0.03 * (0.5 + n);
          float far = exp(-pow(length(p - cameraPosition.xz) * 0.055, 2.0));
          gl_FragColor = vec4(col * far * uA, 1.0);
        }`,
    }),
  );
  floor.position.set(12, 0, -4);
  group.add(floor);

  /* sodium street lamps in the gaps between the sets */
  const iron = new THREE.MeshStandardMaterial({ color: '#17120e', roughness: 0.5, metalness: 0.8 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.07, 4.6, 10), iron, POSTS.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 1.5), iron, POSTS.length);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.05, 0.5), new THREE.MeshBasicMaterial({ color: SODIUM.clone().multiplyScalar(3.2) }), POSTS.length);
  const mm = new THREE.Matrix4();
  POSTS.forEach((px, i) => {
    poles.setMatrixAt(i, mm.makeTranslation(px, 2.3, POST_Z));
    arms.setMatrixAt(i, mm.makeTranslation(px, 4.55, POST_Z + 0.72));
    heads.setMatrixAt(i, mm.makeTranslation(px, 4.5, POST_Z + 1.35));
    const cone = beam(SODIUM, 4.5, 0.12, 1.9);
    cone.position.set(px, 4.5, POST_Z + 1.35);
    (cone.material as THREE.ShaderMaterial).uniforms.uA.value = 0.1;
    const halo = glow(SODIUM, 1.5, 0.9);
    halo.position.set(px, 4.46, POST_Z + 1.36);
    halos.push(halo);
    group.add(cone, halo);
  });
  group.add(poles, arms, heads);

  /* dust in the lamp light, the whole length of the street */
  const n = [500, 1100, 1900][ctx.tier];
  const P = new Float32Array(n * 3);
  const S = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    P[i * 3] = -8 + Math.random() * 44;
    P[i * 3 + 1] = Math.random() * 5;
    P[i * 3 + 2] = -7 + Math.random() * 12;
    S[i] = Math.random();
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(P, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));
  dust = new THREE.Points(
    dg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uA: { value: 1 }, uS: { value: 1 }, uCol: { value: TUNGSTEN.clone() }, uL: { value: LAMPS.map((v) => v.clone()) } },
      vertexShader: /* glsl */ `
        uniform float uT, uS; uniform vec3 uL[3]; attribute float aSeed; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uT * (0.02 + aSeed * 0.035), 5.0);
          p.x += sin(uT * 0.21 + aSeed * 40.0) * 0.3;
          p.z += cos(uT * 0.17 + aSeed * 23.0) * 0.3;
          float lit = 0.0;
          for (int i = 0; i < 3; i++) { vec3 d = p - uL[i]; lit += exp(-dot(d, d) * 0.09); }
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * (1.0 + aSeed * 2.4) * (5.0 / -mv.z);
          vA = (0.05 + lit * 0.5) * (0.4 + 0.6 * aSeed) * smoothstep(0.6, 2.5, -mv.z);
        }`,
      fragmentShader: 'uniform vec3 uCol; uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * uA; gl_FragColor = vec4(uCol * a, 1.0); }',
    }),
  );
  dust.frustumCulled = false;
  group.add(dust);

  /* the three worlds */
  const toP = (r: [number, number]) => (local: number) => mix(r[0], r[1], local);
  const studio = createStudio(ctx, el, toP(STUDIO));
  const market = createMarket(ctx, el);
  market.group.position.x = X_MARKET;
  const bench = createBench(ctx, el);
  bench.group.position.x = X_BENCH;
  stations = [studio, market, bench];
  group.add(studio.group, market.group, bench.group);

  // the way on: behind the bench, a rift of the next chapter's light
  rift = new Rift(ctx, { color: TEAL, height: 3.5, width: 1.2, light: 10, floor: 0.8 });
  rift.object3D.position.copy(RIFT);
  // facing the way he comes from the bench
  rift.object3D.rotation.y = Math.atan2(-(RIFT.x - (X_BENCH + 2.0)), -(RIFT.z + 1.0));
  group.add(rift.object3D);

  // capture hooks: ?act=pick-2 | flip-110 | label-5 | box  (several joined with commas)
  const act = new URLSearchParams(location.search).get('act');
  if (act)
    for (const a of act.split(',')) {
      const [name, arg = ''] = a.split('-');
      stations.forEach((s) => s.act?.(name, arg));
    }
}

function update(f: Frame, ctx: Ctx) {
  const { p, t, io } = f;
  const hero = ctx.hero;
  const narrow = ctx.size.narrow ? 1 : 0;

  /* ---- hero ---- */
  const e1 = smooth(seg(p, WALK1[0], WALK1[1]));
  const e2 = smooth(seg(p, WALK2[0], WALK2[1]));
  // reaches the rift's plane (1/1.3 of the way to OUT_TO) at the shared crossing moment
  const e3 = exitWalk(p, OUT[0], OUT_LEN) / (OUT_LEN * 1.3);
  const x = STOPS[0].x + (STOPS[1].x - STOPS[0].x) * e1 + (STOPS[2].x - STOPS[1].x) * e2 + (OUT_TO.x - STOPS[2].x) * e3;
  const z = STOPS[0].z + (STOPS[1].z - STOPS[0].z) * e1 + (STOPS[2].z - STOPS[1].z) * e2 + (OUT_TO.z - STOPS[2].z) * e3;
  hero.root.position.set(x, 0, z);
  const bump = (e: number) => smooth(seg(e, 0, 0.12)) * (1 - smooth(seg(e, 0.86, 1)));
  const w1 = bump(e1);
  const w2 = bump(e2);
  const stand = e2 > 0.5 ? STOPS[2].face : e1 > 0.5 ? STOPS[1].face : STOPS[0].face;
  hero.root.rotation.y = mix(stand, Math.PI / 2, Math.max(w1, w2));
  // turning off the bench toward the rift
  const outYaw = Math.atan2(OUT_TO.x - STOPS[2].x, OUT_TO.z - STOPS[2].z);
  hero.root.rotation.y = mix(hero.root.rotation.y, outYaw, smooth(seg(p, OUT[0] - 0.012, OUT[0] + 0.012)));
  hero.walkTo(x + (Math.hypot(OUT_TO.x - STOPS[2].x, OUT_TO.z - STOPS[2].z) - (OUT_TO.x - STOPS[2].x)) * e3);
  hero.shadow = 0.75;
  hero.tint.copy(AMBER);
  hero.tintMix = 0.8;
  hero.glow = 1.15;
  hero.push = 0.6;
  hero.form = Math.max(0, 1 - io);
  hero.scatter = Math.max(0, 1 - io);
  if (ctx.size.narrow) hero.root.scale.setScalar(1);

  /* ---- camera: one shot per world, a tracking move between them ---- */
  const A0 = SHOTS[0][narrow];
  const A1 = SHOTS[1][narrow];
  const A2 = SHOTS[2][narrow];
  const c1 = smooth(seg(p, WALK1[0] - 0.01, WALK1[1] + 0.01));
  const c2 = smooth(seg(p, WALK2[0] - 0.01, WALK2[1] + 0.01));
  camPos.fromArray(A0.pos).lerp(va.fromArray(A1.pos), c1).lerp(va.fromArray(A2.pos), c2);
  camAim.fromArray(A0.aim).lerp(vb.fromArray(A1.aim), c1).lerp(vb.fromArray(A2.aim), c2);
  // on the walks the camera drops to the hero's shoulder and lets the sets slide past
  const tr = Math.max(Math.sin(c1 * Math.PI), Math.sin(c2 * Math.PI));
  const fw = Math.pow(tr, 0.6);
  if (narrow) {
    camPos.lerp(va.set(x + 0.25, 1.45, z + 7.4), fw);
    camAim.lerp(vb.set(x + 0.35, 0.55, z), fw);
  } else {
    camPos.lerp(va.set(x + 0.9, 1.5, z + 5.6), fw);
    camAim.lerp(vb.set(x + 1.3, 1.22, z), fw);
  }
  // the entrance: start close on him, pull back to the studio
  const open = 1 - smooth(seg(p, 0, 0.05));
  camPos.z -= open * 1.4;
  camPos.x -= open * (narrow ? 0.4 : 1.7);
  camAim.x -= open * (narrow ? 0.4 : 1.9);
  camAim.y += open * (narrow ? 0.5 : 0.1);
  if (!ctx.still) {
    camPos.x += ctx.pointer.x * 0.2;
    camPos.y += ctx.pointer.y * 0.09;
  }
  // the way out: ease round to frame the rift and let him walk into it
  const c3 = smooth(seg(p, EXIT.cam[0], EXIT.cam[1]));
  if (c3 > 0) {
    // behind and beside his walk line, the rift ahead framed in the middle
    // phone: further back with a wider lens, so his start at the bench and the rift both stay in frame
    camPos.lerp(va.set(X_BENCH + (narrow ? 2.4 : 0.2), narrow ? 1.9 : 1.75, narrow ? 11 : 3.6), c3);
    camAim.lerp(vb.set(narrow ? X_BENCH + 4.0 : RIFT.x, narrow ? 1.3 : 1.55, narrow ? -1.3 : RIFT.z), c3);
  }
  ctx.camera.fov = mix(mix(mix(A0.fov, A1.fov, c1), A2.fov, c2), narrow ? 50 : A2.fov, c3);
  ctx.camera.position.copy(camPos);
  ctx.camera.lookAt(camAim);

  /* ---- the worlds ---- */
  const kS = 1 - smooth(seg(p, 0.33, 0.39));
  const kM = smooth(seg(p, 0.27, 0.33)) * (1 - smooth(seg(p, 0.7, 0.75)));
  const kB = smooth(seg(p, 0.6, 0.67));
  const live = f.side === 0 || io > 0.9;
  stations[0].update({ k: kS * io, local: seg(p, STUDIO[0], STUDIO[1]), live: live && p < WALK1[0], f, ctx });
  stations[1].update({ k: kM * io, local: seg(p, MARKET[0], MARKET[1]), live: live && p > MARKET[0] && p < MARKET[1], f, ctx });
  stations[2].update({ k: kB * io, local: seg(p, BENCH[0], BENCH[1]), live: live && p > BENCH[0], f, ctx });

  /* ---- light ---- */
  const hp = hero.root.position;
  key.position.set(hp.x + 2.2, 4.2, hp.z + 4);
  key.target.position.set(hp.x, 1, hp.z);
  rim.position.set(hp.x - 2.5, 2.6, hp.z - 4);
  rim.target.position.set(hp.x, 1.2, hp.z);
  rim.intensity = 3.4 * io;
  key.intensity = 1.5 * io;
  // the set lamp jumps ahead of him: it is the lamp of whichever world is on stage
  const li = c2 > 0.5 ? 2 : c1 > 0.5 ? 1 : 0;
  const lk = Math.abs(Math.cos(Math.max(c1 < 1 ? c1 : 0, c2) * Math.PI));
  lamp.position.copy(LAMPS[li]);
  lamp.target.position.copy(LAMP_AIM[li]);
  lamp.intensity = LAMP_I[li] * lk * io;
  lamp.angle = LAMP_ANGLE[li];
  warm.position.set(mix(mix(1.2, X_MARKET + 1, c1), X_BENCH + 2.5, c2), 2.6, 1.6);
  warm.intensity = 5 * io;

  const fm = (floor.material as THREE.ShaderMaterial).uniforms;
  fm.uHero.value.copy(hp);
  fm.uPool.value[0].w = kS;
  fm.uPool.value[1].w = kM * 1.2;
  fm.uPool.value[2].w = kB;
  fm.uA.value = io;
  for (const h of halos) h.quaternion.copy(ctx.camera.quaternion);
  // a hair line in the dark behind the bench once he is there; it splits open as he walks to it
  rift.update(exitOpen(p), t, ctx, exitLine(p) * io);
  rift.cross(hero);
  const dm = (dust.material as THREE.ShaderMaterial).uniforms;
  dm.uT.value = t;
  dm.uA.value = io;
  dm.uS.value = ctx.size.dpr * (ctx.size.h / 900);

  ctx.bg.copy(BG);
  ctx.fog.color.copy(FOG);
  ctx.fog.density = 0.042;
  ctx.post.bloom = 0.42;
  ctx.post.threshold = 0.86;
  ctx.post.vignette = 0.55;
  ctx.post.grain = 0.6;
  ctx.scene.environmentIntensity = 0.35;

  show(intro, 1 - smooth(seg(p, 0.012, 0.035)));
}

function leave() {
  for (const s of stations) s.sleep?.();
}

const chapter: Chapter = { id: 'scale', group, init, update, leave };
export default chapter;
