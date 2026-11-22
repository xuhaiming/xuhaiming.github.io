import * as THREE from 'three';
import type { Chapter, Ctx, Frame } from '../../world/types';
import { clamp01, css, inOutCubic, mix, seg, show, smooth, win } from '../../world/util';
import { createBuilder } from './builder';
import { fontsReady, LIME, shotAt, type Key, type Takeover } from './kit';
import { createKnowledge } from './knowledge';
import { createTrace } from './trace';
import { EXIT, Rift, exitCopy, exitLine, exitOpen, exitWalk } from '../../world/Rift';

/**
 * Systems. Three agent systems, each a machine on one long machine-room floor. The hero walks
 * from one to the next and operates it; the visitor can operate each one too.
 *   0.00 - 0.05  arrive
 *   0.05 - 0.33  01 app builder     (request, assemble, bind data, deploy, wall of 80+)
 *   0.33 - 0.41  walk
 *   0.41 - 0.66  02 agent platform  (a traced run under a playhead, guardrail gate, eval board)
 *   0.66 - 0.74  walk
 *   0.74 - 0.96  03 knowledge base  (documents to chunks to embedding space, query, daily sweep, MCP plug)
 *   0.90 - 1.00  walk on, into the rift to the next chapter (the knowledge base's own beats run a
 *                little faster so they finish by 0.90)
 */

const group = new THREE.Group();
const X1 = 0;
const X2 = 13;
const X3 = 26;
const AMBER = new THREE.Color('#ffa62b');
const BG = new THREE.Color('#020301');
/** the way out: from where he stands at the last machine, past its front, into the rift */
const OUT_FROM: [number, number] = [X3 - 2.4, 1.25];
const RIFT: [number, number] = [X3 + 2.8, 3.2];
const OUT_LEN = Math.hypot(RIFT[0] - OUT_FROM[0], RIFT[1] - OUT_FROM[1]);
const OUT_DIR: [number, number] = [(RIFT[0] - OUT_FROM[0]) / OUT_LEN, (RIFT[1] - OUT_FROM[1]) / OUT_LEN];
/** the knowledge base's timeline, sped up so its last beat (0.962) lands at 0.90 */
const kbP = (p: number) => (p < 0.738 ? p : Math.min(1, 0.738 + ((p - 0.738) * (0.962 - 0.738)) / (0.9 - 0.738)));
const kbFrame = { p: 0, io: 0, side: 0, t: 0, dt: 0, vel: 0 } as Frame;
/** the knowledge base's copy and labels leave before the exit camera starts to move (0.84) */
const kbCopy = (p: number) => 1 - smooth(seg(p, 0.8, 0.845));

let builder: ReturnType<typeof createBuilder>;
let trace: ReturnType<typeof createTrace>;
let kb: ReturnType<typeof createKnowledge>;
let s1: ReturnType<typeof builder.update>;
let s2: ReturnType<typeof trace.update>;
let s3: ReturnType<typeof kb.update>;
/** which machines ran last frame: a machine out of view is updated once more at 0 to settle, then skipped */
const awake = [true, true, true];
/** a machine going to sleep hands any visitor take back to scroll at once (it is far behind the camera) */
const rest = (tk: Takeover) => {
  tk.release();
  tk.mix = 0;
};
let floorU: { uTime: { value: number } };
let dust: THREE.Points;
let rim: THREE.DirectionalLight;
let rift: Rift;
let cases: (HTMLElement | null)[] = [];
let scrim: HTMLElement | null = null;
const backs: { mesh: THREE.Mesh; refl: THREE.Mesh; u: { uMap: { value: THREE.Texture | null }; uA: { value: number }; uTime: { value: number } }; video?: HTMLVideoElement; asked: boolean; name: string }[] = [];

const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
const exitPos = new THREE.Vector3();
const exitAim = new THREE.Vector3();

