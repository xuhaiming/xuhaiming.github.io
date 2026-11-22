import * as THREE from 'three';
import type { Chapter, Ctx, Frame } from '../../world/types';
import { mix, seg, show, smooth, win } from '../../world/util';
import { Rift, exitCopy, exitOpen, exitWalk } from '../../world/Rift';

/**
 * Origin. A cloud of points gathers into a figure, the figure turns solid from the feet up,
 * then turns and walks into a rift of light that leads into the next chapter.
 */

const group = new THREE.Group();
const NEXT = new THREE.Color('#3f6bff');
const TINT = new THREE.Color('#cfe6ff');
const BG = new THREE.Color('#030407');
const RIFT_Z = -10;

let floor: THREE.Mesh;
let rift: Rift;
let dust: THREE.Points;
let rim: THREE.DirectionalLight;
let beats: HTMLElement[] = [];
let hint: HTMLElement | null = null;
let t0 = -1;

const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
const a = new THREE.Vector3();
const b = new THREE.Vector3();

function init(ctx: Ctx, el: HTMLElement) {
  beats = ['.o-a', '.o-b', '.o-c'].map((s) => el.querySelector<HTMLElement>(s)!);
  hint = el.querySelector<HTMLElement>('.o-hint');

  const key = new THREE.DirectionalLight('#eaf2ff', 1.7);
  key.position.set(2.5, 4, 3.5);
  rim = new THREE.DirectionalLight(NEXT, 0);
  rim.position.set(-1.2, 2.2, -4);
  const fill = new THREE.HemisphereLight('#8fb4ff', '#05060a', 0.5);
  const back = new THREE.DirectionalLight('#9fc4ff', 2.4);
  back.position.set(-3, 3, -4);
  group.add(key, rim, fill, back);

  // the ground: a pool of light under the figure and a dot lattice that fades with distance
  const fg = new THREE.PlaneGeometry(90, 90);
  fg.rotateX(-Math.PI / 2);
  floor = new THREE.Mesh(
    fg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uPool: { value: 0 }, uHero: { value: new THREE.Vector3() } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */ `
        uniform float uPool; uniform vec3 uHero; varying vec3 vW;
        void main() {
          vec2 g = abs(fract(vW.xz * 1.6) - 0.5);
          float dotv = smoothstep(0.07, 0.02, length(g));
          float far = exp(-length(vW.xz - uHero.xz) * 0.16);
          float pool = exp(-dot(vW.xz - uHero.xz, vW.xz - uHero.xz) * 0.55) * uPool;
          vec3 col = vec3(0.75, 0.86, 1.0) * (dotv * far * 0.34 + pool * 0.16);
          gl_FragColor = vec4(col, 1.0);
        }`,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(floor);

  // the way on: a rift of the next chapter's light at the end of the floor
  rift = new Rift(ctx, { color: NEXT, height: 3.6, width: 1.3, light: 14 });
  rift.object3D.position.set(0, 0, RIFT_Z);
  group.add(rift.object3D);

  const n = [260, 520, 900][ctx.tier];
  const P = new Float32Array(n * 3);
  const S = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    P[i * 3] = (Math.random() - 0.5) * 22;
    P[i * 3 + 1] = Math.random() * 7;
    P[i * 3 + 2] = 6 - Math.random() * 26;
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
      uniforms: { uTime: { value: 0 }, uA: { value: 1 }, uS: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime, uS; attribute float aSeed; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.03 + aSeed * 0.05), 7.0);
          p.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * (1.0 + aSeed * 2.2) * (6.0 / -mv.z);
          vA = (0.25 + 0.75 * aSeed) * smoothstep(0.0, 0.8, p.y) * smoothstep(7.0, 5.5, p.y);
        }`,
      fragmentShader: 'uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.7, 0.82, 1.0) * smoothstep(0.5, 0.0, d) * vA * uA * 0.5, 1.0); }',
    }),
  );
  dust.frustumCulled = false;
  group.add(dust);
}

function update(f: Frame, ctx: Ctx) {
  const { p, io, t } = f;
  const hero = ctx.hero;
  const narrow = ctx.size.narrow;
  if (t0 < 0) t0 = t;
  const boot = ctx.shot || ctx.still ? 1 : smooth((t - t0) / 3.2);

  // ---- hero: gather, solidify, turn, walk ----
  const gather = smooth(seg(p, 0, 0.16));
  const solid = smooth(seg(p, 0.14, 0.44));
  const turn = smooth(seg(p, 0.66, 0.76));
  // he reaches the rift's plane at the shared crossing moment
  const dist = exitWalk(p, 0.74, -RIFT_Z);
  hero.root.position.set(0, 0, -dist);
  hero.root.rotation.y = turn * Math.PI;
  hero.walkTo(dist);
  hero.form = Math.max(1 - solid, 1 - io);
  hero.scatter = Math.max(mix(0.34, 0, gather) * boot + (1 - boot), 1 - io);
  hero.push = 1;
  hero.tint.copy(TINT);
  hero.tintMix = mix(0.8, 0.35, solid);
  hero.glow = 1;
  hero.shadow = solid;
  if (p > 0.47 && p < 0.62) hero.pose = 'wave';

  // ---- camera ----
  const side = narrow ? 0 : 1;
  // A: wide, the figure right of the headline. B: closer three-quarter. C: behind, facing the rift.
  a.set(0.0, 1.25, narrow ? 9.2 : 6.6);
  b.set(narrow ? 1.0 : 2.3, 1.45, narrow ? 6.6 : 4.3);
  const ab = smooth(seg(p, 0.1, 0.5));
  camPos.lerpVectors(a, b, ab);
  camAim.set(mix(-1.45 * side, -0.95 * side, ab), narrow ? 0.72 : 0.98, 0);
  const bc = smooth(seg(p, 0.6, 0.8));
  // the camera stops a few steps short of the rift and lets him walk on into it
  const stop = RIFT_Z + (narrow ? 8.6 : 7.6);
  a.set(narrow ? 0.35 : 0.95, 1.55, Math.max(4.9 - dist, stop));
  camPos.lerp(a, bc);
  b.set(0, mix(1.35, 1.6, smooth(seg(dist, 4, 9))), Math.max(-dist - 5, RIFT_Z - 2.5));
  // portrait: a little wider and aimed lower, so he stands above the headline band at the foot
  if (narrow) b.y -= 0.42;
  camAim.lerp(b, bc);
  if (narrow) ctx.camera.fov = mix(35, 41, bc);
  if (!ctx.still) {
    camPos.x += ctx.pointer.x * 0.22;
    camPos.y += ctx.pointer.y * 0.1;
  }
  ctx.camera.position.copy(camPos);
  ctx.camera.lookAt(camAim);

  // ---- world ----
  // the rift: a far hair line behind him from the second beat, splitting open as he walks up to it
  const open = exitOpen(p);
  rift.update(open, t, ctx, smooth(seg(p, 0.3, 0.52)));
  rift.cross(hero);
  const fm = floor.material as THREE.ShaderMaterial;
  fm.uniforms.uPool.value = boot * mix(0.6, 1, solid) * (1 - open * 0.6);
  fm.uniforms.uHero.value.copy(hero.root.position);
  rim.intensity = open * 4;
  const dm = dust.material as THREE.ShaderMaterial;
  dm.uniforms.uTime.value = t;
  dm.uniforms.uA.value = boot;
  dm.uniforms.uS.value = ctx.size.dpr * (ctx.size.h / 900);

  ctx.bg.copy(BG).lerp(NEXT, open * 0.035);
  ctx.fog.color.copy(ctx.bg);
  ctx.fog.density = 0.028;
  ctx.post.bloom = mix(0.6, 0.5, open);
  ctx.post.threshold = 0.9;

  // ---- copy ----
  show(beats[0], 1 - smooth(seg(p, 0.1, 0.2)));
  show(beats[1], win(p, 0.26, 0.58, 0.06));
  show(beats[2], win(p, 0.7, 1.01, 0.06) * exitCopy(p));
  show(hint, 1 - smooth(seg(p, 0.02, 0.1)));
}

const chapter: Chapter = { id: 'origin', group, init, update };
export default chapter;
