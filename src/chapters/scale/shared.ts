import * as THREE from 'three';
import type { Ctx, Frame } from '../../world/types';
import { css } from '../../world/util';

export const AMBER = new THREE.Color('#ffa62b');
export const SODIUM = new THREE.Color('#ff8a1f');
export const TUNGSTEN = new THREE.Color('#ffd9a0');

/** what the director hands each of the three worlds every frame */
export interface StationFrame {
  /** presence 0..1: how much of this world is on stage */
  k: number;
  /** progress through this world's own beat, 0..1 (clamped) */
  local: number;
  /** true while the beat's DOM should accept input */
  live: boolean;
  f: Frame;
  ctx: Ctx;
}

export interface Station {
  group: THREE.Group;
  update(u: StationFrame): void;
  /** the chapter is no longer on screen: drop pointer state */
  sleep?(): void;
  /** capture hook, e.g. act=pick-2 */
  act?(name: string, arg: string): void;
}

export function canvasTex(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { cv, g, tex };
}

export function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

export const FONT = (px: number, weight = 600, stretch = 'normal') => `${weight} ${stretch} ${px}px Archivo, "Helvetica Neue", Arial, sans-serif`;

export function loadImage(url: string) {
  return new Promise<HTMLImageElement | null>((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}

/** a GLB prop, cloned, normalised so it can be dropped in: materials tamed for the dark stage */
export async function prop(ctx: Ctx, url: string, opts: { height?: number; env?: number; rough?: number } = {}) {
  try {
    const { scene } = await ctx.glb(url);
    const o = scene.clone(true);
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    if (opts.height) o.scale.multiplyScalar(opts.height / Math.max(size.y, 1e-3));
    const b2 = new THREE.Box3().setFromObject(o);
    o.position.y -= b2.min.y;
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.envMapIntensity = opts.env ?? 0.6;
      if (opts.rough !== undefined) mat.roughness = Math.max(mat.roughness, opts.rough);
      m.material = mat;
    });
    const wrap = new THREE.Group();
    wrap.add(o);
    return wrap;
  } catch (e) {
    console.warn('[scale] prop missing', url, e);
    return null;
  }
}

const v = new THREE.Vector3();
const out = { x: 0, y: 0, z: 0 };
/** pin a DOM element to a world position (its own CSS decides the anchor through translate(-50%, …)) */
export function pin(ctx: Ctx, el: HTMLElement | null, world: THREE.Vector3, dx = 0, dy = 0) {
  if (!el) return false;
  ctx.project(v.copy(world), out);
  const ok = out.z > -1 && out.z < 1;
  css(el, 'transform', `translate3d(${(out.x + dx).toFixed(1)}px, ${(out.y + dy).toFixed(1)}px, 0)`);
  return ok;
}

/** soft round glow: lantern halos, light pools in the air */
export function glow(color: THREE.Color, size: number, strength = 1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uCol: { value: color.clone() }, uA: { value: strength } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCol; uniform float uA; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.6); gl_FragColor = vec4(uCol * a * uA, 1.0); }',
    }),
  );
  return m;
}

/** a cone of light in haze, drawn as an open additive cone that fades along its length and at its silhouette */
export function beam(color: THREE.Color, length: number, r0: number, r1: number) {
  const g = new THREE.CylinderGeometry(r0, r1, length, 40, 1, true);
  g.translate(0, -length / 2, 0);
  const m = new THREE.Mesh(
    g,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uCol: { value: color.clone() }, uA: { value: 1 }, uT: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
        void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; uniform float uA, uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main(){
          float along = 1.0 - vUv.y;
          float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
          float dustv = 0.82 + 0.18 * sin(vW.y * 9.0 + vW.x * 5.0 + uT * 0.6);
          float a = rim * pow(clamp(1.0 - along, 0.0, 1.0), 1.5) * dustv;
          gl_FragColor = vec4(uCol * a * uA, 1.0);
        }`,
    }),
  );
  return m;
}

/**
 * One material for every picture card in the chapter: rounded corners, a hairline of light on the edge,
 * and an optional bounding box drawn in the picture's own UV space (origin top-left).
 */
export function cardMat(tex: THREE.Texture | null) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      tMap: { value: tex },
      uA: { value: 1 },
      uR: { value: 0.06 },
      uEdge: { value: 0.5 },
      uGain: { value: 0.9 },
      uCol: { value: AMBER.clone() },
      uBox: { value: new THREE.Vector4(0.2, 0.2, 0.8, 0.8) },
      uBoxA: { value: 0 },
      uBoxK: { value: 1 },
      uDim: { value: 0 },
      uT: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap; uniform float uA, uR, uEdge, uGain, uBoxA, uBoxK, uDim, uT; uniform vec3 uCol; uniform vec4 uBox;
      varying vec2 vUv;
      float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main(){
        vec2 p = vUv - 0.5;
        float d = sdRR(p, vec2(0.5), uR);
        float aa = fwidth(d) * 1.2;
        float m = 1.0 - smoothstep(-aa, aa, d);
        vec3 c = texture2D(tMap, vUv).rgb * uGain;
        vec2 q = vec2(vUv.x, 1.0 - vUv.y);
        if (uBoxA > 0.001) {
          vec2 b0 = uBox.xy;
          vec2 b1 = mix(uBox.xy, uBox.zw, uBoxK);
          vec2 bc = (b0 + b1) * 0.5;
          vec2 bh = max((b1 - b0) * 0.5, vec2(0.0005));
          vec2 dd = abs(q - bc) - bh;
          float bd = max(dd.x, dd.y);
          float w = fwidth(q.x) * 1.6;
          float line = 1.0 - smoothstep(w, w * 2.0, abs(bd));
          // marching dashes while the box is still being drawn
          float run = step(0.5, fract((q.x + q.y) * 26.0 - uT * 1.5));
          line *= mix(1.0, 0.45 + 0.55 * run, 1.0 - step(0.999, uBoxK));
          vec2 cd = abs(abs(q - bc) - bh);
          float corner = (1.0 - smoothstep(w * 3.0, w * 4.0, max(cd.x, cd.y)));
          float inside = 1.0 - smoothstep(0.0, w, bd);
          c *= mix(1.0, mix(1.0 - uDim, 1.0, inside), uBoxA);
          c += uCol * 0.1 * inside * uBoxA;
          c = mix(c, uCol * 1.35, max(line, corner) * uBoxA);
        }
        float edge = 1.0 - smoothstep(0.004, 0.004 + aa, abs(d + 0.006));
        c += uCol * edge * uEdge;
        gl_FragColor = vec4(c, m * uA);
      }`,
  });
}

/** small pseudo-random stream so layouts are the same on every load */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() };
