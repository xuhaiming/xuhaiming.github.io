import * as THREE from 'three';
import type { Ctx } from '../../world/types';
import { BULGE, GATE, LENS, NOISE, SKIN } from './glsl';

/**
 * X-ray views of the hero. Everything here is a second drawing of the real character: the same
 * geometry, skinned in the vertex shader from the same bone texture, in world space. Each layer is
 * drawn only inside the lens (a disc in screen space).
 *
 * Hero.ts is not modified. While this chapter is active the hero's surface material is swapped for
 * a clone that the lens can cut; release() (called from leave()) puts the original back.
 */

export type Layer = 'flat' | 'clay' | 'lines' | 'ghost' | 'bones' | 'pts';
export const LAYERS: Layer[] = ['flat', 'clay', 'lines', 'ghost', 'bones', 'pts'];

interface LayerState {
  /** 1 = this layer is what the lens shows */
  lens: number;
}

type U = Record<string, THREE.IUniform>;

const ROSE = new THREE.Color('#ff5d8f');

const VERT_HEAD = /* glsl */ `
attribute vec4 skinIndex;
attribute vec4 skinWeight;
${SKIN}
${BULGE}
`;

const FRAG_HEAD = /* glsl */ `
${LENS}
${GATE}
`;

export class XRay {
  readonly group = new THREE.Group();
  ready = false;
  readonly stats = { points: 0, tris: 0, bones: 0, tex: 0 };

  /** lens in CSS pixels; r = 0 turns it off */
  readonly lens = { x: 0, y: 0, r: 0 };
  /** glass ring: presence 0..1, spin angle, mode-switch flash 0..1 (1 = just fired), press 0..1 */
  glass = { k: 0, spin: 0, flash: 0, press: 0 };
  /** 1 = the solid surface is cut away inside the lens */
  solidLens = 0;
  /** brightness of the wire lines layer */
  linesGlow = 1;

  readonly state: Record<Layer, LayerState> = {
    flat: { lens: 0 },
    clay: { lens: 0 },
    lines: { lens: 0 },
    ghost: { lens: 0 },
    bones: { lens: 0 },
    pts: { lens: 0 },
  };

  private shared = {
    uBones: { value: null as THREE.Texture | null },
    uBind: { value: new THREE.Matrix4() },
    uLens: { value: new THREE.Vector4(0, 0, 0, 8) },
    uTime: { value: 0 },
    uPx: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uBulge: { value: 0.1 },
  };
  private objs: Partial<Record<Layer, { objs: THREE.Object3D[]; us: U[] }>> = {};
  private heroMesh: THREE.SkinnedMesh | null = null;
  private heroMat: THREE.Material | null = null;
  private myMat: THREE.Material | null = null;
  private solidU = { uLensOn: { value: 0 } };
  private glassMesh: THREE.Mesh | null = null;
  private geo: { base: THREE.BufferGeometry; tri: THREE.BufferGeometry; pts: THREE.BufferGeometry; bone: THREE.InstancedBufferGeometry; joint: THREE.BufferGeometry } | null = null;
  private map: THREE.Texture | null = null;
  private triGeo: THREE.BufferGeometry | null = null;
  private ptsGeo: THREE.BufferGeometry | null = null;
  private tier = 1;

