import * as THREE from 'three';
import type { Ctx } from '../../world/types';
import { clamp01, css, damp, smooth } from '../../world/util';

/** Local helpers for the systems chapter. */

export const LIME = new THREE.Color('#b8ff3c');
export const PALE = new THREE.Color('#eaffc4');
export const STOP = new THREE.Color('#ff5a36');

export const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
export const outCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const outBack = (t: number) => {
  t = clamp01(t);
  const c = 1.55;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/* ---------- DOM pinned to 3D ---------- */

const pr = { x: 0, y: 0, z: 0 };
/**
 * Pin a DOM element to a world position. The element is absolutely positioned at 0,0 and aligned
 * with the CSS `translate` property, so only `transform` is written here. `depth` adds pointer
 * parallax (cards nearer the viewer slide more). `pad` keeps the anchor inside the viewport.
 */
export function pin(ctx: Ctx, el: HTMLElement | null, v: THREE.Vector3, amount: number, depth = 0, pad = 0) {
  if (!el) return;
  if (amount < 0.01) {
    css(el, 'opacity', 0);
    css(el, 'visibility', 'hidden');
    return;
  }
  ctx.project(v, pr);
  const off = pr.z > 1 || pr.z < -1;
  let x = pr.x - (ctx.still ? 0 : ctx.pointer.x * depth * 16);
  let y = pr.y + (ctx.still ? 0 : ctx.pointer.y * depth * 10);
  if (pad) {
    x = Math.min(ctx.size.w - pad, Math.max(pad, x));
    y = Math.min(ctx.size.h - 8, Math.max(ctx.size.narrow ? 124 : 112, y));
  }
  css(el, 'transform', `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`);
  css(el, 'opacity', off ? 0 : amount);
  css(el, 'visibility', off ? 'hidden' : 'visible');
}

/* ---------- scroll value that the visitor can take over ---------- */

/**
 * A value that follows scroll until the visitor operates the machine. Then it follows the visitor
 * (a timed play or a set value) and hands back to scroll once they scroll on.
 */
export class Takeover {
  on = false;
  playing = false;
  value = 0;
  mix = 0;
  private p0 = 0;
  private t0 = -1;
  private dur = 1;
  private from = 0;
  private pending = false;

  play(dur: number, from = 0) {
    this.on = true;
    this.playing = true;
    this.pending = true;
    this.dur = dur;
    this.from = from;
    this.value = from;
  }
  set(v: number) {
    this.on = true;
    this.playing = false;
    this.pending = true;
    this.value = v;
  }
  release() {
    this.on = false;
    this.playing = false;
  }
  resolve(scrollValue: number, p: number, t: number, dt: number, instant = false) {
    if (this.pending) {
      this.pending = false;
      this.p0 = p;
      this.t0 = t;
    }
    if (this.on) {
      if (this.playing) {
        this.value = instant ? 1 : this.from + (1 - this.from) * clamp01((t - this.t0) / this.dur);
        if (this.value >= 1) this.playing = false;
      }
      if (Math.abs(p - this.p0) > 0.022) this.release();
    }
    this.mix = instant ? (this.on ? 1 : 0) : this.mix + ((this.on ? 1 : 0) - this.mix) * damp(this.on ? 14 : 3.5, dt);
    return scrollValue + (this.value - scrollValue) * this.mix;
  }
}

/* ---------- soft light beams (camera-facing ribbons, never 1 px lines) ---------- */

export class Beams {
  mesh: THREE.Mesh;
  private a: Float32Array;
  private b: Float32Array;
  private w: Float32Array;
  private geo: THREE.BufferGeometry;
  readonly mat: THREE.ShaderMaterial;

  constructor(readonly count: number, color = LIME) {
    const n = count;
    this.a = new Float32Array(n * 4 * 3);
    this.b = new Float32Array(n * 4 * 3);
    this.w = new Float32Array(n * 4 * 2);
    const corner = new Float32Array(n * 4 * 2);
    const idx = new Uint16Array(n * 6);
    for (let i = 0; i < n; i++) {
      corner.set([0, -1, 0, 1, 1, -1, 1, 1], i * 8);
      idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3));
    g.setAttribute('aA', new THREE.BufferAttribute(this.a, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aB', new THREE.BufferAttribute(this.b, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aW', new THREE.BufferAttribute(this.w, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uCol: { value: color.clone() }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec3 aA, aB; attribute vec2 aW, aCorner; varying vec2 vUv; varying float vI;
        void main() {
          vec4 a = modelViewMatrix * vec4(aA, 1.0);
          vec4 b = modelViewMatrix * vec4(aB, 1.0);
          vec4 p = mix(a, b, aCorner.x);
          vec2 d = normalize((b.xy / max(-b.z, 0.01)) - (a.xy / max(-a.z, 0.01)) + vec2(1e-5));
          p.xy += vec2(-d.y, d.x) * aCorner.y * aW.x;
          vUv = aCorner; vI = aW.y;
          gl_Position = projectionMatrix * p;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; uniform float uTime; varying vec2 vUv; varying float vI;
        void main() {
          float core = exp(-vUv.y * vUv.y * 9.0);
          float ends = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
          float run = 0.7 + 0.3 * sin(vUv.x * 18.0 - uTime * 6.0);
          gl_FragColor = vec4(mix(uCol, vec3(1.0), core * core * 0.5) * core * ends * run * vI, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
  }

  set(i: number, a: THREE.Vector3, b: THREE.Vector3, width: number, intensity: number) {
    for (let k = 0; k < 4; k++) {
      const o = (i * 4 + k) * 3;
      this.a[o] = a.x;
      this.a[o + 1] = a.y;
      this.a[o + 2] = a.z;
      this.b[o] = b.x;
      this.b[o + 1] = b.y;
      this.b[o + 2] = b.z;
      const q = (i * 4 + k) * 2;
      this.w[q] = width;
      this.w[q + 1] = intensity;
    }
  }
  off(i: number) {
    for (let k = 0; k < 4; k++) this.w[(i * 4 + k) * 2 + 1] = 0;
  }
  commit(t: number) {
    this.geo.attributes.aA.needsUpdate = true;
    this.geo.attributes.aB.needsUpdate = true;
    this.geo.attributes.aW.needsUpdate = true;
    this.mat.uniforms.uTime.value = t;
  }
}

/* ---------- a light fibre along a curve: draws on, then carries pulses ---------- */

export function fibre(points: THREE.Vector3[], radius = 0.014, color = LIME) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  const geo = new THREE.TubeGeometry(curve, 56, radius, 6, false);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uDraw: { value: 0 }, uFlow: { value: 0 }, uTime: { value: 0 }, uCol: { value: color.clone() }, uDir: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uDraw, uFlow, uTime, uDir; uniform vec3 uCol; varying vec2 vUv;
      void main() {
        float on = step(vUv.x, uDraw);
        float head = smoothstep(0.06, 0.0, uDraw - vUv.x) * step(uDraw, 0.999);
        float ph = fract(vUv.x * 3.0 - uTime * 0.55 * uDir);
        float pulse = smoothstep(0.82, 1.0, ph) * uFlow;
        vec3 c = uCol * (0.16 + head * 2.5 + pulse * 2.2) * on;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, mat, curve };
}

/* ---------- canvas helpers ---------- */

export function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export async function fontsReady() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('600 20px Archivo'), document.fonts.load('400 20px Archivo')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* draw with the fallback face */
  }
}

/* ---------- camera keyframes ---------- */

export interface Shot {
  /** camera position and aim, world units */
  pos: [number, number, number];
  aim: [number, number, number];
  fov?: number;
}
export interface Key {
  p: number;
  wide: Shot;
  narrow: Shot;
}

const va = new THREE.Vector3();
const vb = new THREE.Vector3();
export function shotAt(keys: Key[], p: number, narrow: boolean, pos: THREE.Vector3, aim: THREE.Vector3) {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].p) i++;
  const k0 = keys[i];
  const k1 = keys[Math.min(i + 1, keys.length - 1)];
  const t = smooth((p - k0.p) / Math.max(1e-5, k1.p - k0.p));
  const s0 = narrow ? k0.narrow : k0.wide;
  const s1 = narrow ? k1.narrow : k1.wide;
  pos.lerpVectors(va.fromArray(s0.pos), vb.fromArray(s1.pos), t);
  aim.lerpVectors(va.fromArray(s0.aim), vb.fromArray(s1.aim), t);
  const f0 = s0.fov ?? (narrow ? 48 : 35);
  const f1 = s1.fov ?? (narrow ? 48 : 35);
  return f0 + (f1 - f0) * t;
}

/** Prepare a generated GLB prop: clone, tame the baked materials so the chapter's lights shape it. */
export function prop(src: THREE.Group, opts: { tint?: number; rough?: number; metal?: number; env?: number } = {}) {
  const o = src.clone(true);
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    mat.color.multiplyScalar(opts.tint ?? 0.8);
    mat.roughness = opts.rough ?? Math.min(0.75, Math.max(0.38, mat.roughness));
    mat.metalness = opts.metal ?? Math.max(0.55, mat.metalness);
    mat.envMapIntensity = opts.env ?? 1.6;
    m.material = mat;
  });
  return o;
}
