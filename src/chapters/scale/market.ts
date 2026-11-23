import * as THREE from 'three';
import type { Ctx } from '../../world/types';
import { damp, flag, mix, seg, show, smooth } from '../../world/util';
import { A, FEATURES, MARKETS } from './data';
import { AMBER, FONT, canvasTex, glow, loadImage, pin, prop, rng, rr, type Station, type StationFrame } from './shared';

/**
 * World 2, the night market. Seven storefront screens, one per market, under awnings and lantern
 * strings. In front of them stands a physical toggle board: three levers, and a row of seven lamps
 * per lever. Flipping a lever rolls the feature out one market at a time (a pulse runs down each
 * cable, the storefront redraws) and flipping it back rolls it back in reverse order.
 */

const W = 320;
const H = 560;
const INK = '#1b140c';
const PAPER = '#f1e9da';
const STEP = 0.24;
const LANTERN = new THREE.Color('#ffb24a');
const TRAVEL = 0.55;

export function createMarket(ctx: Ctx, el: HTMLElement): Station {
  const group = new THREE.Group();
  const nM = MARKETS.length;

  /* ---------- state ---------- */
  const want = [false, false, false];
  const user: (boolean | null)[] = [null, null, null];
  const applied = FEATURES.map(() => MARKETS.map(() => false));
  const events: { f: number; i: number; v: boolean; t0: number }[] = [];
  const flash = new Float32Array(nM);
  const memberPulse = new Float32Array(nM);
  let now = 0;

  /* ---------- storefront screens ---------- */
  const thumbs: (HTMLImageElement | null)[] = [];
  const screens = MARKETS.map(() => canvasTex(W, H));
  const store = MARKETS.map((_, i) => {
    const g = new THREE.Group();
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.4), new THREE.MeshBasicMaterial({ map: screens[i].tex, color: 0xffffff }));
    scr.position.z = 0.031;
    g.add(scr);
    g.userData.scr = scr;
    group.add(g);
    return g;
  });
  const dark = new THREE.MeshStandardMaterial({ color: '#120e0a', roughness: 0.45, metalness: 0.6 });
  const woodM = new THREE.MeshStandardMaterial({ color: '#33241a', roughness: 0.75 });
  const bezels = new THREE.InstancedMesh(new THREE.BoxGeometry(0.88, 1.48, 0.06), dark, nM);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1, 0.07), woodM, nM * 2);
  group.add(bezels, posts);

  // awnings: striped canvas with a scalloped valance
  const aw = canvasTex(256, 128);
  {
    const g = aw.g;
    for (let s = 0; s < 8; s++) {
      g.fillStyle = s % 2 ? '#e9d9b4' : '#c9761c';
      g.fillRect(s * 32, 0, 32, 128);
    }
    const sh = g.createLinearGradient(0, 0, 0, 128);
    sh.addColorStop(0, 'rgba(0,0,0,0.5)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.fillRect(0, 0, 256, 128);
    aw.tex.needsUpdate = true;
  }
  const val = canvasTex(256, 48);
  {
    const g = val.g;
    g.clearRect(0, 0, 256, 48);
    for (let s = 0; s < 8; s++) {
      g.fillStyle = s % 2 ? '#e9d9b4' : '#c9761c';
      g.beginPath();
      g.rect(s * 32, 0, 32, 26);
      g.arc(s * 32 + 16, 26, 16, 0, Math.PI);
      g.fill();
    }
    val.tex.needsUpdate = true;
  }
  const awnMat = new THREE.MeshStandardMaterial({ map: aw.tex, color: '#8c8478', roughness: 0.9, side: THREE.DoubleSide, emissive: new THREE.Color('#ffb060'), emissiveMap: aw.tex, emissiveIntensity: 0.03 });
  const valMat = new THREE.MeshStandardMaterial({ map: val.tex, color: '#8c8478', roughness: 0.9, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5, emissive: new THREE.Color('#ffb060'), emissiveMap: val.tex, emissiveIntensity: 0.04 });
  const awnings = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.02, 0.62), awnMat, nM);
  const valances = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.02, 0.17), valMat, nM);
  group.add(awnings, valances);

  function drawStore(i: number) {
    const { g, tex } = screens[i];
    const m = MARKETS[i];
    const f0 = applied[0][i];
    const f1 = applied[1][i];
    const f2 = applied[2][i];
    g.fillStyle = PAPER;
    g.fillRect(0, 0, W, H);
    // header
    g.fillStyle = INK;
    g.fillRect(0, 0, W, 60);
    g.fillStyle = '#ffa62b';
    rr(g, 14, 14, 58, 32, 9);
    g.fill();
    g.fillStyle = INK;
    g.font = FONT(20, 800);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(m.code, 43, 31);
    g.textAlign = 'left';
    g.fillStyle = PAPER;
    g.font = FONT(17, 600);
    g.fillText(m.name, 84, 31);
    let y = 60;
    if (f2) {
      g.fillStyle = '#3a2810';
      g.fillRect(0, y, W, 34);
      g.fillStyle = '#ffa62b';
      g.beginPath();
      g.arc(26, y + 17, 9, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(21.5, y + 17);
      g.lineTo(25, y + 20.5);
      g.lineTo(31, y + 13.5);
      g.stroke();
      g.fillStyle = '#ffd9a0';
      g.font = FONT(14, 600);
      g.fillText('Sign-in check on', 44, y + 18);
      y += 34;
    }
    // search
    g.fillStyle = '#e2d7c2';
    rr(g, 14, y + 10, W - 28, 34, 17);
    g.fill();
    g.strokeStyle = '#8d7f6a';
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(34, y + 26, 6, 0, Math.PI * 2);
    g.moveTo(39, y + 31);
    g.lineTo(43, y + 35);
    g.stroke();
    y += 56;
    if (f0) {
      const gr = g.createLinearGradient(14, y, W - 14, y + 96);
      gr.addColorStop(0, '#ffb53d');
      gr.addColorStop(1, '#ff7a1c');
      g.fillStyle = gr;
      rr(g, 14, y, W - 28, 96, 14);
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath();
      g.arc(W - 40, y + 14, 58, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(W - 96, y + 104, 34, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.fillStyle = '#2a1500';
      g.font = FONT(31, 800, 'condensed');
      g.fillText('Sale week', 30, y + 40);
      g.font = FONT(15, 600);
      g.fillText('Free shipping today', 30, y + 70);
      y += 108;
    } else {
      for (let c = 0; c < 5; c++) {
        g.fillStyle = '#e2d7c2';
        g.beginPath();
        g.arc(40 + c * 60, y + 22, 20, 0, Math.PI * 2);
        g.fill();
      }
      y += 56;
    }
    // product tiles
    const bottom = H - 70;
    const th = (bottom - y - 10) / 2;
    const tw = (W - 28 - 10) / 2;
    for (let n = 0; n < 4; n++) {
      const x = 14 + (n % 2) * (tw + 10);
      const ty = y + Math.floor(n / 2) * (th + 10);
      g.fillStyle = '#fffaf0';
      rr(g, x, ty, tw, th, 10);
      g.fill();
      const ih = th - 50;
      const im = thumbs[i * 4 + n] ?? null;
      g.save();
      rr(g, x, ty, tw, ih, 10);
      g.clip();
      if (im) {
        const s = Math.max(tw / im.width, ih / im.height);
        g.drawImage(im, x + (tw - im.width * s) / 2, ty + (ih - im.height * s) / 2, im.width * s, im.height * s);
      } else {
        g.fillStyle = '#ddd2bd';
        g.fillRect(x, ty, tw, ih);
      }
      g.restore();
      g.fillStyle = '#d5c9b3';
      rr(g, x + 10, ty + ih + 10, tw * 0.62, 7, 3.5);
      g.fill();
      g.fillStyle = INK;
      g.font = FONT(17, 750);
      g.fillText(`${m.cur}${m.prices[n]}`, x + 10, ty + ih + 34);
    }
    // bottom bar
    g.fillStyle = '#fffaf0';
    g.fillRect(0, H - 62, W, 62);
    g.textAlign = 'center';
    if (f1) {
      g.fillStyle = '#ffa62b';
      rr(g, 14, H - 52, W - 28, 42, 21);
      g.fill();
      g.fillStyle = '#2a1500';
      g.font = FONT(18, 800);
      g.fillText('Buy now · 1 tap', W / 2, H - 30);
    } else {
      g.strokeStyle = '#8d7f6a';
      g.lineWidth = 2;
      rr(g, 14, H - 52, 140, 42, 21);
      g.stroke();
      rr(g, 166, H - 52, 140, 42, 21);
      g.stroke();
      g.fillStyle = '#5c5042';
      g.font = FONT(16, 650);
      g.fillText('Add to cart', 84, H - 30);
      g.fillText('Buy', 236, H - 30);
    }
    g.textAlign = 'left';
    tex.needsUpdate = true;
  }

  /* ---------- lantern strings and the street behind ---------- */
  const LN = 13;
  const lanterns = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb24a').multiplyScalar(2.6) }), LN * 2);
  const lanternPos: THREE.Vector3[] = [];
  group.add(lanterns);
  const halos = new THREE.Group();
  group.add(halos);
  const bu = { tMap: { value: null as THREE.Texture | null }, uA: { value: 0 }, uOn: { value: 0 } };
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 14.6),
    new THREE.ShaderMaterial({
      uniforms: bu,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tMap; uniform float uA, uOn; varying vec2 vUv;
        void main() {
          vec2 q = (vUv - 0.5) * 2.0;
          float edge = smoothstep(1.0, 0.35, abs(q.x)) * smoothstep(1.0, 0.3, abs(q.y)) * smoothstep(-0.75, 0.1, q.x);
          vec3 c = texture2D(tMap, vUv).rgb;
          c = pow(max(c, 0.0), vec3(1.25)) * vec3(1.0, 0.82, 0.62);
          gl_FragColor = vec4(c * edge * uA * uOn, 1.0);
        }`,
    }),
  );
  backdrop.position.set(5.5, 5.2, -13);
  backdrop.rotation.y = -0.25;
  backdrop.renderOrder = -5;
  group.add(backdrop);
  (async () => {
    if (ctx.tier > 0 && !ctx.still && !ctx.shot) {
      const v = await ctx.video(A + 'market-street.mp4', { poster: A + 'market-street.jpg' });
      if (v.el.videoWidth) {
        bu.tMap.value = v.tex;
        bu.uOn.value = 1;
        group.userData.video = v.el;
        return;
      }
    }
    bu.tMap.value = await ctx.tex(A + 'market-street.webp');
    bu.uOn.value = 1;
  })().catch(() => {});
  prop(ctx, A + 'prop-stall.glb', { height: 2.7, env: 1 }).then((o) => {
    if (!o) return;
    o.position.set(-6.4, 0, -1.5);
    o.rotation.y = 0.5;
    group.add(o);
    const o2 = o.clone();
    o2.position.set(8.6, 0, -1.4);
    o2.rotation.y = -0.75;
    group.add(o2);
  });

  /* ---------- the toggle board ---------- */
  const board = new THREE.Group();
  group.add(board);
  const face = canvasTex(800, 608);
  {
    const g = face.g;
    g.fillStyle = '#17120d';
    g.fillRect(0, 0, 800, 608);
    g.strokeStyle = 'rgba(255,166,43,0.28)';
    g.lineWidth = 3;
    rr(g, 14, 14, 772, 580, 18);
    g.stroke();
    g.fillStyle = '#8d7a5e';
    g.font = FONT(22, 700);
    g.textBaseline = 'middle';
    g.fillText('FEATURE TOGGLES', 40, 52);
    g.textAlign = 'center';
    g.font = FONT(20, 700);
    MARKETS.forEach((m, j) => g.fillText(m.code, 330 + j * 64, 52));
    g.textAlign = 'left';
    FEATURES.forEach((name, f) => {
      const y = 96 + f * 166;
      g.fillStyle = '#0d0a07';
      rr(g, 34, y, 732, 148, 14);
      g.fill();
      g.fillStyle = '#080604';
      rr(g, 70, y + 22, 64, 104, 32);
      g.fill();
      g.fillStyle = '#f1e9da';
      g.font = FONT(30, 760, 'condensed');
      g.fillText(name, 176, y + 46);
      g.fillStyle = '#6f6150';
      g.font = FONT(17, 650);
      g.fillText('ON', 22 + 24, y + 30);
      g.fillText('OFF', 22 + 20, y + 122);
    });
    face.tex.needsUpdate = true;
  }
  const BW = 1.3;
  const BH = 0.988;
  const body = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.08, BH + 0.08, 0.12), dark);
  const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshStandardMaterial({ map: face.tex, roughness: 0.55, metalness: 0.2, emissive: new THREE.Color('#ffffff'), emissiveMap: face.tex, emissiveIntensity: 0.5 }));
  facePlane.position.z = 0.062;
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 12), dark);
  stand.position.set(0, -0.78, -0.1);
  const baseM = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 28), dark);
  baseM.position.set(0, -1.06, -0.2);
  board.add(body, facePlane, stand, baseM);
  const toLocal = (px: number, py: number, z = 0.07) => new THREE.Vector3((px / 800 - 0.5) * BW, (0.5 - py / 608) * BH, z);
  const levers = FEATURES.map((_, f) => {
    const piv = new THREE.Group();
    piv.position.copy(toLocal(102, 96 + f * 166 + 74, 0.06));
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.17, 12), new THREE.MeshStandardMaterial({ color: '#b9b2a6', roughness: 0.25, metalness: 1 }));
    stick.rotation.x = Math.PI / 2;
    stick.position.z = 0.085;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.043, 20, 14), new THREE.MeshStandardMaterial({ color: '#2a1c0c', roughness: 0.3, metalness: 0.2, emissive: AMBER.clone(), emissiveIntensity: 0 }));
    knob.position.z = 0.18;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.012, 10, 24), new THREE.MeshStandardMaterial({ color: '#8f8778', roughness: 0.3, metalness: 1 }));
    piv.add(stick, knob, collar);
    board.add(piv);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.25, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(toLocal(400, 96 + f * 166 + 74, 0.1));
    hit.userData.f = f;
    board.add(hit);
    return { piv, knob, hit, a: -0.55, v: 0, hover: 0 };
  });
  const leds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.021, 12, 8), new THREE.MeshBasicMaterial(), FEATURES.length * nM);
  const ledCol = new THREE.Color();
  const mx = new THREE.Matrix4();
  FEATURES.forEach((_, f) =>
    MARKETS.forEach((__, j) => {
      const p = toLocal(330 + j * 64, 96 + f * 166 + 104, 0.068);
      leds.setMatrixAt(f * nM + j, mx.makeTranslation(p.x, p.y, p.z));
      leds.setColorAt(f * nM + j, ledCol.setRGB(0.05, 0.03, 0.015));
    }),
  );
  board.add(leds);

  /* ---------- cables and pulses ---------- */
  let curves: THREE.CatmullRomCurve3[] = [];
  let cableMesh: THREE.Mesh | null = null;
  const cableMat = new THREE.MeshStandardMaterial({ color: '#0b0907', roughness: 0.6, metalness: 0.3, emissive: AMBER.clone(), emissiveIntensity: 0.1 });
  const pulses = Array.from({ length: 14 }, () => {
    const m = glow(AMBER, 0.42, 0);
    m.visible = false;
    group.add(m);
    return m;
  });
  const ROLLBACK = new THREE.Color('#ff4a1c');

  /* ---------- the team: seven figures made of points ---------- */
  const PER = [320, 900, 1300][ctx.tier];
  const tp = new Float32Array(PER * nM * 3);
  const to = new Float32Array(PER * nM * 3);
  const tm = new Float32Array(PER * nM);
  const ts = new Float32Array(PER * nM);
  const rnd = rng(9);
  const memberPos: THREE.Vector3[] = [];
  const sphere = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, out: number[]) => {
    const u = rnd() * Math.PI * 2;
    const v = Math.acos(2 * rnd() - 1);
    out[0] = cx + Math.sin(v) * Math.cos(u) * rx;
    out[1] = cy + Math.cos(v) * ry;
    out[2] = cz + Math.sin(v) * Math.sin(u) * rz;
  };
  const q = [0, 0, 0];
  for (let m = 0; m < nM; m++) {
    const hgt = 0.92 + rnd() * 0.14;
    for (let i = 0; i < PER; i++) {
      const r = rnd();
      if (r < 0.16) sphere(0, 1.62, 0, 0.095, 0.115, 0.1, q);
      else if (r < 0.2) sphere(0, 1.47, 0, 0.05, 0.05, 0.05, q);
      else if (r < 0.52) sphere(0, 1.17, 0, 0.165, 0.29, 0.1, q);
      else if (r < 0.58) sphere(0, 1.4, 0, 0.21, 0.06, 0.09, q);
      else if (r < 0.72) sphere(rnd() < 0.5 ? -0.225 : 0.225, 1.1, 0, 0.042, 0.31, 0.045, q);
      else sphere(rnd() < 0.5 ? -0.085 : 0.085, 0.45, 0, 0.065, 0.45, 0.07, q);
      const k = (m * PER + i) * 3;
      tp[k] = q[0] * hgt;
      tp[k + 1] = q[1] * hgt;
      tp[k + 2] = q[2] * hgt;
      tm[m * PER + i] = m;
      ts[m * PER + i] = rnd();
    }
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
  tg.setAttribute('aOff', new THREE.BufferAttribute(to, 3));
  tg.setAttribute('aM', new THREE.BufferAttribute(tm, 1));
  tg.setAttribute('aSeed', new THREE.BufferAttribute(ts, 1));
  const tu = { uT: { value: 0 }, uA: { value: 0 }, uS: { value: 1 }, uPulse: { value: Array.from(memberPulse) }, uCol: { value: AMBER.clone() } };
  const team = new THREE.Points(
    tg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: tu,
      vertexShader: /* glsl */ `
        uniform float uT, uA, uS; uniform float uPulse[7]; attribute vec3 aOff; attribute float aM, aSeed; varying float vB;
        void main() {
          vec3 p = position;
          float ph = aM * 1.7;
          p.x += sin(uT * 0.8 + ph) * 0.02 * p.y;
          p.y += sin(uT * 1.6 + ph) * 0.008 * p.y;
          p += 0.006 * vec3(sin(uT * 1.3 + aSeed * 50.0), cos(uT * 1.1 + aSeed * 31.0), sin(uT * 0.9 + aSeed * 77.0));
          float pu = uPulse[int(aM)];
          p.y += pu * 0.05 * smoothstep(1.0, 1.7, p.y);
          vB = uA * (0.5 + 0.15 * aSeed + pu * 1.4);
          vec4 mv = modelViewMatrix * vec4(p + aOff, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * (0.6 + aSeed * 0.6) * 11.0 / -mv.z;
        }`,
      fragmentShader: 'uniform vec3 uCol; varying float vB; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vB; gl_FragColor = vec4(uCol * a, 1.0); }',
    }),
  );
  team.frustumCulled = false;
  group.add(team);

  /* ---------- layout (a row on wide screens, a 4 + 3 wall on phones) ---------- */
  const storePos = MARKETS.map(() => new THREE.Vector3());
  const teamC = new THREE.Vector3();
  const boardTop = new THREE.Vector3();
  let laidNarrow: boolean | null = null;
  function layout(narrow: boolean) {
    if (laidNarrow === narrow) return;
    laidNarrow = narrow;
    const e = new THREE.Euler();
    const qd = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    MARKETS.forEach((_, i) => {
      const s = store[i];
      if (narrow) {
        const row = i < 4 ? 0 : 1;
        const c = row ? i - 4 - 1 : i - 1.5;
        s.position.set(c * 0.98, row ? 1.22 : 2.9, -0.9);
        s.rotation.y = -c * 0.05;
      } else {
        // a street receding to the right: the nearest market is the first to get a feature
        s.position.set(-0.35 + i * 1.22, 1.72, 1.0 - i * 0.92);
        s.rotation.y = -0.2 - i * 0.012;
      }
      storePos[i].copy(s.position);
      qd.setFromEuler(e.set(0, s.rotation.y, 0));
      bezels.setMatrixAt(i, mx.compose(s.position, qd, one));
      const showPost = narrow && i < 4 ? 0.0001 : 1;
      for (let k = 0; k < 2; k++) {
        const px = s.position.x + (k ? 0.36 : -0.36);
        const hh = s.position.y - 0.72;
        posts.setMatrixAt(i * 2 + k, mx.compose(new THREE.Vector3(px, hh / 2, s.position.z - 0.02), qd, new THREE.Vector3(showPost, hh, showPost)));
      }
      const top = s.position.y + 0.74;
      qd.setFromEuler(e.set(-1.05, s.rotation.y, 0, 'YXZ'));
      awnings.setMatrixAt(i, mx.compose(new THREE.Vector3(s.position.x, top + 0.2, s.position.z + 0.27), qd, one));
      qd.setFromEuler(e.set(0, s.rotation.y, 0));
      valances.setMatrixAt(i, mx.compose(new THREE.Vector3(s.position.x, top - 0.02, s.position.z + 0.54), qd, one));
    });
    [bezels, posts, awnings, valances].forEach((m) => (m.instanceMatrix.needsUpdate = true));
    awnings.visible = valances.visible = true;

    if (narrow) {
      board.position.set(0.1, 4.85, 0.6);
      board.rotation.set(0, 0, 0);
      board.scale.setScalar(1.25);
      stand.visible = baseM.visible = false;
    } else {
      board.position.set(0.15, 1.08, 3.5);
      board.rotation.set(-0.3, 0.12, 0);
      board.scale.setScalar(1);
      stand.visible = baseM.visible = true;
    }
    board.updateMatrixWorld(true);
    boardTop.set(0, narrow ? -BH / 2 - 0.04 : BH / 2 + 0.04, 0).applyMatrix4(board.matrix);

    // cables
    if (cableMesh) {
      cableMesh.geometry.dispose();
      group.remove(cableMesh);
    }
    curves = MARKETS.map((_, i) => {
      const s = storePos[i];
      const end = new THREE.Vector3(s.x, s.y + 0.74, s.z - 0.02);
      const a = boardTop.clone();
      if (narrow) return new THREE.CatmullRomCurve3([a, new THREE.Vector3((a.x + end.x) / 2, 4.1, 0.1), new THREE.Vector3(end.x, s.y + 1.05, end.z - 0.1), end]);
      const g0 = new THREE.Vector3(board.position.x, 0.03, board.position.z - 0.35);
      const foot = new THREE.Vector3(s.x - 0.36, 0.03, s.z + 0.12);
      const mid = new THREE.Vector3(mix(g0.x, foot.x, 0.45) - 0.25 + i * 0.05, 0.03, mix(g0.z, foot.z, 0.5) + 0.5 - i * 0.04);
      return new THREE.CatmullRomCurve3([g0, mid, foot, new THREE.Vector3(s.x - 0.36, 0.5, s.z + 0.05), new THREE.Vector3(s.x - 0.36, 1.0, s.z + 0.04)], false, 'catmullrom', 0.2);
    });
    const parts = curves.map((c) => new THREE.TubeGeometry(c, 48, 0.011, 5, false));
    let nV = 0;
    let nI = 0;
    parts.forEach((p) => {
      nV += p.attributes.position.count;
      nI += p.index!.count;
    });
    const mp = new Float32Array(nV * 3);
    const mn = new Float32Array(nV * 3);
    const mi = new Uint32Array(nI);
    let vo = 0;
    let io = 0;
    parts.forEach((p) => {
      mp.set(p.attributes.position.array as Float32Array, vo * 3);
      mn.set(p.attributes.normal.array as Float32Array, vo * 3);
      const ix = p.index!.array;
      for (let k = 0; k < ix.length; k++) mi[io + k] = ix[k] + vo;
      vo += p.attributes.position.count;
      io += ix.length;
      p.dispose();
    });
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    mg.setAttribute('normal', new THREE.BufferAttribute(mn, 3));
    mg.setIndex(new THREE.BufferAttribute(mi, 1));
    cableMesh = new THREE.Mesh(mg, cableMat);
    group.add(cableMesh);

    // lantern strings
    lanternPos.length = 0;
    halos.clear();
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < LN; i++) {
        const u = i / (LN - 1);
        const x = narrow ? (u - 0.5) * 5.4 : -2.6 + u * 9.6 + s * 1.6;
        const sag = Math.sin(u * Math.PI) * 0.42;
        const y = (narrow ? 4.15 : 3.5 + s * 0.25) - sag + (s ? 0.12 : 0);
        const z = narrow ? -1.6 - s * 1.6 : 1.9 - u * 8.2 - s * 0.6;
        const v = new THREE.Vector3(x + (s ? 0.35 : 0), y, z);
        lanternPos.push(v);
        lanterns.setMatrixAt(s * LN + i, mx.compose(v, qd.identity(), new THREE.Vector3(1, 1.25, 1)));
        if (i % 2 === 0) {
          const h = glow(new THREE.Color('#ff9d3a'), 0.95, 0.42);
          h.position.copy(v);
          halos.add(h);
        }
      }
    }
    lanterns.instanceMatrix.needsUpdate = true;

    // team: behind the board, watching the wall
    const spots = narrow
      ? [[-2.0, 0.9], [-1.35, 1.25], [-0.65, 0.95], [0.1, 1.3], [0.8, 0.95], [1.45, 1.25], [2.05, 0.9]]
      : [[0.95, 3.9], [1.45, 3.0], [1.9, 4.3], [2.3, 3.4], [2.75, 2.6], [2.9, 4.2], [3.3, 3.3]];
    memberPos.length = 0;
    teamC.set(0, 0, 0);
    spots.forEach(([x, z], m) => {
      const v = new THREE.Vector3(x, 0, z);
      memberPos.push(v);
      teamC.add(v);
      for (let i = 0; i < PER; i++) {
        const k = (m * PER + i) * 3;
        to[k] = x;
        to[k + 1] = 0;
        to[k + 2] = z;
      }
    });
    teamC.multiplyScalar(1 / nM);
    teamC.y = narrow ? 1.75 : 1.9;
    tg.attributes.aOff.needsUpdate = true;
  }

  /* ---------- rollout engine ---------- */
  function setFeature(f: number, v: boolean, instant = false) {
    if (want[f] === v) return;
    want[f] = v;
    for (let k = events.length - 1; k >= 0; k--) if (events[k].f === f) events.splice(k, 1);
    let n = 0;
    for (let s = 0; s < nM; s++) {
      const i = v ? s : nM - 1 - s;
      if (applied[f][i] === v) continue;
      if (instant) {
        applied[f][i] = v;
        dirty[i] = true;
      } else events.push({ f, i, v, t0: now + 0.18 + n++ * STEP });
    }
    levers[f].v += v ? 9 : -9;
    syncDom();
  }
  const dirty = MARKETS.map(() => true);

  /* ---------- DOM ---------- */
  const copy = el.querySelector<HTMLElement>('.s-market');
  const tagsWrap = el.querySelector<HTMLElement>('.s-market-tags');
  const tagTeam = el.querySelector<HTMLElement>('.s-tag-team');
  const tagBoard = el.querySelector<HTMLElement>('.s-tag-board');
  const btns = Array.from(el.querySelectorAll<HTMLButtonElement>('.s-toggles button'));
  const pips = btns.map((b) => {
    const wrap = b.querySelector<HTMLElement>('.s-pips')!;
    wrap.innerHTML = MARKETS.map((m) => `<i title="${m.name}"></i>`).join('');
    return Array.from(wrap.children) as HTMLElement[];
  });
  btns.forEach((b, f) =>
    b.addEventListener('click', () => {
      user[f] = !want[f];
      setFeature(f, user[f]!);
    }),
  );
  function syncDom() {
    btns.forEach((b, f) => {
      b.setAttribute('aria-checked', String(want[f]));
      pips[f].forEach((p, i) => flag(p, 'on', applied[f][i]));
    });
  }

  // clicking the levers themselves
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let live = false;
  let hoverF = -1;
  const hits = levers.map((l) => l.hit);
  const scrs = store.map((g) => g.userData.scr as THREE.Mesh);
  const storeTag = document.createElement('span');
  storeTag.className = 's-tag s-tag-store';
  tagsWrap?.appendChild(storeTag);
  let hoverS = -1;
  let hoverText = '';
  const lift = new Float32Array(nM);
  const probe = () => {
    ndc.set(ctx.pointer.rx, ctx.pointer.ry);
    ray.setFromCamera(ndc, ctx.camera);
    const h = ray.intersectObjects(hits, false)[0];
    return h ? (h.object.userData.f as number) : -1;
  };
  let downAt = { x: 0, y: 0, f: -1 };
  addEventListener('pointerdown', (e) => {
    if (!live || (e.target as HTMLElement).closest?.('button, a, [data-hit]')) return;
    ctx.pointer.rx = (e.clientX / ctx.size.w) * 2 - 1;
    ctx.pointer.ry = -((e.clientY / ctx.size.h) * 2 - 1);
    downAt = { x: e.clientX, y: e.clientY, f: probe() };
  });
  addEventListener('pointerup', (e) => {
    if (!live || downAt.f < 0) return;
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 12) {
      const f = downAt.f;
      user[f] = !want[f];
      setFeature(f, user[f]!);
    }
    downAt.f = -1;
  });

  // thumbnails for the storefront tiles: one distinct small image per tile (7 stores x 4 tiles)
  Promise.all(Array.from({ length: nM * 4 }, (_, n) => loadImage(`${A}shop-${String(n + 1).padStart(2, '0')}.webp`))).then((ims) => {
    ims.forEach((im, n) => (thumbs[n] = im));
    dirty.fill(true);
  });
  document.fonts?.ready.then(() => dirty.fill(true));

  const v0 = new THREE.Vector3();
  const AUTO = [0.3, 0.46, 0.62];

  function update(u: StationFrame) {
    const { k, local, f } = u;
    const dt = f.dt;
    const t = f.t;
    now = t;
    group.visible = k > 0.002;
    const uiA = k > 0 ? smooth(seg(local, 0.04, 0.12)) * (1 - smooth(seg(local, 0.92, 0.99))) : 0;
    show(copy, uiA);
    show(tagsWrap, uiA * (ctx.size.narrow ? 0 : 1));
    live = u.live && uiA > 0.5;
    const vid = group.userData.video as HTMLVideoElement | undefined;
    if (!group.visible) {
      if (vid && !vid.paused) vid.pause();
      user[0] = user[1] = user[2] = null;
      if (hoverF >= 0) {
        hoverF = -1;
        document.body.style.cursor = '';
      }
      hoverS = -1;
      return;
    }
    layout(ctx.size.narrow);

    // scroll flips the levers one by one until the visitor takes over
    for (let fI = 0; fI < 3; fI++) {
      const auto = local > AUTO[fI];
      const w = user[fI] ?? auto;
      if (w !== want[fI]) setFeature(fI, w, ctx.shot);
    }

    // run the roll-out
    let pi = 0;
    for (let e = events.length - 1; e >= 0; e--) {
      const ev = events[e];
      const uu = (t - ev.t0) / TRAVEL;
      if (uu >= 1) {
        applied[ev.f][ev.i] = ev.v;
        dirty[ev.i] = true;
        flash[ev.i] = 1;
        memberPulse[ev.i] = 1;
        events.splice(e, 1);
        syncDom();
      } else if (uu > 0 && pi < pulses.length) {
        const m = pulses[pi++];
        curves[ev.i].getPointAt(smooth(uu), m.position);
        m.visible = true;
        m.quaternion.copy(ctx.camera.quaternion);
        const mu = (m.material as THREE.ShaderMaterial).uniforms;
        mu.uCol.value.copy(ev.v ? AMBER : ROLLBACK);
        mu.uA.value = 3.2 * Math.sin(uu * Math.PI) ** 0.5 * k;
      }
    }
    for (; pi < pulses.length; pi++) pulses[pi].visible = false;

    for (let i = 0; i < nM; i++) {
      if (dirty[i]) {
        dirty[i] = false;
        drawStore(i);
      }
      flash[i] = Math.max(0, flash[i] - dt * 2.2);
      memberPulse[i] = Math.max(0, memberPulse[i] - dt * 1.4);
      tu.uPulse.value[i] = memberPulse[i];
      const scr = store[i].userData.scr as THREE.Mesh;
      const idle = 0.6 + 0.02 * Math.sin(t * 1.3 + i * 1.9);
      (scr.material as THREE.MeshBasicMaterial).color.setScalar((idle + flash[i] * 0.9 + lift[i] * 0.14) * k);
      lift[i] += ((hoverS === i ? 1 : 0) - lift[i]) * damp(10, dt);
      store[i].scale.setScalar(1 + flash[i] * 0.025 + lift[i] * 0.05);
    }

    // lamps on the board
    for (let fI = 0; fI < 3; fI++) {
      for (let j = 0; j < nM; j++) {
        let pend = false;
        for (let e = 0; e < events.length && !pend; e++) pend = events[e].f === fI && events[e].i === j;
        const on = applied[fI][j];
        if (pend) {
          const b = 0.5 + 0.5 * Math.sin(t * 22);
          ledCol.copy(want[fI] ? AMBER : ROLLBACK).multiplyScalar(0.5 + b * 2.2);
        } else if (on) ledCol.copy(AMBER).multiplyScalar(2.6);
        else ledCol.setRGB(0.07, 0.045, 0.02);
        leds.setColorAt(fI * nM + j, ledCol.multiplyScalar(k));
      }
      // lever: a spring toward its side, with a small overshoot
      const L = levers[fI];
      const target = want[fI] ? 0.55 : -0.55;
      L.v += (target - L.a) * 190 * dt;
      L.v *= Math.exp(-14 * dt);
      L.a += L.v * dt;
      if (ctx.shot) L.a = target;
      L.hover += ((hoverF === fI ? 1 : 0) - L.hover) * damp(12, dt);
      L.piv.rotation.x = -L.a - L.hover * (want[fI] ? -0.08 : 0.08);
      (L.knob.material as THREE.MeshStandardMaterial).emissiveIntensity = (want[fI] ? 2.4 : 0.12) + L.hover * 0.9;
      L.knob.scale.setScalar(1 + L.hover * 0.12);
    }
    leds.instanceColor!.needsUpdate = true;

    // hover affordance on the board (fine pointers only)
    if (live && ctx.pointer.seen && ctx.tier > 0) {
      const h = probe();
      if (h !== hoverF) {
        hoverF = h;
        document.body.style.cursor = h >= 0 ? 'pointer' : '';
      }
      const sh = h >= 0 ? undefined : ray.intersectObjects(scrs, false)[0];
      hoverS = sh ? scrs.indexOf(sh.object as THREE.Mesh) : -1;
    } else if (hoverF >= 0) {
      hoverF = -1;
      document.body.style.cursor = '';
    }

    // ambience
    tu.uT.value = t;
    tu.uA.value = k;
    tu.uS.value = ctx.size.dpr * (ctx.size.h / 900);
    bu.uA.value = 0.26 * k;
    (lanterns.material as THREE.MeshBasicMaterial).color.copy(LANTERN).multiplyScalar(2.6 * k * (0.96 + 0.04 * Math.sin(t * 7.3)));
    halos.children.forEach((h, i) => {
      h.quaternion.copy(ctx.camera.quaternion);
      ((h as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uA.value = 0.42 * k * (0.9 + 0.1 * Math.sin(t * 2.1 + i));
    });
    if (vid && vid.paused) vid.play().catch(() => {});

    if (hoverS >= 0) {
      const n = +applied[0][hoverS] + +applied[1][hoverS] + +applied[2][hoverS];
      const txt = `${MARKETS[hoverS].name} · ${n} of 3 live`;
      if (txt !== hoverText) storeTag.textContent = hoverText = txt;
      pin(ctx, storeTag, group.localToWorld(v0.copy(storePos[hoverS]).setY(storePos[hoverS].y - 0.78)));
    }
    flag(storeTag, 'on', hoverS >= 0);
    if (!ctx.size.narrow) {
      pin(ctx, tagTeam, group.localToWorld(v0.copy(teamC)));
      pin(ctx, tagBoard, group.localToWorld(v0.copy(board.position).setY(board.position.y + 0.66)));
    }
  }

  return {
    group,
    update,
    sleep() {
      (group.userData.video as HTMLVideoElement | undefined)?.pause();
      live = false;
      hoverF = hoverS = -1;
      downAt.f = -1;
      document.body.style.cursor = '';
    },
    act(name, arg) {
      // act=flip-101 : lever states as three digits
      // capture self-test: a real click on lever N of the 3D board
      if (name === 'simtap')
        setTimeout(() => {
          const w = levers[Number(arg) || 0].hit.getWorldPosition(new THREE.Vector3());
          const o = ctx.project(w);
          const ev = { clientX: o.x, clientY: o.y, pointerType: 'mouse', bubbles: true };
          dispatchEvent(new PointerEvent('pointerdown', ev));
          dispatchEvent(new PointerEvent('pointerup', ev));
        }, 450);
      if (name === 'flip')
        [0, 1, 2].forEach((f) => {
          user[f] = arg[f] === '1';
        });
    },
  };
}
