import * as THREE from 'three';
import type { Hero } from './Hero';
import type { Ctx } from './types';
import { clamp01, mix, seg, smooth } from './util';

/**
 * The light rift: the way from one chapter into the next.
 *
 * Far away it is a hair-thin vertical line of light. As it opens, the line splits sideways into two
 * ragged edges, and between them you look into the next chapter: a floor of points running away to a
 * bright horizon in that chapter's colour, motes hanging at different depths. The edges shed fine
 * debris, the air around it holds a soft haze, the floor in front takes a fan of light (with the
 * hero's shadow in it) and a point light spills the colour onto everything nearby.
 *
 * The object's origin is the foot of the rift on the floor; it faces +Z (the side you approach from).
 * Everything is driven by `update(open, t, ctx, on)` and `cross(hero)`, pure functions of the inputs.
 * No render targets: the space beyond is ray-marched analytically on the slit quad itself.
 */

/**
 * The exit beat, the same in every chapter (fractions of chapter progress):
 *   copy, panels and labels gone by `copy`; the hairline appears over `line`; it splits over `open`;
 *   the hero reaches the rift's plane at `cross` and is gone in points by ~0.995.
 */
export const EXIT = {
  copy: [0.875, 0.915] as const,
  cam: [0.86, 0.93] as const,
  line: [0.9, 0.94] as const,
  open: [0.94, 0.97] as const,
  cross: 0.975,
};
/** how present the rift is (the hairline fading in) */
export const exitLine = (p: number) => smooth(seg(p, EXIT.line[0], EXIT.line[1]));
/** how far it has split */
export const exitOpen = (p: number) => smooth(seg(p, EXIT.open[0], EXIT.open[1]));
/** 1 while chapter copy may show, 0 once the exit begins */
export const exitCopy = (p: number) => 1 - smooth(seg(p, EXIT.copy[0], EXIT.copy[1]));
/**
 * Distance walked on the way out: starts from rest at p0, eases into a steady pace and reaches
 * `toPlane` (the distance from his start to the rift's plane) exactly at EXIT.cross, then walks on.
 */
export function exitWalk(p: number, p0: number, toPlane: number) {
  const T = Math.max(1e-3, EXIT.cross - p0);
  const k = T * 0.35;
  const v = toPlane / (T - k / 2);
  const u = Math.max(0, p - p0);
  return u < k ? (v * u * u) / (2 * k) : v * (u - k / 2);
}

export interface RiftOpts {
  /** the next chapter's dominant colour */
  color: THREE.ColorRepresentation;
  /** height of the rift in world units (default 4.2) */
  height?: number;
  /** full width of the opening when open = 1 (default 1.7) */
  width?: number;
  /** peak point-light intensity when fully open (default 28); 0 to skip the light */
  light?: number;
  /** strength of the light laid on the floor in front (default 1) */
  floor?: number;
  /** draw the floor fan / reflection at all (default true) */
  floorPlane?: boolean;
}

/** shared GLSL: the opening's half width at height y (local units) */
const SHAPE = /* glsl */ `
  uniform float uOpen, uH, uW, uT;
  // the opening only takes the lower RIFT_SPAN of the line; above it the line goes on as a hairline
  const float RIFT_SPAN = 0.8;
  // a slender seam standing on the floor: widest a third of the way up, closing to nothing at the top
  // of the opening, where the edges run on into the hairline (no closed point)
  float riftProf(float y) {
    float yn = clamp(y / (uH * RIFT_SPAN), 0.0, 1.0);
    // a concave taper at both ends: the edges flow into the hairline instead of meeting in a point
    return pow(max(sin(3.14159265 * pow(0.04 + 0.96 * yn, 0.85)), 0.0), 1.5);
  }

  // the edges are not ruled lines: slow drift plus a fine, irregular tremor
  float riftWob(float y) {
    return sin(y * 1.7 + uT * 0.35) * 0.45 + sin(y * 4.3 - uT * 0.6 + 1.3) * 0.25
      + sin(y * 11.9 + uT * 1.1) * 0.09 + sin(y * 29.0 - uT * 2.3) * 0.035 + sin(y * 63.0 + uT * 3.7) * 0.015;
  }
  float riftHalf(float y) {
    return uOpen * uW * 0.5 * riftProf(y) * (1.0 + 0.09 * riftWob(y));
  }
  // each edge tears on its own
  float riftEdge(float y, float side) {
    return uOpen * uW * 0.5 * riftProf(y) * (1.0 + 0.065 * riftWob(y + side * 3.71));
  }
`;

