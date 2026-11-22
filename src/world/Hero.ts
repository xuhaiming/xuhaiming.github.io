import * as THREE from 'three';
import type { Tier } from './types';

const TINT = new THREE.Color('#cfe6ff');

interface Act {
  name: string;
  action: THREE.AnimationAction;
  w: number;
}

/**
 * The protagonist: one rigged character that exists in two forms at once, a skinned mesh and a
 * cloud of points riding the same skeleton. `form` cross-dissolves between them, `scatter` blows
 * the points off the body. All public state is "immediate mode": the director calls reset() before
 * every chapter update, so a chapter sets what it wants each frame and never has to clean up.
 */
export class Hero {
  /** move / rotate / scale this. Feet are at y = 0, the figure is 1.75 units tall and faces +Z. */
  readonly root = new THREE.Group();
  /** true once the model has loaded */
  ready = false;
  /** height of the figure in world units (before root scale) */
  readonly height = 1.75;

  /* ---- per-frame state (reset every frame) ---- */
  visible = true;
  /** 0 = solid mesh, 1 = all points. In between, the surface converts in a noisy sweep from the feet up. */
  form = 0;
  /** 0 = points sit on the body, 1 = blown away and faded out */
  scatter = 0;
  /** colour of the points and of the dissolve edge */
  readonly tint = TINT.clone();
  /** 0 = points keep the model's own colours, 1 = pure tint */
  tintMix = 0.65;
  /** brightness of the points */
  glow = 1;
  /** 0..1: how strongly the pointer pushes points aside (only visible when form > 0) */
  push = 0;
  /** point size multiplier */
  grain = 1;
  /** named clip to hold instead of idle/walk: 'wave', 'think', or any clip in the file */
  pose: string | null = null;
  /** opacity of the soft contact shadow under the feet */
  shadow = 0;
  /** world units covered by one full walk cycle; lower it if the feet seem to slide */
  stride = 0.6;
  /**
   * A rift he is walking through (set by Rift.cross): points that have passed behind its plane are
   * seen only through its opening. toLocal maps world space to the rift's space (plane z = 0, the
   * opening a lens of half width halfW and the given height standing on y = 0).
   */
  readonly portal = { on: false, toLocal: new THREE.Matrix4(), halfW: 0, height: 4 };

  /**
   * The push only follows a real pointer: a mouse or pen once it has moved, a finger only while it is
   * down. Without this the resting pointer (screen centre) carves a hard ring into the figure on
   * touch screens and in captures. Eased so it never pops.
   */
  private live = 0;
  private liveK = 0;

  private mesh: THREE.SkinnedMesh | null = null;
  private points: THREE.Points | null = null;
  private blob: THREE.Mesh;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  /** the same actions as a flat list with their blend weights (iterated every frame without allocating) */
  private acts: Act[] = [];
  private walkAct: THREE.AnimationAction | null = null;
  private travel = 0;
  private travelTarget = 0;
  private walkAsked = false;
  private walkWas = false;
  private walkW = 0;
  private forcedWalk = -1;
  private u = {
    uForm: { value: 0 },
    uScatter: { value: 0 },
    uTime: { value: 0 },
    uTint: { value: new THREE.Color() },
    uTintMix: { value: 0.65 },
    uGlow: { value: 1 },
    uHeight: { value: 1.75 },
    uSize: { value: 1 },
    uPush: { value: 0 },
    uRayO: { value: new THREE.Vector3() },
    uRayD: { value: new THREE.Vector3(0, 0, -1) },
    uBones: { value: null as THREE.Texture | null },
    uBind: { value: new THREE.Matrix4() },
    uBindInv: { value: new THREE.Matrix4() },
    uMap: { value: null as THREE.Texture | null },
    uSkinned: { value: 0 },
    uPortalOn: { value: 0 },
    uPortal: { value: new THREE.Matrix4() },
    uPortalShape: { value: new THREE.Vector2(0, 4) },
    uPortalCam: { value: new THREE.Vector3() },
  };

