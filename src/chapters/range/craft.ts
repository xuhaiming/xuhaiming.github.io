import * as THREE from 'three';
import type { Ctx, Frame } from '../../world/types';
import { clamp01, damp, flag, inOutCubic, seg, smooth } from '../../world/util';
import { COBALT, glowMat, hazeLoop, NOISE, place, plinth, tag, type Station, type Tag } from './kit';

/**
 * Station 4, Visual craft: the exhibit is the pipeline that made it. One object, four states on a
 * turntable: the generated image, the mesh built from it, the mesh as points, the points set in
 * motion against a generated video loop. Scroll, the slider or a tap on the film strip scrubs
 * between them; the pointer bends whatever is on the table (a live vertex shader on the mesh, a
 * push field on the points, a ripple through the screen behind).
 */

const group = new THREE.Group();
const table = new THREE.Group(); // spins
const strip = new THREE.Group();
let now = 0;
const OY = 1.5;
const SIZE = 1.32;
const STAGES = [
  { name: 'Image', kit: 'ComfyUI · Stable Diffusion', line: 'A prompt becomes a picture.' },
  { name: 'Mesh', kit: 'Blender', line: 'The picture becomes geometry, cleaned and decimated.' },
  { name: 'Points', kit: 'Three.js · GLSL', line: 'The geometry becomes points the shader can move.' },
  { name: 'Motion', kit: 'GSAP · GLSL', line: 'Easing, time and a generated video loop.' },
];

const st = {
  k: 0, // 0..3 current
  target: 0,
  user: false,
  userS: 0,
  touched: -99,
  spin: 0,
  spinV: 0,
  ready: false,
  px: 0,
  py: 0,
  amp: 0,
};
/** a tap on a frame eases the target there over 1.4 s (t0 < 0: no tween running) */
const tw = { from: 0, to: 0, t0: -1 };
const TW = 1.4;

const U = {
  uBuild: { value: 0 },
  uDis: { value: 0 },
  uTime: { value: 0 },
  uRayO: { value: new THREE.Vector3() },
  uRayD: { value: new THREE.Vector3(0, 0, -1) },
  uPush: { value: 0 },
  uScatter: { value: 0 },
  uSize: { value: 1 },
  uMap: { value: null as THREE.Texture | null },
  uCol: { value: COBALT.clone() },
  uYMin: { value: -0.5 },
  uYH: { value: 1 },
};

let card: THREE.Mesh;
let cardMat: THREE.ShaderMaterial;
let screen: THREE.Mesh;
let screenMat: THREE.ShaderMaterial;
let cloud: THREE.Points | null = null;
let model: THREE.Object3D | null = null;
let ring: THREE.Mesh;
const frames: THREE.Mesh[] = [];
const frameMats: THREE.ShaderMaterial[] = [];
const tags: Tag[] = [];
let slider: HTMLInputElement | null = null;
let lineEl: HTMLElement | null = null;
let stopEls: HTMLElement[] = [];
let lastStage = -1;
const inv = new THREE.Matrix4();
const ro = new THREE.Vector3();
const rd = new THREE.Vector3();

const COMMON = /* glsl */ `
${NOISE}
uniform float uBuild, uDis, uTime, uYMin, uYH, uPush, uScatter;
uniform vec3 uRayO, uRayD, uCol;
float hN(vec3 p) { return clamp((p.y - uYMin) / uYH, 0.0, 1.0); }
// order in which the surface turns to points: top first, broken up by noise
float disK(vec3 p) { return (1.0 - hN(p)) * 0.62 + vnoise(p * 7.0) * 0.38; }
vec3 bend(vec3 p, out float near) {
  vec3 toP = p - uRayO; vec3 onRay = uRayO + uRayD * dot(toP, uRayD); vec3 away = p - onRay; float d = length(away);
  near = smoothstep(0.42, 0.0, d);
  return away / max(d, 0.0001);
}`;

