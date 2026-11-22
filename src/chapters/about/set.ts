import * as THREE from 'three';
import type { Ctx } from '../../world/types';
import { damp } from '../../world/util';

/**
 * The darkroom: floor, a far wall of slow haze (generated video plate), a key light on a stand with
 * a visible beam, a red safelight on a cable, a stool, a line of prints drying, dust in the beam.
 */

const A = '/assets/about/';
const ROSE = new THREE.Color('#ff5d8f');
const SAFE = new THREE.Color('#ff2f55');
const KEY = new THREE.Color('#ffe0cf');

export interface SetState {
  /** 0..1 overall presence (chapter io) */
  io: number;
  /** 0 portrait light, 1 safelight only (the room dims at the end of the chapter) */
  dark: number;
  /** where the key light should aim */
  target: THREE.Vector3;
  /** how far the camera has pushed in, 0..1: the props step out of the way of the close-up */
  close: number;
}

export class StudioSet {
  readonly group = new THREE.Group();
  /** world position of the lamp head, for the beam and the key light */
  readonly lamp = new THREE.Vector3(-2.35, 2.42, 1.55);
  private key: THREE.SpotLight;
  private rim: THREE.DirectionalLight;
  private kick: THREE.DirectionalLight;
  private fill: THREE.HemisphereLight;
  private safe: THREE.PointLight;
  private bulb: THREE.Mesh;
  private bulbHalo: THREE.Mesh;
  private lampGlow: THREE.Mesh;
  private beam: THREE.Mesh;
  private wall: THREE.Mesh;
  private dust: THREE.Points;
  private prints: THREE.Group;
  private printCards: THREE.Mesh[] = [];
  private stand: THREE.Object3D | null = null;
  private stool: THREE.Object3D | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private flick = 1;
  private tmp = new THREE.Vector3();

