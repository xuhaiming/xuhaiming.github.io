import * as THREE from 'three';
import type { Ctx } from '../../world/types';
import { clamp01, css, damp, flag, mix, seg, show, smooth } from '../../world/util';
import { A, PRODUCTS, STAGES, STAGE_OF } from './data';
import { AMBER, TUNGSTEN, beam, cardMat, glow, pin, prop, rng, type Station, type StationFrame } from './shared';

/**
 * World 1, the photo studio. One bare seller photo stands on a paper sweep under a tungsten lamp.
 * Four agents work on it in turn (vision, web search, vector search, image pipeline) and the product
 * sheet beside it fills in. The visitor picks the photo; scroll, or the pick itself, runs the pipeline.
 */

const PHOTO = 1.06;
const PHOTO_POS = new THREE.Vector3(0.1, 1.52, 0.05);
const CLOUD_C = new THREE.Vector3(-0.08, 2.72, -0.9);
const WEB_C = new THREE.Vector3(3.4, 4.9, -2.5);

export function createStudio(ctx: Ctx, el: HTMLElement, toP: (local: number) => number): Station {
  const group = new THREE.Group();
  const narrow = () => ctx.size.narrow;

  /* ---------- the set: table, paper sweep, lamp, camera ---------- */
  const wood = new THREE.MeshStandardMaterial({ color: '#2a2019', roughness: 0.62, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ color: '#16130f', roughness: 0.38, metalness: 0.85 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.07, 1.3), wood);
  top.position.set(0.1, 0.86, -0.1);
  group.add(top);
  const legG = new THREE.CylinderGeometry(0.028, 0.022, 0.86, 10);
  const legs = new THREE.InstancedMesh(legG, steel, 4);
  const m4 = new THREE.Matrix4();
  [[-1.05, -0.62], [1.25, -0.62], [-1.05, 0.42], [1.25, 0.42]].forEach(([x, z], i) => legs.setMatrixAt(i, m4.makeTranslation(x, 0.43, z)));
  group.add(legs);

  // paper sweep: flat on the table, then curving up behind the photo
  const sg = new THREE.PlaneGeometry(2.2, 2.5, 1, 40);
  {
    const pos = sg.attributes.position;
    const R = 0.42;
    const flat = 1.02;
    for (let i = 0; i < pos.count; i++) {
      const s = (0.5 - pos.getY(i) / 2.5) * 2.5; // 0 front edge .. 2.5 top
      let y = 0;
      let z = 0;
      if (s < flat) z = -s;
      else if (s < flat + (R * Math.PI) / 2) {
        const a = (s - flat) / R;
        z = -flat - Math.sin(a) * R;
        y = R - Math.cos(a) * R;
      } else {
        z = -flat - R;
        y = R + (s - flat - (R * Math.PI) / 2);
      }
      pos.setXYZ(i, pos.getX(i), y, z);
    }
    sg.computeVertexNormals();
  }
  const sweep = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#6f675a', roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
  sweep.position.set(0.1, 0.9, 0.52);
  group.add(sweep);

  // the lamp's light: a real spot for the set and a visible cone in the haze
  const LAMP_HEAD = new THREE.Vector3(-1.62, 1.86, -1.4);
  const cone = beam(TUNGSTEN, 2.7, 0.16, 1.1);
  cone.position.copy(LAMP_HEAD);
  cone.lookAt(PHOTO_POS.x + 0.3, 1.25, -0.5);
  cone.rotateX(-Math.PI / 2);
  group.add(cone);
  const lens = glow(TUNGSTEN, 0.6, 1.3);
  lens.position.copy(LAMP_HEAD);
  group.add(lens);
  prop(ctx, A + 'prop-lamp.glb', { height: 2.9, env: 1.2 }).then((o) => {
    if (!o) return;
    o.position.set(-1.9, 0, -1.6);
    o.rotation.y = 4.04;
    group.add(o);
  });
  prop(ctx, A + 'prop-camera.glb', { height: 1.2, env: 0.9 }).then((o) => {
    if (!o) return;
    o.position.set(0.72, 0, 3.2);
    o.rotation.y = -3.0;
    group.add(o);
  });

  /* ---------- the photo ---------- */
  const blank = new THREE.DataTexture(new Uint8Array([40, 34, 28, 255]), 1, 1);
  blank.needsUpdate = true;
  const pu = {
    tA: { value: blank as THREE.Texture },
    tB: { value: blank as THREE.Texture },
    uScan: { value: -1 },
    uBox: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
    uBoxA: { value: [0, 0, 0, 0] },
    uHot: { value: -1 },
    uCut: { value: 0 },
    uT: { value: 0 },
    uA: { value: 1 },
    uCol: { value: AMBER.clone() },
  };
  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(PHOTO, PHOTO),
    new THREE.ShaderMaterial({
      uniforms: pu,
      side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tA, tB; uniform float uScan, uHot, uCut, uT, uA; uniform vec4 uBox[4]; uniform float uBoxA[4]; uniform vec3 uCol;
        varying vec2 vUv;
        float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
        void main() {
          vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
          vec2 q = vec2(uv.x, 1.0 - uv.y);
          vec3 raw = texture2D(tA, uv).rgb;
          vec4 cut = texture2D(tB, uv);
          // stage 4: the background is replaced by a clean sweep, cell by cell, left to right
          vec3 paper = mix(vec3(0.60, 0.565, 0.52), vec3(0.80, 0.77, 0.725), smoothstep(0.05, 0.75, uv.y));
          float sh = texture2D(tB, uv + vec2(-0.012, 0.03)).a;
          paper *= 1.0 - 0.22 * sh * smoothstep(0.5, 0.0, uv.y);
          vec3 clean = mix(paper, cut.rgb, cut.a);
          vec2 cell = floor(q * 54.0);
          float r = hash(cell);
          float front = uCut * 1.55 - q.x * 0.45 - r * 0.1;
          float w = smoothstep(0.0, 0.06, front);
          float lead = smoothstep(0.0, 0.03, front) * (1.0 - smoothstep(0.03, 0.14, front));
          float cd = length(fract(q * 54.0) - 0.5);
          vec3 col = mix(raw, clean, w);
          col += uCol * lead * (1.0 - cut.a) * smoothstep(0.5, 0.2, cd) * 1.4;
          // stage 1: the scan line reads the picture top to bottom
          if (uScan > -0.5 && uScan < 1.02) {
            float d = q.y - uScan;
            col += uCol * (exp(-abs(d) * 160.0) * 1.6 + smoothstep(-0.16, 0.0, d) * step(d, 0.0) * 0.16);
          }
          // regions vision has read
          float px = fwidth(q.x);
          for (int i = 0; i < 4; i++) {
            float a = uBoxA[i];
            if (a < 0.002) continue;
            vec2 c = (uBox[i].xy + uBox[i].zw) * 0.5;
            vec2 h = (uBox[i].zw - uBox[i].xy) * 0.5 * (1.0 + (1.0 - a) * 0.12);
            vec2 dd = abs(q - c) - h;
            float bd = max(dd.x, dd.y);
            float hot = 1.0 - step(0.5, abs(uHot - float(i)));
            float line = 1.0 - smoothstep(px * 1.2, px * 2.4, abs(bd));
            vec2 ad = abs(q - c);
            float arm = min(h.x, h.y) * 0.34;
            float corners = step(h.x - arm, ad.x) * step(h.y - arm, ad.y);
            float thick = 1.0 - smoothstep(px * 2.6, px * 3.8, abs(bd));
            float inside = 1.0 - smoothstep(0.0, px, bd);
            col += uCol * inside * (0.035 + hot * 0.16) * a;
            col = mix(col, uCol * (1.5 + hot), max(line * (0.3 + hot * 0.6), thick * corners) * a);
          }
          // the lamp falls off across the print
          col *= mix(0.74, 1.06, smoothstep(1.25, 0.1, length(uv - vec2(0.15, 0.95))));
          gl_FragColor = vec4(col * uA, 1.0);
        }`,
    }),
  );
  const easel = new THREE.Group();
  easel.position.copy(PHOTO_POS);
  easel.rotation.x = -0.09;
  const back = new THREE.Mesh(new THREE.BoxGeometry(PHOTO + 0.07, PHOTO + 0.07, 0.03), new THREE.MeshStandardMaterial({ color: '#0f0c09', roughness: 0.5, metalness: 0.4 }));
  back.position.z = -0.018;
  const flip = new THREE.Group();
  flip.add(photo, back);
  easel.add(flip);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.22), steel);
  foot.position.set(0, -PHOTO / 2 - 0.06, -0.06);
  easel.add(foot);
  group.add(easel);

  /* ---------- stage 4: variants fan out from behind the print ---------- */
  const variants = [0, 1].map((i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), cardMat(null));
    (m.material as THREE.ShaderMaterial).uniforms.uGain.value = 0.62;
    m.userData.to = new THREE.Vector3(i ? -0.78 : -0.64, i ? -0.06 : 0.5, i ? -0.2 : -0.36);
    m.userData.rz = i ? -0.11 : 0.09;
    easel.add(m);
    return m;
  });

  /* ---------- stage 3: the embedding cloud ---------- */
  const N = [420, 760, 1100][ctx.tier];
  const CL = 5;
  const rnd = rng(77);
  const centres: THREE.Vector3[] = [];
  for (let c = 0; c < CL; c++) centres.push(new THREE.Vector3((c - 2) * 0.4 + (rnd() - 0.5) * 0.16, (rnd() - 0.5) * 0.42, (rnd() - 0.5) * 0.7));
  const cp = new Float32Array(N * 3);
  const cc = new Float32Array(N);
  const cs = new Float32Array(N);
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 0.9;
  for (let i = 0; i < N; i++) {
    const loose = rnd() < 0.2;
    const c = Math.floor(rnd() * CL);
    const o = centres[c];
    cp[i * 3] = loose ? (rnd() - 0.5) * 3.0 : o.x + gauss() * 0.24;
    cp[i * 3 + 1] = loose ? (rnd() - 0.5) * 0.9 : o.y + gauss() * 0.24;
    cp[i * 3 + 2] = loose ? (rnd() - 0.5) * 1.2 : o.z + gauss() * 0.3;
    cc[i] = loose ? -1 : c;
    cs[i] = rnd();
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  cg.setAttribute('aC', new THREE.BufferAttribute(cc, 1));
  cg.setAttribute('aSeed', new THREE.BufferAttribute(cs, 1));
  const cu = { uT: { value: 0 }, uA: { value: 0 }, uK: { value: 0 }, uC: { value: 0 }, uS: { value: 1 }, uCol: { value: AMBER.clone() } };
  const cloud = new THREE.Points(
    cg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: cu,
      vertexShader: /* glsl */ `
        uniform float uT, uA, uK, uC, uS; attribute float aC, aSeed; varying float vB;
        void main() {
          vec3 p = position;
          p += 0.035 * vec3(sin(uT * 0.7 + aSeed * 40.0), cos(uT * 0.6 + aSeed * 23.0), sin(uT * 0.5 + aSeed * 61.0));
          float mine = 1.0 - step(0.5, abs(aC - uC));
          vB = mix(0.3 + 0.25 * aSeed, 0.16 + mine * 1.3, uK) * uA;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * (0.9 + aSeed * 1.0 + mine * uK * 0.9) * (17.0 / -mv.z);
        }`,
      fragmentShader: 'uniform vec3 uCol; varying float vB; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vB; gl_FragColor = vec4(uCol * a, 1.0); }',
    }),
  );
  const emb = new THREE.Group();
  group.add(emb);
  cloud.position.copy(CLOUD_C);
  cloud.frustumCulled = false;
  emb.add(cloud);

  // the product's own point, its three neighbours, and the dotted links between them
  const self = glow(new THREE.Color('#fff1d6'), 0.34, 2.2);
  emb.add(self);
  const nearCards = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), cardMat(null));
    (m.material as THREE.ShaderMaterial).uniforms.uGain.value = 0.72;
    emb.add(m);
    return m;
  });
  const LINK = 30;
  const lp = new Float32Array(LINK * 4 * 3);
  const lt = new Float32Array(LINK * 4);
  for (let s = 0; s < 4; s++) for (let i = 0; i < LINK; i++) lt[s * LINK + i] = (s === 0 ? 0 : 0.4) + (i / LINK) * (s === 0 ? 0.4 : 0.35);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lg.setAttribute('aT', new THREE.BufferAttribute(lt, 1));
  const lu = { uK: { value: 0 }, uA: { value: 1 }, uS: { value: 1 }, uT: { value: 0 }, uCol: { value: AMBER.clone() } };
  const links = new THREE.Points(
    lg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: lu,
      vertexShader: /* glsl */ `
        uniform float uK, uS, uT; attribute float aT; varying float vB;
        void main() {
          vB = step(aT, uK) * (0.55 + 0.45 * sin(aT * 60.0 - uT * 4.0));
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * 16.0 / -mv.z;
        }`,
      fragmentShader: 'uniform vec3 uCol; uniform float uA; varying float vB; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vB * uA; gl_FragColor = vec4(uCol * a * 1.3, 1.0); }',
    }),
  );
  links.frustumCulled = false;
  emb.add(links);
  const selfPos = new THREE.Vector3();
  const nearPos = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const photoTop = new THREE.Vector3();

  /* ---------- stage 2: queries arc out to the web and come back with facts ---------- */
  const WN = [140, 300, 460][ctx.tier];
  const wSeed = new Float32Array(WN * 3);
  for (let i = 0; i < WN * 3; i++) wSeed[i] = Math.random();
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WN * 3), 3));
  wg.setAttribute('aSeed', new THREE.BufferAttribute(wSeed, 3));
  const wu = { uT: { value: 0 }, uA: { value: 0 }, uS: { value: 1 }, uFrom: { value: new THREE.Vector3() }, uTo: { value: WEB_C.clone() }, uCol: { value: new THREE.Color('#ffd28a') } };
  const web = new THREE.Points(
    wg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: wu,
      vertexShader: /* glsl */ `
        uniform float uT, uA, uS; uniform vec3 uFrom, uTo; attribute vec3 aSeed; varying float vB;
        void main() {
          float ph = fract(uT * (0.22 + aSeed.x * 0.12) + aSeed.y);
          // out along the top of the arc, back along the bottom
          float back = step(0.5, ph);
          float s = back > 0.5 ? 1.0 - (ph - 0.5) * 2.0 : ph * 2.0;
          vec3 to = uTo + (aSeed - 0.5) * vec3(3.0, 1.0, 2.0);
          vec3 mid = mix(uFrom, to, 0.5) + vec3(mix(-1.3, 0.9, back) + (aSeed.z - 0.5) * 0.9, mix(0.9, -0.6, back), 0.8 * (aSeed.x - 0.5));
          vec3 p = mix(mix(uFrom, mid, s), mix(mid, to, s), s);
          vB = max(0.0, uA * sin(clamp(s, 0.0, 1.0) * 3.14159) * (0.5 + back * 0.9) + uA * smoothstep(0.9, 1.0, s) * 0.8);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * (1.0 + back * 0.9) * 26.0 / -mv.z;
        }`,
      fragmentShader: 'uniform vec3 uCol; varying float vB; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vB; gl_FragColor = vec4(uCol * a, 1.0); }',
    }),
  );
  web.frustumCulled = false;
  group.add(web);

  /* ---------- DOM: the sheet, the region tags, the stepper ---------- */
  const copy = el.querySelector<HTMLElement>('.s-studio');
  const sheet = el.querySelector<HTMLElement>('.s-sheet')!;
  const rowsEl = sheet.querySelector<HTMLElement>('.s-rows')!;
  const titleEl = sheet.querySelector<HTMLElement>('.s-sheet-title')!;
  const stageEl = sheet.querySelector<HTMLElement>('.s-sheet-stage')!;
  const countEl = sheet.querySelector<HTMLElement>('.s-sheet-n')!;
  const picksEl = sheet.querySelector<HTMLElement>('.s-picks')!;
  const tagsWrap = el.querySelector<HTMLElement>('.s-tags');
  const tags = Array.from(el.querySelectorAll<HTMLElement>('.s-tags .s-tag'));
  const steps = Array.from(el.querySelectorAll<HTMLButtonElement>('.s-steps button'));
  let rowEls: HTMLElement[] = [];
  let hot = -1;
  let lastCount = -1;
  let lastStage = '';

  PRODUCTS.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `Photo: ${p.name}`);
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<img src="${A}product-${p.id}-raw.webp" alt="" loading="lazy" decoding="async" width="96" height="96"><span>${p.name}</span>`;
    b.addEventListener('click', () => pick(i));
    picksEl.appendChild(b);
  });
  const pickBtns = Array.from(picksEl.querySelectorAll<HTMLButtonElement>('button'));
  steps.forEach((b, i) => b.addEventListener('click', () => ctx.goTo('scale', toP(0.2 + ((i + 0.97) / 4) * 0.6))));

  function buildRows(i: number) {
    const p = PRODUCTS[i];
    titleEl.firstElementChild!.textContent = p.title;
    rowsEl.innerHTML = p.rows
      .map((r) => {
        let th = '';
        if (r.thumbs === 'near') th = [1, 2, 3].map((n) => `<img src="${A}near-${p.id}-${n}.webp" alt="" width="40" height="40">`).join('');
        if (r.thumbs === 'variants') th = ['pack', 'life'].map((n) => `<img src="${A}product-${p.id}-${n}.webp" alt="" width="40" height="40">`).join('');
        return `<div class="s-row" data-src="${r.src}"${r.r !== undefined ? ` data-r="${r.r}"` : ''}><dt>${r.k}</dt><dd><span>${r.v}</span>${th ? `<em>${th}</em>` : ''}</dd><i>${r.src}</i></div>`;
      })
      .join('');
    rowEls = Array.from(rowsEl.querySelectorAll<HTMLElement>('.s-row'));
    rowEls.forEach((re) => {
      const r = re.dataset.r;
      if (r === undefined) return;
      re.addEventListener('pointerenter', () => (hot = Number(r)));
      re.addEventListener('pointerleave', () => (hot = -1));
    });
    tags.forEach((t, k) => (t.textContent = p.regions[k]?.tag ?? ''));
    pickBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    lastCount = -1;
  }

  /* ---------- product state ---------- */
  const texes = new Map<number, Promise<{ raw: THREE.Texture; cut: THREE.Texture; pack: THREE.Texture; life: THREE.Texture; near: THREE.Texture[] }>>();
  const load = (i: number) => {
    if (!texes.has(i)) {
      const id = PRODUCTS[i].id;
      texes.set(
        i,
        (async () => {
          const [raw, cut, pack, life, n1, n2, n3] = await Promise.all([
            ctx.tex(`${A}product-${id}-raw.webp`),
            ctx.tex(`${A}product-${id}-cut.webp`),
            ctx.tex(`${A}product-${id}-pack.webp`),
            ctx.tex(`${A}product-${id}-life.webp`),
            ctx.tex(`${A}near-${id}-1.webp`),
            ctx.tex(`${A}near-${id}-2.webp`),
            ctx.tex(`${A}near-${id}-3.webp`),
          ]);
          return { raw, cut, pack, life, near: [n1, n2, n3] };
        })(),
      );
    }
    return texes.get(i)!;
  };
  let cur = 0;
  let pending = -1;
  let swap = 1;
  /** -1: the pipeline follows the scroll; 0..4: it is running on its own clock after a pick */
  let run = -1;
  let runAt = 0;
  let lastLocal = 0;
  let F = 0;

  async function apply(i: number) {
    const t = await load(i);
    cur = i;
    pu.tA.value = t.raw;
    pu.tB.value = t.cut;
    (variants[0].material as THREE.ShaderMaterial).uniforms.tMap.value = t.pack;
    (variants[1].material as THREE.ShaderMaterial).uniforms.tMap.value = t.life;
    nearCards.forEach((m, k) => ((m.material as THREE.ShaderMaterial).uniforms.tMap.value = t.near[k]));
    PRODUCTS[i].regions.forEach((r, k) => pu.uBox.value[k].set(r.box[0], r.box[1], r.box[2], r.box[3]));
    buildRows(i);
    // where this product lives in the cloud, and its three nearest
    const c = centres[PRODUCTS[i].cluster];
    cu.uC.value = PRODUCTS[i].cluster;
    selfPos.copy(c).add(CLOUD_C);
    const offs = [
      [-0.44, 0.16, 0.18],
      [0.02, 0.34, -0.1],
      [0.44, 0.1, 0.2],
    ];
    nearPos.forEach((v, k) => v.set(selfPos.x + offs[k][0], selfPos.y + offs[k][1], selfPos.z + offs[k][2]));
    emb.position.y = narrow() ? -0.48 : 0;
    photoTop.set(PHOTO_POS.x, PHOTO_POS.y + PHOTO / 2 + 0.04 - emb.position.y, PHOTO_POS.z);
    const P = lg.attributes.position as THREE.BufferAttribute;
    const segs: [THREE.Vector3, THREE.Vector3][] = [[photoTop, selfPos], [selfPos, nearPos[0]], [selfPos, nearPos[1]], [selfPos, nearPos[2]]];
    segs.forEach(([a, b], s) => {
      for (let k = 0; k < LINK; k++) {
        const t2 = k / (LINK - 1);
        const bow = Math.sin(t2 * Math.PI) * (s === 0 ? 0.16 : 0.03);
        P.setXYZ(s * LINK + k, mix(a.x, b.x, t2) - bow, mix(a.y, b.y, t2), mix(a.z, b.z, t2) + bow);
      }
    });
    P.needsUpdate = true;
    self.position.copy(selfPos);
  }

  function pick(i: number) {
    if (pending >= 0) return;
    pending = i;
    load(i).then(() => {
      swap = 0;
      run = 0;
      runAt = lastLocal;
    });
  }

  const ready = apply(0);
  if (ctx.tier > 0) setTimeout(() => PRODUCTS.forEach((_, i) => load(i)), 2500);

  const v0 = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const o = { x: 0, y: 0, z: 0 };
  let tilt = 0;
  // the sheet's size, cached: reading offsetWidth after the per-frame transform writes forces layout
  let sheetW = 0;
  let sheetH = 0;
  new ResizeObserver(([e]) => {
    const b = e.borderBoxSize?.[0];
    sheetW = b ? b.inlineSize : sheet.offsetWidth;
    sheetH = b ? b.blockSize : sheet.offsetHeight;
  }).observe(sheet);
  const per = [0, 0, 0, 0];
  const CNT = [4, 3, 2, 3];

  function update(u: StationFrame) {
    const { k, local, f } = u;
    const dt = f.dt;
    const t = f.t;
    group.visible = k > 0.002;
    show(copy, k > 0 ? smooth(seg(local, 0.1, 0.17)) * (1 - smooth(seg(local, 0.9, 0.97))) : 0);
    const ui = k > 0 ? smooth(seg(local, 0.13, 0.2)) * (1 - smooth(seg(local, 0.9, 0.97))) : 0;
    show(sheet, ui);
    show(tagsWrap, ui);
    if (!group.visible) {
      run = -1;
      return;
    }

    // the swap: the print turns over and comes back as the next photo
    if (swap < 1) {
      const was = swap;
      swap = Math.min(1, swap + dt / 0.7);
      if (was < 0.5 && swap >= 0.5 && pending >= 0) {
        const p = pending;
        apply(p).then(() => (pending = -1));
      }
    }
    const fl = smooth(swap);
    flip.rotation.y = fl * Math.PI * 2;
    flip.position.y = Math.sin(fl * Math.PI) * 0.12;

    // pipeline progress, 0..4
    const S = seg(local, 0.2, 0.8) * 4;
    lastLocal = local;
    if (run >= 4 && Math.abs(local - runAt) > 0.1) run = -1;
    if (run >= 0 && swap >= 1) run = Math.min(4, run + dt * (ctx.shot ? 99 : 0.85));
    const target = run >= 0 ? (swap < 0.5 ? 0 : run) : S;
    F = ctx.shot ? target : F + (target - F) * damp(run >= 0 ? 30 : 9, dt);
    const s1 = clamp01(F);
    const s2 = clamp01(F - 1);
    const s3 = clamp01(F - 2);
    const s4 = clamp01(F - 3);

    // photo
    pu.uT.value = t;
    pu.uA.value = k;
    pu.uScan.value = s1 > 0.001 && s1 < 0.86 ? s1 / 0.84 : -1;
    const P = PRODUCTS[cur];
    for (let i = 0; i < 4; i++) {
      const r = P.regions[i];
      const cy = (r.box[1] + r.box[3]) / 2;
      const a = smooth(seg(s1, cy * 0.84, cy * 0.84 + 0.12)) * (1 - 0.75 * smooth(s4 * 2));
      pu.uBoxA.value[i] = a * (hot < 0 || hot === i ? 1 : 0.35);
      // tag follows the region's top-left corner
      v0.set((r.box[i > 1 ? 2 : 0] - 0.5) * PHOTO, (0.5 - r.box[i % 2 ? 3 : 1]) * PHOTO, 0.01);
      photo.localToWorld(v0);
      pin(ctx, tags[i], v0);
      css(tags[i], 'opacity', swap < 1 ? 0 : a * (1 - smooth(s4 * 3)) * (narrow() ? 0 : 1) * (hot < 0 || hot === i ? 1 : 0.3));
    }
    pu.uHot.value = hot;
    pu.uCut.value = smooth(seg(s4, 0.05, 0.7));

    // variants
    variants.forEach((m, i) => {
      const e = smooth(seg(s4, 0.45 + i * 0.15, 0.85 + i * 0.15));
      const to = m.userData.to as THREE.Vector3;
      m.position.set(to.x * e, to.y * e - (1 - e) * 0.1, mix(-0.06, to.z, e));
      m.rotation.z = (m.userData.rz as number) * e + Math.sin(t * 0.6 + i * 2) * 0.012;
      m.position.y += Math.sin(t * 0.8 + i * 1.7) * 0.012 * e;
      const mu = (m.material as THREE.ShaderMaterial).uniforms;
      mu.uA.value = e * k * (swap < 1 ? 0 : 1);
      m.visible = e > 0.002;
    });

    // embedding cloud and neighbours
    cu.uT.value = t;
    cu.uA.value = k * (0.55 + 0.45 * smooth(seg(local, 0.1, 0.3)));
    cu.uK.value = smooth(seg(s3, 0.0, 0.35)) * (1 - 0.5 * smooth(seg(s4, 0.3, 0.9)));
    cu.uS.value = ctx.size.dpr * (ctx.size.h / 900);
    lu.uK.value = s3 * 1.1;
    lu.uT.value = t;
    lu.uA.value = k * (1 - 0.6 * smooth(seg(s4, 0.3, 0.9))) * (swap < 1 ? 0 : 1);
    lu.uS.value = cu.uS.value;
    (self.material as THREE.ShaderMaterial).uniforms.uA.value = smooth(seg(s3, 0.25, 0.45)) * 2.2 * k * (0.85 + 0.15 * Math.sin(t * 3));
    self.quaternion.copy(ctx.camera.quaternion);
    nearCards.forEach((m, i) => {
      const e = smooth(seg(s3, 0.5 + i * 0.1, 0.8 + i * 0.1));
      m.position.copy(nearPos[i]);
      m.position.y += 0.2 * e + Math.sin(t * 0.9 + i * 2.1) * 0.015;
      m.quaternion.copy(ctx.camera.quaternion);
      m.scale.setScalar(0.4 + 0.6 * e);
      (m.material as THREE.ShaderMaterial).uniforms.uA.value = e * k * (swap < 1 ? 0 : 1);
      m.visible = e > 0.002;
    });

    // web search arcs
    wu.uT.value = t;
    wu.uA.value = k * Math.max(smooth(seg(s2, 0.0, 0.15)) * (1 - smooth(seg(s3, 0.0, 0.4))), 0);
    wu.uS.value = cu.uS.value;
    wu.uFrom.value.set(PHOTO_POS.x + 0.2, PHOTO_POS.y + 0.2, PHOTO_POS.z + 0.1);
    web.visible = wu.uA.value > 0.003;

    // light
    (cone.material as THREE.ShaderMaterial).uniforms.uA.value = 0.2 * k;
    (cone.material as THREE.ShaderMaterial).uniforms.uT.value = t;
    (lens.material as THREE.ShaderMaterial).uniforms.uA.value = 1.3 * k * (0.97 + 0.03 * Math.sin(t * 31));
    lens.quaternion.copy(ctx.camera.quaternion);

    // sheet: rows fill in as their stage passes
    let filled = 0;
    per.fill(0);
    rowEls.forEach((re, i) => {
      const st = STAGE_OF[P.rows[i].src];
      const th = st + 0.18 + (per[st]++ / CNT[st]) * 0.7;
      const on = F > th && swap >= 1;
      if (on) filled++;
      flag(re, 'in', on);
      flag(re, 'now', !on && F > st + 0.02 && F < st + 1 && swap >= 1);
      flag(re, 'hot', hot >= 0 && re.dataset.r === String(hot));
    });
    flag(titleEl, 'in', F > 0.5 && swap >= 1);
    if (filled !== lastCount) {
      lastCount = filled;
      countEl.textContent = `${filled} / ${rowEls.length}`;
    }
    const si = Math.min(3, Math.floor(F));
    const label = F < 0.02 ? 'Bare photo' : F > 3.98 ? 'Ready to list' : STAGES[si];
    if (label !== lastStage) {
      lastStage = label;
      stageEl.textContent = label;
    }
    css(sheet, '--fill', F / 4);
    flag(sheet, 'done', F > 3.98);
    steps.forEach((b, i) => {
      flag(b, 'on', F > i + 0.02 && F < i + 1 && F < 3.98);
      flag(b, 'did', F >= i + 1 || F > 3.98);
    });

    // the sheet floats beside the print on wide screens (a fixed panel on phones, see CSS)
    if (!narrow()) {
      anchor.set(PHOTO_POS.x + PHOTO / 2 + 0.28, PHOTO_POS.y + 0.1, PHOTO_POS.z);
      group.localToWorld(anchor);
      ctx.project(anchor, o);
      const x = Math.min(o.x, ctx.size.w - sheetW - 24);
      tilt += (ctx.pointer.x - tilt) * damp(4, dt);
      css(sheet, 'transform', `translate3d(${x.toFixed(1)}px, ${(o.y - sheetH / 2).toFixed(1)}px, 0) perspective(900px) rotateY(${(-7 + tilt * 3).toFixed(2)}deg) rotateX(${(ctx.pointer.y * 1.6).toFixed(2)}deg)`);
    } else css(sheet, 'transform', 'none');
  }

  return {
    group,
    update,
    act(name, arg) {
      if (name === 'pick') ready.then(() => apply(Number(arg) || 0));
      if (name === 'hot') hot = Number(arg) || 0;
    },
  };
}
