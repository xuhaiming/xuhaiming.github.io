import * as THREE from 'three';
import type { Ctx } from '../../world/types';
import { clamp01, css, damp, flag, mix, seg, show, smooth } from '../../world/util';
import { A, SAMPLES } from './data';
import { AMBER, FONT, TUNGSTEN, beam, canvasTex, cardMat, glow, pin, prop, rr, type Station, type StationFrame } from './shared';

/**
 * World 3, the labelling bench. Samples arrive on a belt from three inlets (client portal, Official
 * Account, Mini Program). One at a time is lifted under the gantry; the visitor drags a box around
 * the object (or taps to snap one) and names it; the card files itself into the dataset tray and the
 * management monitor counts. Left alone, the bench keeps labelling slowly on its own.
 */

const STATION_X = 0.9;
const WORK = new THREE.Vector3(STATION_X, 2.3, 0.6);
const BELT_Y = 0.95;
const SPACING = 1.12;
const SOURCES = ['Client portal', 'Official Account', 'Mini Program'];

type Role = 'belt' | 'lift' | 'work' | 'fly' | 'stack';
interface Card {
  mesh: THREE.Mesh;
  u: Record<string, THREE.IUniform>;
  tag: THREE.Mesh;
  tagTex: ReturnType<typeof canvasTex>;
  sample: number;
  role: Role;
  x: number;
  slot: number;
  /** time since the role began */
  age: number;
  tagK: number;
  op: number;
}