  constructor(ctx: Ctx) {
    const g = this.group;

    // ---- lights ----
    this.key = new THREE.SpotLight(KEY, 0, 16, 0.44, 0.85, 1.6);
    this.key.position.copy(this.lamp);
    g.add(this.key, this.key.target);
    this.rim = new THREE.DirectionalLight(ROSE, 0);
    this.rim.position.set(2.8, 2.4, -3.6);
    g.add(this.rim, this.rim.target);
    this.kick = new THREE.DirectionalLight('#ff3d6e', 0);
    this.kick.position.set(-3.2, 1.2, -2.6);
    g.add(this.kick, this.kick.target);
    this.fill = new THREE.HemisphereLight('#ff9db4', '#140408', 0);
    g.add(this.fill);
    this.safe = new THREE.PointLight(SAFE, 0, 12, 1.8);
    // low enough to hang in the frame, never under the top bar
    this.safe.position.set(-3.8, 2.5, -2.7);
    g.add(this.safe);

    // ---- floor: dark sealed concrete that takes the real lights ----
    const fg = new THREE.PlaneGeometry(60, 60);
    fg.rotateX(-Math.PI / 2);
    const rough = noiseTexture(256);
    rough.repeat.set(14, 14);
    const floor = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: '#1c1113', roughness: 0.62, roughnessMap: rough, bumpMap: rough, bumpScale: 0.6, metalness: 0, envMapIntensity: 0.25 }));
    g.add(floor);

    // ---- far wall: the haze plate ----
    this.wall = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 16.875),
      new THREE.ShaderMaterial({
        depthWrite: false,
        fog: false,
        uniforms: { uMap: { value: null }, uHas: { value: 0 }, uTime: { value: 0 }, uGain: { value: 1 }, uRose: { value: ROSE.clone() }, uShift: { value: new THREE.Vector2() } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform float uHas, uTime, uGain; uniform vec3 uRose; uniform vec2 uShift; varying vec2 vUv;
          float h2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
          float n2(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
          float fbm(vec2 p) { return n2(p) * 0.55 + n2(p * 2.1 + 3.7) * 0.3 + n2(p * 4.3 + 9.1) * 0.15; }
          void main() {
            vec2 uv = vUv + uShift;
            // slow haze, always there; the generated plate rides on top of it when it has loaded
            float hz = fbm(vec2(uv.x * 3.0 - uTime * 0.012, uv.y * 2.2 + uTime * 0.006) + fbm(uv * 2.0 + uTime * 0.01) * 0.8);
            float pl = length((uv - vec2(0.3, 0.62)) * vec2(1.0, 1.5)) / 0.42; float pool = exp(-pl * pl);
            vec3 col = uRose * (0.012 + hz * hz * 0.06 + pool * 0.07 * (0.6 + hz));
            vec3 plate = texture2D(uMap, uv).rgb;
            col = mix(col, plate * (0.75 + hz * 0.5) + col * 0.5, uHas);
            vec2 q = abs(vUv - 0.5) * 2.0;
            float edge = smoothstep(1.0, 0.55, q.x) * smoothstep(1.0, 0.4, q.y);
            gl_FragColor = vec4(col * edge * uGain, 1.0);
          }`,
      }),
    );
    this.wall.position.set(0, 6.2, -13);
    this.wall.renderOrder = -5;
    g.add(this.wall);

    // ---- the key light's visible beam ----
    const cone = new THREE.ConeGeometry(1, 1, 40, 1, true);
    cone.translate(0, -0.5, 0); // apex at origin, opening down -Y
    this.beam = new THREE.Mesh(
      cone,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: { uA: { value: 0 }, uTime: { value: 0 }, uCol: { value: KEY.clone() } },
        vertexShader: /* glsl */ `
          varying vec3 vP; varying vec3 vN; varying vec3 vV; varying vec3 vW;
          void main() { vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `
          uniform float uA, uTime; uniform vec3 uCol; varying vec3 vP; varying vec3 vN; varying vec3 vV; varying vec3 vW;
          float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
          float n3(vec3 x) { vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y), mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
          void main() {
            float along = -vP.y;                       // 0 at the lamp, 1 at the far end
            float side = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); // soft silhouette
            float haze = 0.55 + 0.45 * n3(vW * 1.4 + vec3(uTime * 0.05, -uTime * 0.03, 0.0));
            float a = side * haze * smoothstep(0.0, 0.05, along) * pow(clamp(1.0 - along, 0.0, 1.0), 1.7) * uA;
            gl_FragColor = vec4(uCol * a, 1.0);
          }`,
      }),
    );
    this.beam.position.copy(this.lamp);
    this.beam.renderOrder = 1;
    g.add(this.beam);

    // lamp face and safelight bulb: small emissive things with a halo, so the light has a source
    const halo = (col: THREE.Color, size: number) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
          uniforms: { uA: { value: 0 }, uCol: { value: col.clone() } },
          vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy; gl_Position = projectionMatrix * mv; }`,
          fragmentShader: /* glsl */ `uniform float uA; uniform vec3 uCol; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 3.0) + exp(-d * d * 60.0) * 2.0; gl_FragColor = vec4(uCol * a * uA, 1.0); }`,
        }),
      );
      m.frustumCulled = false;
      return m;
    };
    this.lampGlow = halo(KEY, 1.0);
    this.lampGlow.position.copy(this.lamp);
    g.add(this.lampGlow);

    this.bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), new THREE.MeshBasicMaterial({ color: SAFE.clone().multiplyScalar(6), fog: false }));
    this.bulb.position.copy(this.safe.position);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 28, 1, true), new THREE.MeshStandardMaterial({ color: '#0d0809', roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }));
    shade.position.copy(this.safe.position).y += 0.1;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 6, 6), new THREE.MeshBasicMaterial({ color: '#050304' }));
    cable.position.copy(this.safe.position).y += 3.17;
    this.bulbHalo = halo(SAFE, 2.6);
    this.bulbHalo.position.copy(this.safe.position);
    g.add(this.bulb, shade, cable, this.bulbHalo);

    // ---- dust in the beam ----
    const n = [220, 480, 800][ctx.tier];
    const P = new Float32Array(n * 3);
    const S = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      P[i * 3] = (Math.random() - 0.5) * 9;
      P[i * 3 + 1] = Math.random() * 4.2;
      P[i * 3 + 2] = 3.5 - Math.random() * 9;
      S[i] = Math.random();
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));
    this.dust = new THREE.Points(
      dg,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uA: { value: 0 }, uS: { value: 1 }, uLamp: { value: this.lamp }, uAim: { value: new THREE.Vector3() }, uKey: { value: 1 }, uSafe: { value: this.safe.position } },
        vertexShader: /* glsl */ `
          uniform float uTime, uS, uKey; uniform vec3 uLamp, uAim, uSafe; attribute float aSeed; varying vec3 vC;
          void main() {
            vec3 p = position;
            p.y = mod(p.y + uTime * (0.012 + aSeed * 0.03), 4.2);
            p.x += sin(uTime * 0.13 + aSeed * 30.0) * 0.35;
            p.z += cos(uTime * 0.11 + aSeed * 17.0) * 0.25;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uS * (1.0 + aSeed * 2.4) * (5.5 / -mv.z);
            // lit only where the beam or the safelight reaches it
            vec3 ax = normalize(uAim - uLamp);
            vec3 tp = p - uLamp;
            float al = dot(tp, ax);
            float off = length(tp - ax * al) / max(al * 0.47, 0.05);
            float inBeam = smoothstep(1.0, 0.3, off) * step(0.0, al) * uKey;
            float nearSafe = exp(-dot(p - uSafe, p - uSafe) * 0.22);
            float tw = 0.6 + 0.4 * sin(uTime * (0.8 + aSeed * 2.0) + aSeed * 50.0);
            vC = (vec3(1.0, 0.86, 0.78) * inBeam * 0.9 + vec3(1.0, 0.2, 0.36) * (nearSafe * 0.8 + 0.035)) * tw;
          }`,
        fragmentShader: 'uniform float uA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC * smoothstep(0.5, 0.0, d) * uA, 1.0); }',
      }),
    );
    this.dust.frustumCulled = false;
    g.add(this.dust);

    // ---- a line of prints drying at the back ----
    this.prints = new THREE.Group();
    this.prints.position.set(-0.4, 0, -4.4);
    this.prints.rotation.y = 0.12;
    g.add(this.prints);
    this.buildPrints();

    // ---- generated assets, late ----
    this.loadProps(ctx);
    this.loadPlate(ctx);
  }

  private buildPrints() {
    const span = 6.4;
    const sag = 0.22;
    const y0 = 2.72;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      pts.push(new THREE.Vector3((u - 0.5) * span, y0 - Math.sin(u * Math.PI) * sag, 0));
    }
    const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.006, 5), new THREE.MeshStandardMaterial({ color: '#2a1a1c', roughness: 0.9 }));
    this.prints.add(cord);
    const count = 4;
    const clipMat = new THREE.MeshStandardMaterial({ color: '#6a4a3c', roughness: 0.8 });
    const paper = new THREE.PlaneGeometry(0.62, 0.84, 1, 6);
    paper.translate(0, -0.42, 0);
    for (let i = 0; i < count; i++) {
      const u = (i + 0.9) / (count + 0.8);
      const x = (u - 0.5) * span;
      const y = y0 - Math.sin(u * Math.PI) * sag;
      const holder = new THREE.Group();
      holder.position.set(x, y, 0);
      // blank paper under the safelight, each sheet a slightly different tone
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3f3134').multiplyScalar(0.8 + 0.12 * ((i * 7) % 3)), roughness: 0.9, side: THREE.DoubleSide, emissive: '#ffd9d2' });
      const card = new THREE.Mesh(paper, mat);
      card.position.y = -0.02;
      holder.add(card);
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.03), clipMat);
      clip.position.set(0, -0.02, 0.01);
      holder.add(clip);
      holder.userData.seed = i * 1.7 + 0.4;
      this.prints.add(holder);
      this.printCards.push(card);
    }
  }

  private async loadProps(ctx: Ctx) {
    const tune = (o: THREE.Object3D) =>
      o.traverse((c) => {
        const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && m.isMeshStandardMaterial) {
          m.envMapIntensity = 0.5;
          m.roughness = Math.max(m.roughness, 0.45);
        }
      });
    try {
      const { scene } = await ctx.glb(A + 'light-stand.glb');
      tune(scene);
      scene.scale.setScalar(2.55);
      scene.position.set(this.lamp.x - 0.12, 0, this.lamp.z + 0.06);
      scene.rotation.y = 0.9;
      this.stand = scene;
      this.group.add(scene);
    } catch {
      /* the stand is optional */
    }
    try {
      const { scene } = await ctx.glb(A + 'stool.glb');
      tune(scene);
      scene.scale.setScalar(0.72);
      scene.position.set(-1.25, 0, -1.05);
      scene.rotation.y = 0.5;
      this.stool = scene;
      this.group.add(scene);
    } catch {
      /* optional */
    }
    try {
      const { scene } = await ctx.glb(A + 'print-line.glb');
      tune(scene);
      scene.traverse((c) => {
        const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && m.isMeshStandardMaterial) m.color.setScalar(0.22);
      });
      scene.scale.setScalar(2.3);
      scene.position.set(4.4, 1.75, -5.2);
      scene.rotation.y = -0.5;
      this.group.add(scene);
      // two cables up into the dark
      for (const dx of [-1.02, 1.02]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 5, 5), new THREE.MeshBasicMaterial({ color: '#050304' }));
        c.position.set(4.4 + dx * Math.cos(0.5), 2.5 + 2.5, -5.2 + dx * Math.sin(0.5));
        this.group.add(c);
      }
    } catch {
      /* optional */
    }
  }

  private async loadPlate(ctx: Ctx) {
    const u = (this.wall.material as THREE.ShaderMaterial).uniforms;
    try {
      if (ctx.tier === 0 || ctx.still) {
        const t = await ctx.tex(A + 'darkroom-haze.jpg');
        if ((t.image as { width?: number })?.width) {
          u.uMap.value = t;
          u.uHas.value = 1;
        }
      } else {
        const v = await ctx.video(A + 'darkroom-haze.mp4', { poster: A + 'darkroom-haze.jpg' });
        if (v.el.videoWidth > 0) {
          this.videoEl = v.el;
          u.uMap.value = v.tex;
          u.uHas.value = 1;
        }
      }
    } catch {
      /* the procedural haze stays */
    }
  }

  enter() {
    this.videoEl?.play().catch(() => {});
  }
  leave() {
    this.videoEl?.pause();
  }

  update(s: SetState, ctx: Ctx, t: number, dt: number) {
    const io = s.io;
    const lit = 1 - s.dark;
    if (this.videoEl && this.videoEl.paused && io > 0.01) this.videoEl.play().catch(() => {});
    // a tungsten lamp is never perfectly steady
    this.flick += (1 + (Math.sin(t * 13.1) * Math.sin(t * 7.3) > 0.93 ? -0.07 : 0) - this.flick) * damp(18, dt);
    const k = io * this.flick;

    this.key.intensity = 70 * k * (0.12 + 0.88 * lit);
    this.key.target.position.copy(s.target);
    this.rim.intensity = io * (4.2 + 1.2 * s.dark);
    this.rim.target.position.copy(s.target);
    this.kick.intensity = io * (0.9 + 1.8 * s.dark);
    this.kick.target.position.copy(s.target);
    this.fill.intensity = io * (0.34 - 0.14 * s.dark);
    this.safe.intensity = io * (26 + 30 * s.dark) * (0.96 + 0.04 * Math.sin(t * 1.3));

    // beam from the lamp to the subject
    const dir = this.tmp.copy(s.target).sub(this.lamp);
    const len = dir.length() + 1.6;
    this.beam.quaternion.setFromUnitVectors(DOWN, dir.normalize());
    this.beam.scale.set(len * 0.47, len, len * 0.47);
    const bu = (this.beam.material as THREE.ShaderMaterial).uniforms;
    bu.uA.value = 0.11 * k * (0.15 + 0.85 * lit);
    bu.uTime.value = t;
    (this.lampGlow.material as THREE.ShaderMaterial).uniforms.uA.value = 1.5 * k * (0.2 + 0.8 * lit);
    (this.bulbHalo.material as THREE.ShaderMaterial).uniforms.uA.value = io * (0.5 + 0.35 * s.dark) * (0.94 + 0.06 * Math.sin(t * 1.3));

    const wu = (this.wall.material as THREE.ShaderMaterial).uniforms;
    wu.uTime.value = t;
    wu.uGain.value = io * (0.75 + 0.2 * s.dark);
    wu.uShift.value.set(ctx.still ? 0 : ctx.pointer.x * -0.006, ctx.still ? 0 : ctx.pointer.y * -0.004);

    const du = (this.dust.material as THREE.ShaderMaterial).uniforms;
    du.uTime.value = ctx.still ? 0 : t;
    du.uA.value = io * 0.75;
    du.uS.value = ctx.size.dpr * (ctx.size.h / 900);
    du.uAim.value.copy(s.target);
    du.uKey.value = 0.15 + 0.85 * lit;

    // prints sway on the line
    for (const h of this.prints.children) {
      const seed = h.userData.seed as number | undefined;
      if (seed === undefined) continue;
      h.rotation.z = ctx.still ? 0 : Math.sin(t * 0.55 + seed) * 0.035 + Math.sin(t * 1.3 + seed * 2.0) * 0.012;
      h.rotation.x = ctx.still ? 0 : Math.sin(t * 0.4 + seed * 1.3) * 0.05;
    }
    for (const c of this.printCards) (c.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.012 - 0.006 * s.dark;
    if (this.stool) this.stool.visible = s.close < 0.98;
    if (this.stand) this.stand.visible = true;
  }
}

const DOWN = new THREE.Vector3(0, -1, 0);

function noiseTexture(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const img = x.createImageData(size, size);
  let seed = 4242;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  // a few octaves of value noise, tiled
  const oct = [8, 24, 64].map((n) => ({ n, v: Array.from({ length: n * n }, rnd) }));
  for (let y = 0; y < size; y++)
    for (let xx = 0; xx < size; xx++) {
      let v = 0;
      let amp = 0.55;
      for (const o of oct) {
        const fx = (xx / size) * o.n;
        const fy = (y / size) * o.n;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = fx - ix;
        const ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const at = (a: number, b: number) => o.v[(b % o.n) * o.n + (a % o.n)];
        v += amp * ((at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy);
        amp *= 0.5;
      }
      const g = Math.round(255 * Math.min(1, 0.35 + v * 0.75));
      const i = (y * size + xx) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