  /** call every frame until it returns true: the hero model may arrive late */
  build(ctx: Ctx): boolean {
    if (this.ready) return true;
    if (!ctx.hero.ready) return false;
    let mesh: THREE.SkinnedMesh | null = null;
    ctx.hero.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh && (!mesh || m.geometry.attributes.position.count > mesh.geometry.attributes.position.count)) mesh = m;
    });
    if (!mesh) return false;
    const sk = mesh as THREE.SkinnedMesh;
    const g = sk.geometry;
    if (!g.attributes.skinIndex || !sk.skeleton.boneTexture) return false;
    this.tier = ctx.tier;
    this.heroMesh = sk;
    this.heroMat = sk.material as THREE.Material;
    this.map = (this.heroMat as THREE.MeshStandardMaterial).map;

    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox!;
    this.shared.uBones.value = sk.skeleton.boneTexture;
    this.shared.uBind.value = sk.bindMatrix;

    this.stats.tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    this.stats.bones = sk.skeleton.bones.length;
    const img = this.map?.image as { width?: number } | undefined;
    this.stats.tex = img?.width ?? 0;

    // --- geometries ---
    // the two heavy ones are built on separate calls (tens of ms each on a phone): the caller keeps
    // calling from idle time or once a frame until everything is there
    if (!this.triGeo) {
      this.triGeo = wireGeometry(g);
      return false;
    }
    if (!this.ptsGeo) {
      this.ptsGeo = samplePoints(g, [14000, 30000, 46000][ctx.tier], sk.skeleton.bones);
      return false;
    }
    const tri = this.triGeo;
    const pts = this.ptsGeo;
    this.stats.points = pts.attributes.position.count;
    const { bone, joint } = boneGeometry(sk, bb);
    this.geo = { base: g, tri, pts, bone, joint };

    // --- solid surface: a clone of the hero's material that the lens can cut ---
    const orig = this.heroMat;
    const mine = orig.clone();
    const shared = this.shared;
    const solidU = this.solidU;
    mine.onBeforeCompile = (s, r) => {
      orig.onBeforeCompile(s, r);
      s.uniforms.uLens = shared.uLens;
      s.uniforms.uLensSolid = solidU.uLensOn;
      s.fragmentShader = s.fragmentShader.replace('void main() {', `${LENS}\nuniform float uLensSolid;\nvoid main() {\n  if (uLensSolid > 0.5 && lensMask(gl_FragCoord.xy) > 0.5) discard;`);
    };
    this.myMat = mine;
    // the clone only reaches the hero at runtime (apply()), outside this chapter's group, so the
    // director's idle pre-compile would never see it and its program would link inside the first
    // frame in About. A hidden stand-in with the hero's own geometry and skeleton puts it in the group.
    const stand = new THREE.SkinnedMesh(g, mine);
    stand.bind(sk.skeleton, sk.bindMatrix);
    stand.bindMode = sk.bindMode;
    stand.frustumCulled = false;
    stand.visible = false;
    stand.name = 'xray-surface-warm';
    this.group.add(stand);

    // --- layers on the hero ---
    for (const l of LAYERS) {
      const layer = this.make(l);
      this.objs[l] = layer;
      for (const o of layer.objs) this.group.add(o);
    }

    // --- the glass ---
    this.glassMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        premultipliedAlpha: true,
        uniforms: { uC: { value: new THREE.Vector2() }, uR: { value: new THREE.Vector2() }, uK: { value: 0 }, uSpin: { value: 0 }, uFlash: { value: 0 }, uPxR: { value: 100 }, uPress: { value: 0 }, uCol: { value: ROSE.clone() } },
        vertexShader: /* glsl */ `
          uniform vec2 uC, uR; varying vec2 vP;
          void main() { vP = position.xy * 1.7; gl_Position = vec4(uC + vP * uR, 0.0, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uK, uSpin, uFlash, uPxR, uPress; uniform vec3 uCol; varying vec2 vP;
          float gs(float x) { return exp(-x * x); }
          void main() {
            float d = length(vP);
            float px = 1.0 / uPxR;              // one pixel in lens-radius units
            float ang = atan(vP.y, vP.x);
            // glass body: a slightly darker, slightly rose disc with a soft glint
            float inside = smoothstep(1.0, 0.97, d);
            float dark = inside * (0.2 + 0.1 * smoothstep(0.3, 1.0, d));
            float glint = inside * smoothstep(0.55, 0.98, d) * pow(max(0.0, cos(ang - 2.2)), 6.0) * 0.1;
            // rim: a warm inner line and a rose outer line, like a chromatic edge
            float w = 1.0 * px;
            float rimIn = gs((d - 1.0 + 1.2 * px) / w);
            float rimOut = gs((d - 1.0 - 1.2 * px) / w);
            float halo = gs(max(d - 1.0, 0.0) / 0.14) * step(1.0, d) * (0.1 + 0.16 * uPress);
            // a broken outer ring that keeps turning, and ticks every 30 degrees
            float a2 = ang + uSpin;
            float arc = gs((d - 1.085) / (1.1 * px)) * smoothstep(0.35, 0.5, abs(fract(a2 / 2.0943951) - 0.5));
            float tk = abs(fract((ang - uSpin * 0.25) / 0.5235988) - 0.5) * 0.5235988 * d;
            float ticks = smoothstep(1.4 * px, 0.4 * px, tk) * smoothstep(1.035, 1.045, d) * smoothstep(1.075, 1.065, d) * 0.5;
            // centre mark
            vec2 q = abs(vP);
            float cross = smoothstep(1.2 * px, 0.3 * px, min(q.x, q.y)) * smoothstep(0.075, 0.065, max(q.x, q.y)) * smoothstep(0.012, 0.022, max(q.x, q.y)) * 0.55;
            // switching views: a ring runs outwards
            float fl = gs((d - 1.0 - (1.0 - uFlash) * 0.5) / 0.03) * uFlash;
            vec3 warm = vec3(1.0, 0.9, 0.86);
            vec3 col = warm * rimIn * 0.95 + uCol * (rimOut * 1.25 + halo * 0.6 + arc * 1.0 + ticks + fl * 2.0) + warm * (glint + cross);
            col += uCol * inside * 0.012;
            gl_FragColor = vec4(col * uK, dark * uK);
          }`,
      }),
    );
    this.glassMesh.frustumCulled = false;
    this.glassMesh.renderOrder = 30;
    this.group.add(this.glassMesh);

    this.ready = true;
    return true;
  }

  begin() {
    for (const l of LAYERS) {
      const s = this.state[l];
      s.lens = 0;
    }
    this.solidLens = 0;
    this.linesGlow = 1;
    this.lens.r = 0;
    this.glass.k = 0;
  }

  apply(ctx: Ctx, t: number) {
    if (!this.ready) return;
    const { dpr, w, h } = ctx.size;
    const sh = this.shared;
    sh.uTime.value = t;
    sh.uPx.value = dpr * (h / 900);
    const r = Math.max(0, this.lens.r);
    sh.uLens.value.set(this.lens.x * dpr, (h - this.lens.y) * dpr, r * dpr, Math.max(4, Math.round((ctx.size.narrow ? 5 : 7) * dpr)));
    sh.uBones.value = this.heroMesh!.skeleton.boneTexture;
    sh.uRes.value.set(w * dpr, h * dpr);
    sh.uBulge.value = 0.1 + 0.26 * this.glass.press;

    // swap the surface material in (and keep it in: another chapter may have restored it)
    const mesh = this.heroMesh!;
    if (mesh.material !== this.myMat) {
      this.heroMat = mesh.material as THREE.Material;
      mesh.material = this.myMat!;
    }
    this.solidU.uLensOn.value = this.solidLens > 0.5 && r > 1 ? 1 : 0;

    for (const l of LAYERS) {
      const s = this.state[l];
      const layer = this.objs[l]!;
      const on = s.lens > 0.5 && r > 1;
      for (const o of layer.objs) o.visible = on;
      if (!on) continue;
      for (const u of layer.us) {
        u.uLensOn.value = 1;
        if (u.uLineK) u.uLineK.value = l === 'lines' ? this.linesGlow : 1;
      }
    }

    const gm = this.glassMesh!;
    gm.visible = this.glass.k > 0.004 && r > 1;
    if (gm.visible) {
      const u = (gm.material as THREE.ShaderMaterial).uniforms;
      u.uC.value.set((this.lens.x / w) * 2 - 1, -((this.lens.y / h) * 2 - 1));
      u.uR.value.set((r / w) * 2, (r / h) * 2);
      u.uK.value = this.glass.k;
      u.uSpin.value = this.glass.spin;
      u.uFlash.value = this.glass.flash;
      u.uPxR.value = r;
      u.uPress.value = this.glass.press;
    }
  }

  /** give the hero his own material back */
  release() {
    if (this.heroMesh && this.heroMat && this.heroMesh.material === this.myMat) this.heroMesh.material = this.heroMat;
  }

  private base(extra: U = {}): U {
    return {
      uBones: this.shared.uBones,
      uBind: this.shared.uBind,
      uLens: this.shared.uLens,
      uTime: this.shared.uTime,
      uPx: this.shared.uPx,
      uRes: this.shared.uRes,
      uBulge: this.shared.uBulge,
      uLensOn: { value: 0 },
      uRose: { value: ROSE },
      ...extra,
    };
  }

  private make(l: Layer): { objs: THREE.Object3D[]; us: U[] } {
    const geo = this.geo!;
    const objs: THREE.Object3D[] = [];
    const us: U[] = [];
    const push = (o: THREE.Object3D, u: U, ro: number) => {
      (o as THREE.Mesh).frustumCulled = false;
      o.renderOrder = 1 + ro;
      o.matrixAutoUpdate = false;
      objs.push(o);
      us.push(u);
    };

    if (l === 'flat') {
      const u = this.base({ uMap: { value: this.map } });
      push(
        new THREE.Mesh(
          geo.base,
          new THREE.ShaderMaterial({
            uniforms: u,
            vertexShader: /* glsl */ `${VERT_HEAD}
              varying vec2 vUv;
              void main() {
                mat4 m = skinM(skinIndex, skinWeight);
                vec4 w = m * (uBind * vec4(position, 1.0));
                vUv = uv;
                gl_Position = bulge(projectionMatrix * viewMatrix * w);
              }`,
            fragmentShader: /* glsl */ `${FRAG_HEAD}
              uniform sampler2D uMap; uniform vec3 uRose;
              varying vec2 vUv;
              void main() {
                if (gate(gl_FragCoord.xy) < 0.5) discard;
                vec3 tex = texture2D(uMap, vUv).rgb;
                // the base colour map exactly as painted, no light, with its UV grid on top
                vec2 g = vUv * 48.0;
                vec2 fw = fwidth(g);
                vec2 gl = smoothstep(fw * 1.4, fw * 0.4, abs(fract(g) - 0.5) * -1.0 + 0.5);
                float grid = max(gl.x, gl.y) * smoothstep(0.6, 0.15, max(fw.x, fw.y));
                float chk = mod(floor(g.x / 6.0) + floor(g.y / 6.0), 2.0);
                gl_FragColor = vec4(tex * (1.02 + 0.1 * chk) + uRose * grid * 0.55, 1.0);
              }`,
          }),
        ),
        u,
        2,
      );
    }

    if (l === 'clay' || l === 'lines') {
      const solid = l === 'clay';
      const u = this.base({ uLineK: { value: 1 } });
      push(
        new THREE.Mesh(
          geo.tri,
          new THREE.ShaderMaterial({
            uniforms: u,
            transparent: !solid,
            depthWrite: solid,
            blending: solid ? THREE.NormalBlending : THREE.AdditiveBlending,
            vertexShader: /* glsl */ `${VERT_HEAD}
              attribute vec3 aBary;
              varying vec3 vB; varying vec3 vN; varying vec3 vV;
              void main() {
                mat4 m = skinM(skinIndex, skinWeight);
                vec4 w = m * (uBind * vec4(position, 1.0));
                vB = aBary;
                vN = mat3(m) * mat3(uBind) * normal;
                vV = cameraPosition - w.xyz;
                gl_Position = bulge(projectionMatrix * viewMatrix * w);
              }`,
            fragmentShader: /* glsl */ `${FRAG_HEAD}
              uniform float uLineK; uniform vec3 uRose;
              varying vec3 vB; varying vec3 vN; varying vec3 vV;
              void main() {
                if (gate(gl_FragCoord.xy) < 0.5) discard;
                float e = min(min(vB.x, vB.y), vB.z);
                float fw = fwidth(e);
                // lines thin out to an even tone when the triangles get smaller than a few pixels
                float line = (1.0 - smoothstep(fw * 0.35, fw * 1.15, e)) * mix(0.16, 1.0, smoothstep(0.42, 0.1, fw));
                vec3 N = normalize(vN);
                vec3 V = normalize(vV);
                float ndv = max(dot(N, V), 0.0);
                float rim = pow(max(1.0 - ndv, 0.0), 2.4);
                ${
                  solid
                    ? /* glsl */ `
                // dark x-ray fill with bright wires
                vec3 dark = vec3(0.022, 0.008, 0.014) * (0.6 + ndv) + uRose * rim * 0.16;
                vec3 lineC = mix(uRose, vec3(1.0, 0.86, 0.84), 0.35) * 1.5;
                vec3 col = mix(dark, lineC, line * uLineK);
                gl_FragColor = vec4(col, 1.0);`
                    : /* glsl */ `
                float a = line * uLineK * (0.22 + rim * 0.9);
                if (a < 0.004) discard;
                vec3 col = mix(uRose, vec3(1.0, 0.86, 0.84), 0.25) * a;
                gl_FragColor = vec4(col, 1.0);`
                }
              }`,
          }),
        ),
        u,
        solid ? 2 : 6,
      );
    }

    if (l === 'ghost') {
      const u = this.base();
      push(
        new THREE.Mesh(
          geo.base,
          new THREE.ShaderMaterial({
            uniforms: u,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: /* glsl */ `${VERT_HEAD}
              varying vec3 vN; varying vec3 vV;
              void main() {
                mat4 m = skinM(skinIndex, skinWeight);
                vec4 w = m * (uBind * vec4(position, 1.0));
                vN = mat3(m) * mat3(uBind) * normal;
                vV = cameraPosition - w.xyz;
                gl_Position = bulge(projectionMatrix * viewMatrix * w);
              }`,
            fragmentShader: /* glsl */ `${FRAG_HEAD}
              uniform vec3 uRose;
              varying vec3 vN; varying vec3 vV;
              void main() {
                if (gate(gl_FragCoord.xy) < 0.5) discard;
                float ndv = abs(dot(normalize(vN), normalize(vV)));
                float rim = pow(max(1.0 - ndv, 0.0), 2.2);
                vec3 col = uRose * (rim * 0.5 + 0.018);
                gl_FragColor = vec4(col, 1.0);
              }`,
          }),
        ),
        u,
        5,
      );
    }

    if (l === 'bones') {
      const u = this.base();
      push(
        new THREE.Mesh(
          geo.bone,
          new THREE.ShaderMaterial({
            uniforms: u,
            vertexShader: /* glsl */ `
              ${SKIN}
              ${BULGE}
              attribute vec2 aI; attribute vec3 aR0; attribute vec3 aR1; attribute vec3 aBary;
              varying vec3 vB; varying vec3 vW; varying float vAlong;
              void main() {
                vec3 h = (boneM(aI.x) * vec4(aR0, 1.0)).xyz;
                vec3 t = (boneM(aI.y) * vec4(aR1, 1.0)).xyz;
                vec3 ax = t - h;
                float len = max(length(ax), 1e-5);
                vec3 d = ax / len;
                vec3 ref = abs(d.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
                vec3 bx = normalize(cross(ref, d));
                vec3 bz = cross(d, bx);
                float wd = clamp(len * 0.13, 0.006, 0.034);
                vec3 p = h + d * (position.y * len) + (bx * position.x + bz * position.z) * wd;
                vB = aBary; vW = p; vAlong = position.y;
                gl_Position = bulge(projectionMatrix * viewMatrix * vec4(p, 1.0));
              }`,
            fragmentShader: /* glsl */ `${FRAG_HEAD}
              uniform vec3 uRose;
              varying vec3 vB; varying vec3 vW; varying float vAlong;
              void main() {
                if (gate(gl_FragCoord.xy) < 0.5) discard;
                vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
                vec3 V = normalize(cameraPosition - vW);
                float ndv = abs(dot(N, V));
                float e = min(min(vB.x, vB.y), vB.z);
                float fw = fwidth(e);
                float line = 1.0 - smoothstep(fw * 0.7, fw * 1.9, e);
                vec3 body = mix(vec3(0.34, 0.08, 0.16), vec3(0.9, 0.42, 0.5), ndv * ndv) * (0.5 + 0.5 * vAlong);
                vec3 col = mix(body, vec3(1.0, 0.9, 0.88) * 1.7, line);
                gl_FragColor = vec4(col, 1.0);
              }`,
          }),
        ),
        u,
        3,
      );
      const uj = this.base();
      push(
        new THREE.Points(
          geo.joint,
          new THREE.ShaderMaterial({
            uniforms: uj,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            premultipliedAlpha: true,
            vertexShader: /* glsl */ `
              ${SKIN}
              ${BULGE}
              uniform float uPx, uTime;
              attribute float aI; attribute float aK; attribute float aSize;
              varying float vPulse;
              void main() {
                vec4 w = boneM(aI) * vec4(position, 1.0);
                vec4 mv = viewMatrix * w;
                vPulse = 0.5 + 0.5 * sin(uTime * 2.0 - aK * 9.0);
                gl_Position = bulge(projectionMatrix * mv);
                gl_PointSize = uPx * aSize * 62.0 / -mv.z;
              }`,
            fragmentShader: /* glsl */ `${FRAG_HEAD}
              uniform vec3 uRose; varying float vPulse;
              void main() {
                if (gate(gl_FragCoord.xy) < 0.5) discard;
                float d = length(gl_PointCoord - 0.5) * 2.0;
                float core = smoothstep(0.42, 0.3, d);
                float ring = smoothstep(0.16, 0.0, abs(d - 0.78)) * (0.45 + 0.55 * vPulse);
                float a = max(core, ring);
                if (a < 0.01) discard;
                vec3 col = vec3(1.0, 0.93, 0.9) * core * 1.6 + uRose * ring * 1.8;
                gl_FragColor = vec4(col, max(core, ring * 0.5));
              }`,
          }),
        ),
        uj,
        8,
      );
    }

    if (l === 'pts') {
      const u = this.base({ uMap: { value: this.map } });
      push(
        new THREE.Points(
          geo.pts,
          new THREE.ShaderMaterial({
            uniforms: u,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: /* glsl */ `
              attribute vec4 aSkinI; attribute vec4 aSkinW; attribute float aSeed;
              ${NOISE}
              ${SKIN}
              ${BULGE}
              uniform sampler2D uMap; uniform float uPx, uTime; uniform vec3 uRose;
              varying vec3 vCol;
              void main() {
                mat4 m = skinM(aSkinI, aSkinW);
                vec4 w = m * (uBind * vec4(position, 1.0));
                // each point breathes off the surface a little
                float ph = uTime * (0.6 + aSeed) + aSeed * 40.0;
                w.xyz += (vec3(vnoise(position * 9.0 + ph * 0.2), vnoise(position * 9.0 + 7.0 - ph * 0.17), vnoise(position * 9.0 + 3.0 + ph * 0.13)) - 0.5) * 0.02;
                vec4 mv = viewMatrix * w;
                gl_Position = bulge(projectionMatrix * mv);
                float tw = 0.7 + 0.3 * sin(ph * 2.0);
                gl_PointSize = uPx * (0.75 + aSeed * 0.9) * 7.2 / -mv.z;
                vec3 own = texture2D(uMap, uv).rgb * 1.5 + 0.05;
                vCol = mix(own, uRose, 0.42) * tw * 0.8;
              }`,
            fragmentShader: /* glsl */ `${FRAG_HEAD}
              varying vec3 vCol;
              void main() {
                if (gate(gl_FragCoord.xy) < 0.5) discard;
                float d = length(gl_PointCoord - 0.5);
                float a = smoothstep(0.5, 0.1, d);
                if (a < 0.004) discard;
                gl_FragColor = vec4(vCol * a, 1.0);
              }`,
          }),
        ),
        u,
        7,
      );
    }
    return { objs, us };
  }
}

