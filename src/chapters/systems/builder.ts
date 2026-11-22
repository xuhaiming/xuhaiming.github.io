import * as THREE from 'three';
import type { Ctx, Frame } from '../../world/types';
import { clamp01, css, damp, flag, inOutCubic, mix, seg, smooth } from '../../world/util';
import { APPS, appTexture, TILE_NAMES, WALL_COLS, WALL_ROWS, wallAtlas } from './apps';
import { fibre, LIME, outCubic, pin, prop, rng, Takeover } from './kit';

/**
 * Machine one: the app builder. A request is typed, a panel assembles from layout blocks, the
 * blocks fill with components, fibres bind them to internal services, and the finished app flies
 * to a wall of published apps where a colleague opens it.
 */

const PW = 2.5;
const PH = PW * 0.625;
const HOME = new THREE.Vector3(0.7, 2.02, 0.95);
const HOME_RY = -0.2;
const WALL_Z = -3.3;
const WALL_X = 0.9;
const WALL_Y = 2.85;
const TW = 0.66;
const TH = 0.5;
const PX = 0.75;
const PY = 0.585;
const N = WALL_COLS * WALL_ROWS;
const MINE = 1 * WALL_COLS + 8; // the slot the visitor's app lands in
const MAXB = 8;

export function createBuilder(ctx: Ctx, el: HTMLElement, X: number) {
  const group = new THREE.Group();
  group.position.x = X;
  const take = new Takeover();
  let app = 0;
  let appShown = -1;
  const textures: (THREE.Texture | null)[] = [null, null, null];
  const r = rng(77);

  /* ----- DOM ----- */
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s);
  const chips = Array.from(el.querySelectorAll<HTMLButtonElement>('.s-c1 .s-chip'));
  const promptEl = q('.s-prompt');
  const promptText = q('.s-prompt-text');
  const stepsEl = q('.s-steps');
  const steps = Array.from(el.querySelectorAll<HTMLElement>('.s-steps li'));
  const tags = Array.from(el.querySelectorAll<HTMLElement>('.s-svc'));
  const countEl = q('.s-count');
  const countNum = q('.s-count b');
  const tileEl = q('.s-tilename');
  const cursorEl = q('.s-cursor');
  const openEl = q('.s-opened');
  let typed = -1;
  let countShown = '';

  chips.forEach((c, i) =>
    c.addEventListener('click', () => {
      app = i;
      take.play(8.5);
    }),
  );

  /* ----- light ----- */
  const lamp = new THREE.PointLight(LIME, 0, 11, 1.6);
  lamp.position.set(0.6, 2.4, 1.6);
  group.add(lamp);

  /* ----- plinth and props ----- */
  const metal = new THREE.MeshStandardMaterial({ color: '#0d100c', roughness: 0.42, metalness: 0.85 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.9, 0.16, 48), metal);
  plinth.position.set(0.7, 0.08, 0.3);
  group.add(plinth);
  const ringMat = new THREE.MeshBasicMaterial({ color: LIME.clone().multiplyScalar(1.6) });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.012, 8, 96), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0.7, 0.165, 0.3);
  group.add(ring);

  ctx.glb('/assets/systems/prop-forge.glb').then(
    (g) => {
      const o = prop(g.scene);
      o.scale.setScalar(3.1);
      o.position.set(0.7, 0.16, -0.25);
      o.rotation.y = -0.35;
      group.add(o);
    },
    () => {},
  );
  ctx.glb('/assets/systems/prop-console.glb').then(
    (g) => {
      const o = prop(g.scene);
      o.scale.setScalar(1.25);
      o.position.set(-1.5, 0, 0.85);
      o.rotation.y = -Math.PI / 2 + 0.5;
      group.add(o);
    },
    () => {},
  );

  /* ----- the panel being built ----- */
  const panel = new THREE.Group();
  group.add(panel);

  const plateU = {
    uA: { value: 0 },
    uScan: { value: -1 },
    uPack: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: new THREE.Vector2(PW + 0.14, PH + 0.14) },
  };
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(PW + 0.14, PH + 0.14),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: plateU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uA, uScan, uPack, uTime; uniform vec2 uSize; varying vec2 vUv;
        float box(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
        void main() {
          vec2 p = (vUv - 0.5) * uSize;
          float d = box(p, uSize * 0.5, 0.07);
          float inside = smoothstep(0.0, -0.01, d);
          float rim = smoothstep(0.022, 0.0, abs(d + 0.012));
          vec3 lime = vec3(0.72, 1.0, 0.24);
          vec3 col = vec3(0.012, 0.018, 0.01) + lime * rim * (0.55 + uPack * 2.0);
          // the print head: a bright bar that sweeps down while components are laid in
          float bar = smoothstep(0.02, 0.0, abs((1.0 - vUv.y) - uScan)) * step(0.0, uScan) * step(uScan, 1.0);
          col += lime * bar * 2.6;
          col += lime * uPack * smoothstep(0.08, 0.0, abs(vUv.y - fract(uPack * 1.0))) * 1.5;
          gl_FragColor = vec4(col, inside * uA * 0.9 + rim * uA * 0.1);
        }`,
    }),
  );
  plate.position.z = -0.03;
  plate.renderOrder = 2;
  panel.add(plate);

  const base = new THREE.PlaneGeometry(1, 1);
  const bg = new THREE.InstancedBufferGeometry();
  bg.index = base.index;
  bg.setAttribute('position', base.attributes.position);
  bg.setAttribute('uv', base.attributes.uv);
  const aRect = new THREE.InstancedBufferAttribute(new Float32Array(MAXB * 4), 4);
  const aOrd = new THREE.InstancedBufferAttribute(new Float32Array(MAXB), 1);
  const aData = new THREE.InstancedBufferAttribute(new Float32Array(MAXB), 1);
  const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(MAXB * 3), 3);
  for (let i = 0; i < MAXB * 3; i++) aSeed.array[i] = r();
  bg.setAttribute('aRect', aRect);
  bg.setAttribute('aOrd', aOrd);
  bg.setAttribute('aData', aData);
  bg.setAttribute('aSeed', aSeed);
  const bu = {
    uMap: { value: null as THREE.Texture | null },
    uLayout: { value: 0 },
    uFill: { value: 0 },
    uData: { value: 0 },
    uMerge: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: new THREE.Vector2(PW, PH) },
    uGain: { value: 1 },
  };
  const blocks = new THREE.Mesh(
    bg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: bu,
      vertexShader: /* glsl */ `
        uniform float uLayout, uMerge, uTime; uniform vec2 uSize;
        attribute vec4 aRect; attribute float aOrd, aData; attribute vec3 aSeed;
        varying vec2 vUv, vP, vHalf; varying vec4 vRect; varying float vIn, vOrd, vData;
        mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
        void main() {
          float tin = clamp(uLayout * 1.7 - aOrd * 0.7, 0.0, 1.0);
          float e = 1.0 - pow(1.0 - tin, 3.0);
          vec2 size = aRect.zw * uSize;
          vec2 c = (aRect.xy + aRect.zw * 0.5 - 0.5) * vec2(1.0, -1.0) * uSize;
          vec3 q = vec3(position.xy * size, 0.0);
          float ang = (1.0 - e) * (aSeed.x - 0.5) * 3.4;
          q.xz = rot(ang) * q.xz;
          q.yz = rot(ang * 0.7) * q.yz;
          vec3 from = vec3((aSeed.x - 0.5) * 3.4, -1.7 - aSeed.y * 0.6, 0.2 + aSeed.z * 1.4);
          vec3 pos = mix(from, vec3(c, 0.0), e) + q * mix(0.55, 1.0, e);
          pos.z += sin(e * 3.14159) * 0.55 + (1.0 - uMerge) * (0.02 + aSeed.z * 0.07) * e;
          pos.y += (1.0 - uMerge) * sin(uTime * 0.9 + aSeed.y * 20.0) * 0.006 * e;
          vUv = uv; vP = position.xy * size; vHalf = size * 0.5; vRect = aRect; vIn = tin; vOrd = aOrd; vData = aData;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uFill, uData, uTime, uGain;
        varying vec2 vUv, vP, vHalf; varying vec4 vRect; varying float vIn, vOrd, vData;
        float box(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
        void main() {
          float d = box(vP, vHalf, 0.035);
          float inside = smoothstep(0.0, -0.006, d);
          float edge = smoothstep(0.014, 0.0, abs(d + 0.008));
          vec2 puv = vRect.xy + vec2(vUv.x, 1.0 - vUv.y) * vRect.zw;
          vec3 skel = texture2D(uMap, vec2(puv.x, 1.0 - puv.y * 0.5)).rgb;
          vec3 live = texture2D(uMap, vec2(puv.x, 0.5 - puv.y * 0.5)).rgb;
          float f = clamp(uFill * 1.6 - vOrd * 0.6, 0.0, 1.0);
          float down = 1.0 - vUv.y;
          float shown = step(down, f);
          float front = smoothstep(0.05, 0.0, abs(down - f)) * step(0.001, f) * step(f, 0.999);
          float l = vData < -0.5 ? 1.0 : clamp(uData * 1.8 - vOrd * 0.8, 0.0, 1.0);
          float lr = smoothstep(vUv.x - 0.2, vUv.x, l * 1.2);
          vec3 ui = mix(skel, live, lr);
          vec3 lime = vec3(0.72, 1.0, 0.24);
          float wave = smoothstep(0.12, 0.0, abs(vUv.x - l * 1.2)) * step(0.001, l) * step(l, 0.99);
          // wireframe stage: outline and a faint diagonal hatch
          float hatch = smoothstep(0.92, 1.0, sin((vP.x + vP.y) * 46.0 - uTime * 2.0) * 0.5 + 0.5) * 0.05;
          vec3 col = lime * (edge * (1.4 - shown * 1.05) + hatch * (1.0 - shown)) + ui * shown * uGain * 1.25 + lime * (front * 1.8 + wave * 0.3);
          float a = inside * vIn * mix(0.55, 1.0, shown);
          gl_FragColor = vec4(col, a);
        }`,
    }),
  );
  blocks.frustumCulled = false;
  blocks.renderOrder = 3;
  panel.add(blocks);

  const loadApp = (i: number) => {
    const def = APPS[i];
    if (!textures[i]) textures[i] = appTexture(def, ctx.tier === 0 ? 768 : 1024);
    bu.uMap.value = textures[i];
    const order = def.blocks.map((_, k) => k);
    def.blocks.forEach((b, k) => {
      aRect.setXYZW(k, b.x, b.y, b.w, b.h);
      aOrd.setX(k, order[k] / Math.max(1, def.blocks.length - 1));
      aData.setX(k, b.data ?? -1);
    });
    aRect.needsUpdate = aOrd.needsUpdate = aData.needsUpdate = true;
    bg.instanceCount = def.blocks.length;
    tags.forEach((t, k) => {
      const s = t.querySelector('span');
      if (s) s.textContent = def.services[k];
    });
    chips.forEach((c, k) => {
      flag(c, 'on', k === i);
      c.setAttribute('aria-pressed', String(k === i));
    });
    appShown = i;
    typed = -1;
  };

  /* ----- internal services: three drums, bound by fibres ----- */
  const drumPos = [new THREE.Vector3(2.75, 0, -1.0), new THREE.Vector3(3.3, 0, -0.25), new THREE.Vector3(2.85, 0, 0.5)];
  const drumH = [1.5, 1.1, 0.8];
  const drumRings: THREE.MeshBasicMaterial[] = [];
  const disc = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32);
  const gap = new THREE.CylinderGeometry(0.285, 0.285, 0.05, 32);
  const dark = new THREE.MeshStandardMaterial({ color: '#141813', roughness: 0.36, metalness: 0.9 });
  const fibres: ReturnType<typeof fibre>[] = [];
  panel.position.copy(HOME);
  panel.rotation.y = HOME_RY;
  panel.updateMatrix();
  drumPos.forEach((p, i) => {
    const n = Math.round(drumH[i] / 0.25);
    const rm = new THREE.MeshBasicMaterial({ color: LIME.clone() });
    drumRings.push(rm);
    for (let k = 0; k < n; k++) {
      const d = new THREE.Mesh(disc, dark);
      d.position.set(p.x, 0.1 + k * 0.25, p.z);
      const g2 = new THREE.Mesh(gap, rm);
      g2.position.set(p.x, 0.225 + k * 0.25, p.z);
      group.add(d);
      if (k < n - 1) group.add(g2);
    }
    const top = new THREE.Vector3(p.x, n * 0.25 - 0.02, p.z);
    const end = new THREE.Vector3(PW / 2 + 0.07, 0.45 - i * 0.45, 0).applyMatrix4(panel.matrix);
    const midA = top.clone().add(new THREE.Vector3(-0.1, 0.7 + i * 0.1, 0.2));
    const midB = end.clone().add(new THREE.Vector3(0.55, 0.12, 0.1));
    const fb = fibre([top, midA, midB, end], 0.013);
    fibres.push(fb);
    group.add(fb.mesh);
  });

  /* ----- the wall of published apps ----- */
  const tg = new THREE.InstancedBufferGeometry();
  tg.index = base.index;
  tg.setAttribute('position', base.attributes.position);
  tg.setAttribute('uv', base.attributes.uv);
  const tPos = new Float32Array(N * 3);
  const tCell = new Float32Array(N * 2);
  const tOrd = new Float32Array(N);
  const tIdx = new Float32Array(N);
  const tSeed = new Float32Array(N);
  const rank: number[] = [];
  // publish order: roughly outward from the middle, with noise, so the wall grows like a crowd
  const order = Array.from({ length: N }, (_, i) => i)
    .filter((i) => i !== MINE)
    .map((i) => {
      const cx = (i % WALL_COLS) - 6;
      const cy = Math.floor(i / WALL_COLS) - 3;
      return { i, k: Math.hypot(cx * 0.6, cy) + r() * 3.2 };
    })
    .sort((a, b) => a.k - b.k);
  order.forEach((o, k) => (rank[o.i] = k));
  rank[MINE] = 9999;
  const slot = (i: number, out: THREE.Vector3) =>
    out.set(WALL_X + ((i % WALL_COLS) - (WALL_COLS - 1) / 2) * PX, WALL_Y + ((WALL_ROWS - 1) / 2 - Math.floor(i / WALL_COLS)) * PY, WALL_Z);
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    slot(i, v);
    tPos.set([v.x, v.y, v.z + (r() - 0.5) * 0.1], i * 3);
    tCell.set([i % WALL_COLS, Math.floor(i / WALL_COLS)], i * 2);
    tOrd[i] = rank[i];
    tIdx[i] = i;
    tSeed[i] = r();
  }
  tg.setAttribute('aPos', new THREE.InstancedBufferAttribute(tPos, 3));
  tg.setAttribute('aCell', new THREE.InstancedBufferAttribute(tCell, 2));
  tg.setAttribute('aOrd', new THREE.InstancedBufferAttribute(tOrd, 1));
  tg.setAttribute('aIdx', new THREE.InstancedBufferAttribute(tIdx, 1));
  tg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(tSeed, 1));
  tg.instanceCount = N;
  const tu = {
    uAtlas: { value: null as THREE.Texture | null },
    uCount: { value: 0 },
    uTime: { value: 0 },
    uHover: { value: -1 },
    uHoverAmt: { value: 0 },
    uPress: { value: -1 },
    uPressAmt: { value: 0 },
    uTile: { value: new THREE.Vector2(TW, TH) },
    uGrid: { value: new THREE.Vector2(WALL_COLS, WALL_ROWS) },
    uA: { value: 1 },
  };
  const wall = new THREE.Mesh(
    tg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: tu,
      vertexShader: /* glsl */ `
        uniform float uCount, uTime, uHover, uHoverAmt, uPress, uPressAmt; uniform vec2 uTile;
        attribute vec3 aPos; attribute vec2 aCell; attribute float aOrd, aIdx, aSeed;
        varying vec2 vUv, vCell; varying float vOn, vSeed, vHot;
        void main() {
          float on = clamp(uCount - aOrd, 0.0, 1.0);
          float pop = 1.0 + sin(on * 3.14159) * 0.3;
          float h = abs(aIdx - uHover) < 0.5 ? uHoverAmt : 0.0;
          float pr = abs(aIdx - uPress) < 0.5 ? uPressAmt : 0.0;
          vec3 p = aPos + vec3(position.xy * uTile * mix(0.9, 1.0, on) * pop * (1.0 + h * 0.2 + pr * 1.6), h * 0.3 + pr * 1.3 + sin(on * 3.14159) * 0.5);
          p.y += sin(uTime * 0.7 + aSeed * 30.0) * 0.008;
          vUv = uv; vCell = aCell; vOn = on; vSeed = aSeed; vHot = max(h, pr);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uAtlas; uniform float uTime, uA; uniform vec2 uGrid, uTile;
        varying vec2 vUv, vCell; varying float vOn, vSeed, vHot;
        float box(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
        void main() {
          vec2 p = (vUv - 0.5) * uTile;
          float d = box(p, uTile * 0.5, 0.035);
          float inside = smoothstep(0.0, -0.006, d);
          float edge = smoothstep(0.012, 0.0, abs(d + 0.007));
          vec2 uv = vec2((vCell.x + vUv.x) / uGrid.x, 1.0 - (vCell.y + 1.0 - vUv.y) / uGrid.y);
          vec3 ui = texture2D(uAtlas, uv).rgb;
          vec3 lime = vec3(0.72, 1.0, 0.24);
          // idle life: now and then a tile is in use and brightens
          float use = smoothstep(0.93, 1.0, sin(uTime * 0.45 + vSeed * 80.0) * 0.5 + 0.5);
          float born = sin(vOn * 3.14159);
          vec3 col = ui * (0.62 + use * 0.55 + vHot * 0.9) * vOn + lime * (edge * (0.1 + vOn * 0.22 + vHot * 1.2 + use * 0.3) + born * 0.8);
          float a = inside * mix(0.16, 1.0, vOn) * uA + edge * 0.1 * uA;
          gl_FragColor = vec4(col, a);
        }`,
    }),
  );
  wall.frustumCulled = false;
  wall.renderOrder = 1;
  group.add(wall);

  // landing flash on the visitor's slot
  const flashU = { uA: { value: 0 } };
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: flashU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform float uA; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float r = 1.0 - uA; float ring = smoothstep(0.08, 0.0, abs(d - r * 0.9)) * uA; gl_FragColor = vec4(vec3(0.72, 1.0, 0.24) * (ring * 2.0 + exp(-d * d * 8.0) * uA * 0.6), 1.0); }',
    }),
  );
  slot(MINE, flash.position);
  flash.position.z += 0.05;
  group.add(flash);

  /* ----- pointer: hover and open tiles on the wall ----- */
  let hover = -1;
  let hoverAmt = 0;
  let press = -1;
  let pressT = -10;
  let pressAmt = 0;
  let count = 0;
  let active = false;
  let now = 0;
  const hit = new THREE.Vector3();
  const pickTile = () => {
    const ray = ctx.ray().ray;
    const oz = ray.origin.z;
    const dz = ray.direction.z;
    if (Math.abs(dz) < 1e-4) return -1;
    const k = (WALL_Z - oz) / dz;
    if (k < 0) return -1;
    hit.copy(ray.direction).multiplyScalar(k).add(ray.origin);
    const cx = (hit.x - X - WALL_X) / PX + (WALL_COLS - 1) / 2;
    const cy = (WALL_ROWS - 1) / 2 - (hit.y - WALL_Y) / PY;
    const c = Math.round(cx);
    const rw = Math.round(cy);
    if (c < 0 || c >= WALL_COLS || rw < 0 || rw >= WALL_ROWS) return -1;
    if (Math.abs(cx - c) > 0.46 || Math.abs(cy - rw) > 0.45) return -1;
    const i = rw * WALL_COLS + c;
    return rank[i] < count - 0.5 ? i : -1;
  };
  let mineOpen = false;
  let mineOpenT = -10;
  addEventListener('click', (e) => {
    if (!active) return;
    if ((e.target as HTMLElement).closest?.('a,button,input,label,[data-hit]')) return;
    const i = pickTile();
    if (i >= 0) {
      press = i;
      pressT = now;
    } else if (landed > 0.9 && overMine()) {
      mineOpen = !mineOpen;
      mineOpenT = now;
    }
  });
  const sv = new THREE.Vector3();
  const overMine = () => {
    const ray = ctx.ray().ray;
    panel.getWorldPosition(sv);
    return ray.distanceSqToPoint(sv) < 0.4 * 0.4;
  };

  /* ----- per-frame ----- */
  let landed = 0;
  let openAmt = 0;
  let landT = -1;
  const wp = new THREE.Vector3();
  const c1 = new THREE.Vector3();
  const mine = new THREE.Vector3();
  const ctrl = new THREE.Vector3();
  const act = new URLSearchParams(location.search).get('act') ?? '';
  if (ctx.shot && act.startsWith('app-')) app = Math.min(2, Math.max(0, Number(act.slice(4)) || 0));

  function update(f: Frame, near: number) {
    const { p, t, dt } = f;
    now = t;
    active = near > 0.5;
    if (!tu.uAtlas.value) tu.uAtlas.value = wallAtlas(ctx.tier === 0 ? 128 : 168);
    if (appShown !== app) loadApp(app);
    const narrow = ctx.size.narrow;

    const b = take.resolve(seg(p, 0.075, 0.275), p, t, dt, ctx.shot);
    const type = seg(b, 0.0, 0.15);
    const layout = seg(b, 0.15, 0.38);
    const fill = seg(b, 0.36, 0.6);
    const data = seg(b, 0.58, 0.8);
    const pack = seg(b, 0.79, 0.85);
    const fly = inOutCubic(seg(b, 0.84, 0.985));
    landed = seg(b, 0.975, 1);

    /* prompt */
    const ask = APPS[app].ask;
    const n = Math.round(type * ask.length);
    if (n !== typed && promptText) {
      typed = n;
      promptText.textContent = ask.slice(0, n);
    }
    flag(promptEl, 'typing', type > 0 && type < 1);
    flag(promptEl, 'sent', type >= 1);
    pin(ctx, promptEl, wp.set(X - 1.5, narrow ? 2.5 : 2.5, 0.9), near * smooth(seg(p, 0.045, 0.07)) * (1 - smooth(seg(b, 0.86, 0.95))), 0.9, narrow ? 150 : 0);

    /* steps */
    const stage = b < 0.15 ? -1 : b < 0.37 ? 0 : b < 0.59 ? 1 : b < 0.8 ? 2 : 3;
    steps.forEach((s, i) => {
      flag(s, 'on', i === stage && b < 0.995);
      flag(s, 'done', i < stage || b >= 0.995);
    });
    css(stepsEl, '--b', b);
    pin(ctx, stepsEl, wp.set(X + HOME.x, HOME.y - PH / 2 - 0.2, HOME.z + 0.1), near * smooth(seg(b, 0.1, 0.16)) * (1 - smooth(seg(b, 0.86, 0.93))), 0.6, narrow ? 150 : 0);

    /* panel */
    bu.uLayout.value = layout;
    bu.uFill.value = fill;
    bu.uData.value = data;
    bu.uMerge.value = smooth(seg(b, 0.78, 0.85));
    bu.uTime.value = t;
    plateU.uA.value = smooth(layout * 2);
    plateU.uScan.value = fill > 0 && fill < 1 ? fill : -1;
    plateU.uPack.value = pack > 0 && pack < 1 ? pack : 0;
    plateU.uTime.value = t;

    slot(MINE, mine);
    // a colleague opens the app once it has landed
    if (landed >= 1 && landT < 0) landT = t;
    if (landed < 1) {
      landT = -1;
      mineOpen = false;
    }
    let cyc = landT < 0 ? -1 : (t - landT) % 9;
    if (ctx.shot) cyc = act === 'open' ? 3 : landed >= 1 ? 0.6 : -1;
    const auto = cyc > 1.5 && cyc < 5.6 ? 1 : 0;
    const want = landed >= 1 ? Math.max(auto, mineOpen && t - mineOpenT < 6 ? 1 : 0) : 0;
    openAmt = ctx.shot ? want : openAmt + (want - openAmt) * damp(5, dt);
    const o = smooth(openAmt);

    ctrl.set(mix(HOME.x, mine.x, 0.4), 4.9, 0.4);
    const a1 = 1 - fly;
    panel.position.set(
      a1 * a1 * HOME.x + 2 * a1 * fly * ctrl.x + fly * fly * mine.x,
      a1 * a1 * HOME.y + 2 * a1 * fly * ctrl.y + fly * fly * mine.y,
      a1 * a1 * HOME.z + 2 * a1 * fly * ctrl.z + fly * fly * mine.z,
    );
    c1.set(narrow ? 0.9 : 1.0, 2.75, -1.2);
    panel.position.lerp(c1, o);
    const sc = mix(mix(1, TW / PW, fly), narrow ? 0.72 : 0.92, o);
    panel.scale.setScalar(sc);
    panel.rotation.y = mix(HOME_RY, 0, fly) + (ctx.still ? 0 : Math.sin(t * 0.5) * 0.012 * (1 - fly));
    panel.rotation.x = Math.sin(fly * Math.PI) * -0.5;
    panel.position.y += ctx.still ? 0 : Math.sin(t * 0.8) * 0.012 * (1 - fly);
    bu.uGain.value = mix(1, 0.75, fly) + o * 0.3;
    flashU.uA.value = landed > 0 && landed < 1 ? Math.sin(landed * Math.PI) : 0;

    /* services */
    const def = APPS[app];
    const used = [false, false, false];
    def.blocks.forEach((bl) => bl.data !== undefined && (used[bl.data] = true));
    fibres.forEach((fb, i) => {
      const draw = outCubic(seg(data, i * 0.12, 0.45 + i * 0.12)) * (1 - smooth(seg(b, 0.8, 0.86)));
      fb.mat.uniforms.uDraw.value = used[i] ? draw : 0;
      fb.mat.uniforms.uFlow.value = data > 0.4 ? 1 : 0;
      fb.mat.uniforms.uTime.value = t;
      fb.mat.uniforms.uDir.value = -1;
      const lit = used[i] ? smooth(seg(data, i * 0.12, 0.3 + i * 0.12)) : 0;
      drumRings[i].color.copy(LIME).multiplyScalar(0.06 + lit * 1.3 + lit * 0.3 * Math.sin(t * 5 + i));
      const tag = tags[i];
      flag(tag, 'on', lit > 0.5);
      const top = Math.round(drumH[i] / 0.25) * 0.25;
      pin(ctx, tag, wp.set(X + drumPos[i].x, top + 0.22, drumPos[i].z), near * smooth(seg(b, 0.3, 0.42)) * (1 - smooth(seg(b, 0.88, 0.96))), 0.4, narrow ? 70 : 0);
    });

    /* wall */
    const grow = smooth(seg(p, 0.1, 0.315));
    count = ctx.shot && p > 0.32 ? N : 9 + grow * grow * (N - 9);
    tu.uCount.value = count;
    tu.uTime.value = t;
    tu.uA.value = near;
    const hv = active && ctx.pointer.seen && !narrow ? pickTile() : -1;
    if (hv >= 0) hover = hv;
    hoverAmt += ((hv >= 0 ? 1 : 0) - hoverAmt) * damp(hv >= 0 ? 14 : 7, dt);
    tu.uHover.value = hover;
    tu.uHoverAmt.value = hoverAmt;
    const pressing = t - pressT < 2.6 ? 1 : 0;
    pressAmt += (pressing - pressAmt) * damp(pressing ? 9 : 6, dt);
    tu.uPress.value = press;
    tu.uPressAmt.value = pressAmt;
    const hot = active && (hv >= 0 || (landed > 0.9 && ctx.pointer.seen && overMine()));

    const shownIdx = pressAmt > 0.3 ? press : hover;
    if (tileEl && shownIdx >= 0) {
      const name = TILE_NAMES[shownIdx % TILE_NAMES.length];
      if (tileEl.dataset.n !== name) {
        tileEl.dataset.n = name;
        tileEl.textContent = name;
      }
      slot(shownIdx, wp);
      wp.x += X;
      wp.y += TH / 2 + 0.1 + pressAmt * 0.42;
      wp.z += pressAmt * 1.3;
    }
    pin(ctx, tileEl, wp, near * Math.max(hoverAmt, pressAmt), 0.2);

    const shown = count >= 80 ? '80+' : String(Math.floor(count));
    if (shown !== countShown && countNum) {
      countShown = shown;
      countNum.textContent = shown;
    }
    pin(ctx, countEl, wp.set(X + WALL_X + (narrow ? 0 : 2.1), WALL_Y + (WALL_ROWS / 2) * PY + 0.42, WALL_Z), near * smooth(narrow ? seg(p, 0.26, 0.29) : seg(p, 0.085, 0.12)), 0.15, narrow ? 120 : 130);

    /* the colleague's cursor */
    let curA = 0;
    if (cyc >= 0 && landed >= 1) {
      const inn = outCubic(clamp01(cyc / 1.3));
      const out = smooth(clamp01((cyc - 6.2) / 1.2));
      panel.getWorldPosition(wp);
      wp.x += mix(1.9, 0.22 * sc, inn) + out * 1.6;
      wp.y += mix(-1.3, -0.12 * sc, inn) - out * 0.9;
      wp.z += 0.1;
      curA = clamp01(cyc / 0.4) * (1 - out);
      flag(cursorEl, 'click', cyc > 1.3 && cyc < 1.75);
    }
    pin(ctx, cursorEl, wp, near * curA, 0);
    panel.getWorldPosition(wp);
    wp.y += (PH / 2) * sc + 0.14;
    pin(ctx, openEl, wp, near * o, 0.3, narrow ? 120 : 0);

    lamp.intensity = near * (2.5 + layout * 5 + fill * 9) * (1 - fly * 0.6);
    ringMat.color.copy(LIME).multiplyScalar(0.5 + layout * 1.2 + pack * 2 * (1 - fly));
    return { b, fly, landed, open: o, hot };
  }

  return { group, update, take };
}