function bent(radius: number, a0: number, a1: number, y0: number, y1: number, segs = 20) {
  const g = new THREE.PlaneGeometry(1, 1, segs, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5;
    const vv = p.getY(i) + 0.5;
    const a = a0 + (a1 - a0) * u;
    p.setXYZ(i, Math.sin(a) * radius, y0 + (y1 - y0) * vv, Math.cos(a) * radius);
  }
  g.computeVertexNormals();
  return g;
}

function frameMat(tex: THREE.Texture | null) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uMap: { value: tex }, uOn: { value: 0 }, uA: { value: 1 }, uCol: { value: COBALT.clone() }, uHas: { value: tex ? 1 : 0 }, uGain: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uOn, uA, uHas, uGain; uniform vec3 uCol; varying vec2 vUv;
      float sdRR(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec2 p = vUv - 0.5;
        float d = sdRR(p, vec2(0.5), 0.07);
        if (d > 0.0) discard;
        float edge = smoothstep(-0.035, -0.008, d);
        vec3 t = uHas > 0.5 ? texture2D(uMap, vUv).rgb : vec3(0.02, 0.03, 0.08);
        vec3 c = t * uGain * mix(0.4, 1.0, uOn) + uCol * edge * (0.25 + uOn * 2.2);
        gl_FragColor = vec4(c, uA);
      }`,
  });
}

function init(ctx: Ctx, panel: HTMLElement, layer: HTMLElement) {
  slider = panel.querySelector('input[type=range]');
  lineEl = panel.querySelector('.r-status');
  stopEls = Array.from(panel.querySelectorAll<HTMLElement>('.r-stops button'));
  slider?.addEventListener('input', () => {
    tw.t0 = -1;
    st.target = Number(slider!.value);
    st.user = true;
    st.touched = now;
  });
  stopEls.forEach((b, i) => b.addEventListener('click', () => go(i)));

  group.add(plinth(0.86, 0.14));
  table.position.y = OY;
  group.add(table);

  // turntable ring with a lit index mark: the thing the tween eases
  ring = new THREE.Mesh(
    new THREE.RingGeometry(0.66, 0.8, 96, 1),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uCol: { value: COBALT.clone() }, uA: { value: 1 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; uniform float uA; varying vec2 vP;
        void main() {
          float a = atan(vP.y, vP.x) / 6.2831853 + 0.5; float r = length(vP);
          float tick = smoothstep(0.42, 0.5, abs(fract(a * 72.0) - 0.5)) * step(0.74, r);
          float major = smoothstep(0.46, 0.5, abs(fract(a * 4.0) - 0.5)) * step(0.68, r);
          float lineR = smoothstep(0.006, 0.0, abs(r - 0.67));
          gl_FragColor = vec4(uCol * (tick * 0.5 + major * 2.2 + lineR * 1.4) * uA, 1.0);
        }`,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.146;
  group.add(ring);

  // ---- the generated image, as a card ----
  cardMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uMap: { value: null }, uA: { value: 1 }, uScan: { value: 0 }, uCol: { value: COBALT.clone() }, uHas: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uA, uScan, uHas, uTime; uniform vec3 uCol; varying vec2 vUv;
      float sdRR(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec2 p = vUv - 0.5;
        float d = sdRR(p, vec2(0.5), 0.045);
        if (d > 0.0) discard;
        float edge = smoothstep(-0.014, -0.003, d);
        vec3 t = uHas > 0.5 ? texture2D(uMap, vUv).rgb : vec3(0.03, 0.05, 0.12);
        // while the mesh is being read out of the picture, a line scans it
        float sl = smoothstep(0.02, 0.0, abs(vUv.y - uScan)) * step(0.001, uScan) * step(uScan, 0.999);
        float below = step(vUv.y, uScan) * step(0.001, uScan);
        vec2 gq = abs(fract(vUv * 26.0) - 0.5);
        float dots = smoothstep(0.2, 0.1, length(gq)) * below;
        vec3 c = t * 0.78 * (1.0 - below * 0.55) + uCol * (edge * 0.9 + dots * 0.5) + vec3(0.8, 0.88, 1.0) * sl * 2.0;
        gl_FragColor = vec4(c, uA);
      }`,
  });
  card = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), cardMat);
  card.renderOrder = 4;
  group.add(card);
  ctx.tex('/assets/range/camera-1024.webp').then((t) => {
    cardMat.uniforms.uMap.value = t;
    cardMat.uniforms.uHas.value = 1;
    frameMats[0].uniforms.uMap.value = t;
    frameMats[0].uniforms.uHas.value = 1;
  });

  // ---- the screen behind: the video loop pushed through a shader ----
  screenMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uMap: { value: null }, uHas: { value: 0 }, uA: { value: 0.4 }, uTime: { value: 0 }, uP: { value: new THREE.Vector2(0.5, 0.5) }, uAmp: { value: 0 }, uCol: { value: COBALT.clone() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uHas, uA, uTime, uAmp; uniform vec2 uP; uniform vec3 uCol; varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 uv = vUv;
        vec2 q = uv - uP; q.x *= 1.6;
        float d = length(q);
        float rip = sin(d * 34.0 - uTime * 5.0) * exp(-d * 5.0) * uAmp;
        uv += normalize(q + 0.0001) * rip * 0.03;
        float n = vnoise(vec3(uv * 3.0, uTime * 0.12));
        uv += (n - 0.5) * 0.03;
        vec3 t = uHas > 0.5 ? texture2D(uMap, uv).rgb : uCol * (0.2 + 0.5 * vnoise(vec3(uv * 2.5, uTime * 0.1)));
        // slats: the screen is built from vertical light bars
        float slat = 0.72 + 0.28 * smoothstep(0.08, 0.2, abs(fract(vUv.x * 46.0) - 0.5));
        float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        vec3 c = (t * 1.5 + uCol * 0.05 + vec3(0.7, 0.8, 1.0) * max(rip, 0.0) * 0.5) * slat * edge * uA;
        gl_FragColor = vec4(c, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
  });
  screen = new THREE.Mesh(bent(2.3, Math.PI - 0.8, Math.PI + 0.12, 0.45, 3.0, 32), screenMat);
  screen.renderOrder = -2;
  group.add(screen);
  const setLoop = (t: THREE.Texture) => {
    screenMat.uniforms.uMap.value = t;
    screenMat.uniforms.uHas.value = 1;
    frameMats[3].uniforms.uMap.value = t;
    frameMats[3].uniforms.uHas.value = 1;
  };
  ctx.tex('/assets/range/haze.jpg').then(setLoop).catch(() => {});
  hazeLoop(ctx, setLoop);

  // ---- the film strip ----
  strip.position.y = 0;
  group.add(strip);
  const FR = 1.62;
  const FW = 0.5 / FR; // frame arc
  const GAP = 0.085 / FR;
  const total = 4 * FW + 3 * GAP;
  const band = new THREE.Mesh(
    bent(FR - 0.004, -total / 2 - 0.12, total / 2 + 0.12, 0.3, 0.98, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uA: { value: 1 }, uCol: { value: COBALT.clone() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uA; uniform vec3 uCol; varying vec2 vUv;
        void main() {
          // sprocket holes along both edges
          float hx = abs(fract(vUv.x * 26.0) - 0.5);
          float hy = min(abs(vUv.y - 0.075), abs(vUv.y - 0.925));
          float hole = step(hx, 0.26) * step(hy, 0.035);
          if (hole > 0.5) discard;
          float fade = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
          float line = smoothstep(0.0, 0.012, abs(vUv.y - 0.5) - 0.484);
          gl_FragColor = vec4(vec3(0.014, 0.022, 0.055) + uCol * line * 0.8, 0.86 * fade * uA);
        }`,
    }),
  );
  band.renderOrder = 6;
  strip.add(band);
  for (let i = 0; i < 4; i++) {
    const a0 = -total / 2 + i * (FW + GAP);
    const m = frameMat(null);
    frameMats.push(m);
    const f = new THREE.Mesh(bent(FR, a0, a0 + FW, 0.39, 0.89, 12), m);
    f.renderOrder = 7;
    f.userData.i = i;
    f.userData.a = a0 + FW / 2;
    frames.push(f);
    strip.add(f);
    const tg = tag(layer, `<s>${i + 1}</s><b>${STAGES[i].name}</b><i>${STAGES[i].kit}</i>`, 'r-frame', true);
    tg.el.addEventListener('click', () => go(i));
    tags.push(tg);
  }
  ctx.tex('/assets/range/camera-mesh-512.webp').then((t) => {
    frameMats[1].uniforms.uGain.value = 2.6;
    frameMats[1].uniforms.uMap.value = t;
    frameMats[1].uniforms.uHas.value = 1;
  }).catch(() => {});

  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), glowMat());
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.012;
  (glow.material as THREE.ShaderMaterial).uniforms.uA.value = 0.2;
  group.add(glow);

  ctx.glb('/assets/range/camera.glb').then((g) => build(g.scene, ctx)).catch((e) => console.warn('[range] station 4 object missing', e));
}

