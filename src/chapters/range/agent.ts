import * as THREE from 'three';
import type { Ctx, Frame } from '../../world/types';
import { clamp01, flag, seg, smooth } from '../../world/util';
import { COBALT, glowMat, lamp, metal, NOISE, place, pointsMat, rayDist, tag, type Station, type Tag } from './kit';

/**
 * Station 3, AI agents: the loop as a machine. A ring with four stops (plan, call a tool, observe,
 * repeat), the model at its hub, a guardrail gate before the tool call, three tool sockets outside
 * the ring and a band of ticks that records every step (the trace). Pick a socket: one iteration
 * runs, the arm reaches for that tool, the observation flows back into the model, an eval pip lights.
 */

const group = new THREE.Group();
const rig = new THREE.Group();
let now = 0;
const R = 0.95;
const CX = -0.5;
const CY = 1.62;
const D2R = Math.PI / 180;
const A_PLAN = 90 * D2R;
const A_GATE = 45 * D2R;
const A_CALL = 0;
const A_OBS = -90 * D2R;
const A_REP = -180 * D2R;
const onRing = (a: number, out: THREE.Vector3, r = R) => out.set(Math.cos(a) * r, Math.sin(a) * r, 0);

const TOOLS = [
  { key: 'docs', name: 'Docs', kit: 'RAG · vector search', task: '“How do refunds work?”', plan: 'search the docs', call: 'docs.search("refund policy")', obs: '3 passages came back', ang: 30 },
  { key: 'mcp', name: 'MCP server', kit: 'MCP · tool calling', task: '“Open a ticket for this bug.”', plan: 'use the tracker over MCP', call: 'tracker.create_issue({…})', obs: 'issue created', ang: 0 },
  { key: 'api', name: 'Internal tool', kit: 'tool calling', task: '“Where is order 1042?”', plan: 'look the order up', call: 'orders.get(1042)', obs: 'status: shipped', ang: -30 },
];
const SOCK_R = 1.78;

const st = {
  run: -1, // 0..1 while an iteration runs
  tool: 0,
  nextAuto: 0,
  touched: -99,
  idleA: A_PLAN,
  tokA: A_PLAN,
  out: 0, // token offset along the arm 0..1
  step: -1,
  evals: 0,
  loops: 0,
  core: 0,
  gate: 0,
  sock: [0, 0, 0],
  arm: [0, 0, 0],
  ticks: new Float32Array(72),
  frozen: false,
};

let track: THREE.Mesh;
let groove: THREE.ShaderMaterial;
let core: THREE.Mesh;
let shell: THREE.Points;
let ticks: THREE.InstancedMesh;
let pips: THREE.InstancedMesh;
let token: THREE.Points;
let flows: THREE.Points;
let gateA: THREE.Mesh;
let gateB: THREE.Mesh;
const stops: THREE.Mesh[] = [];
const stopMats: THREE.MeshStandardMaterial[] = [];
const socks: THREE.Group[] = [];
const sockMats: THREE.MeshStandardMaterial[] = [];
const arms: THREE.Mesh[] = [];
const armCurves: THREE.QuadraticBezierCurve3[] = [];
const sockPos: THREE.Vector3[] = [];
const stopTags: Tag[] = [];
const sockTags: Tag[] = [];
let coreTag: Tag;
let gateTag: Tag;
let traceTag: Tag;
let evalTag: Tag;
let traceEls: HTMLElement[] = [];
let taskEl: HTMLElement | null = null;
let panelEl: HTMLElement;
const hist = new Float32Array(16 * 3);
const v = new THREE.Vector3();
const w = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const sc = new THREE.Vector3();
const c3 = new THREE.Color();
const Z = new THREE.Vector3(0, 0, 1);