/** fragment only: the screen's top band (the page header) never gets the line; it fades out before it */
const TOP = /* glsl */ `
  uniform vec2 uTop;
  float topFade() { return 1.0 - smoothstep(uTop.x - uTop.y * 1.9, uTop.x - uTop.y, gl_FragCoord.y); }
`;

const HASH = /* glsl */ `
  float rh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
`;

const vLocal = /* glsl */ `
  varying vec3 vL; varying vec3 vWp;
  void main() {
    vL = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWp = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

export class Rift {
  readonly object3D = new THREE.Group();
  readonly color: THREE.Color;
  readonly height: number;
  readonly light: THREE.PointLight | null;
  private slit: THREE.Mesh;
  private haze: THREE.Mesh;
  private floor: THREE.Mesh | null;
  private debris: THREE.Points;
  private u: Record<string, THREE.IUniform>;
  private lightMax: number;
  private floorGain: number;
  private v = new THREE.Vector3();
  private open = 0;
  /** how much the hero's points may brighten as he crosses: less for pale colours (ice) */
  private glowK = 1;
  private on = 1;

  constructor(ctx: Ctx, opts: RiftOpts) {
    this.color = new THREE.Color(opts.color);
    const H = (this.height = opts.height ?? 4.2);
    const W = opts.width ?? 1.7;
    this.lightMax = opts.light ?? 28;
    this.floorGain = opts.floor ?? 1;

    // bright hues (lime, ice) would glare at the same gain as deep ones (cobalt, violet): even them out
    const c = this.color;
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    this.glowK = Math.min(1, Math.sqrt(0.3 / Math.max(lum, 1e-3)));
    const glow = this.color.clone().multiplyScalar(Math.min(1, Math.pow(0.2 / Math.max(lum, 1e-3), 0.75)));

    // one uniform block shared by every part, so they always agree on the shape
    this.u = {
      uOpen: { value: 0 },
      uOn: { value: 1 },
      uH: { value: H },
      uW: { value: W },
      uT: { value: 0 },
      uCol: { value: glow },
      uCam: { value: new THREE.Vector3(0, 1.5, 10) },
      uFog: { value: 0 },
      uS: { value: 1 },
      uHero: { value: new THREE.Vector2(0, 99) },
      uHeroK: { value: 0 },
      uGain: { value: this.floorGain },
      uTop: { value: new THREE.Vector2(1e5, 80) },
    };

    // ---- the slit: the hot edges and the space beyond, on one quad ----
    const SW = W + 1.4;
    const sg = new THREE.PlaneGeometry(SW, H + 0.6, 1, 1);
    sg.translate(0, H / 2, 0);
    this.slit = new THREE.Mesh(
      sg,
      new THREE.ShaderMaterial({
        uniforms: this.u,
        transparent: true,
        depthWrite: false,
        // premultiplied: the glow outside adds light, the opening itself replaces what is behind it
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        vertexShader: vLocal,
        fragmentShader: /* glsl */ `
          uniform vec3 uCol, uCam; uniform float uOn, uFog;
          varying vec3 vL; varying vec3 vWp;
          ${SHAPE}
          ${TOP}
          ${HASH}
          // what you see through the opening: a floor of points running away to a lit horizon
          vec3 beyond(vec3 ro, vec3 rd, float fwx) {
            float dz = min(rd.z, -0.03);
            vec3 hot = mix(uCol, vec3(1.0), 0.4);
            float flat_ = max(length(rd.xz), 1e-3);
            float el = rd.y / flat_;
            // sky: deep colour, darker upward, a thin bright horizon far away
            // a deep, mostly dark space: colour lives in the horizon, the floor and the motes, not as a fill
            vec3 c = uCol * (0.004 + 0.025 * exp(-max(el, 0.0) * 5.0));
            c += hot * exp(-abs(el) * 60.0) * 0.22 + uCol * exp(-abs(el) * 14.0) * 0.035;
            // floor (computed unconditionally: derivatives must stay in uniform control flow)
            float down = step(rd.y, -0.002);
            float tf = max(ro.y, 0.0) / max(-rd.y, 0.002);
            vec3 hp = ro + rd * min(tf, 400.0);
            float depth = max(-hp.z, 0.0);
            vec2 gp = hp.xz * 1.4;
            vec2 g = abs(fract(gp) - 0.5);
            float fwg = length(fwidth(gp));
            float dots = smoothstep(0.1, 0.035, length(g)) * (1.0 - smoothstep(0.25, 0.7, fwg));
            float fogd = exp(-depth * 0.06);
            float lane = exp(-hp.x * hp.x * 0.1);
            vec3 fl = uCol * 0.02 + mix(uCol, hot, 0.35) * dots * (0.9 + 0.9 * lane) + hot * 0.06 * lane * exp(-depth * 0.4);
            // faint rails running away to the vanishing point: the strongest cue that the space goes on
            float rx = abs(fract(hp.x / 0.9 + 0.5) - 0.5) * 0.9;
            float fxr = max(fwidth(hp.x), 1e-4);
            float rail = smoothstep(fxr * 1.2 + 0.006, 0.0, rx) * (1.0 - smoothstep(0.3, 0.9, fxr)) * exp(-depth * 0.05);
            fl += mix(uCol, hot, 0.3) * rail * 0.22;
            c = mix(c, mix(c, fl, fogd), down);
            // a soft glow at the vanishing point, far down the middle
            float ax = abs(rd.x) / max(-rd.z, 0.05);
            c += hot * exp(-ax * 9.0 - abs(el) * 28.0) * 0.45;
            // motes hanging at several depths: real parallax as you move
            for (int i = 0; i < 4; i++) {
              float fi = float(i);
              float D = 1.8 + fi * 3.4;
              vec3 p = ro + rd * (D / -dz);
              vec2 q = p.xy * vec2(1.6, 1.25) + vec2(fi * 7.31, fi * 3.17 + uT * 0.04 * (1.0 + fi * 0.3));
              vec2 cell = floor(q);
              float h = rh(cell + fi * 17.0);
              vec2 o = vec2(rh(cell + 3.7), rh(cell + 9.1)) - 0.5;
              float r = 0.035;
              float rr = max(r, fwx * 1.6 * (D / -dz) * 1.4);
              float m = smoothstep(rr, 0.0, length(fract(q) - 0.5 - o * 0.6)) * step(0.8, h) * (r / rr);
              c += hot * m * exp(-D * 0.11) * 0.9 * step(0.0, p.y);
            }
            return c;
          }
          void main() {
            float x = vL.x;
            float y = vL.y;
            float yn = y / uH;
            float side = x < 0.0 ? -1.0 : 1.0;
            float hw = riftEdge(y, side);
            float fwx = max(fwidth(x), 1e-4);
            float fwy = max(fwidth(y), 1e-4);
            float dx = abs(x) - hw;
            float adx = abs(dx);

            // fog: light is dimmed by the air between, but a source holds through it better than a surface
            float dist = length(vWp - cameraPosition);
            float fogV = exp(-pow(uFog * dist, 2.0));

            // vertical envelope: cut clean by the floor, brightest along the middle of the seam, fading to
            // nothing at both ends of the line
            float floorCut = smoothstep(-fwy, fwy, y);
            float env = pow(max(sin(3.14159265 * clamp(yn * 1.02, 0.0, 1.0)), 0.0), 1.3) * floorCut;
            // where the two edges run together near the top of the opening, they are a single hairline, so
            // their light must not add up into a bright closed point
            float closed = 1.0 - smoothstep(0.0, 0.03, hw);
            float tipDim = mix(1.0, mix(0.32, 1.0, smoothstep(0.0, 0.55, riftProf(y))), smoothstep(0.0, 0.3, uOpen));

            // the edge: a white-hot core about a pixel wide (never thinner, so far away it is a hair line)
            float lw = fwx * 0.6 + 0.0006;
            float core = exp(-adx / lw);
            float near_ = exp(-adx / (fwx * 3.0 + 0.008));
            // the edge flickers very slightly along its length, like a filament
            float fil = 0.88 + 0.12 * sin(y * 37.0 + uT * 5.0 + side) * sin(y * 11.0 - uT * 2.1);
            vec3 col = vec3(1.0) * (core * 0.95 + near_ * 0.08) * env * tipDim * fil * mix(1.0, fogV, 0.5);
            vec3 white = mix(uCol, vec3(1.0), 0.8);

            // the opening
            float inside = smoothstep(fwx, -fwx, dx) * floorCut * step(0.0005, hw);
            vec3 rd = normalize(vL - uCam);
            vec3 bc = beyond(vL, rd, fwx);
            // light pours in from the edges: a soft rim of brightness just inside them
            // dx > 0 outside the opening: clamp so the exp cannot overflow (inf * 0 = NaN below)
            float dxi = min(dx, 0.0);
            float rim = exp(dxi / max(0.03 + hw * 0.12, 0.02));
            bc += uCol * rim * 0.1 + white * exp(dxi / 0.01) * 0.08;
            col += bc * inside * mix(0.5, 1.0, smoothstep(0.0, 0.5, uOpen)) * mix(1.0, fogV, 0.6);

            float tf = topFade();
            col *= uOn * tf;
            float alpha = clamp(inside * uOn * tf, 0.0, 1.0);
            col = clamp(col, 0.0, 12.0);
            gl_FragColor = vec4(col, alpha);
          }`,
      }),
    );
    // drawn before the hero's points, so his dissolving figure shows inside the opening
    this.slit.renderOrder = -1;
    // chapters often set their fog after updating the rift: read the air and the eye at draw time
    this.slit.onBeforeRender = (_r, scene, camera) => {
      const fog = scene.fog as THREE.FogExp2 | null;
      this.u.uFog.value = fog && 'density' in fog ? fog.density : 0;
      const cam = (this.u.uCam.value as THREE.Vector3).setFromMatrixPosition(camera.matrixWorld);
      this.object3D.worldToLocal(cam);
    };
    this.slit.frustumCulled = false;

    // ---- haze: the light hanging in the air around it (an upright billboard) ----
    const HW = 9;
    const HH = H * 1.7;
    const hg = new THREE.PlaneGeometry(HW, HH, 1, 1);
    hg.translate(0, H * 0.48, 0);
    this.haze = new THREE.Mesh(
      hg,
      new THREE.ShaderMaterial({
        uniforms: this.u,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: vLocal,
        fragmentShader: /* glsl */ `
          uniform vec3 uCol; uniform float uOn, uFog;
          varying vec3 vL; varying vec3 vWp;
          ${SHAPE}
          ${TOP}
          void main() {
            float x = vL.x;
            float y = vL.y - uH * 0.36;
            float sx = 0.2 + uOpen * 0.6;
            float sy = uH * 0.4;
            float core = exp(-pow(x / sx, 2.0) - pow(y / sy, 2.0));
            float body = exp(-pow(x / (1.3 + uOpen * 1.6), 2.0) - pow(y / (uH * 0.62), 2.0));
            // thicker air means more light scattered toward you
            float air = 0.55 + clamp(uFog * 18.0, 0.0, 0.9);
            float k = (core * (0.018 + uOpen * 0.022) + body * (0.01 + uOpen * 0.022)) * air;
            // the haze hangs in front of the room, not across the opening: keep the view through it clear
            float hwh = riftHalf(vL.y);
            float inO = smoothstep(0.06, -0.06, abs(x) - hwh) * step(0.001, hwh);
            vec3 col = uCol * k * (1.0 - 0.75 * inO);
            col *= uOn * smoothstep(0.0, 0.5, vWp.y) * topFade();
            gl_FragColor = vec4(clamp(col, 0.0, 4.0), 1.0);
          }`,
      }),
    );
    this.haze.renderOrder = 3;
    this.haze.frustumCulled = false;

    // ---- floor: the fan of light, the line's reflection, the hero's shadow ----
    this.floor = null;
    if (opts.floorPlane !== false) {
      const fg = new THREE.PlaneGeometry(14, 26, 1, 1);
      fg.rotateX(-Math.PI / 2);
      fg.translate(0, 0.008, 12);
      this.floor = new THREE.Mesh(
        fg,
        new THREE.ShaderMaterial({
          uniforms: this.u,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexShader: vLocal,
          fragmentShader: /* glsl */ `
            uniform vec3 uCol; uniform vec2 uHero; uniform float uOn, uFog, uHeroK, uGain;
            varying vec3 vL; varying vec3 vWp;
            ${SHAPE}
            void main() {
              float x = vL.x;
              float z = vL.z;
              float zz = max(z, 0.0);
              float wb = riftHalf(uH * 0.3);
              float fwx = max(fwidth(x), 1e-4);
              // a fan that widens with distance, brightest straight out of the opening
              float spread = wb + 0.1 + zz * (0.16 + uOpen * 0.42);
              float fan = exp(-pow(x / spread, 2.0));
              float fall = 1.0 / (1.0 + zz * zz * 0.12);
              float I = fan * fall * (0.03 * uOn + 0.42 * uOpen);
              // where the light meets the floor
              I += exp(-(x * x) / (0.015 + wb * wb * 1.5) - zz * 2.6) * (0.2 * uOn + 0.3 * uOpen);
              // a little behind the rift too
              // exp of a large positive z would overflow to inf, and mix(inf, 1, 1) is NaN (a black hole after bloom)
              I *= exp(min(z, 0.0) * 2.5);
              // the hero blocks the light: a shadow running from his feet away from the rift
              if (uHero.y > 0.05 && uHeroK > 0.001) {
                float xs = x * uHero.y / max(z, 0.05);
                float d = abs(xs - uHero.x);
                float sh = smoothstep(0.24, 0.08, d) * step(uHero.y - 0.15, z) * (1.0 - smoothstep(uHero.y * 1.15, uHero.y * 2.6 + 0.6, z));
                I *= 1.0 - 0.85 * sh * uHeroK;
              }
              // the line itself reflected in the floor: a long thin streak toward you
              float rw = wb + fwx * 1.2 + 0.004;
              float refl = smoothstep(rw + fwx, rw * 0.2, abs(x)) * exp(-zz * 0.9) * step(0.0, z) * (0.05 + 0.3 * uOpen);
              float dist = length(vWp - cameraPosition);
              float fogV = exp(-pow(uFog * dist, 2.0));
              // the plane's own edges never show
              float edge = clamp((25.0 - z) / 12.0, 0.0, 1.0) * clamp((7.0 - abs(x)) / 2.5, 0.0, 1.0);
              vec3 col = (uCol * I + mix(uCol, vec3(1.0), 0.55) * refl) * uOn * uGain * edge * mix(1.0, fogV, 0.7);
              gl_FragColor = vec4(clamp(col, 0.0, 4.0), 1.0);
            }`,
        }),
      );
      this.floor.renderOrder = 2;
      this.floor.frustumCulled = false;
    }

    // ---- debris: points shed by the edges ----
    const n = [420, 900, 1500][ctx.tier];
    const A = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      A[i * 4] = Math.random();
      A[i * 4 + 1] = Math.random();
      A[i * 4 + 2] = Math.random();
      A[i * 4 + 3] = Math.random();
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    dg.setAttribute('aR', new THREE.BufferAttribute(A, 4));
    this.debris = new THREE.Points(
      dg,
      new THREE.ShaderMaterial({
        uniforms: this.u,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform vec3 uCol; uniform float uOn, uFog, uS;
          attribute vec4 aR;
          varying vec3 vC;
          ${SHAPE}
          void main() {
            float side = aR.y < 0.5 ? -1.0 : 1.0;
            // slow: each mote takes several seconds to leave the edge and fade
            float speed = 0.04 + aR.z * 0.07;
            float life = fract(uT * speed + aR.w * 7.13 + aR.x * 3.1);
            // born on an edge of the opening, mostly through its middle
            float yn = mix(aR.x, 0.5 + (aR.x - 0.5) * 0.6, 0.4) * RIFT_SPAN;
            float y0 = yn * uH;
            float hw = riftEdge(y0, side);
            // drifting away from the edge, rising a little, with a slow curl
            float out_ = pow(life, 1.2) * (0.08 + aR.z * 0.75) * (0.25 + uOpen);
            float y = y0 + life * (0.1 + aR.w * 0.45) + sin(life * 6.0 + aR.x * 40.0) * 0.04 * life;
            // a few fall inward into the space beyond instead of drifting out
            float inward = step(0.82, aR.w);
            float x = side * (hw + mix(out_, -min(out_, hw) * 0.9, inward)) + sin(uT * 0.3 + aR.y * 30.0) * 0.02 * life;
            float z = (aR.w - 0.5) * 0.35 * life + mix(life * (0.05 + aR.x * 0.4), -life * 1.4, inward);
            vec3 p = vec3(x, y, z);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float dist = -mv.z;
            // fine: a pixel or two, a rare larger one
            float big = pow(aR.z, 4.0);
            gl_PointSize = max(1.5, uS * (1.6 + big * 3.0) * (6.0 / max(dist, 0.2)));
            float fade = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.45, 1.0, life)) * pow(riftProf(y0), 0.35);
            // sparse: most motes are faint, a few catch the light
            float lit = 0.25 + 1.6 * pow(aR.x, 3.0);
            float fogV = exp(-pow(uFog * dist, 2.0));
            vec3 white = mix(uCol, vec3(1.0), 0.75);
            vC = mix(white, uCol * 1.4, smoothstep(0.1, 0.7, life)) * fade * lit * fogV * uOn * smoothstep(0.0, 0.15, uOpen + 0.05);
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vC;
          ${TOP}
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.1, d);
            gl_FragColor = vec4(clamp(vC * a * topFade(), 0.0, 4.0), 1.0);
          }`,
      }),
    );
    this.debris.frustumCulled = false;
    this.debris.renderOrder = 5;

    this.object3D.add(this.haze, this.slit, this.debris);
    if (this.floor) this.object3D.add(this.floor);

    this.light = null;
    if (this.lightMax > 0) {
      this.light = new THREE.PointLight(this.color, 0, 16, 2);
      // just behind the plane: it lights the room in front and the hero's back, never his face as he crosses
      this.light.position.set(0, H * 0.45, -0.9);
      this.object3D.add(this.light);
    }
  }

  /**
   * open: 0 a hair line … 1 fully split. on: overall presence 0..1 (fade the whole thing in or out).
   * Call every frame after the camera is placed.
   */
  update(open: number, t: number, ctx: Ctx, on = 1) {
    this.open = open = clamp01(open);
    this.on = on = clamp01(on);
    const vis = on > 0.002;
    this.object3D.visible = vis;
    if (!vis) {
      if (this.light) this.light.intensity = 0;
      return;
    }
    const u = this.u;
    u.uOpen.value = open;
    u.uOn.value = on;
    u.uT.value = ctx.still ? t * 0.15 : t;
    u.uFog.value = ctx.fog.density;
    u.uS.value = ctx.size.dpr * (ctx.size.h / 900);
    (u.uTop.value as THREE.Vector2).set(ctx.size.h * ctx.size.dpr, 82 * ctx.size.dpr);
    this.object3D.updateWorldMatrix(true, false);
    const cam = this.v.copy(ctx.camera.position);
    this.object3D.worldToLocal(cam);
    (u.uCam.value as THREE.Vector3).copy(cam);
    // the haze always turns its face to the camera, staying upright
    this.haze.rotation.y = Math.atan2(cam.x, cam.z);
    if (this.light) this.light.intensity = on * this.lightMax * (0.08 + 0.92 * smooth(open));
  }

  /**
   * Take the hero apart as he passes through. Call after setting his state for the frame.
   * Returns how far he is dissolved (0..1). Depth is measured along the rift's facing direction.
   */
  cross(hero: Hero) {
    this.object3D.updateWorldMatrix(true, false);
    const p = this.v.copy(hero.root.position);
    this.object3D.worldToLocal(p);
    const depth = -p.z;
    const d = smooth(seg(depth, -0.75, 0.2));
    const s = smooth(seg(depth, -0.1, 1.0));
    hero.form = Math.max(hero.form, d);
    hero.scatter = Math.max(hero.scatter, s * 0.9);
    hero.tint.lerp(this.color, d * 0.75);
    hero.glow = mix(hero.glow, mix(1.0, 1.7, this.glowK), d * (1 - s * 0.5));
    hero.tintMix = mix(hero.tintMix, mix(0.55, 0.9, this.glowK), d);
    hero.shadow *= 1 - d;
    hero.push *= 1 - d;
    if (s > 0.995) hero.visible = false;
    // once any of him is near the plane, what passes behind it shows only through the opening
    if (depth > -0.8) {
      hero.portal.on = true;
      hero.portal.toLocal.copy(this.object3D.matrixWorld).invert();
      hero.portal.halfW = this.open * (this.u.uW.value as number) * 0.5;
      hero.portal.height = this.height * 0.8; // RIFT_SPAN
    }
    // for the floor shadow: his place in front of the rift, and how solid he still is
    (this.u.uHero.value as THREE.Vector2).set(p.x, p.z);
    this.u.uHeroK.value = (1 - d) * this.open * (Math.abs(p.x) < 3 ? 1 : 0);
    return d;
  }

  /** current open amount (as last set) */
  get amount() {
    return this.open * this.on;
  }
}