/**
 * The wire view needs unshared corners (barycentric edges): an unindexed copy carrying only what its
 * shader reads, in the file's own compact types (three times the vertices, so every byte counts).
 */
function wireGeometry(g: THREE.BufferGeometry) {
  const lean = new THREE.BufferGeometry();
  lean.setIndex(g.index);
  for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) lean.setAttribute(name, g.attributes[name]);
  const tri = g.index ? lean.toNonIndexed() : lean.clone();
  const n = tri.attributes.position.count;
  const bary = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) bary[i * 3 + (i % 3)] = 255;
  tri.setAttribute('aBary', new THREE.BufferAttribute(bary, 3, true));
  return tri;
}

/** area-weighted surface samples that keep the skinning of their nearest vertex (the same idea as Hero.buildPoints) */
function samplePoints(g: THREE.BufferGeometry, count: number, bones: THREE.Bone[]) {
  // more points per area on the head (the face has to read through the lens) and a few more on the hands
  const gain = new Float32Array(bones.length).fill(1);
  for (let i = 0; i < bones.length; i++)
    for (let o: THREE.Object3D | null = bones[i]; o && (o as THREE.Bone).isBone; o = o.parent) {
      if (/Head$/.test(o.name)) gain[i] = 2.4;
      else if (/Hand$/.test(o.name)) gain[i] = 1.5;
      else continue;
      break;
    }
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
    // the triangle's first corner decides: regions are far larger than a triangle
    const v0 = vi(t, 0);
    let k = 0;
    for (let j = 1; j < 4; j++) if (sw.getComponent(v0, j) > sw.getComponent(v0, k)) k = j;
    total += b.sub(a).cross(c.sub(a)).length() * (gain[si.getComponent(v0, k)] ?? 1);
    cdf[t] = total;
  }
  const P = new Float32Array(count * 3);
  const U = new Float32Array(count * 2);
  const I = bones.length <= 256 ? new Uint8Array(count * 4) : new Uint16Array(count * 4);
  const W = new Float32Array(count * 4);
  const S = new Float32Array(count);
  let seed = 9871;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
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
    for (let k = 0; k < 4; k++) {
      I[i * 4 + k] = si.getComponent(near, k);
      W[i * 4 + k] = sw.getComponent(near, k);
    }
    S[i] = rnd();
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
  pg.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  pg.setAttribute('aSkinI', new THREE.BufferAttribute(I, 4));
  pg.setAttribute('aSkinW', new THREE.BufferAttribute(W, 4));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));
  return pg;
}