/* hero path: [p, x, z] */
const PATH: [number, number, number][] = [
  [0, X1 - 6.6, 1.5],
  [0.05, X1 - 2.4, 1.25],
  [0.328, X1 - 2.4, 1.25],
  [0.408, X2 - 2.95, 1.7],
  [0.662, X2 - 2.95, 1.7],
  [0.738, X3 - 2.4, 1.25],
  [0.9, X3 - 2.4, 1.25],
  [1, X3 + 4.4, 2.9],
];
const dists: number[] = [0];
for (let i = 1; i < PATH.length; i++) dists.push(dists[i - 1] + Math.hypot(PATH[i][1] - PATH[i - 1][1], PATH[i][2] - PATH[i - 1][2]));

const KEYS: Key[] = [
  { p: 0, wide: { pos: [X1 - 3.4, 1.7, 9.6], aim: [X1 - 3.8, 1.35, 0] }, narrow: { pos: [X1 - 3.2, 1.9, 9.5], aim: [X1 - 3.4, 0.2, 0] } },
  { p: 0.07, wide: { pos: [X1 - 0.9, 2.0, 10.2], aim: [X1 - 1.25, 1.8, 0] }, narrow: { pos: [X1 - 1.3, 2.3, 12.2], aim: [X1 - 1.1, 0.1, 0] } },
  { p: 0.2, wide: { pos: [X1 - 0.5, 2.15, 9.5], aim: [X1 - 0.95, 1.9, 0] }, narrow: { pos: [X1 + 0.2, 2.3, 10.6], aim: [X1 + 0.3, 0.45, 0] } },
  { p: 0.3, wide: { pos: [X1 - 0.8, 2.7, 11.8], aim: [X1 - 1.25, 2.5, -1] }, narrow: { pos: [X1 + 0.6, 2.8, 13.5], aim: [X1 + 0.9, 0.6, -2] } },
  { p: 0.335, wide: { pos: [X1 - 0.6, 2.7, 11.8], aim: [X1 - 1.05, 2.5, -1] }, narrow: { pos: [X1 + 0.6, 2.8, 13.5], aim: [X1 + 0.9, 0.6, -2] } },
  { p: 0.41, wide: { pos: [X2 - 1.3, 2.9, 11.8], aim: [X2 - 1.7, 1.85, -0.4] }, narrow: { pos: [X2 + 0.5, 3.6, 15.6], aim: [X2 + 0.6, 0.1, -0.3] } },
  { p: 0.53, wide: { pos: [X2 - 1.0, 2.7, 11.0], aim: [X2 - 1.45, 1.85, -0.4] }, narrow: { pos: [X2 + 0.9, 3.5, 15.0], aim: [X2 + 0.9, 0.1, -0.3] } },
  { p: 0.655, wide: { pos: [X2 - 0.8, 2.8, 11.4], aim: [X2 - 1.2, 1.9, -0.4] }, narrow: { pos: [X2 + 1.4, 3.5, 15.2], aim: [X2 + 1.4, 0.1, -0.3] } },
  { p: 0.74, wide: { pos: [X3 - 0.9, 2.7, 11.4], aim: [X3 - 1.3, 2.6, 0] }, narrow: { pos: [X3 + 0.4, 3.2, 14.5], aim: [X3 + 0.4, 0.5, 0] } },
  { p: 0.86, wide: { pos: [X3 - 0.3, 2.7, 10.4], aim: [X3 - 0.75, 2.7, 0] }, narrow: { pos: [X3 + 0.75, 2.8, 12.6], aim: [X3 + 0.75, 0.5, 0] } },
  { p: 0.945, wide: { pos: [X3 - 1.3, 1.8, 10.2], aim: [X3 - 1.75, 1.5, 0] }, narrow: { pos: [X3 - 0.6, 2.2, 13], aim: [X3 - 0.4, 0.0, 0] } },
  { p: 1, wide: { pos: [X3 + 1.2, 1.75, 10.4], aim: [X3 + 2.5, 1.55, 1.2] }, narrow: { pos: [X3 + 2.4, 2.1, 12.6], aim: [X3 + 2.9, 0.6, 1.2] } },
];