function go(i: number) {
  st.user = true;
  st.touched = now;
  tw.from = st.target;
  tw.to = i;
  tw.t0 = now;
}

/** plain float copy of a (possibly quantized / interleaved) geometry, safe to bake transforms into */
function floatGeo(src: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  if (src.index) g.setIndex(src.index.clone());
  for (const name of Object.keys(src.attributes)) {
    const a = src.attributes[name];
    const n = a.count;
    const s = a.itemSize;
    const out = new Float32Array(n * s);
    for (let i = 0; i < n; i++) for (let k = 0; k < s; k++) out[i * s + k] = a.getComponent(i, k);
    g.setAttribute(name, new THREE.BufferAttribute(out, s));
  }
  for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  return g;
}

function build(src: THREE.Group, ctx: Ctx) {
  const root = src.clone(true);
  let mesh: THREE.Mesh | null = null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (!mesh || m.geometry.attributes.position.count > mesh.geometry.attributes.position.count)) mesh = m;
  });
  if (!mesh) return;
  const me = mesh as THREE.Mesh;
  root.updateWorldMatrix(true, true);
  const geo = floatGeo(me.geometry).applyMatrix4(me.matrixWorld);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());
  const c = bb.getCenter(new THREE.Vector3());
  const k = SIZE / Math.max(size.x, size.y, size.z);
  geo.translate(-c.x, -c.y, -c.z).scale(k, k, k);
  geo.computeBoundingBox();
  U.uYMin.value = geo.boundingBox!.min.y;
  U.uYH.value = geo.boundingBox!.max.y - geo.boundingBox!.min.y;

  const mat = (me.material as THREE.MeshStandardMaterial).clone();
  mat.envMapIntensity = 1.5;
  mat.side = THREE.DoubleSide;
  U.uMap.value = mat.map;
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vObj; varying float vNear;\n${COMMON}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vObj = position;
        float near; vec3 away = bend(position, near);
        vNear = near * uPush;
        transformed += normal * near * uPush * (0.07 + 0.05 * sin(uTime * 7.0 - length(position - uRayO) * 16.0));`,
      );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vObj; varying float vNear;\n${COMMON}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float h = hN(vObj);
        float bEdge = uBuild * 1.16 - 0.06 - (h * 0.88 + vnoise(vObj * 9.0) * 0.12);
        if (bEdge < 0.0) discard;
        float dThr = uDis * 1.14 - 0.07;
        float dEdge = disK(vObj) - dThr;
        if (dEdge < 0.0) discard;
        // freshly built surface still shows its wireframe
        vec3 gq = abs(fract(vObj * 15.0) - 0.5);
        float wire = smoothstep(0.44, 0.49, max(gq.x, max(gq.y, gq.z)));
        float fresh = smoothstep(0.42, 0.0, bEdge) * step(uBuild, 0.999);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.04, 0.1), fresh * 0.85);
        totalEmissiveRadiance += uCol * (wire * fresh * 2.2 + smoothstep(0.05, 0.0, bEdge) * step(uBuild, 0.999) * 5.0);
        totalEmissiveRadiance += mix(uCol, vec3(1.0), 0.4) * smoothstep(0.06, 0.0, dEdge) * step(0.001, uDis) * 4.0;
        totalEmissiveRadiance += mix(uCol, vec3(1.0), 0.5) * vNear * 0.9;`,
      );
  };
  const solid = new THREE.Mesh(geo, mat);
  model = solid;
  table.add(solid);

  // ---- sample the surface into points ----
  const count = [16000, 36000, 60000][ctx.tier];
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const index = geo.index;
  const tris = index ? index.count / 3 : pos.count / 3;
  const vi = (t: number, kk: number) => (index ? index.getX(t * 3 + kk) : t * 3 + kk);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const cc = new THREE.Vector3();
  const cdf = new Float32Array(tris);
  let total = 0;
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(pos, vi(t, 0));
    b.fromBufferAttribute(pos, vi(t, 1));
    cc.fromBufferAttribute(pos, vi(t, 2));
    total += b.sub(a).cross(cc.sub(a)).length();
    cdf[t] = total;
  }
  const P = new Float32Array(count * 3);
  const T = new Float32Array(count * 2);
  const S = new Float32Array(count);
  let seed = 987654;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const r = rnd() * total;
    let lo = 0;
    let hi = tris - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cdf[m] < r) lo = m + 1;
      else hi = m;
    }
    const i0 = vi(lo, 0);
    const i1 = vi(lo, 1);
    const i2 = vi(lo, 2);
    let u = rnd();
    let v = rnd();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    P[i * 3] = pos.getX(i0) * w + pos.getX(i1) * u + pos.getX(i2) * v;
    P[i * 3 + 1] = pos.getY(i0) * w + pos.getY(i1) * u + pos.getY(i2) * v;
    P[i * 3 + 2] = pos.getZ(i0) * w + pos.getZ(i1) * u + pos.getZ(i2) * v;
    if (uv) {
      T[i * 2] = uv.getX(i0) * w + uv.getX(i1) * u + uv.getX(i2) * v;
      T[i * 2 + 1] = uv.getY(i0) * w + uv.getY(i1) * u + uv.getY(i2) * v;
    }
    S[i] = rnd();
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
  pg.setAttribute('uv', new THREE.BufferAttribute(T, 2));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));
  cloud = new THREE.Points(
    pg,
    new THREE.ShaderMaterial({
      uniforms: { ...U, uHasMap: { value: mat.map ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        ${COMMON}
        uniform float uSize, uHasMap; uniform sampler2D uMap;
        attribute float aSeed; varying vec3 vC; varying float vA;
        void main() {
          vec3 p = position;
          float dThr = uDis * 1.14 - 0.07;
          float born = 1.0 - smoothstep(dThr - 0.05, dThr + 0.02, disK(position));
          vec3 f = vec3(vnoise(p * 2.2 + vec3(0.0, uTime * 0.3, 3.1)), vnoise(p * 2.2 + vec3(7.7, 1.3, uTime * 0.3)), vnoise(p * 2.2 + vec3(uTime * 0.3, 9.1, 4.4))) - 0.5;
          p += f * (0.03 + 0.05 * uDis);
          // motion: the cloud opens into a slow orbiting swarm
          float s = clamp(uScatter * 1.4 - aSeed * 0.4, 0.0, 1.0);
          float ang = s * (1.2 + aSeed * 2.4) + uTime * 0.35 * s;
          float cs = cos(ang), sn = sin(ang);
          vec3 sw = vec3(p.x * cs - p.z * sn, p.y, p.x * sn + p.z * cs);
          sw *= 1.0 + s * (0.2 + aSeed * 0.9);
          sw += f * s * 0.7;
          sw.y += sin(aSeed * 40.0 + uTime * 0.7) * 0.18 * s;
          p = mix(p, sw, s);
          float near; vec3 away = bend(p, near);
          p += away * near * 0.32 * uPush;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (0.75 + aSeed * 0.9) * (1.0 + near * uPush * 1.5) * (5.2 / -mv.z);
          vec3 own = uHasMap > 0.5 ? texture2D(uMap, uv).rgb : vec3(0.3, 0.45, 1.0);
          own = own * 1.5 + 0.035;
          vC = mix(own, vec3(0.55, 0.7, 1.0), 0.22 + 0.4 * s) * (0.62 + 0.3 * sin(uTime * 2.0 + aSeed * 50.0));
          vA = born;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d) * vA;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vC * a, a);
        }`,
    }),
  );
  cloud.frustumCulled = false;
  cloud.renderOrder = 3;
  table.add(cloud);

  // a still of the cloud for the film strip
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g2 = cv.getContext('2d')!;
  g2.fillStyle = '#02040a';
  g2.fillRect(0, 0, 256, 256);
  g2.globalCompositeOperation = 'lighter';
  g2.fillStyle = 'rgba(150,185,255,0.5)';
  const cy = Math.cos(0.6);
  const sy = Math.sin(0.6);
  for (let i = 0; i < Math.min(count, 9000); i++) {
    const x = P[i * 3] * cy + P[i * 3 + 2] * sy;
    const y = P[i * 3 + 1];
    g2.fillRect(128 + (x / SIZE) * 190, 128 - (y / SIZE) * 190, 1.3, 1.3);
  }
  const ct = new THREE.CanvasTexture(cv);
  ct.colorSpace = THREE.SRGBColorSpace;
  frameMats[2].uniforms.uMap.value = ct;
  frameMats[2].uniforms.uHas.value = 1;
  st.ready = true;
}

function update(s: number, on: number, pre: number, f: Frame, ctx: Ctx) {
  const { t, dt } = f;
  now = t;
  const active = on > 0.6;
  const narrow = ctx.size.narrow;

  // ---- scrub: scroll drives it until the visitor takes the slider; scrolling on hands it back ----
  const fromScroll = seg(s, 0.1, 0.86) * 3;
  if (tw.t0 >= 0) {
    const u = (t - tw.t0) / TW;
    st.target = tw.from + (tw.to - tw.from) * inOutCubic(u);
    if (u >= 1) tw.t0 = -1;
  }
  if (st.user && Math.abs(s - st.userS) > 0.12) st.user = false;
  if (!st.user) {
    st.userS = s;
    st.target = fromScroll;
  }
  st.k += (st.target - st.k) * damp(st.user ? 9 : 6, dt);
  const vis = Math.max(smooth(on), pre, s > 0.5 ? 1 : 0);
  const k = st.k + (1.0 - st.k) * pre;
  if (slider && document.activeElement !== slider && Math.abs(Number(slider.value) - st.k) > 0.004) slider.value = st.k.toFixed(3);
  const stage = Math.min(3, Math.round(st.k));
  if (stage !== lastStage) {
    lastStage = stage;
    if (lineEl) lineEl.textContent = STAGES[stage].line;
    stopEls.forEach((b, i) => b.setAttribute('aria-pressed', String(i === stage)));
  }

  const build = smooth(seg(k, 0.25, 1));
  const dis = smooth(seg(k, 1.15, 2));
  const scat = smooth(seg(k, 2.15, 3));
  U.uBuild.value = build;
  U.uDis.value = dis;
  U.uScatter.value = scat;
  U.uTime.value = t;
  U.uSize.value = ctx.size.dpr * (ctx.size.h / 900) * 1.45;

  // ---- pointer: bend whatever is on the table ----
  const ray = ctx.ray().ray;
  const hot = active && ctx.pointer.seen && !ctx.still ? 1 : 0;
  st.amp += (hot - st.amp) * damp(4, dt);
  U.uPush.value = st.amp;
  table.updateWorldMatrix(true, false);
  inv.copy(table.matrixWorld).invert();
  ro.copy(ray.origin).applyMatrix4(inv);
  rd.copy(ray.direction).transformDirection(inv);
  U.uRayO.value.copy(ro);
  U.uRayD.value.copy(rd);

  // turntable: steady drift, nudged by the pointer's horizontal travel
  const dx = ctx.pointer.x - st.px;
  st.px = ctx.pointer.x;
  st.spinV += (active ? dx * 2.2 : 0) - st.spinV * Math.min(1, dt * 2.5);
  st.spin += (ctx.still ? 0 : dt * 0.22) + st.spinV * dt * 6;
  table.rotation.y = st.spin + 0.5;
  table.position.y = OY + Math.sin(t * 0.8) * 0.015;
  if (model) model.visible = build > 0.002 && dis < 0.998;
  if (cloud) cloud.visible = dis > 0.002;
  ring.rotation.z = -st.spin;
  (ring.material as THREE.ShaderMaterial).uniforms.uA.value = 0.5 + 0.5 * on;

  // ---- the image card: front and centre, then pinned up as the reference ----
  const away = smooth(seg(k, 0.3, 0.95));
  card.position.set(-1.02 * away, OY + 0.62 * away, 0.25 - 0.95 * away);
  card.rotation.y = 0.5 * away + (1 - away) * ctx.pointer.x * 0.2 * st.amp;
  card.rotation.x = -(1 - away) * ctx.pointer.y * 0.12 * st.amp;
  card.scale.setScalar((narrow ? 0.92 : 1) * (1 - 0.52 * away));
  cardMat.uniforms.uA.value = vis * (1 - 0.45 * smooth(seg(k, 1.0, 1.6)));
  cardMat.uniforms.uScan.value = k < 0.25 ? 0 : seg(k, 0.25, 1);
  cardMat.uniforms.uTime.value = t;

  // ---- the screen ----
  const su = screenMat.uniforms;
  su.uTime.value = t;
  su.uA.value = vis * (0.1 + 0.16 * smooth(seg(k, 0.5, 2)) + 0.45 * scat);
  su.uAmp.value = st.amp;
  su.uP.value.set(0.5 + ctx.pointer.x * 0.4, 0.5 + ctx.pointer.y * 0.4);

  // ---- film strip ----
  const lead = clamp01(Math.max(on, pre));
  strip.rotation.y = -(st.k - 1.5) * 0.11 + ctx.pointer.x * 0.04 * st.amp;
  strip.position.y = -0.5 * (1 - smooth(lead));
  frames.forEach((fr, i) => {
    const near = clamp01(1 - Math.abs(st.k - i) * 1.25);
    frameMats[i].uniforms.uOn.value = smooth(near);
    frameMats[i].uniforms.uA.value = lead;
    const tg = tags[i];
    const a = fr.userData.a as number;
    tg.at.set(Math.sin(a) * 1.62, narrow ? 0.98 : 0.3, Math.cos(a) * 1.62);
    strip.localToWorld(tg.at);
    place(ctx, tg, on, dt);
    flag(tg.el, 'on', stage === i);
  });
}

function tap(ctx: Ctx) {
  const hit = ctx.ray().intersectObjects(frames, false)[0];
  if (hit) go(hit.object.userData.i);
  else go((Math.round(st.target) + 1) % 4);
}

function act(name: string) {
  const m = /^k-(\d+)$/.exec(name);
  if (m) {
    st.user = true;
    st.userS = NaN;
    st.target = st.k = Number(m[1]) / 10;
  }
}

export const craft: Station = { group, init, update, tap, act };