  constructor(private tier: Tier) {
    if (typeof addEventListener === 'function') {
      addEventListener('pointermove', (e) => e.pointerType !== 'touch' && (this.live = 1), { passive: true });
      addEventListener('pointerdown', () => (this.live = 1), { passive: true });
      const up = (e: PointerEvent) => e.pointerType === 'touch' && (this.live = 0);
      addEventListener('pointerup', up, { passive: true });
      addEventListener('pointercancel', up, { passive: true });
    }
    const g = new THREE.PlaneGeometry(1.5, 1.5);
    g.rotateX(-Math.PI / 2);
    this.blob = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uA: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform float uA; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.2) * uA; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }',
      }),
    );
    this.blob.position.y = 0.004;
    this.blob.renderOrder = -1;
    this.root.add(this.blob);
  }

  /** names of the animation clips found in the model */
  get clips() {
    return [...this.actions.keys()];
  }

  /**
   * Walk in place, scroll-driven: pass the distance (world units) the root has travelled along its
   * path. The cycle phase follows the distance so the feet do not slide, and the pose relaxes into
   * idle when the distance stops changing. Call every frame while the hero should be walk-capable.
   */
  walkTo(distance: number) {
    this.travelTarget = distance;
    this.walkAsked = true;
  }

  /** Force the idle/walk blend (0..1) and let the cycle run on its own clock, e.g. a treadmill shot. */
  walkFree(amount: number) {
    this.forcedWalk = amount;
  }

  /** world position of a bone by its short name, e.g. 'Head', 'RightHand', 'Hips' */
  bone(name: string, out = new THREE.Vector3()) {
    const b = this.bones.get(name);
    if (b) b.getWorldPosition(out);
    else this.root.getWorldPosition(out).y += this.height * 0.6;
    return out;
  }
  private bones = new Map<string, THREE.Bone>();

  reset() {
    this.visible = true;
    this.form = 0;
    this.scatter = 0;
    this.tint.copy(TINT);
    this.tintMix = 0.65;
    this.glow = 1;
    this.push = 0;
    this.grain = 1;
    this.pose = null;
    this.shadow = 0;
    this.stride = 0.6;
    this.portal.on = false;
    this.walkAsked = false;
    this.forcedWalk = -1;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.scale.setScalar(1);
  }

  async load(url: string, loadGlb: (u: string) => Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>) {
    const { scene, animations } = await loadGlb(url);
    let mesh: THREE.SkinnedMesh | null = null;
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh && (!mesh || m.geometry.attributes.position.count > mesh.geometry.attributes.position.count)) mesh = m;
      const b = o as THREE.Bone;
      if (b.isBone) this.bones.set(b.name.replace(/^mixamorig[:_]?/, ''), b);
    });
    if (!mesh) throw new Error('hero.glb has no skinned mesh');
    const sk = mesh as THREE.SkinnedMesh;
    this.mesh = sk;
    sk.frustumCulled = false;
    this.root.add(scene);

    // normalise to the contract in case a replacement model is off: 1.75 tall, feet on the floor
    scene.updateWorldMatrix(true, true);
    sk.geometry.computeBoundingBox();
    const box = sk.geometry.boundingBox!.clone().applyMatrix4(sk.matrixWorld);
    const h = box.max.y - box.min.y;
    if (h > 0.01 && Math.abs(h - this.height) > 0.05) {
      const s = this.height / h;
      scene.scale.multiplyScalar(s);
      scene.position.y -= box.min.y * s;
    }

    const src = sk.material as THREE.MeshStandardMaterial;
    const mat = src.clone();
    mat.envMapIntensity = 1;
    mat.roughness = Math.max(0.55, mat.roughness);
    mat.metalness = 0;
    mat.color.multiplyScalar(0.82);
    this.u.uMap.value = mat.map;
    this.u.uHeight.value = sk.geometry.boundingBox!.max.y - sk.geometry.boundingBox!.min.y;
    const yMin = sk.geometry.boundingBox!.min.y;
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, this.u);
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vBind;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vBind;\nuniform float uForm; uniform float uHeight; uniform vec3 uTint;\n${NOISE}\n${sweep(yMin)}`)
        .replace(
          '#include <map_fragment>',
          // near-white parts of the texture (the shoes) would clip and bloom under any key light: knee them down
          '#include <map_fragment>\n{ float l = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)); diffuseColor.rgb *= mix(1.0, 0.5 / max(l, 0.001), smoothstep(0.45, 0.95, l)); }',
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float kS = sweepK(vBind);
          float thr = uForm * 1.12 - 0.06;
          if (kS < thr) discard;
          totalEmissiveRadiance += uTint * smoothstep(0.022, 0.0, kS - thr) * step(0.001, uForm) * 2.2;`,
        );
    };
    sk.material = mat;

    this.buildPoints(sk, yMin);

    this.mixer = new THREE.AnimationMixer(scene);
    for (const clip of animations) {
      const a = this.mixer.clipAction(clip);
      const name = clip.name.toLowerCase();
      a.play();
      a.setEffectiveWeight(0);
      if (name === 'walk') a.timeScale = 0;
      if (name === 'wave') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions.set(name, a);
      this.acts.push({ name, action: a, w: name === 'idle' ? 1 : 0 });
    }
    this.walkAct = this.actions.get('walk') ?? null;
    this.ready = true;
  }

  private buildPoints(mesh: THREE.SkinnedMesh, yMin: number) {
    const count = [26000, 60000, 110000][this.tier];
    const g = mesh.geometry;
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    const si = g.attributes.skinIndex;
    const sw = g.attributes.skinWeight;
    const index = g.index;
    const tris = index ? index.count / 3 : pos.count / 3;
    const vi = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const cdf = new Float32Array(tris);
    let total = 0;
    for (let t = 0; t < tris; t++) {
      a.fromBufferAttribute(pos, vi(t, 0));
      b.fromBufferAttribute(pos, vi(t, 1));
      c.fromBufferAttribute(pos, vi(t, 2));
      total += b.sub(a).cross(c.sub(a)).length();
      cdf[t] = total;
    }
    const P = new Float32Array(count * 3);
    const U = new Float32Array(count * 2);
    const I = new Uint16Array(count * 4);
    const W = new Float32Array(count * 4);
    const S = new Float32Array(count);
    let seed = 1234567;
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
        U[i * 2] = uv.getX(i0) * w + uv.getX(i1) * u + uv.getX(i2) * v;
        U[i * 2 + 1] = uv.getY(i0) * w + uv.getY(i1) * u + uv.getY(i2) * v;
      }
      const near = w >= u && w >= v ? i0 : u >= v ? i1 : i2;
      if (si && sw) {
        for (let k = 0; k < 4; k++) {
          I[i * 4 + k] = si.getComponent(near, k);
          W[i * 4 + k] = sw.getComponent(near, k);
        }
      }
      S[i] = rnd();
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    pg.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    pg.setAttribute('aSkinI', new THREE.BufferAttribute(I, 4));
    pg.setAttribute('aSkinW', new THREE.BufferAttribute(W, 4));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));

    mesh.skeleton.computeBoneTexture();
    this.u.uBones.value = mesh.skeleton.boneTexture;
    this.u.uBind.value = mesh.bindMatrix;
    this.u.uBindInv.value = mesh.bindMatrixInverse;
    this.u.uSkinned.value = si && sw ? 1 : 0;

    const pm = new THREE.ShaderMaterial({
      uniforms: this.u,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uForm, uScatter, uTime, uTintMix, uGlow, uHeight, uSize, uPush, uSkinned, uPortalOn;
        uniform vec3 uTint, uRayO, uRayD, uPortalCam;
        uniform mat4 uPortal;
        uniform vec2 uPortalShape;
        uniform highp sampler2D uBones;
        uniform sampler2D uMap;
        uniform mat4 uBind, uBindInv;
        attribute vec4 aSkinI, aSkinW;
        attribute float aSeed;
        varying vec3 vCol;
        varying float vA;
        ${NOISE}
        ${sweep(yMin)}
        mat4 boneM(float i) {
          int size = textureSize(uBones, 0).x;
          int j = int(i) * 4;
          int x = j % size;
          int y = j / size;
          return mat4(texelFetch(uBones, ivec2(x, y), 0), texelFetch(uBones, ivec2(x + 1, y), 0), texelFetch(uBones, ivec2(x + 2, y), 0), texelFetch(uBones, ivec2(x + 3, y), 0));
        }
        vec3 flow(vec3 p, float t) {
          return vec3(vnoise(p * 1.3 + vec3(0.0, t, 7.1)), vnoise(p * 1.3 + vec3(13.7, 3.3, t)), vnoise(p * 1.3 + vec3(t, 29.1, 5.5))) - 0.5;
        }
        void main() {
          vec4 p = vec4(position, 1.0);
          if (uSkinned > 0.5) {
            vec4 sp = uBind * p;
            vec4 acc = boneM(aSkinI.x) * sp * aSkinW.x + boneM(aSkinI.y) * sp * aSkinW.y + boneM(aSkinI.z) * sp * aSkinW.z + boneM(aSkinI.w) * sp * aSkinW.w;
            p = uBindInv * vec4(acc.xyz, 1.0);
          }
          vec4 wp = modelMatrix * p;

          float k = sweepK(position);
          float thr = uForm * 1.12 - 0.06;
          float born = 1.0 - smoothstep(thr - 0.05, thr + 0.02, k);
          born *= mix(1.0, 0.45, smoothstep(0.0, 0.08, thr - k) * (1.0 - smoothstep(0.9, 1.0, uForm)) * 0.0);

          float s = clamp(uScatter * 1.5 - aSeed * 0.5, 0.0, 1.0);
          float s2 = s * s;
          vec3 f = flow(wp.xyz * 0.8 + aSeed * 3.0, uTime * 0.25);
          wp.xyz += f * (0.035 * uForm + s2 * 5.5);
          wp.xyz += normalize(vec3(wp.x, 0.35, wp.z) + f) * s2 * 0.9 * (0.4 + aSeed);
          wp.y += s2 * 1.4 * aSeed;

          // pointer: push points away from the pick ray
          vec3 toP = wp.xyz - uRayO;
          vec3 onRay = uRayO + uRayD * dot(toP, uRayD);
          vec3 away = wp.xyz - onRay;
          float d = length(away);
          wp.xyz += (away / max(d, 0.0001)) * smoothstep(0.42, 0.0, d) * 0.3 * uPush * uForm;

          vec4 mv = viewMatrix * wp;
          gl_Position = projectionMatrix * mv;
          float tw = 0.75 + 0.25 * sin(uTime * 2.3 + aSeed * 40.0);
          gl_PointSize = uSize * (1.0 + s2 * 2.5) * (0.7 + aSeed * 0.9) * (5.4 / -mv.z);
          vec3 own = texture2D(uMap, uv).rgb;
          own = own * 1.25 + 0.04;
          vCol = mix(own, uTint, uTintMix) * uGlow * tw;
          vA = born * (1.0 - smoothstep(0.55, 1.0, s));
          // through a rift: behind its plane, a point shows only where the eye sees it through the opening
          if (uPortalOn > 0.5) {
            vec3 q = (uPortal * vec4(wp.xyz, 1.0)).xyz;
            if (q.z < 0.0) {
              vec3 c = uPortalCam;
              float tt = c.z / max(c.z - q.z, 1e-4);
              vec3 h = c + (q - c) * tt;
              float yn = clamp(h.y / max(uPortalShape.y, 0.01), 0.0, 1.0);
              float hw = uPortalShape.x * pow(max(sin(3.14159265 * pow(0.08 + 0.92 * yn, 0.8)), 0.0), 0.8);
              vA *= smoothstep(hw + 0.02, hw - 0.05, abs(h.x)) * step(0.0, h.y) * step(0.0, c.z);
            }
          }
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vCol;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.12, d) * vA;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vCol * a, a);
        }`,
    });
    const pts = new THREE.Points(pg, pm);
    pts.frustumCulled = false;
    pts.matrixAutoUpdate = false;
    this.points = pts;
    mesh.parent!.add(pts);
  }

  /** called by the director after the chapter update */
  update(dt: number, t: number, ray: THREE.Ray, dpr: number, viewH: number) {
    this.root.visible = this.visible && this.ready;
    if (!this.ready || !this.mesh || !this.points) return;
    const form = THREE.MathUtils.clamp(this.form, 0, 1);
    const u = this.u;
    u.uForm.value = form;
    u.uScatter.value = THREE.MathUtils.clamp(this.scatter, 0, 1);
    u.uTime.value = t;
    u.uTint.value.copy(this.tint);
    u.uTintMix.value = this.tintMix;
    u.uGlow.value = this.glow * 0.62;
    u.uSize.value = this.grain * dpr * (viewH / 900) * 1.5;
    this.liveK += (this.live - this.liveK) * (1 - Math.exp(-dt * 6));
    u.uPush.value = this.push * this.liveK;
    u.uRayO.value.copy(ray.origin);
    u.uRayD.value.copy(ray.direction);
    const pt = this.portal;
    u.uPortalOn.value = pt.on ? 1 : 0;
    if (pt.on) {
      u.uPortal.value.copy(pt.toLocal);
      u.uPortalShape.value.set(pt.halfW, pt.height);
      // the pick ray starts at the camera: that is the eye looking through the opening
      u.uPortalCam.value.copy(ray.origin).applyMatrix4(pt.toLocal);
    }

    (this.mesh.material as THREE.Material).visible = form < 0.995;
    this.points.visible = form > 0.002;
    this.points.matrix.copy(this.mesh.matrix);
    (this.blob.material as THREE.ShaderMaterial).uniforms.uA.value = this.shadow * (1 - form);
    this.blob.visible = this.shadow > 0.01;

    // animation: idle <-> walk by travelled distance, or a held pose
    const walk = this.walkAct;
    let walkTarget = 0;
    if (this.forcedWalk >= 0) {
      walkTarget = this.forcedWalk;
      if (walk) walk.time = (walk.time + dt * walkTarget) % walk.getClip().duration;
    } else if (this.walkAsked) {
      if (!this.walkWas) this.travel = this.travelTarget;
      const prev = this.travel;
      this.travel += (this.travelTarget - this.travel) * (1 - Math.exp(-dt * 9));
      const speed = Math.abs(this.travel - prev) / Math.max(dt, 1e-4);
      walkTarget = THREE.MathUtils.smoothstep(speed, 0.04, 0.5);
      if (walk) {
        const d = walk.getClip().duration;
        walk.time = ((((this.travel / this.stride) % 1) + 1) % 1) * d;
      }
    }
    this.walkWas = this.walkAsked;
    this.walkW += (walkTarget - this.walkW) * (1 - Math.exp(-dt * 7));

    const pose = this.pose && this.actions.has(this.pose) ? this.pose : null;
    const ease = 1 - Math.exp(-dt * 6);
    for (let i = 0; i < this.acts.length; i++) {
      const act = this.acts[i];
      const name = act.name;
      const action = act.action;
      let target = 0;
      if (pose) target = name === pose ? 1 : 0;
      else if (name === 'walk') target = this.walkW;
      else if (name === 'idle') target = 1 - this.walkW;
      const w = act.w;
      const nw = name === 'walk' && !pose ? target : w + (target - w) * ease;
      act.w = nw;
      action.setEffectiveWeight(nw);
      if (name === 'wave' && nw < 0.01 && target === 0) action.reset().play().setEffectiveWeight(0);
    }
    this.mixer!.update(dt);
    this.root.updateWorldMatrix(true, true);
    this.mesh.skeleton.update();
  }
}

const NOISE = /* glsl */ `
float hash31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

/** the dissolve order of a point on the bind-pose surface: low values convert first (feet), high last (head) */
const sweep = (yMin: number) => /* glsl */ `
float sweepK(vec3 bind) {
  float h = clamp((bind.y - (${yMin.toFixed(4)})) / uHeight, 0.0, 1.0);
  return h * 0.62 + vnoise(bind * 9.0 / uHeight) * 0.38;
}`;
