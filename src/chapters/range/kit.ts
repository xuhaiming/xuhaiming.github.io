import * as THREE from 'three';
import type { Ctx, Frame } from '../../world/types';

/** Shared pieces for the four stations of the Range chapter. */

export const COBALT = new THREE.Color('#3f6bff');
export const ICE = new THREE.Color('#cfe0ff');
export const INK = '#eef3ff';

export interface Station {
  group: THREE.Group;
  /** build everything; `panel` is the station's DOM block, `layer` the label layer */
  init(ctx: Ctx, panel: HTMLElement, layer: HTMLElement): void;
  /**
   * s: scroll progress through the stop, 0..1. on: 0..1 presence of the stop (labels, controls).
   * pre: 0..1 overview preview: show the finished exhibit from afar, whatever s says.
   */
  update(s: number, on: number, pre: number, f: Frame, ctx: Ctx): void;
  /** a tap / click that landed on the canvas while the station is the focus */
  tap(ctx: Ctx): void;
  /** capture hook */
  act(name: string, ctx: Ctx): void;
}

/* ---------- the hall's haze loop ---------- */

// One video shared by the far wall and the craft screen. It plays only while the chapter is on
// screen: decoded once so the texture has a frame, then paused until `hazeOn(true)`.
const haze = { el: null as HTMLVideoElement | null, on: false, ready: null as Promise<THREE.VideoTexture | null> | null };
export function hazeLoop(ctx: Ctx, set: (t: THREE.Texture) => void) {
  if (ctx.tier === 0 || ctx.still) return;
  haze.ready ??= ctx
    .video('/assets/range/haze.mp4', { poster: '/assets/range/haze.jpg' })
    .then((v) =>
      v.el
        .play()
        .then(() => firstFrame(v.el))
        .then(() => {
          haze.el = v.el;
          if (!haze.on) v.el.pause();
          return v.tex;
        }),
    )
    .catch(() => null);
  haze.ready.then((t) => t && set(t));
}
/** resolves once a decoded frame has been presented (so a VideoTexture paused right after has content) */
export function firstFrame(el: HTMLVideoElement) {
  return new Promise<void>((res) => {
    if (!('requestVideoFrameCallback' in el)) return res();
    el.requestVideoFrameCallback(() => res());
    setTimeout(res, 1500);
  });
}
export function hazeOn(on: boolean) {
  haze.on = on;
  const v = haze.el;
  if (!v) return;
  if (on && v.paused) v.play().catch(() => {});
  else if (!on && !v.paused) v.pause();
}

/* ---------- canvas textures ---------- */

export interface Paint {
  tex: THREE.CanvasTexture;
  g: CanvasRenderingContext2D;
  w: number;
  h: number;
  done(): void;
}

export function paint(w: number, h: number, ctx: Ctx): Paint {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy());
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex, g, w, h, done: () => (tex.needsUpdate = true) };
}

