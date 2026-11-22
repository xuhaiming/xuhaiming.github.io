import * as THREE from 'three';
import type { Chapter, Ctx, Frame } from '../../world/types';
import { mix, seg, show, smooth } from '../../world/util';

/**
 * Contact. The bookend to Origin: the figure stands in a ring of the colours it walked through,
 * waves, and at the very end returns to points.
 */

const group = new THREE.Group();
const HUES = ['#3f6bff', '#b8ff3c', '#ffa62b', '#2fe0c2', '#ff5d8f', '#9b7bff'];
const BG = new THREE.Color('#030407');
let rings: THREE.Mesh[] = [];
let floor: THREE.Mesh;
let copy: HTMLElement | null = null;
const pos = new THREE.Vector3();
const aim = new THREE.Vector3();

function init(_ctx: Ctx, el: HTMLElement) {
  copy = el.querySelector<HTMLElement>('.c-copy');
  const key = new THREE.DirectionalLight('#f1f6ff', 1.8);
  key.position.set(-2.5, 4, 3);
  group.add(key, new THREE.HemisphereLight('#9fbfff', '#06070b', 0.6));

  // one thin ring of light per chapter, laid on the floor around the figure
  HUES.forEach((hex, i) => {
    const r = 1.15 + i * 0.52;
    const g = new THREE.RingGeometry(r, r + 0.022, 160, 1, 0, Math.PI * 2);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uCol: { value: new THREE.Color(hex) }, uA: { value: 0 }, uT: { value: 0 }, uI: { value: i } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */ `
          uniform vec3 uCol; uniform float uA, uT, uI; varying vec3 vP;
          void main() {
            float ang = atan(vP.z, vP.x);
            float run = 0.5 + 0.5 * sin(ang * 2.0 - uT * (0.35 + uI * 0.07) + uI * 1.7);
            gl_FragColor = vec4(uCol * (0.35 + 1.9 * pow(run, 6.0)) * uA, 1.0);
          }`,
      }),
    );
    m.position.y = 0.01;
    rings.push(m);
    group.add(m);
  });

  const fg = new THREE.CircleGeometry(14, 64);
  fg.rotateX(-Math.PI / 2);
  floor = new THREE.Mesh(
    fg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uA: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA; varying vec3 vP; void main(){ float d = length(vP.xz); gl_FragColor = vec4(vec3(0.6, 0.75, 1.0) * exp(-d * d * 0.5) * 0.14 * uA, 1.0); }',
    }),
  );
  group.add(floor);
}

function update(f: Frame, ctx: Ctx) {
  const { p, io, t } = f;
  const hero = ctx.hero;
  const narrow = ctx.size.narrow;
  const arrive = smooth(seg(p, 0, 0.25));
  const fade = smooth(seg(p, 0.72, 1));

  hero.root.rotation.y = mix(0.7, 0.25, arrive);
  hero.form = Math.max(1 - io, fade);
  hero.scatter = Math.max(1 - io, fade * 0.3);
  hero.tintMix = 0.5;
  hero.push = 1;
  hero.shadow = 0.8;
  if (p > 0.3 && p < 0.62) hero.pose = 'wave';

  rings.forEach((m, i) => {
    const u = (m.material as THREE.ShaderMaterial).uniforms;
    u.uA.value = smooth(seg(p, 0.05 + i * 0.06, 0.3 + i * 0.06)) * io;
    u.uT.value = t;
    // additive: a ring at zero adds nothing, so do not draw it
    m.visible = u.uA.value > 0.001;
  });
  (floor.material as THREE.ShaderMaterial).uniforms.uA.value = io;
  floor.visible = io > 0.001;

  const orbit = t * 0.04;
  pos.set(Math.sin(orbit) * 0.6 + (narrow ? 0 : 0.3), mix(2.6, 1.5, arrive), mix(8.5, narrow ? 7.4 : 5.6, arrive));
  aim.set(narrow ? 0 : -1.25, narrow ? 0.55 : 1.0, 0);
  if (!ctx.still) {
    pos.x += ctx.pointer.x * 0.25;
    pos.y += ctx.pointer.y * 0.1;
  }
  ctx.camera.position.copy(pos);
  ctx.camera.lookAt(aim);

  ctx.bg.copy(BG);
  ctx.fog.color.copy(ctx.bg);
  ctx.fog.density = 0.015;
  ctx.post.bloom = 0.45;
  ctx.post.threshold = 0.95;
  show(copy, smooth(seg(p, 0.08, 0.3)));
}

const chapter: Chapter = { id: 'contact', group, init, update };
export default chapter;