function start(tool: number) {
  st.tool = tool;
  st.run = 0;
  st.step = -1;
  st.ticks.fill(0);
  const T = TOOLS[tool];
  if (taskEl) taskEl.textContent = T.task;
  const txt = [`pick a tool: ${T.plan}`, 'allowed for this user', T.call, T.obs, 'enough to answer? if not, go round again'];
  traceEls.forEach((el, i) => {
    el.querySelector('span')!.textContent = txt[i];
    el.classList.remove('on');
  });
  panelEl.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.tool) === tool)));
}

function init(ctx: Ctx, panel: HTMLElement, layer: HTMLElement) {
  panelEl = panel;
  taskEl = panel.querySelector('.r-task b');
  traceEls = Array.from(panel.querySelectorAll<HTMLElement>('.r-trace li'));
  panel.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) =>
    b.addEventListener('click', () => {
      st.touched = now;
      start(Number(b.dataset.tool));
    }),
  );

  rig.position.set(CX, CY, 0);
  group.add(rig);
  const dark = metal('#0a1124', 0.34, 0.85);

  // ---- the ring ----
  track = new THREE.Mesh(new THREE.TorusGeometry(R, 0.034, 14, 160), dark);
  rig.add(track);
  const back = new THREE.Mesh(new THREE.TorusGeometry(R, 0.012, 8, 160), metal('#0a1124', 0.3, 0.9));
  back.position.z = -0.09;
  rig.add(back);
  groove = new THREE.ShaderMaterial({
    uniforms: { uTok: { value: 0 }, uRun: { value: 0 }, uCol: { value: COBALT.clone() }, uDraw: { value: 1 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTok, uRun, uDraw; uniform vec3 uCol; varying vec3 vP;
      void main() {
        float a = atan(vP.y, vP.x);
        float turn = fract((1.5707963 - a) / 6.2831853);     // 0 at the top, clockwise
        if (turn > uDraw) discard;
        float behind = fract((a - uTok) / 6.2831853);        // clockwise travel: the trail is at larger angles
        float trail = exp(-behind * 7.0);
        vec3 c = uCol * (0.35 + trail * mix(1.2, 4.5, uRun)) + vec3(1.0) * trail * trail * uRun * 1.5;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const gv = new THREE.Mesh(new THREE.TorusGeometry(R, 0.009, 6, 200), groove);
  gv.position.z = 0.032;
  rig.add(gv);

  // ---- the trace: a band of ticks, one lit for every step taken ----
  ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.07, 0.012), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 72);
  ticks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rig.add(ticks);

  // ---- the model ----
  core = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uK: { value: 0 }, uCol: { value: COBALT.clone() } },
      vertexShader: /* glsl */ `
        uniform float uT, uK; varying vec3 vN, vV, vP; ${NOISE}
        void main() {
          float n = vnoise(position * 5.0 + uT * 0.6);
          vec3 p = position * (1.0 + (n - 0.5) * (0.07 + uK * 0.12));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uT, uK; uniform vec3 uCol; varying vec3 vN, vV, vP; ${NOISE}
        void main() {
          float fr = pow(clamp(1.0 - dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.2);
          float n = vnoise(vP * 9.0 + vec3(0.0, uT * 0.8, 0.0));
          float veins = smoothstep(0.52, 0.6, n) * (0.4 + uK * 1.6);
          vec3 c = vec3(0.01, 0.02, 0.06) + uCol * (fr * (1.3 + uK * 3.0) + veins) + vec3(1.0) * fr * fr * uK * 1.2;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  rig.add(core);
  {
    const n = [220, 420, 600][ctx.tier];
    const P = new Float32Array(n * 3);
    const S = new Float32Array(n);
    const A = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * 6.283;
      const ph = Math.acos(2 * Math.random() - 1);
      const r = 0.38 + Math.random() * 0.1;
      P[i * 3] = r * Math.sin(ph) * Math.cos(th);
      P[i * 3 + 1] = r * Math.cos(ph);
      P[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      S[i] = 0.8 + Math.random() * 1.8;
      A[i] = 0.25 + Math.random() * 0.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('aS', new THREE.BufferAttribute(S, 1));
    g.setAttribute('aA', new THREE.BufferAttribute(A, 1));
    shell = new THREE.Points(g, pointsMat('#b9ceff'));
    rig.add(shell);
  }
  // spokes: plan leaves the model at the top, the observation enters at the bottom
  for (const a of [A_PLAN, A_OBS]) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, R - 0.36, 6), metal('#101a38', 0.3, 0.9));
    onRing(a, sp.position, (R + 0.36) / 2);
    rig.add(sp);
  }

  // ---- the four stops ----
  [A_PLAN, A_CALL, A_OBS, A_REP].forEach((a, i) => {
    const m = lamp('#9db8ff', 0.4);
    stopMats.push(m);
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.062, 24, 16), m);
    onRing(a, s.position);
    s.position.z = 0.05;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 32), dark);
    collar.position.copy(s.position);
    stops.push(s);
    rig.add(s, collar);
    const tg = tag(layer, `<s>${i + 1}</s><b>${['Plan', 'Call a tool', 'Observe', 'Repeat'][i]}</b>`, `r-stop p${i}`);
    stopTags.push(tg);
  });

  // ---- guardrail: a gate across the track ----
  const plate = new THREE.BoxGeometry(0.1, 0.05, 0.075);
  const gm = lamp('#9db8ff', 0.5);
  gm.color.set('#0c1530');
  gm.metalness = 0.8;
  gm.roughness = 0.3;
  gateA = new THREE.Mesh(plate, gm);
  gateB = new THREE.Mesh(plate, gm);
  rig.add(gateA, gateB);

  // ---- tool sockets and the arm that reaches them ----
  TOOLS.forEach((T, i) => {
    const g = new THREE.Group();
    const a = T.ang * D2R;
    onRing(a, g.position, SOCK_R);
    g.position.x += 0.0;
    sockPos.push(g.position.clone());
    g.rotation.z = a;
    const m = lamp('#9db8ff', 0.3);
    sockMats.push(m);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.16, 32, 1, true), dark);
    cup.rotation.z = Math.PI / 2;
    (cup.material as THREE.Material).side = THREE.DoubleSide;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 32), dark);
    base.rotation.z = Math.PI / 2;
    base.position.x = 0.08;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 40), m);
    lip.rotation.y = Math.PI / 2;
    lip.position.x = -0.08;
    g.add(cup, base, lip);
    // what lives in the socket
    if (i === 0) {
      for (let k = 0; k < 4; k++) {
        const page = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.17, 0.13), k === 0 ? m : dark);
        page.position.set(0.14 + k * 0.035, 0, 0);
        page.rotation.x = k * 0.12;
        g.add(page);
      }
    } else if (i === 1) {
      for (const dy of [-0.05, 0.05]) {
        const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 12), m);
        prong.rotation.z = Math.PI / 2;
        prong.position.set(0.17, dy, 0);
        g.add(prong);
      }
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.12), dark);
      body.position.x = 0.29;
      g.add(body);
    } else {
      const nut = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.032, 6, 6), dark);
      nut.rotation.y = Math.PI / 2;
      nut.position.x = 0.17;
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 12), m);
      pin.rotation.z = Math.PI / 2;
      pin.position.x = 0.18;
      g.add(nut, pin);
    }
    socks.push(g);
    rig.add(g);

    const from = onRing(A_CALL, new THREE.Vector3());
    from.x += 0.06;
    const to = g.position.clone();
    to.x -= Math.cos(a) * 0.14;
    to.y -= Math.sin(a) * 0.14;
    const mid = from.clone().lerp(to, 0.5);
    mid.x += 0.08;
    mid.z += 0.12;
    mid.y += Math.sin(a) * 0.05;
    const cv = new THREE.QuadraticBezierCurve3(from, mid, to);
    armCurves.push(cv);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(cv, 32, 0.014, 8), lamp('#9db8ff', 2.4));
    arms.push(arm);
    rig.add(arm);

    const tg = tag(layer, `<b>${T.name}</b><i>${T.kit}</i>`, 'r-sock', true);
    tg.el.addEventListener('click', () => {
      st.touched = now;
      start(i);
    });
    sockTags.push(tg);
  });

  // ---- evals: five pips that fill as loops pass their checks ----
  pips = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 5);
  for (let i = 0; i < 5; i++) {
    onRing((202 + i * 9) * D2R, v, R + 0.42);
    m4.makeTranslation(v.x, v.y, 0);
    pips.setMatrixAt(i, m4);
  }
  rig.add(pips);

  // ---- token and flows ----
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
  tg.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(16).map((_, i) => 11 * (1 - i / 18)), 1));
  tg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(16).map((_, i) => Math.pow(1 - i / 16, 2)), 1));
  token = new THREE.Points(tg, pointsMat('#eaf0ff'));
  token.frustumCulled = false;
  token.renderOrder = 6;
  rig.add(token);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36 * 3), 3));
  fg.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(36).fill(3.2), 1));
  fg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(36), 1));
  flows = new THREE.Points(fg, pointsMat('#cfe0ff'));
  flows.frustumCulled = false;
  rig.add(flows);

  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3), glowMat());
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.012, 0.2);
  (glow.material as THREE.ShaderMaterial).uniforms.uA.value = 0.16;
  group.add(glow);
  // the stand: a mast behind the ring down to a foot
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, CY - R + 0.08, 16), dark);
  mast.position.set(CX, (CY - R + 0.08) / 2, -0.09);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.08, 48), metal('#080c18', 0.45, 0.6));
  foot.position.set(CX, 0.04, -0.09);
  group.add(mast, foot);

  coreTag = tag(layer, '<b>Model</b><i>GPT and Gemini APIs</i>', 'r-node below');
  gateTag = tag(layer, '<b>Guardrails</b>', 'r-node small');
  traceTag = tag(layer, '<b>Tracing</b>', 'r-node small left');
  evalTag = tag(layer, '<b>Evals</b>', 'r-node small left');
  start(0);
  st.run = -1;
}

function flow(k: number, a: THREE.Vector3, b: THREE.Vector3, amount: number, t: number) {
  const P = flows.geometry.attributes.position as THREE.BufferAttribute;
  const A = flows.geometry.attributes.aA as THREE.BufferAttribute;
  for (let j = 0; j < 12; j++) {
    const u = (j / 12 + t * 0.9) % 1;
    const i = k * 12 + j;
    P.setXYZ(i, a.x + (b.x - a.x) * u + Math.sin(j * 5.1 + t * 3) * 0.02, a.y + (b.y - a.y) * u + Math.cos(j * 3.7 + t * 2) * 0.02, 0.04 + Math.sin(j * 2.3) * 0.03);
    A.setX(i, amount * Math.sin(u * Math.PI));
  }
}

function update(s: number, on: number, pre: number, f: Frame, ctx: Ctx) {
  const { t, dt } = f;
  now = t;
  const active = on > 0.6;
  const build = Math.max(smooth(seg(s, 0.0, 0.45)), pre);
  const b1 = smooth(seg(build, 0.0, 0.45)); // ring
  const b2 = smooth(seg(build, 0.3, 0.6)); // model
  const b3 = smooth(seg(build, 0.5, 0.8)); // stops, gate, trace
  const b4 = smooth(seg(build, 0.65, 1)); // sockets

  // ---- one iteration ----
  if (active && build > 0.97 && st.run < 0 && !ctx.shot && !ctx.still && t - st.touched > 9) {
    st.nextAuto -= dt;
    if (st.nextAuto <= 0) {
      start((st.tool + (st.loops ? 1 : 0)) % 3);
      st.nextAuto = 3.5;
    }
  }
  if (st.run >= 0 && !st.frozen) {
    st.run += dt / 7.5;
    if (st.run >= 1) {
      st.run = -1;
      st.loops += 1;
      st.idleA = A_REP;
    }
  }
  const u = st.run;
  const running = u >= 0;
  let stepNow = -1;
  let out = 0;
  let corePulse = 0;
  let planFlow = 0;
  let obsFlow = 0;
  let armK = 0;
  if (running) {
    if (u < 0.12) {
      st.tokA = A_PLAN;
      corePulse = Math.sin(seg(u, 0, 0.12) * Math.PI);
      planFlow = corePulse;
      stepNow = 0;
    } else if (u < 0.3) {
      st.tokA = A_PLAN + (A_CALL - A_PLAN) * smooth(seg(u, 0.12, 0.3));
      stepNow = st.tokA < A_GATE + 0.12 ? 1 : 0;
    } else if (u < 0.56) {
      st.tokA = A_CALL;
      armK = smooth(seg(u, 0.3, 0.37)) * (1 - smooth(seg(u, 0.52, 0.56)));
      out = smooth(seg(u, 0.36, 0.43)) * (1 - smooth(seg(u, 0.47, 0.54)));
      stepNow = 2;
    } else if (u < 0.72) {
      st.tokA = A_CALL + (A_OBS - A_CALL) * smooth(seg(u, 0.56, 0.72));
      stepNow = 2;
    } else if (u < 0.85) {
      st.tokA = A_OBS;
      obsFlow = Math.sin(seg(u, 0.72, 0.85) * Math.PI);
      corePulse = obsFlow * 0.8;
      stepNow = 3;
    } else {
      st.tokA = A_OBS + (A_REP - A_OBS) * smooth(seg(u, 0.85, 1));
      stepNow = u > 0.93 ? 4 : 3;
    }
    if (stepNow > st.step) {
      for (let i = st.step + 1; i <= stepNow; i++) traceEls[i]?.classList.add('on');
      st.step = stepNow;
      if (stepNow === 4) st.evals = (st.evals % 5) + 1;
    }
    // every step leaves a record on the trace band
    const turn = ((((A_PLAN - st.tokA) / (Math.PI * 2)) % 1) + 1) % 1;
    const ti = Math.floor(turn * 72) % 72;
    st.ticks[ti] = 1;
  } else {
    st.idleA -= dt * 0.35;
    st.tokA = st.idleA;
  }
  st.core += (corePulse - st.core) * Math.min(1, dt * 6);
  st.gate += ((running && Math.abs(st.tokA - A_GATE) < 0.35 ? 1 : 0) - st.gate) * Math.min(1, dt * 8);
  for (let i = 0; i < 3; i++) {
    st.arm[i] += ((running && st.tool === i ? armK : 0) - st.arm[i]) * Math.min(1, dt * 12);
    st.sock[i] += ((running && st.tool === i && u > 0.4 && u < 0.52 ? 1 : 0) - st.sock[i]) * Math.min(1, dt * 7);
  }

  // ---- ring ----
  rig.rotation.y = (active && !ctx.still ? ctx.pointer.x * 0.12 : 0) + Math.sin(t * 0.3) * 0.02;
  rig.rotation.x = active && !ctx.still ? -ctx.pointer.y * 0.06 : 0;
  const idx = track.geometry.index!.count;
  track.geometry.setDrawRange(0, Math.floor((idx * b1) / 6) * 6);
  groove.uniforms.uDraw.value = b1;
  groove.uniforms.uTok.value = st.tokA;
  groove.uniforms.uRun.value = running ? 1 : 0.25;

  for (let i = 0; i < 72; i++) {
    const a = A_PLAN - (i / 72) * Math.PI * 2;
    const lit = st.ticks[i];
    onRing(a, v, R + 0.2 + lit * 0.025);
    q.setFromAxisAngle(Z, a - Math.PI / 2);
    const show = clamp01(b3 * 72 * 1.2 - i);
    sc.set(1, (i % 6 === 0 ? 1.5 : 1) * show + 0.0001, 1);
    m4.compose(v, q, sc);
    ticks.setMatrixAt(i, m4);
    ticks.setColorAt(i, lit > 0 ? c3.setRGB(0.9 + lit, 1.2 + lit, 2.6) : c3.setRGB(0.05, 0.085, 0.2));
  }
  ticks.instanceMatrix.needsUpdate = true;
  if (ticks.instanceColor) ticks.instanceColor.needsUpdate = true;

  // ---- model ----
  const cu = (core.material as THREE.ShaderMaterial).uniforms;
  cu.uT.value = t;
  cu.uK.value = st.core;
  core.scale.setScalar(Math.max(0.0001, b2 * (1 + st.core * 0.08)));
  shell.rotation.y = t * 0.25;
  shell.rotation.x = Math.sin(t * 0.2) * 0.4;
  shell.scale.setScalar(Math.max(0.0001, b2 * (1 + st.core * 0.25)));
  const sz = ctx.size.dpr * (ctx.size.h / 900);
  (shell.material as THREE.ShaderMaterial).uniforms.uS.value = sz * (1 + st.core);

  // ---- stops, gate ----
  const stopAt = [A_PLAN, A_CALL, A_OBS, A_REP];
  stops.forEach((sMesh, i) => {
    let d = Math.abs(((st.tokA - stopAt[i] + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    d = Math.max(0, 1 - d / 0.5);
    stopMats[i].emissiveIntensity = 0.35 + d * (running ? 5 : 1.2);
    sMesh.scale.setScalar(Math.max(0.0001, b3 * (1 + d * 0.25)));
  });
  for (const [g, sgn] of [
    [gateA, 1],
    [gateB, -1],
  ] as [THREE.Mesh, number][]) {
    onRing(A_GATE, g.position, R + sgn * (0.052 + st.gate * 0.12));
    g.position.z = 0.02;
    g.rotation.z = A_GATE;
    g.scale.setScalar(Math.max(0.0001, b3));
  }
  (gateA.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + st.gate * 2.5;

  // ---- sockets, arms ----
  socks.forEach((g, i) => {
    const a = TOOLS[i].ang * D2R;
    const slide = (1 - smooth(clamp01(b4 * 1.6 - i * 0.3))) * 0.8;
    onRing(a, g.position, SOCK_R + slide);
    g.visible = b4 > 0.01;
    sockMats[i].emissiveIntensity = 0.35 + st.sock[i] * 6 + (st.tool === i && running ? 0.8 : 0) + (active && !running ? 0.35 + 0.35 * Math.sin(t * 2.2 - i * 0.9) : 0);
    const arm = arms[i];
    const cnt = arm.geometry.index!.count;
    arm.geometry.setDrawRange(0, Math.floor((cnt * st.arm[i]) / 6) * 6);
    arm.visible = st.arm[i] > 0.01;
  });

  // ---- evals ----
  for (let i = 0; i < 5; i++) pips.setColorAt(i, i < st.evals ? c3.setRGB(1.2, 1.7, 3.2) : c3.setRGB(0.05, 0.085, 0.2));
  if (pips.instanceColor) pips.instanceColor.needsUpdate = true;
  pips.visible = b3 > 0.5;

  // ---- token ----
  onRing(st.tokA, v);
  v.z = 0.05;
  if (out > 0) armCurves[st.tool].getPoint(out, v);
  hist.copyWithin(3, 0, 45);
  hist[0] = v.x;
  hist[1] = v.y;
  hist[2] = v.z;
  (token.geometry.attributes.position.array as Float32Array).set(hist);
  token.geometry.attributes.position.needsUpdate = true;
  const tu = (token.material as THREE.ShaderMaterial).uniforms;
  tu.uS.value = sz * (running ? 1 : 0.6);
  tu.uA.value = b3 * (running ? 1 : 0.5);

  // ---- flows ----
  flow(0, w.set(0, 0.34, 0), onRing(A_PLAN, v), planFlow, t);
  flow(1, onRing(A_OBS, v), w.set(0, -0.34, 0), obsFlow, t);
  if (running) flow(2, sockPos[st.tool], onRing(A_CALL, v), smooth(seg(u, 0.44, 0.48)) * (1 - smooth(seg(u, 0.54, 0.6))), t);
  else flow(2, v, v, 0, t);
  flows.geometry.attributes.position.needsUpdate = true;
  flows.geometry.attributes.aA.needsUpdate = true;
  (flows.material as THREE.ShaderMaterial).uniforms.uS.value = sz;

  // ---- labels ----
  const la = on * smooth(seg(build, 0.85, 1));
  const off = [
    [0, 0.2],
    [0.0, 0.0],
    [0, -0.2],
    [-0.16, 0],
  ];
  stopTags.forEach((tg, i) => {
    onRing(stopAt[i], tg.at, i === 1 ? R + 0.3 : R);
    tg.at.x += off[i][0];
    tg.at.y += off[i][1];
    rig.localToWorld(tg.at);
    place(ctx, tg, la, dt);
    flag(tg.el, 'hot', running && [0, 2, 3, 4].indexOf(stepNow) === i);
  });
  sockTags.forEach((tg, i) => {
    tg.at.copy(socks[i].position);
    tg.at.x += 0.46;
    rig.localToWorld(tg.at);
    place(ctx, tg, la, dt);
    flag(tg.el, 'on', running && st.tool === i);
  });
  coreTag.at.set(0, -0.5, 0.1);
  rig.localToWorld(coreTag.at);
  place(ctx, coreTag, la, dt);
  onRing(A_GATE, gateTag.at, R + 0.36);
  rig.localToWorld(gateTag.at);
  place(ctx, gateTag, la, dt);
  flag(gateTag.el, 'hot', st.gate > 0.4);
  onRing(128 * D2R, traceTag.at, R + 0.34);
  rig.localToWorld(traceTag.at);
  place(ctx, traceTag, la, dt);
  onRing(220 * D2R, evalTag.at, R + 0.56);
  rig.localToWorld(evalTag.at);
  place(ctx, evalTag, la, dt);
}

function tap(ctx: Ctx) {
  // nearest socket to the pointer, otherwise the next tool
  const ray = ctx.ray().ray;
  let best = -1;
  let bd = 0.45;
  socks.forEach((g, i) => {
    const d = rayDist(ray, g.getWorldPosition(v));
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  st.touched = now;
  start(best >= 0 ? best : (st.tool + 1) % 3);
}

function act(name: string) {
  st.touched = now + 1e6;
  const m = /^(docs|mcp|api)(?:-(\d+))?$/.exec(name);
  if (!m) return;
  start(['docs', 'mcp', 'api'].indexOf(m[1]));
  const at = Number(m[2] ?? 42) / 100;
  // replay quickly up to the requested point so the trace band and steps are filled
  for (let x = 0; x < at; x += 0.004) {
    st.run = x;
    const a = x < 0.12 ? A_PLAN : x < 0.3 ? A_PLAN + (A_CALL - A_PLAN) * smooth(seg(x, 0.12, 0.3)) : x < 0.56 ? A_CALL : x < 0.72 ? A_CALL + (A_OBS - A_CALL) * smooth(seg(x, 0.56, 0.72)) : x < 0.85 ? A_OBS : A_OBS + (A_REP - A_OBS) * smooth(seg(x, 0.85, 1));
    const turn = ((((A_PLAN - a) / (Math.PI * 2)) % 1) + 1) % 1;
    st.ticks[Math.floor(turn * 72) % 72] = 1;
  }
  st.run = at;
  st.frozen = true;
}

export const agent: Station = { group, init, update, tap, act };