export const FONT = (px: number, weight = 500) => `${weight} ${px}px Archivo, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;
export const MONO = (px: number, weight = 500) => `${weight} ${px}px ui-monospace, "Cascadia Mono", "SF Mono", Consolas, monospace`;

export function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/* ---------- DOM labels pinned to 3D points ---------- */

export interface Tag {
  /** zero-size anchor moved by place() */
  el: HTMLElement;
  /** the visible chip (a <button> when interactive) */
  in: HTMLElement;
  at: THREE.Vector3;
  /** current opacity, eased */
  a: number;
}

const pr = { x: 0, y: 0, z: 0 };

export function tag(layer: HTMLElement, html: string, cls = '', button = false): Tag {
  const el = document.createElement('div');
  el.className = `r-tag ${cls}`;
  const inner = document.createElement(button ? 'button' : 'span');
  inner.className = 'in';
  inner.innerHTML = html;
  if (button) (inner as HTMLButtonElement).type = 'button';
  el.appendChild(inner);
  el.style.visibility = 'hidden';
  layer.appendChild(el);
  return { el, in: inner, at: new THREE.Vector3(), a: 0 };
}

/** put a tag at its world anchor; `alpha` 0 hides it. Cheap: writes only when something moved. */
export function place(ctx: Ctx, t: Tag, alpha: number, dt: number) {
  t.a += (alpha - t.a) * Math.min(1, dt * 9);
  if (t.a < 0.01 && alpha <= 0) {
    if (t.el.style.visibility !== 'hidden') t.el.style.visibility = 'hidden';
    return;
  }
  ctx.project(t.at, pr);
  const off = pr.z > 1 || pr.z < -1;
  const vis = off ? 'hidden' : 'visible';
  if (t.el.style.visibility !== vis) t.el.style.visibility = vis;
  if (off) return;
  t.el.style.opacity = t.a.toFixed(3);
  t.el.style.transform = `translate3d(${pr.x.toFixed(1)}px, ${pr.y.toFixed(1)}px, 0)`;
}

/** same, at explicit screen pixels */
export function placeAt(t: Tag, x: number, y: number, alpha: number, dt: number) {
  t.a += (alpha - t.a) * Math.min(1, dt * 9);
  const vis = t.a < 0.01 ? 'hidden' : 'visible';
  if (t.el.style.visibility !== vis) t.el.style.visibility = vis;
  if (t.a < 0.01) return;
  t.el.style.opacity = t.a.toFixed(3);
  t.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
}

/* ---------- materials ---------- */

/** dark coated metal that takes the station light: used for every machined part */
export function metal(color = '#0b1226', rough = 0.38, metalness = 0.75) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness, clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 1.6 });
}

/** a lit part: emissive cobalt whose strength is driven per frame */
export function lamp(color: THREE.ColorRepresentation = COBALT, k = 1) {
  const m = new THREE.MeshStandardMaterial({ color: '#05070d', emissive: color, emissiveIntensity: k, roughness: 0.4, metalness: 0 });
  return m;
}

/** soft round additive sprite points with per-point size / alpha attributes (aS, aA) */
export function pointsMat(color: THREE.ColorRepresentation = ICE) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color(color) }, uS: { value: 1 }, uA: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uS; attribute float aS; attribute float aA; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uS * aS * (6.0 / -mv.z);
        vA = aA;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform float uA; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d) * vA * uA;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uCol * a, 1.0);
      }`,
  });
}

/** additive glow disc on the floor / behind a part */
export function glowMat(color: THREE.ColorRepresentation = COBALT) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(color) }, uA: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uCol; uniform float uA; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.4) * uA; gl_FragColor = vec4(uCol * a, 1.0); }',
  });
}

export const NOISE = /* glsl */ `
float hash31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

/** a plinth every exhibit stands on: low machined drum with a lit seam */
export function plinth(r: number, h = 0.16) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, h, 64), metal('#080c18', 0.5, 0.6));
  body.position.y = h / 2;
  const seam = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, 0.008, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color('#3f6bff').multiplyScalar(2.2) }));
  seam.rotation.x = Math.PI / 2;
  seam.position.y = h * 0.72;
  const top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 64), metal('#0a1020', 0.28, 0.7));
  top.rotation.x = -Math.PI / 2;
  top.position.y = h + 0.001;
  g.add(body, seam, top);
  return g;
}

/** normalise a loaded prop: clone, shade consistently, darken to sit in the hall */
export function prop(src: THREE.Group, dim = 0.75) {
  const g = src.clone(true);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    mat.color.multiplyScalar(dim);
    mat.envMapIntensity = 1.2;
    m.material = mat;
  });
  return g;
}

const _v = new THREE.Vector3();
/** distance from a world point to the pointer ray (world units) */
export function rayDist(ray: THREE.Ray, p: THREE.Vector3) {
  return Math.sqrt(ray.distanceSqToPoint(_v.copy(p)));
}