const HELPER = /(ArmHalf|ElbowHalf|KneeHalf|ForeArmTwist)$/;
const FACE = /(Jaw|Lip(Upper|Lower)|Eyelid(Upper|Lower)|Brow|MouthCorner|Cheek)$/;

/** one octahedral bone per parent-child pair and one dot per joint, both posed in the shader from the bone texture */
function boneGeometry(mesh: THREE.SkinnedMesh, bb: THREE.Box3) {
  const sk = mesh.skeleton;
  const rest: THREE.Vector3[] = sk.boneInverses.map((m) => new THREE.Vector3().setFromMatrixPosition(m.clone().invert()));
  const toLocal = mesh.bindMatrix.clone().invert();
  const tmp = new THREE.Vector3();
  const kOf = (v: THREE.Vector3) => {
    tmp.copy(v).applyMatrix4(toLocal);
    return THREE.MathUtils.clamp((tmp.y - bb.min.y) / (bb.max.y - bb.min.y), 0, 1) * 0.62 + 0.19;
  };

  // unit bone: head at y = 0, tail at y = 1, widest a little above the head (the Blender shape)
  const H = [0, 0, 0];
  const T = [0, 1, 0];
  const ring = [
    [1, 0.14, 0],
    [0, 0.14, 1],
    [-1, 0.14, 0],
    [0, 0.14, -1],
  ];
  const P: number[] = [];
  const B: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => {
    P.push(...a, ...b, ...c);
    B.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
  };
  for (let i = 0; i < 4; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % 4];
    tri(H, b, a);
    tri(T, a, b);
  }
  const bone = new THREE.InstancedBufferGeometry();
  bone.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  bone.setAttribute('aBary', new THREE.Float32BufferAttribute(B, 3));
  const I: number[] = [];
  const R0: number[] = [];
  const R1: number[] = [];
  const K: number[] = [];
  const JP: number[] = [];
  const JI: number[] = [];
  const JK: number[] = [];
  const JS: number[] = [];
  const fwd = new THREE.Vector3(0, 0, 1).transformDirection(mesh.bindMatrix);
  sk.bones.forEach((b, i) => {
    // helper joints (they only follow their neighbour at half strength to keep the skin's volume) are not
    // part of the skeleton a person would draw
    if (HELPER.test(b.name)) return;
    const pi = b.parent && (b.parent as THREE.Bone).isBone ? sk.bones.indexOf(b.parent as THREE.Bone) : -1;
    let len = 0.12;
    if (pi >= 0 && FACE.test(b.name)) {
      // face controls all hang off the head joint: drawn as spokes they would fill the skull. Each is a
      // short pin under the skin, pointing out of the face, with a small dot
      len = 0.026;
      const tail = rest[i].clone().addScaledVector(fwd, len);
      I.push(i, i);
      R0.push(rest[i].x, rest[i].y, rest[i].z);
      R1.push(tail.x, tail.y, tail.z);
      K.push(kOf(rest[i]));
      JP.push(tail.x, tail.y, tail.z);
      JI.push(i);
      JK.push(kOf(rest[i]));
      JS.push(0.2);
      return;
    }
    if (pi >= 0) {
      len = rest[i].distanceTo(rest[pi]);
      if (len > 0.004) {
        I.push(pi, i);
        R0.push(rest[pi].x, rest[pi].y, rest[pi].z);
        R1.push(rest[i].x, rest[i].y, rest[i].z);
        K.push(kOf(rest[pi]));
      }
    }
    // leaf joints (head, hands, toes) get a short tip in the direction they were already going
    if (pi >= 0 && !b.children.some((c) => (c as THREE.Bone).isBone)) {
      const tip = rest[i].clone().sub(rest[pi]).normalize().multiplyScalar(Math.min(0.2, len * 0.7)).add(rest[i]);
      I.push(i, i);
      R0.push(rest[i].x, rest[i].y, rest[i].z);
      R1.push(tip.x, tip.y, tip.z);
      K.push(kOf(rest[i]));
    }
    JP.push(rest[i].x, rest[i].y, rest[i].z);
    JI.push(i);
    JK.push(kOf(rest[i]));
    JS.push(THREE.MathUtils.clamp(len * 5.5, 0.24, 1));
  });
  bone.setAttribute('aI', new THREE.InstancedBufferAttribute(new Float32Array(I), 2));
  bone.setAttribute('aR0', new THREE.InstancedBufferAttribute(new Float32Array(R0), 3));
  bone.setAttribute('aR1', new THREE.InstancedBufferAttribute(new Float32Array(R1), 3));
  bone.setAttribute('aK', new THREE.InstancedBufferAttribute(new Float32Array(K), 1));
  bone.instanceCount = K.length;
  const joint = new THREE.BufferGeometry();
  joint.setAttribute('position', new THREE.Float32BufferAttribute(JP, 3));
  joint.setAttribute('aI', new THREE.Float32BufferAttribute(JI, 1));
  joint.setAttribute('aK', new THREE.Float32BufferAttribute(JK, 1));
  joint.setAttribute('aSize', new THREE.Float32BufferAttribute(JS, 1));
  return { bone, joint };
}