async function init(ctx: Ctx, el: HTMLElement) {
  cases = ['.s-intro', '.s-c1', '.s-c2', '.s-c3'].map((s) => el.querySelector<HTMLElement>(s));
  scrim = el.querySelector<HTMLElement>('.s-scrim');
  await fontsReady();
  // props are shared by the three machines; in capture mode wait for them so stills are complete
  const props = Promise.all(['console', 'forge', 'gate', 'pedestal', 'plug'].map((n) => ctx.glb(`/assets/systems/prop-${n}.glb`).catch(() => null)));
  if (ctx.shot) await Promise.race([props, new Promise((r) => setTimeout(r, 2500))]);

  /* ----- light ----- */
  const key = new THREE.DirectionalLight('#f3ffe2', 2.8);
  key.position.set(-2.5, 5, 6);
  rim = new THREE.DirectionalLight(LIME, 2.4);
  rim.position.set(2.5, 8, -5.5);
  const fill = new THREE.HemisphereLight('#a6d95a', '#020301', 0.3);
  group.add(key, rim, fill);

  /* ----- floor: dark polished concrete with a lattice of points and a walkway ----- */
  const fg = new THREE.PlaneGeometry(120, 44);
  fg.rotateX(-Math.PI / 2);
  const fm = new THREE.MeshStandardMaterial({ color: '#040503', roughness: 0.66, metalness: 0.25 });
  floorU = { uTime: { value: 0 } };
  fm.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, floorU);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vW; uniform float uTime;
        float fh(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float fn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float wear = fn(vW.xz * vec2(0.7, 3.0)) * 0.6 + fn(vW.xz * 9.0) * 0.4;
        roughnessFactor = clamp(roughnessFactor + (wear - 0.5) * 0.36, 0.12, 1.0);`,
      )
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directSpecular *= 0.12; reflectedLight.directDiffuse *= 0.6;`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec2 g = abs(fract(vW.xz * 1.25) - 0.5);
        float lat = smoothstep(0.055, 0.02, length(g)) * exp(-abs(vW.z - 1.0) * 0.17);
        float edge = smoothstep(0.022, 0.0, abs(abs(vW.z - 1.45) - 0.95)) * step(0.35, fract(vW.x * 0.55 - uTime * 0.05));
        totalEmissiveRadiance += vec3(0.72, 1.0, 0.24) * (lat * 0.11 + edge * 0.2);`,
      );
  };
  const floor = new THREE.Mesh(fg, fm);
  floor.position.set(X2, 0, -6);
  group.add(floor);

  /* ----- dust in the light ----- */
  const n = [300, 700, 1100][ctx.tier];
  const P = new Float32Array(n * 3);
  const S = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    P[i * 3] = -10 + Math.random() * 48;
    P[i * 3 + 1] = Math.random() * 6;
    P[i * 3 + 2] = 6 - Math.random() * 14;
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
      uniforms: { uTime: { value: 0 }, uS: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime, uS; attribute float aSeed; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.02 + aSeed * 0.04), 6.0);
          p.x += sin(uTime * 0.17 + aSeed * 30.0) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * (1.0 + aSeed * 2.4) * (6.0 / -mv.z);
          vA = (0.2 + 0.8 * aSeed) * smoothstep(0.0, 0.6, p.y) * smoothstep(6.0, 4.6, p.y) * smoothstep(0.5, 3.0, -mv.z);
        }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.72, 1.0, 0.36) * smoothstep(0.5, 0.0, d) * vA * 0.42, 1.0); }',
    }),
  );
  dust.frustumCulled = false;
  group.add(dust);

  /* ----- backdrops: one generated still / loop per machine, graded into the lime world ----- */
  const BW = 15;
  const BH = BW * (9 / 16);
  const bv = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  (['builder', 'trace', 'kb'] as const).forEach((name, i) => {
    const u = { uMap: { value: null as THREE.Texture | null }, uA: { value: 0 }, uTime: { value: 0 } };
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(BW, BH),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: u,
        vertexShader: bv,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform float uA; varying vec2 vUv;
          void main() {
            vec3 c = texture2D(uMap, vUv).rgb;
            float l = dot(c, vec3(0.3, 0.6, 0.1));
            vec3 g = mix(c, vec3(0.72, 1.0, 0.24) * l * 1.3, 0.6);
            vec2 q = (vUv - 0.5) * 2.0;
            float m = smoothstep(1.0, 0.35, abs(q.x)) * smoothstep(1.0, 0.3, abs(q.y));
            gl_FragColor = vec4(g * g * m * uA * 1.5, 1.0);
          }`,
      }),
    );
    mesh.position.set([X1, X2, X3][i] + 0.4, BH / 2 - 0.35, -9.5);
    mesh.renderOrder = -5;
    // the floor in front of the backdrop picks it up as a long soft reflection
    const refl = new THREE.Mesh(
      new THREE.PlaneGeometry(BW, 10),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: u,
        vertexShader: bv,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform float uA; varying vec2 vUv;
          void main() {
            vec3 c = texture2D(uMap, vec2(vUv.x, (1.0 - vUv.y) * 0.75 + 0.02), 4.0).rgb;
            float l = dot(c, vec3(0.3, 0.6, 0.1));
            float m = smoothstep(1.0, 0.4, abs(vUv.x - 0.5) * 2.0) * pow(clamp(vUv.y, 0.0, 1.0), 1.6);
            gl_FragColor = vec4(vec3(0.72, 1.0, 0.24) * l * m * uA * 0.22, 1.0);
          }`,
      }),
    );
    refl.rotation.x = -Math.PI / 2;
    refl.position.set(mesh.position.x, 0.012, -4.5);
    refl.renderOrder = -4;
    mesh.visible = refl.visible = false;
    group.add(mesh, refl);
    backs.push({ mesh, refl, u, asked: false, name });
  });

  /* ----- the way out: a rift of the next chapter's light past the last machine ----- */
  rift = new Rift(ctx, { color: AMBER, height: 3.7, width: 1.25, light: 14, floor: 0.7 });
  rift.object3D.position.set(RIFT[0], 0, RIFT[1]);
  // turned to face the way he comes, and a little toward the camera
  rift.object3D.rotation.y = Math.atan2(-OUT_DIR[0], -OUT_DIR[1]);
  group.add(rift.object3D);

  builder = createBuilder(ctx, el, X1);
  trace = createTrace(ctx, el, X2);
  kb = createKnowledge(ctx, el, X3, trace.mcpPort);
  group.add(builder.group, trace.group, kb.group);
}

function backdrop(ctx: Ctx, i: number, amount: number, t: number) {
  const b = backs[i];
  if (amount > 0.01 && !b.asked) {
    b.asked = true;
    const still = `/assets/systems/still-${b.name}.webp`;
    ctx.tex(still).then(
      (tex) => {
        if (!b.u.uMap.value) b.u.uMap.value = tex;
        if (ctx.tier > 0 && !ctx.still && !ctx.shot)
          ctx.video(`/assets/systems/loop-${b.name}.mp4`, { poster: still }).then((v) => {
            if (v.el.readyState < 2) return;
            b.video = v.el;
            b.u.uMap.value = v.tex;
          });
      },
      () => {},
    );
  }
  const on = amount > 0.01 && !!b.u.uMap.value;
  b.mesh.visible = b.refl.visible = on;
  b.u.uA.value = amount;
  b.u.uTime.value = t;
  if (b.video) {
    if (on && b.video.paused) b.video.play().catch(() => {});
    else if (!on && !b.video.paused) b.video.pause();
  }
}

function update(f: Frame, ctx: Ctx) {
  const { p, io, t } = f;
  const hero = ctx.hero;
  const narrow = ctx.size.narrow;

  /* ----- which machine we are at ----- */
  const near1 = 1 - smooth(seg(p, 0.34, 0.385));
  const near2 = win(p, 0.355, 0.715, 0.04);
  const near3 = smooth(seg(p, 0.685, 0.725));
  // a machine stays drawn until the camera has carried it well out of frame (no pop while on screen);
  // only the one(s) near the camera do any work
  builder.group.visible = p < 0.43;
  trace.group.visible = p > 0.29 && p < 0.78;
  kb.group.visible = p > 0.64;
  // only the machine(s) in view do any work; the one just left gets a final frame at 0
  const on1 = near1 > 0.001;
  const on2 = near2 > 0.001;
  const on3 = near3 > 0.001;
  if (on1 || awake[0]) {
    s1 = builder.update(f, near1);
    if (!on1) rest(builder.take);
  }
  if (on2 || awake[1]) {
    s2 = trace.update(f, near2);
    if (!on2) rest(trace.take);
  }
  if (on3 || awake[2]) {
    Object.assign(kbFrame, f, { p: kbP(p) });
    s3 = kb.update(kbFrame, near3, kbCopy(p));
    if (!on3) rest(kb.take);
  }
  awake[0] = on1;
  awake[1] = on2;
  awake[2] = on3;
  css(document.documentElement, 'cursor', (near1 > 0.5 && s1.hot) || (near2 > 0.5 && s2.hot) ? 'pointer' : near3 > 0.5 && s3.hot ? 'crosshair' : '');

  const bk = narrow ? 0.6 : 1;
  backdrop(ctx, 0, near1 * bk * mix(0.42, 0.2, smooth(seg(p, 0.2, 0.3))), t);
  backdrop(ctx, 1, near2 * bk * 0.4, t);
  backdrop(ctx, 2, near3 * bk * 0.4, t);

  /* ----- hero ----- */
  let i = 0;
  while (i < PATH.length - 2 && p > PATH[i + 1][0]) i++;
  // the same easing as the camera's key-to-key blend, so he keeps his place in the frame on a walk
  const k = smooth(clamp01((p - PATH[i][0]) / (PATH[i + 1][0] - PATH[i][0])));
  const hx = mix(PATH[i][1], PATH[i + 1][1], k);
  const hz = mix(PATH[i][2], PATH[i + 1][2], k);
  const moving = PATH[i][1] !== PATH[i + 1][1];
  hero.root.position.set(hx, 0, hz);
  hero.walkTo(mix(dists[i], dists[i + 1], k));
  // the way out: straight through the rift, reaching it at the shared moment
  const outing = p > PATH[PATH.length - 2][0];
  if (outing) {
    const dw = exitWalk(p, PATH[PATH.length - 2][0], OUT_LEN);
    hero.root.position.set(OUT_FROM[0] + OUT_DIR[0] * dw, 0, OUT_FROM[1] + OUT_DIR[1] * dw);
    hero.walkTo(dists[PATH.length - 2] + dw);
  }
  // face the way he walks; at a machine, turn toward it
  const settle = moving ? Math.min(smooth(1 - k * 6), 1) + smooth((k - 0.86) / 0.14) : 1;
  const walkYaw = moving ? Math.atan2(PATH[i + 1][1] - PATH[i][1], PATH[i + 1][2] - PATH[i][2]) : Math.PI / 2;
  hero.root.rotation.y = mix(walkYaw, Math.PI / 2 + 0.62, clamp01(settle) * (i === PATH.length - 2 ? 0 : 1) * (i === 0 ? smooth((k - 0.8) / 0.2) : 1));
  if (outing) hero.root.rotation.y = mix(Math.PI / 2 + 0.62, Math.atan2(OUT_DIR[0], OUT_DIR[1]), smooth(seg(p, 0.9, 0.915)));
  hero.form = Math.max(0, 1 - io);
  hero.scatter = Math.max(0, 1 - io);
  hero.tint.copy(LIME);
  hero.tintMix = 0.8;
  hero.shadow = 1;
  hero.push = 1;
  // he thinks while the query runs
  if (s3.qv > 0.05 && s3.qv < 0.8 && near3 > 0.9) hero.pose = 'think';

  /* ----- camera ----- */
  ctx.camera.fov = shotAt(KEYS, p, narrow, camPos, camAim);
  // follow the playhead a little while a run is being scrubbed
  if (near2 > 0.5 && !narrow) camAim.x += (s2.u - 0.5) * 0.5 * trace.take.mix;
  // the exit: fall in behind him on his way out, the rift ahead in the middle of the frame
  const ex = smooth(seg(p, EXIT.cam[0] - 0.02, EXIT.cam[1]));
  if (ex > 0) {
    // behind him and out to the open side (+z, away from the machines), aimed between him and the
    // rift so both are in frame from the first step
    const back = narrow ? 5.6 : 4.4;
    const sideOff = narrow ? 3.8 : 3.4;
    const ox = OUT_FROM[0] - OUT_DIR[0] * back - OUT_DIR[1] * sideOff;
    const oz = OUT_FROM[1] - OUT_DIR[1] * back + OUT_DIR[0] * sideOff;
    // phone: favour him early in the move, the rift by the time it opens
    const ak = narrow ? mix(0.2, 0.5, seg(p, 0.9, 0.95)) : 0.55;
    camPos.lerp(exitPos.set(ox, narrow ? 2.3 : 2.1, oz), ex);
    camAim.lerp(exitAim.set(mix(OUT_FROM[0], RIFT[0], ak), narrow ? 1.3 : 1.5, mix(OUT_FROM[1], RIFT[1], ak)), ex);
    ctx.camera.fov = mix(ctx.camera.fov, narrow ? 46 : 35, ex);
  }
  if (!ctx.still) {
    camPos.x += ctx.pointer.x * 0.32;
    camPos.y += ctx.pointer.y * 0.16;
    camPos.y += Math.sin(t * 0.4) * 0.03;
  }
  ctx.camera.position.copy(camPos);
  ctx.camera.lookAt(camAim);

  /* ----- world ----- */
  const out = exitOpen(p);
  floorU.uTime.value = ctx.still ? 0 : t;
  const dm = dust.material as THREE.ShaderMaterial;
  dm.uniforms.uTime.value = t;
  dm.uniforms.uS.value = ctx.size.dpr * (ctx.size.h / 900);
  rim.color.copy(LIME).lerp(AMBER, out * 0.8);
  rim.intensity = 2.4 + s2.stop * 1.2;
  // a hair line beside the last machine from the moment he reaches it; it splits as he walks up
  rift.update(out, t, ctx, exitLine(p));
  rift.cross(hero);
  ctx.bg.copy(BG).lerp(AMBER, out * 0.012);
  ctx.fog.color.copy(ctx.bg);
  ctx.fog.density = 0.034;
  ctx.post.bloom = 0.62;
  ctx.post.threshold = 0.8;
  ctx.post.vignette = 0.55;
  ctx.scene.environmentIntensity = 0.5;

  /* ----- copy ----- */
  const c0 = 1 - smooth(seg(p, 0.03, 0.055));
  const c1 = win(p, 0.06, 0.33, 0.022);
  const c2 = win(p, 0.405, 0.662, 0.022);
  const c3 = win(kbP(p), 0.738, 0.966, 0.022) * kbCopy(p);
  show(cases[0], c0);
  show(cases[1], c1);
  show(cases[2], c2);
  show(cases[3], c3);
  css(scrim, 'opacity', Math.max(c0, c1, c2, c3));
}

function leave() {
  for (const b of backs) b.video?.pause();
  document.documentElement.style.cursor = '';
}

const chapter: Chapter = { id: 'systems', group, init, update, leave };
export default chapter;