export function createBench(ctx: Ctx, el: HTMLElement): Station {
  const group = new THREE.Group();

  /* ---------- the belt ---------- */
  const dark = new THREE.MeshStandardMaterial({ color: '#15110d', roughness: 0.42, metalness: 0.75 });
  const BELT_L = 7.8;
  const BELT_CX = 2.5;
  const beltU = { uOff: { value: 0 }, uA: { value: 1 }, uCol: { value: AMBER.clone() } };
  const belt = new THREE.Mesh(
    new THREE.PlaneGeometry(BELT_L, 0.86),
    new THREE.ShaderMaterial({
      uniforms: beltU,
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */ `
        uniform float uOff, uA; uniform vec3 uCol; varying vec2 vUv; varying vec3 vW;
        void main() {
          float x = vUv.x * ${BELT_L.toFixed(2)} + uOff;
          float rib = smoothstep(0.42, 0.5, abs(fract(x * 7.0) - 0.5));
          float chev = smoothstep(0.46, 0.5, abs(fract(x * 0.9 + abs(vUv.y - 0.5) * 0.7) - 0.5));
          vec3 c = vec3(0.028, 0.024, 0.02) * (1.0 - rib * 0.55);
          c += uCol * chev * 0.05;
          // the gantry lamp pools on the belt at the station
          float pool = exp(-pow((vUv.x * ${BELT_L.toFixed(2)} - ${(STATION_X - (BELT_CX - BELT_L / 2)).toFixed(2)}) * 1.3, 2.0));
          c += vec3(1.0, 0.72, 0.4) * pool * 0.16 * (1.0 - rib * 0.4);
          float edge = smoothstep(0.5, 0.42, abs(vUv.y - 0.5));
          gl_FragColor = vec4(c * edge * uA, 1.0);
        }`,
    }),
  );
  belt.rotation.x = -Math.PI / 2;
  belt.position.set(BELT_CX, BELT_Y, 0);
  group.add(belt);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(BELT_L, 0.16, 1.02), dark);
  frame.position.set(BELT_CX, BELT_Y - 0.085, 0);
  group.add(frame);
  const railG = new THREE.BoxGeometry(BELT_L, 0.07, 0.05);
  const rails = new THREE.InstancedMesh(railG, new THREE.MeshStandardMaterial({ color: '#4a4034', roughness: 0.3, metalness: 1 }), 2);
  const m4 = new THREE.Matrix4();
  rails.setMatrixAt(0, m4.makeTranslation(BELT_CX, BELT_Y + 0.03, 0.5));
  rails.setMatrixAt(1, m4.makeTranslation(BELT_CX, BELT_Y + 0.03, -0.5));
  group.add(rails);
  const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, BELT_Y - 0.16, 0.07), dark, 10);
  for (let i = 0; i < 5; i++) {
    const x = BELT_CX - BELT_L / 2 + 0.3 + i * ((BELT_L - 0.6) / 4);
    legs.setMatrixAt(i * 2, m4.makeTranslation(x, (BELT_Y - 0.16) / 2, 0.44));
    legs.setMatrixAt(i * 2 + 1, m4.makeTranslation(x, (BELT_Y - 0.16) / 2, -0.44));
  }
  group.add(legs);
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.96, 20), new THREE.MeshStandardMaterial({ color: '#5a5045', roughness: 0.28, metalness: 1 }));
  roller.rotation.x = Math.PI / 2;
  roller.position.set(BELT_CX - BELT_L / 2, BELT_Y - 0.085, 0);
  group.add(roller);

  // gantry over the station: two posts, a lamp bar, a sheet of light
  const gantry = new THREE.Group();
  const postG = new THREE.BoxGeometry(0.07, 3.24, 0.07);
  const gp1 = new THREE.Mesh(postG, dark);
  gp1.position.set(STATION_X - 0.78, 1.62, -0.62);
  const gp2 = gp1.clone();
  gp2.position.x = STATION_X + 0.78;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.09, 0.14), dark);
  bar.position.set(STATION_X, 3.24, -0.62);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.025, 0.05), new THREE.MeshBasicMaterial({ color: TUNGSTEN.clone().multiplyScalar(3) }));
  strip.position.set(STATION_X, 3.185, -0.6);
  const cone = beam(TUNGSTEN, 2.3, 0.5, 0.95);
  cone.position.set(STATION_X, 3.19, -0.55);
  cone.scale.z = 0.35;
  gantry.add(gp1, gp2, bar, strip, cone);
  group.add(gantry);

  /* ---------- inlets: three chutes dropping points onto the belt ---------- */
  const INLET_X = [3.7, 4.25, 4.8];
  const inletG = new THREE.Group();
  const rings: THREE.Mesh[] = [];
  INLET_X.forEach((x) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 10, 36), new THREE.MeshBasicMaterial({ color: AMBER.clone() }));
    r.rotation.x = Math.PI / 2;
    r.position.set(x, 2.2, 0);
    rings.push(r);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.2, 6), dark);
    stem.position.set(x, 3.3, 0);
    inletG.add(r, stem);
  });
  group.add(inletG);
  const RN = [150, 260, 380][ctx.tier];
  const rs = new Float32Array(RN * 3);
  for (let i = 0; i < RN * 3; i++) rs[i] = Math.random();
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RN * 3), 3));
  rg.setAttribute('aSeed', new THREE.BufferAttribute(rs, 3));
  const ru = { uT: { value: 0 }, uA: { value: 1 }, uS: { value: 1 }, uX: { value: INLET_X }, uHot: { value: [0, 0, 0] }, uCol: { value: AMBER.clone() } };
  const rain = new THREE.Points(
    rg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: ru,
      vertexShader: /* glsl */ `
        uniform float uT, uA, uS; uniform float uX[3]; uniform float uHot[3]; attribute vec3 aSeed; varying float vB;
        void main() {
          int k = int(floor(aSeed.x * 2.999));
          float ph = fract(uT * (0.35 + aSeed.y * 0.3) + aSeed.z);
          float r = 0.17 * sqrt(aSeed.y) * (1.0 - ph * 0.3);
          float an = aSeed.z * 6.2831 + uT * 0.6;
          vec3 p = vec3(uX[k] + cos(an) * r, mix(2.2, ${(BELT_Y + 0.03).toFixed(2)}, ph * ph), sin(an) * r);
          vB = uA * (0.25 + uHot[k] * 1.1) * (1.0 - ph * 0.55);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * (0.7 + aSeed.x) * 7.0 / -mv.z;
        }`,
      fragmentShader: 'uniform vec3 uCol; varying float vB; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vB; gl_FragColor = vec4(uCol * a, 1.0); }',
    }),
  );
  rain.frustumCulled = false;
  group.add(rain);
  const inletHot = [0, 0, 0];

  /* ---------- dataset tray ---------- */
  const TRAY = new THREE.Vector3(-0.5, 0, 0.6);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.8), new THREE.MeshStandardMaterial({ color: '#2a2019', roughness: 0.6, metalness: 0.05 }));
  stand.position.set(TRAY.x, 0.755, TRAY.z - 0.1);
  group.add(stand);
  const tlegs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.018, 0.74, 8), dark, 4);
  [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.24], [0.44, 0.24]].forEach(([x, z], i) => tlegs.setMatrixAt(i, m4.makeTranslation(TRAY.x + x, 0.37, TRAY.z + z)));
  group.add(tlegs);
  prop(ctx, A + 'prop-tray.glb', { height: 0.36, env: 0.35, rough: 0.7 }).then((o) => {
    if (!o) return;
    o.position.set(TRAY.x, 0.78, TRAY.z - 0.1);
    o.scale.multiplyScalar(1.05);
    group.add(o);
  });
  prop(ctx, A + 'prop-conveyor.glb', { height: 0.95, env: 0.45, rough: 0.6 }).then((o) => {
    if (!o) return;
    o.position.set(5.3, 0, -2.3);
    o.rotation.y = -0.3;
    group.add(o);
  });

  /* ---------- the monitor ---------- */
  const mon = canvasTex(768, 480);
  const monG = new THREE.Group();
  const monScr = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: mon.tex }));
  monScr.position.z = 0.03;
  const monBack = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 0.05), dark);
  const monArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 10), dark);
  monArm.position.set(0, -1.55, -0.05);
  const monBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.05, 24), dark);
  monBase.position.set(0, -2.6, -0.05);
  monG.add(monBack, monScr, monArm, monBase);
  monG.position.set(2.95, 2.7, -1.0);
  monG.scale.setScalar(1.2);
  monG.rotation.y = -0.3;
  group.add(monG);

  /* ---------- stats ---------- */
  const stats = { uploaded: 0, labelled: 0, by: new Map<string, number>(), src: [0, 0, 0], hand: 0, handSum: 0, last: '' };
  let monDirty = true;
  function drawMonitor() {
    const g = mon.g;
    g.fillStyle = '#100c08';
    g.fillRect(0, 0, 768, 480);
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = '#8d7a5e';
    g.font = FONT(22, 650);
    g.fillText('Labelled', 40, 58);
    g.fillText('Uploaded', 300, 58);
    g.fillText('Box overlap, by hand', 500, 58);
    g.fillStyle = '#ffa62b';
    g.font = FONT(104, 780, 'extra-condensed');
    g.fillText(String(stats.labelled), 36, 156);
    g.fillStyle = '#f1e9da';
    g.fillText(String(stats.uploaded), 296, 156);
    g.fillText(stats.hand ? `${Math.round((stats.handSum / stats.hand) * 100)}%` : '–', 496, 156);
    // progress
    const pr = stats.uploaded ? stats.labelled / stats.uploaded : 0;
    g.fillStyle = '#2a2118';
    rr(g, 40, 186, 688, 12, 6);
    g.fill();
    g.fillStyle = '#ffa62b';
    rr(g, 40, 186, Math.max(12, 688 * pr), 12, 6);
    g.fill();
    // classes
    g.font = FONT(22, 650);
    g.fillStyle = '#8d7a5e';
    g.fillText('By label', 40, 250);
    g.fillText('By source', 440, 250);
    const top = [...stats.by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const mx = Math.max(1, ...top.map((e) => e[1]));
    top.forEach(([name, n], i) => {
      const y = 286 + i * 36;
      g.fillStyle = '#f1e9da';
      g.font = FONT(22, 600);
      g.fillText(name, 40, y + 8);
      g.fillStyle = name === stats.last ? '#ffa62b' : '#6b5a40';
      rr(g, 160, y - 8, 200 * (n / mx), 16, 8);
      g.fill();
      g.fillStyle = '#b9a98f';
      g.fillText(String(n), 170 + 200 * (n / mx), y + 8);
    });
    if (!top.length) {
      g.fillStyle = '#5c5042';
      g.font = FONT(22, 500);
      g.fillText('Nothing labelled yet', 40, 294);
    }
    SOURCES.forEach((s, i) => {
      const y = 286 + i * 36;
      g.fillStyle = '#f1e9da';
      g.font = FONT(22, 600);
      g.fillText(s, 440, y + 8);
      g.textAlign = 'right';
      g.fillStyle = '#ffa62b';
      g.fillText(String(stats.src[i]), 728, y + 8);
      g.textAlign = 'left';
    });
    mon.tex.needsUpdate = true;
  }

  /* ---------- cards ---------- */
  const NCARD = 14;
  const geo = new THREE.PlaneGeometry(1, 1);
  let nextSample = 0;
  const cards: Card[] = [];
  for (let i = 0; i < NCARD; i++) {
    const mat = cardMat(null);
    mat.uniforms.uDim.value = 0.45;
    mat.uniforms.uGain.value = 0.86;
    const mesh = new THREE.Mesh(geo, mat);
    const tagTex = canvasTex(256, 64);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: tagTex.tex, transparent: true, depthWrite: false }));
    tag.position.set(-0.3, 0.565, 0.004);
    tag.visible = false;
    mesh.add(tag);
    mesh.visible = false;
    group.add(mesh);
    cards.push({ mesh, u: mat.uniforms, tag, tagTex, sample: 0, role: 'belt', x: 99, slot: 0, age: 0, tagK: 0, op: 1 });
  }
  const texCache = new Map<number, THREE.Texture>();
  const blank = new THREE.DataTexture(new Uint8Array([30, 25, 20, 255]), 1, 1);
  blank.needsUpdate = true;
  function setSample(c: Card, s: number) {
    c.sample = s;
    c.u.tMap.value = texCache.get(s) ?? blank;
    if (!texCache.has(s))
      ctx.tex(`${A}sample-${SAMPLES[s].id}.webp`).then((t) => {
        texCache.set(s, t);
        if (c.sample === s) c.u.tMap.value = t;
      }).catch(() => {});
    const b = SAMPLES[s].box;
    (c.u.uBox.value as THREE.Vector4).set(b[0], b[1], b[2], b[3]);
    c.u.uBoxA.value = 0;
    c.u.uBoxK.value = 1;
    c.tag.visible = false;
    c.tagK = 0;
  }
  function drawTag(c: Card, text: string) {
    const g = c.tagTex.g;
    g.clearRect(0, 0, 256, 64);
    g.font = FONT(38, 760, 'condensed');
    const w = Math.min(244, g.measureText(text).width + 44);
    g.fillStyle = '#ffa62b';
    rr(g, 2, 6, w, 52, 12);
    g.fill();
    g.fillStyle = '#231300';
    g.textBaseline = 'middle';
    g.fillText(text, 22, 34);
    c.tagTex.tex.needsUpdate = true;
  }
  let spawned = 0;
  function spawn(c: Card, x: number, count = true) {
    setSample(c, nextSample);
    nextSample = (nextSample + 1) % SAMPLES.length;
    c.role = 'belt';
    c.x = x;
    c.age = 0;
    if (count) {
      const src = spawned % 3;
      stats.src[src]++;
      stats.uploaded++;
      inletHot[src] = 1;
      monDirty = true;
    }
    spawned++;
  }
  // six on the belt to begin with
  for (let i = 0; i < 6; i++) spawn(cards[i], STATION_X + 0.6 + i * SPACING);
  for (let i = 6; i < NCARD; i++) cards[i].role = 'stack', (cards[i].slot = -1);

  /* ---------- the bench's state machine ---------- */
  let active: Card | null = null;
  /** 0 nothing, 1 box being drawn, 2 boxed (waiting for a name) */
  let boxed = 0;
  let boxFrom = new THREE.Vector4();
  let boxTo = new THREE.Vector4();
  let boxAnim = 1;
  let handIoU = -1;
  let idle = 0;
  let touched = false;
  let options: string[] = [];
  let wrong = [false, false, false];
  let hintText = '';
  let live = false;
  let coarse = matchMedia('(pointer: coarse)').matches;

  const chipsWrap = el.querySelector<HTMLElement>('.s-chips')!;
  const chips = Array.from(chipsWrap.querySelectorAll<HTMLButtonElement>('button'));
  const hint = el.querySelector<HTMLElement>('.s-hint')!;
  const copy = el.querySelector<HTMLElement>('.s-bench');
  const uiWrap = el.querySelector<HTMLElement>('.s-bench-ui');
  const tagIn = Array.from(el.querySelectorAll<HTMLElement>('.s-tag-in'));
  const tagSet = el.querySelector<HTMLElement>('.s-tag-set');
  const tagMon = el.querySelector<HTMLElement>('.s-tag-mon');

  function setHint(s: string) {
    if (s === hintText) return;
    hintText = s;
    hint.textContent = s;
  }
  function makeOptions(s: number) {
    const all = SAMPLES.map((x) => x.label);
    const right = SAMPLES[s].label;
    const others = [all[(s + 3) % all.length], all[(s + 7) % all.length]];
    const pos = s % 3;
    options = [...others];
    options.splice(pos, 0, right);
    wrong = [false, false, false];
    chips.forEach((b, i) => {
      b.textContent = options[i];
      b.classList.remove('no');
      b.disabled = false;
    });
  }
  chips.forEach((b, i) =>
    b.addEventListener('click', () => {
      if (!active || active.role !== 'work' || boxed !== 2) return;
      idle = 0;
      touched = true;
      if (options[i] === SAMPLES[active.sample].label) file(active);
      else {
        wrong[i] = true;
        b.classList.add('no');
        b.disabled = true;
      }
    }),
  );

  function iou(a: THREE.Vector4, b: [number, number, number, number]) {
    const ix = Math.max(0, Math.min(a.z, b[2]) - Math.max(a.x, b[0]));
    const iy = Math.max(0, Math.min(a.w, b[3]) - Math.max(a.y, b[1]));
    const inter = ix * iy;
    const un = (a.z - a.x) * (a.w - a.y) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
    return un > 0 ? inter / un : 0;
  }
  function snap(c: Card, from?: THREE.Vector4) {
    const b = SAMPLES[c.sample].box;
    boxTo.set(b[0], b[1], b[2], b[3]);
    if (from) {
      boxFrom.copy(from);
      c.u.uBoxK.value = 1;
    } else {
      boxFrom.copy(boxTo);
      c.u.uBoxK.value = 0;
    }
    boxAnim = 0;
    boxed = 1;
    c.u.uBoxA.value = 1;
  }
  function file(c: Card) {
    const label = SAMPLES[c.sample].label;
    drawTag(c, label);
    c.tag.visible = true;
    c.role = 'fly';
    c.age = 0;
    stats.labelled++;
    stats.by.set(label, (stats.by.get(label) ?? 0) + 1);
    stats.last = label;
    if (handIoU >= 0) {
      stats.hand++;
      stats.handSum += handIoU;
    }
    monDirty = true;
    // everything already in the tray moves one place back; the oldest goes round again
    for (const o of cards) if (o.role === 'stack' && o.slot >= 0) o.slot++;
    c.slot = 0;
    boxed = 0;
    active = null;
  }

  /* ---------- pointer: drag a box on the lifted card ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitUv = new THREE.Vector2();
  function cardUv(cx: number, cy: number, clampIt = false) {
    if (!active || active.role !== 'work') return false;
    ndc.set((cx / ctx.size.w) * 2 - 1, -((cy / ctx.size.h) * 2 - 1));
    ray.setFromCamera(ndc, ctx.camera);
    const h = ray.intersectObject(active.mesh, false)[0];
    if (h?.uv) {
      hitUv.set(h.uv.x, 1 - h.uv.y);
      return true;
    }
    if (clampIt) {
      // off the card while dragging: project onto the card's plane and clamp
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(active.mesh.quaternion);
      const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, active.mesh.position.clone().applyMatrix4(group.matrixWorld));
      const p = new THREE.Vector3();
      if (ray.ray.intersectPlane(pl, p)) {
        active.mesh.worldToLocal(p);
        hitUv.set(clamp01(p.x + 0.5), clamp01(0.5 - p.y));
        return true;
      }
    }
    return false;
  }
  let drag: { x: number; y: number; u: number; v: number; moved: boolean; mouse: boolean } | null = null;
  let hover = false;
  addEventListener('pointerdown', (e) => {
    coarse = e.pointerType !== 'mouse';
    if (!live || (e.target as HTMLElement).closest?.('button, a, [data-hit]')) return;
    if (!cardUv(e.clientX, e.clientY)) return;
    drag = { x: e.clientX, y: e.clientY, u: hitUv.x, v: hitUv.y, moved: false, mouse: e.pointerType === 'mouse' };
    idle = 0;
    touched = true;
  });
  addEventListener('pointermove', (e) => {
    if (!live) return;
    if (drag && drag.mouse && active) {
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
      if (drag.moved && cardUv(e.clientX, e.clientY, true)) {
        const b = active.u.uBox.value as THREE.Vector4;
        b.set(Math.min(drag.u, hitUv.x), Math.min(drag.v, hitUv.y), Math.max(drag.u, hitUv.x), Math.max(drag.v, hitUv.y));
        active.u.uBoxA.value = 1;
        active.u.uBoxK.value = 1;
        boxed = 1;
        boxAnim = 1;
        idle = 0;
      }
    } else if (e.pointerType === 'mouse') {
      hover = cardUv(e.clientX, e.clientY);
      if (hover) idle = Math.min(idle, 1.2);
    }
  });
  addEventListener('pointercancel', () => (drag = null));
  addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!live || !active || active.role !== 'work') return;
    idle = 0;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 12 && boxed === 0) {
        handIoU = -1;
        snap(active);
      }
      return;
    }
    const b = (active.u.uBox.value as THREE.Vector4).clone();
    const q = iou(b, SAMPLES[active.sample].box);
    if (b.z - b.x < 0.04 || b.w - b.y < 0.04) {
      active.u.uBoxA.value = 0;
      boxed = 0;
      return;
    }
    handIoU = q;
    if (q >= 0.6) {
      boxed = 2;
      setHint(`Good box, ${Math.round(q * 100)}% overlap. Now name it.`);
    } else {
      snap(active, b);
      setHint(`${Math.round(q * 100)}% overlap, tightened for you. Now name it.`);
    }
  });

  const beltPose = (x: number, p: THREE.Vector3) => p.set(x, BELT_Y + 0.21, 0.02);
  const stackPose = (slot: number, p: THREE.Vector3) => p.set(TRAY.x + slot * 0.012, 1.22 + slot * 0.062, TRAY.z + 0.16 - slot * 0.1);
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const v0 = new THREE.Vector3();
  let beltOff = 0;
  let presetDone = false;
  let preset = 0;
  let presetBox = false;

  function update(u: StationFrame) {
    const { k, local, f } = u;
    const dt = f.dt;
    const t = f.t;
    group.visible = k > 0.002;
    // the copy and the bench UI are gone before the camera swings toward the rift (p 0.90 on), so the
    // lifted card and its hint never slide across the copy column
    const uiA = k > 0 ? smooth(seg(local, 0.05, 0.14)) * (1 - smooth(seg(local, 0.79, 0.86))) : 0;
    show(copy, uiA);
    show(uiWrap, uiA);
    live = u.live && uiA > 0.5;
    if (!group.visible) {
      if (document.body.style.cursor === 'crosshair') document.body.style.cursor = '';
      return;
    }

    // capture presets: N cards already filed, optionally a box on the current one
    if (!presetDone && (preset > 0 || presetBox)) {
      presetDone = true;
      for (let n = 0; n < preset; n++) {
        const lead = cards.filter((c) => c.role === 'belt').sort((a, b) => a.x - b.x)[0];
        if (!lead) break;
        active = lead;
        handIoU = n % 2 ? 0.8 + (n % 3) * 0.05 : -1;
        const shift = lead.x - STATION_X;
        for (const c of cards) if (c.role === 'belt') c.x -= shift;
        file(lead);
        lead.role = 'stack';
        lead.u.uBoxA.value = 1;
        lead.tagK = 1;
        recycle();
      }
    }

    /* belt and cards */
    let lead: Card | null = active;
    if (!lead) for (const c of cards) if (c.role === 'belt' && (!lead || c.x < lead.x)) lead = c;
    const moving = !active && lead && lead.x > STATION_X;
    if (moving) {
      const step = Math.min(lead!.x - STATION_X, dt * (ctx.shot ? 50 : 1.15));
      beltOff += step;
      for (const c of cards) if (c.role === 'belt') c.x -= step;
    } else if (!active && lead) {
      active = lead;
      lead.role = 'lift';
      lead.age = 0;
      boxed = 0;
      handIoU = -1;
      idle = 0;
      touched = false;
      makeOptions(lead.sample);
      setHint(coarse ? 'Tap the picture to box the object' : 'Drag a box around the object, or click to snap one');
      if (ctx.shot) lead.age = 9;
    }
    beltU.uOff.value = beltOff;
    beltU.uA.value = k;

    // the bench labels on its own when left alone
    if (active && active.role === 'work' && !ctx.shot && !drag) {
      idle += dt;
      if (boxed === 0 && idle > (touched ? 10 : 3.2)) {
        handIoU = -1;
        snap(active);
        idle = 0;
      } else if (boxed === 2 && idle > (touched || hover ? 12 : 2.8)) file(active);
    }
    if (active && active.role === 'work' && presetBox && boxed === 0) {
      snap(active);
      boxAnim = 1;
      active.u.uBoxK.value = 1;
    }

    // box animation: either drawing itself from the corner, or easing from the hand-drawn box
    if (active && boxed === 1 && boxAnim < 1 && !drag) {
      boxAnim = Math.min(1, boxAnim + dt / 0.55);
      const e = smooth(boxAnim);
      const b = active.u.uBox.value as THREE.Vector4;
      b.lerpVectors(boxFrom, boxTo, e);
      if (boxFrom.equals(boxTo)) active.u.uBoxK.value = e;
      if (boxAnim >= 1) {
        active.u.uBoxK.value = 1;
        boxed = 2;
        if (handIoU < 0) setHint('Snapped to the object. Now name it.');
      }
    } else if (active && boxed === 1 && boxAnim >= 1 && !drag) boxed = 2;

    for (const c of cards) {
      c.age += dt;
      const m = c.mesh;
      c.u.uT.value = t;
      if (c.role === 'belt') {
        beltPose(c.x, m.position);
        m.rotation.set(-0.98, 0, 0);
        m.scale.setScalar(0.54);
        // materialise under the inlets
        const born = smooth(seg(c.x, 5.0, 4.2));
        c.u.uA.value = born * k;
        c.u.uEdge.value = 0.35;
        m.visible = born > 0.002;
      } else if (c.role === 'lift' || c.role === 'work') {
        const e = smooth(clamp01(c.age / 0.6));
        beltPose(STATION_X, pa);
        m.position.lerpVectors(pa, WORK, e);
        m.position.y += Math.sin(t * 1.1) * 0.012 * e;
        m.rotation.set(mix(-0.98, -0.04, e), Math.sin(t * 0.7) * 0.02 * e, 0);
        m.scale.setScalar(mix(0.54, 1.12, e));
        c.u.uA.value = k;
        c.u.uEdge.value = 0.35 + 0.5 * e + (hover && live ? 0.6 : 0);
        m.visible = true;
        if (c.role === 'lift' && c.age >= 0.6) c.role = 'work';
      } else if (c.role === 'fly') {
        const e = smooth(clamp01(c.age / (ctx.shot ? 0.001 : 0.8)));
        stackPose(0, pb);
        m.position.lerpVectors(WORK, pb, e);
        m.position.y += Math.sin(e * Math.PI) * 0.55;
        m.rotation.set(mix(-0.04, -0.22, e), Math.sin(e * Math.PI) * -0.5, Math.sin(e * Math.PI) * 0.12);
        m.scale.setScalar(mix(1.12, 0.66, e));
        c.u.uA.value = k;
        if (e >= 1) {
          c.op = 1;
          c.role = 'stack';
          c.age = 0;
          recycle();
        }
      } else if (c.slot >= 0) {
        stackPose(c.slot, pb);
        m.position.lerp(pb, damp(8, dt));
        m.rotation.set(-0.22, 0, 0);
        m.scale.setScalar(0.66);
        c.op += ((c.slot >= 6 ? 0 : 1) - c.op) * damp(6, dt);
        c.u.uA.value = k * c.op * (1 - c.slot * 0.07);
        c.u.uEdge.value = 0.3;
        c.u.uBoxA.value = 0.55;
        m.visible = c.op > 0.01;
      } else m.visible = false;
      // the label tab pops in once the card has a name
      if (c.tag.visible) {
        c.tagK += (1 - c.tagK) * damp(10, dt);
        c.tag.scale.setScalar(c.tagK);
        (c.tag.material as THREE.MeshBasicMaterial).opacity = c.u.uA.value;
      }
      m.renderOrder = c.role === 'stack' ? 10 - c.slot : 20;
    }

    /* ambience */
    for (let i = 0; i < 3; i++) {
      inletHot[i] = Math.max(0, inletHot[i] - dt * 0.8);
      ru.uHot.value[i] = inletHot[i];
      (rings[i].material as THREE.MeshBasicMaterial).color.copy(AMBER).multiplyScalar((0.5 + inletHot[i] * 2.4) * k);
    }
    ru.uT.value = t;
    ru.uA.value = k;
    ru.uS.value = ctx.size.dpr * (ctx.size.h / 900);
    (cone.material as THREE.ShaderMaterial).uniforms.uA.value = 0.3 * k;
    (cone.material as THREE.ShaderMaterial).uniforms.uT.value = t;
    (strip.material as THREE.MeshBasicMaterial).color.copy(TUNGSTEN).multiplyScalar(3 * k);
    (monScr.material as THREE.MeshBasicMaterial).color.setScalar(1.5 * k);
    if (monDirty) {
      monDirty = false;
      drawMonitor();
    }

    /* DOM */
    const working = !!active && active.role === 'work';
    const chipA = working && boxed === 2 ? 1 : 0;
    flag(chipsWrap, 'on', chipA > 0 && live);
    flag(hint, 'on', working);
    group.localToWorld(v0.copy(WORK).setY(WORK.y - 0.6));
    pin(ctx, hint, v0);
    pin(ctx, chipsWrap, v0, 0, 30);
    tagIn.forEach((el2, i) => {
      pin(ctx, el2, group.localToWorld(v0.set(INLET_X[i], 2.42 + i * 0.27, 0)));
      flag(el2, 'hot', inletHot[i] > 0.3);
    });
    pin(ctx, tagSet, group.localToWorld(v0.set(TRAY.x - 0.2, 0.66, TRAY.z + 0.35)));
    pin(ctx, tagMon, group.localToWorld(v0.set(monG.position.x, monG.position.y + 0.72, monG.position.z)));
    if (live && ctx.tier > 0) {
      const want = working && (hover || !!drag) ? 'crosshair' : '';
      if (document.body.style.cursor !== want && (want || document.body.style.cursor === 'crosshair')) document.body.style.cursor = want;
    }
  }

  function recycle() {
    // free cards (never used, or pushed out of the tray) rejoin the belt at the inlets
    const belt2 = cards.filter((c) => c.role === 'belt');
    let far = belt2.reduce((mx2, c) => Math.max(mx2, c.x), STATION_X);
    for (const c of cards) {
      if (c.role !== 'stack') continue;
      if (c.slot >= 0 && c.slot < 7) continue;
      if (belt2.length >= 6) break;
      far = Math.max(far + SPACING, 6.2);
      spawn(c, far);
      c.slot = -1;
      belt2.push(c);
    }
  }

  document.fonts?.ready.then(() => (monDirty = true));

  return {
    group,
    update,
    sleep() {
      live = false;
      drag = null;
      hover = false;
      chipsWrap.classList.remove('on');
      if (document.body.style.cursor === 'crosshair') document.body.style.cursor = '';
    },
    act(name, arg) {
      if (name === 'label') preset = Number(arg) || 0;
      if (name === 'box') presetBox = true;
      // capture self-test: a real mouse drag across the lifted card (simdrag-good | simdrag-loose)
      if (name === 'simdrag')
        setTimeout(() => {
          if (!active) return;
          const b = SAMPLES[active.sample].box;
          const pad = arg === 'loose' ? 0.16 : 0.02;
          const at = (u: number, v: number) => {
            const w = active!.mesh.localToWorld(new THREE.Vector3(u - 0.5, 0.5 - v, 0));
            const o = ctx.project(w);
            return { clientX: o.x, clientY: o.y, pointerType: 'mouse', bubbles: true };
          };
          const p0 = at(Math.max(0.01, b[0] - pad), Math.max(0.01, b[1] - pad));
          const p1 = at(Math.min(0.99, b[2] + pad), Math.min(0.99, b[3] + pad));
          dispatchEvent(new PointerEvent('pointerdown', p0));
          dispatchEvent(new PointerEvent('pointermove', { ...p1, clientX: (p0.clientX + p1.clientX) / 2, clientY: (p0.clientY + p1.clientY) / 2 }));
          dispatchEvent(new PointerEvent('pointermove', p1));
          dispatchEvent(new PointerEvent('pointerup', p1));
        }, 450);
    },
  };
}
