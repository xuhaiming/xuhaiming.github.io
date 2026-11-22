import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Ctx, Frame } from '../../world/types';
import { clamp01, flag, seg, smooth } from '../../world/util';
import { COBALT, glowMat, lamp, metal, place, pointsMat, tag, type Station, type Tag } from './kit';

/**
 * Station 2, Backend and cloud: a service graph you can send traffic through.
 * A read goes client -> API -> cache; a hit turns back there, a miss reads through the service to
 * MySQL and warms the cache on the way home (so the next one is a hit until the TTL ring runs out).
 * A job is accepted, queued, and worked through three Lambda steps by a state machine; its write
 * invalidates the cache. Requests are points with a trail; a label rides the one you fired.
 */

const group = new THREE.Group();
let now = 0;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const N = {
  C: V(-1.85, 1.6, 0.4),
  A: V(-0.78, 1.6, 0.18),
  R: V(0.2, 2.42, 0.0),
  S: V(0.5, 1.5, -0.05),
  D: V(1.7, 1.62, -0.2),
  Q: V(-0.42, 0.74, 0.34),
  L1: V(0.38, 0.62, 0.34),
  L2: V(0.98, 0.62, 0.28),
  L3: V(1.58, 0.7, 0.16),
};
type NodeId = keyof typeof N;
const ORDER: NodeId[] = ['C', 'A', 'R', 'S', 'D', 'Q', 'L1', 'L2', 'L3'];
const EDGES: [NodeId, NodeId][] = [
  ['C', 'A'], // 0
  ['A', 'R'], // 1
  ['R', 'S'], // 2
  ['A', 'S'], // 3
  ['S', 'D'], // 4
  ['A', 'Q'], // 5
  ['Q', 'L1'], // 6
  ['L1', 'L2'], // 7
  ['L2', 'L3'], // 8
  ['L3', 'D'], // 9
  ['D', 'R'], // 10
];
const curves: THREE.QuadraticBezierCurve3[] = [];
const NE = EDGES.length;

interface Leg {
  e: number;
  dir: 1 | -1;
  wait?: number;
  say?: string;
  arrive?: (r: Req) => void;
}
const TRAIL = 12;
interface Req {
  alive: boolean;
  user: boolean;
  legs: Leg[];
  i: number;
  u: number;
  wait: number;
  speed: number;
  hist: Float32Array;
  say: string;
  fresh: boolean;
}
const POOL = 30;
const reqs: Req[] = [];

const st = {
  ttl: 0,
  ttlMax: 9,
  queue: 0,
  hot: new Float32Array(ORDER.length),
  edgeHot: new Float32Array(NE),
  stage: new Float32Array(3),
  auto: 0,
  touched: -99,
  ambient: 0,
  status: '',
  build: 0,
  jobs: 0,
  writes: 0,
};

let edgeMat: THREE.ShaderMaterial;
let reqPts: THREE.Points;
let clients: THREE.Points;
let rows: THREE.Points;
let cacheDiscs: THREE.MeshStandardMaterial[] = [];
let ttlRing: THREE.Mesh;
let pods: THREE.InstancedMesh;
let podBars: THREE.InstancedMesh;
let queueSlabs: THREE.InstancedMesh;
let stageMats: THREE.MeshStandardMaterial[] = [];
let apiRing: THREE.MeshStandardMaterial;
let dbSeam: THREE.MeshStandardMaterial;
let tapRing: THREE.Mesh;
const nodeGroups: Partial<Record<NodeId, THREE.Group>> = {};
const tags: Partial<Record<NodeId, Tag>> = {};
const stageTags: Tag[] = [];
let follow: Tag;
let followReq: Req | null = null;
let statusEl: HTMLElement | null = null;
const m4 = new THREE.Matrix4();
const q4 = new THREE.Quaternion();
const s3 = new THREE.Vector3();
const p3 = new THREE.Vector3();
const c3 = new THREE.Color();
const LAMBDAS: NodeId[] = ['L1', 'L2', 'L3'];

/* ---------- routes ---------- */

const hit = (id: NodeId, k = 1) => {
  const i = ORDER.indexOf(id);
  st.hot[i] = Math.max(st.hot[i], k);
};
function status(text: string) {
  if (st.status === text || !statusEl) return;
  st.status = text;
  statusEl.textContent = text;
}

const HIT_TAIL: Leg[] = [
  { e: 1, dir: -1, say: 'cache hit', arrive: () => hit('A') },
  { e: 0, dir: -1, say: '200 · from Redis', arrive: (r) => r.user && status('Cache hit. Redis answered; the service and MySQL never heard about it.') },
];
const MISS_TAIL: Leg[] = [
  { e: 2, dir: 1, say: 'cache miss', arrive: () => hit('S') },
  { e: 4, dir: 1, say: 'SELECT …', wait: 0.45, arrive: () => hit('D') },
  { e: 4, dir: -1, say: 'row', arrive: () => hit('S') },
  {
    e: 2,
    dir: -1,
    say: 'SET · TTL',
    arrive: (r) => {
      hit('R');
      if (r.user) st.ttl = st.ttlMax;
    },
  },
  { e: 1, dir: -1, say: 'now cached', arrive: () => hit('A') },
  { e: 0, dir: -1, say: '200 · from MySQL', arrive: (r) => r.user && status('Cache miss. Read through the service to MySQL, then stored in Redis. Send another: it takes the short path.') },
];
const READ: Leg[] = [
  { e: 0, dir: 1, say: 'GET /product/42', arrive: () => hit('A') },
  {
    e: 1,
    dir: 1,
    say: 'GET /product/42',
    wait: 0.25,
    arrive: (r) => {
      hit('R');
      const isHit = r.user ? st.ttl > 0 : Math.random() < 0.72;
      r.legs = isHit ? HIT_TAIL : MISS_TAIL;
      r.i = -1;
    },
  },
];
const INVAL: Leg[] = [
  {
    e: 10,
    dir: 1,
    say: 'invalidate',
    arrive: () => {
      hit('R');
      st.ttl = 0;
      status('Pipeline finished: validated, transformed, stored. The write cleared the cache, so the next read is a miss.');
    },
  },
];
const WORK: Leg[] = [
  {
    e: 6,
    dir: 1,
    say: 'step 1 · validate',
    wait: 0.8,
    arrive: () => {
      st.queue = Math.max(0, st.queue - 1);
      st.stage[0] = 1;
      hit('L1');
    },
  },
  { e: 7, dir: 1, say: 'step 2 · transform', wait: 0.8, arrive: () => ((st.stage[1] = 1), hit('L2')) },
  { e: 8, dir: 1, say: 'step 3 · store', wait: 0.8, arrive: () => ((st.stage[2] = 1), hit('L3')) },
  {
    e: 9,
    dir: 1,
    say: 'INSERT …',
    arrive: (r) => {
      hit('D');
      spawn(INVAL, r.user, 1.5);
    },
  },
];
const ACK: Leg[] = [{ e: 0, dir: -1, say: '202 · accepted' }];
const JOB: Leg[] = [
  { e: 0, dir: 1, say: 'POST /import', arrive: () => hit('A') },
  {
    e: 5,
    dir: 1,
    say: 'enqueue',
    arrive: (r) => {
      hit('Q');
      st.queue += 1;
      spawn(ACK, false, 2.2);
      const w = spawn(WORK, r.user, 1.25);
      if (w) w.wait = 0.9;
      if (r.user) status('Accepted and queued: the caller already has its answer. Step Functions now runs three Lambda steps in order.');
    },
  },
];

function spawn(legs: Leg[], user: boolean, speed: number) {
  const r = reqs.find((x) => !x.alive);
  if (!r) return null;
  r.alive = true;
  r.user = user;
  r.legs = legs;
  r.i = 0;
  r.u = 0;
  r.wait = 0;
  r.speed = speed;
  r.say = legs[0].say ?? '';
  r.fresh = true;
  if (user) followReq = r;
  return r;
}

function fire(kind: 'read' | 'job') {
  if (kind === 'read') {
    spawn(READ, true, 1.25);
    status(st.ttl > 0 ? 'Request sent. The cache is warm…' : 'Request sent. The cache is cold…');
  } else {
    spawn(JOB, true, 1.3);
    status('Job submitted…');
  }
  hit('C');
}

/* ---------- build ---------- */

function init(ctx: Ctx, panel: HTMLElement, layer: HTMLElement) {
  statusEl = panel.querySelector('.r-status');
  panel.querySelectorAll<HTMLButtonElement>('[data-fire]').forEach((b) =>
    b.addEventListener('click', () => {
      st.touched = now;
      fire(b.dataset.fire as 'read' | 'job');
    }),
  );

  for (let i = 0; i < POOL; i++) reqs.push({ alive: false, user: false, legs: READ, i: 0, u: 0, wait: 0, speed: 1, hist: new Float32Array(TRAIL * 3), say: '', fresh: true });

  // ---- edges: thin tubes with a travelling dash ----
  const parts: THREE.BufferGeometry[] = [];
  EDGES.forEach(([a, b], i) => {
    const A = N[a];
    const B = N[b];
    const mid = A.clone().lerp(B, 0.5);
    const d = B.clone().sub(A);
    mid.z += 0.16 + d.length() * 0.06;
    mid.y += (i === 10 ? 0.5 : i === 3 ? -0.14 : Math.abs(d.y) > 0.3 ? 0 : -0.08) * 1;
    if (i === 5 || i === 9) mid.x += i === 5 ? -0.3 : 0.25;
    const c = new THREE.QuadraticBezierCurve3(A, mid, B);
    curves.push(c);
    const g = new THREE.TubeGeometry(c, 40, i === 10 || i === 3 ? 0.006 : 0.011, 6, false);
    const id = new Float32Array(g.attributes.position.count).fill(i);
    g.setAttribute('aEdge', new THREE.BufferAttribute(id, 1));
    parts.push(g);
  });
  edgeMat = new THREE.ShaderMaterial({
    uniforms: { uHot: { value: st.edgeHot }, uDraw: { value: new Float32Array(NE) }, uTime: { value: 0 }, uCol: { value: COBALT.clone() } },
    vertexShader: /* glsl */ `
      uniform float uHot[${NE}]; uniform float uDraw[${NE}];
      attribute float aEdge; varying float vU, vHot, vDraw, vE;
      void main() { int e = int(aEdge + 0.5); vHot = uHot[e]; vDraw = uDraw[e]; vU = uv.x; vE = aEdge;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCol; varying float vU, vHot, vDraw, vE;
      void main() {
        if (vU > vDraw) discard;
        float dash = smoothstep(0.0, 0.12, fract(vU * 7.0 - uTime * 0.35)) * smoothstep(0.55, 0.4, fract(vU * 7.0 - uTime * 0.35));
        float quiet = (vE > 9.5 || (vE > 2.5 && vE < 3.5)) ? 0.45 : 1.0;
        vec3 c = uCol * (0.22 + dash * 0.55) * quiet + mix(uCol, vec3(1.0), 0.55) * vHot * 2.6;
        c *= 1.0 + smoothstep(0.04, 0.0, vDraw - vU) * step(vDraw, 0.995) * 5.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  group.add(new THREE.Mesh(mergeGeometries(parts)!, edgeMat));

  // ---- nodes ----
  const dark = metal('#0a1124', 0.36, 0.8);
  const node = (id: NodeId) => {
    const g = new THREE.Group();
    g.position.copy(N[id]);
    nodeGroups[id] = g;
    group.add(g);
    return g;
  };

  // clients: people, as points
  {
    const g = node('C');
    const n = [90, 150, 200][ctx.tier];
    const P = new Float32Array(n * 3);
    const S = new Float32Array(n);
    const A = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = Math.pow(Math.random(), 0.6) * 0.3;
      const th = Math.random() * 6.283;
      const ph = Math.acos(2 * Math.random() - 1);
      P[i * 3] = r * Math.sin(ph) * Math.cos(th);
      P[i * 3 + 1] = r * Math.cos(ph) * 1.15;
      P[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      S[i] = 1.2 + Math.random() * 2.6;
      A[i] = 0.35 + Math.random() * 0.65;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    pg.setAttribute('aS', new THREE.BufferAttribute(S, 1));
    pg.setAttribute('aA', new THREE.BufferAttribute(A, 1));
    clients = new THREE.Points(pg, pointsMat('#cfe0ff'));
    g.add(clients);
    tapRing = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.415, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#9db8ff').multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    g.add(tapRing);
  }
  // API gateway: a hex slab facing the room
  {
    const g = node('A');
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 6), dark);
    slab.rotation.x = Math.PI / 2;
    apiRing = lamp(COBALT, 1.2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 6, 6), apiRing);
    ring.position.z = 0.055;
    ring.rotation.z = Math.PI / 6;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 6), apiRing);
    core.rotation.x = Math.PI / 2;
    g.add(slab, ring, core);
    g.rotation.y = 0.25;
  }
  // cache: four platters of memory and a TTL ring
  {
    const g = node('R');
    for (let i = 0; i < 4; i++) {
      const m = lamp('#7fa0ff', 0.1);
      m.color.set('#0a1124');
      m.metalness = 0.7;
      m.roughness = 0.35;
      cacheDiscs.push(m);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 48), m);
      d.position.y = (i - 1.5) * 0.058;
      g.add(d);
    }
    ttlRing = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.325, 96, 1),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uArc: { value: 0 }, uCol: { value: new THREE.Color('#9db8ff') } },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uArc; uniform vec3 uCol; varying vec2 vP; void main(){ float a = atan(vP.x, vP.y) / 6.2831853 + 0.5; float on = step(a, uArc); gl_FragColor = vec4(uCol * (0.12 + on * 1.9), 1.0); }',
      }),
    );
    ttlRing.rotation.x = -Math.PI / 2;
    ttlRing.position.y = -0.14;
    g.add(ttlRing);
    g.rotation.x = 0.5;
  }
  // services: six containers
  {
    const g = node('S');
    pods = new THREE.InstancedMesh(new RoundedBoxGeometry(0.15, 0.15, 0.15, 3, 0.025), dark, 6);
    podBars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.016, 0.012), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 6);
    podBars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pods.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 6; i++) podBars.setColorAt(i, c3.set('#3f6bff'));
    g.add(pods, podBars);
    g.rotation.y = -0.3;
  }
  // database: a drum of rows
  {
    const g = node('D');
    dbSeam = lamp(COBALT, 1);
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.13, 48), dark);
      d.position.y = (i - 1) * 0.16;
      g.add(d);
      if (i < 2) {
        const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.03, 48), dbSeam);
        sm.position.y = (i - 0.5) * 0.16;
        g.add(sm);
      }
    }
    const n = 84;
    const P = new Float32Array(n * 3);
    const S = new Float32Array(n);
    const A = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i / 28) * 6.283 + Math.floor(i / 28) * 0.11;
      P[i * 3] = Math.cos(a) * 0.34;
      P[i * 3 + 1] = (Math.floor(i / 28) - 1) * 0.16;
      P[i * 3 + 2] = Math.sin(a) * 0.34;
      S[i] = 1.5;
      A[i] = 0.3 + 0.5 * Math.random();
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    pg.setAttribute('aS', new THREE.BufferAttribute(S, 1));
    pg.setAttribute('aA', new THREE.BufferAttribute(A, 1));
    rows = new THREE.Points(pg, pointsMat('#9db8ff'));
    g.add(rows);
  }
  // queue: messages waiting in line
  {
    const g = node('Q');
    queueSlabs = new THREE.InstancedMesh(new RoundedBoxGeometry(0.045, 0.17, 0.17, 2, 0.012), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.5, emissive: '#3f6bff', emissiveIntensity: 0 }), 5);
    for (let i = 0; i < 5; i++) {
      m4.makeTranslation((i - 2) * 0.075, 0, 0);
      queueSlabs.setMatrixAt(i, m4);
      queueSlabs.setColorAt(i, c3.set('#0a1124'));
    }
    g.add(queueSlabs);
    g.rotation.y = 0.35;
  }
  // the pipeline: three Lambda steps on one rail
  LAMBDAS.forEach((id, i) => {
    const g = node(id);
    const m = lamp('#9db8ff', 0.15);
    stageMats.push(m);
    const shell = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), dark);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), m);
    shell.scale.set(1, 1.15, 1);
    (shell.material as THREE.Material).side = THREE.FrontSide;
    const cage = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 6, 48), m);
    cage.rotation.x = Math.PI / 2;
    shell.visible = false;
    g.add(shell, core, cage);
    const frame = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), new THREE.MeshPhysicalMaterial({ color: '#0d1630', roughness: 0.15, metalness: 0.3, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 2 }));
    frame.scale.set(1, 1.15, 1);
    g.add(frame);
    g.userData.spin = i;
    const stg = tag(layer, ['validate', 'transform', 'store'][i], 'r-mini');
    stageTags.push(stg);
  });

  // ---- request points ----
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POOL * TRAIL * 3), 3));
  rg.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(POOL * TRAIL), 1));
  rg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(POOL * TRAIL), 1));
  reqPts = new THREE.Points(rg, pointsMat('#e4ecff'));
  reqPts.frustumCulled = false;
  reqPts.renderOrder = 5;
  group.add(reqPts);

  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.2), glowMat());
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.012, 0.1);
  (glow.material as THREE.ShaderMaterial).uniforms.uA.value = 0.16;
  group.add(glow);

  // ---- labels ----
  const T: [NodeId, string, number][] = [
    ['C', '<b>Clients</b>', 0.46],
    ['A', '<b>API</b><i>Node.js · GraphQL</i>', 0.4],
    ['R', '<b>Cache</b><i>Redis</i>', 0.36],
    ['S', '<b>Services</b><i>Python · ECS / EKS</i>', -0.34],
    ['D', '<b>Database</b><i>MySQL</i>', 0.42],
    ['Q', '<b>Queue</b>', -0.26],
    ['L2', '<b>Pipeline</b><i>Step Functions · Lambda</i>', -0.36],
  ];
  for (const [id, html, dy] of T) {
    const tg = tag(layer, html, `r-node ${dy < 0 ? 'below' : ''}`);
    tg.el.dataset.dy = String(dy);
    tags[id] = tg;
  }
  follow = tag(layer, '', 'r-follow');
}

/* ---------- frame ---------- */

function step(r: Req, dt: number) {
  if (r.wait > 0) {
    r.wait -= dt;
    return;
  }
  const leg = r.legs[r.i];
  const c = curves[leg.e];
  r.u += (dt * r.speed) / Math.max(0.3, c.getLength());
  st.edgeHot[leg.e] = Math.max(st.edgeHot[leg.e], r.user ? 1 : 0.12);
  if (r.u >= 1) {
    const legs = r.legs;
    r.u = 0;
    r.wait = leg.wait ?? 0;
    leg.arrive?.(r);
    r.i += 1;
    if (r.legs === legs && r.i >= legs.length) {
      r.alive = false;
      if (followReq === r) followReq = null;
      return;
    }
    r.say = r.legs[r.i].say ?? r.say;
    // hold the head on the node it just reached
    c.getPoint(leg.dir > 0 ? 1 : 0, p3);
    return;
  }
  c.getPoint(leg.dir > 0 ? r.u : 1 - r.u, p3);
}

function update(s: number, on: number, pre: number, f: Frame, ctx: Ctx) {
  const { t, dt } = f;
  now = t;
  const active = on > 0.6;
  const build = Math.max(smooth(seg(s, 0.0, 0.42)), pre);
  st.build = build;

  // ---- traffic ----
  if (active && build > 0.95) {
    st.ambient -= dt;
    if (st.ambient <= 0 && !ctx.still) {
      st.ambient = 0.5 + Math.random() * 0.5;
      spawn(READ, false, 2.3 + Math.random() * 0.6);
    }
    // idle: the exhibit demonstrates itself until someone takes over
    if (t - st.touched > 14 && !ctx.shot) {
      const before = st.auto;
      st.auto += dt;
      const at = (x: number) => before < x && st.auto >= x;
      if (at(1.2)) fire('read');
      if (at(7)) fire('read');
      if (at(12)) fire('job');
      if (st.auto > 24) st.auto = 0;
    } else st.auto = 0;
  }
  st.ttl = Math.max(0, st.ttl - dt);
  for (let i = 0; i < st.hot.length; i++) st.hot[i] *= Math.exp(-dt * 2.4);
  for (let i = 0; i < NE; i++) st.edgeHot[i] *= Math.exp(-dt * 3.2);
  for (let i = 0; i < 3; i++) st.stage[i] *= Math.exp(-dt * 0.55);

  const P = reqPts.geometry.attributes.position as THREE.BufferAttribute;
  const S = reqPts.geometry.attributes.aS as THREE.BufferAttribute;
  const A = reqPts.geometry.attributes.aA as THREE.BufferAttribute;
  const pa = P.array as Float32Array;
  for (let k = 0; k < POOL; k++) {
    const r = reqs[k];
    const o = k * TRAIL;
    if (!r.alive) {
      for (let j = 0; j < TRAIL; j++) A.setX(o + j, 0);
      continue;
    }
    const leg = r.legs[Math.min(r.i, r.legs.length - 1)];
    curves[leg.e].getPoint(leg.dir > 0 ? r.u : 1 - r.u, p3);
    step(r, dt);
    if (!r.alive) continue;
    if (r.fresh) {
      for (let j = 0; j < TRAIL; j++) r.hist.set([p3.x, p3.y, p3.z], j * 3);
      r.fresh = false;
    } else {
      r.hist.copyWithin(3, 0, (TRAIL - 1) * 3);
      r.hist[0] = p3.x;
      r.hist[1] = p3.y;
      r.hist[2] = p3.z;
    }
    pa.set(r.hist, o * 3);
    for (let j = 0; j < TRAIL; j++) {
      const k1 = 1 - j / TRAIL;
      S.setX(o + j, (r.user ? 9 : 3.4) * (0.35 + 0.65 * k1));
      A.setX(o + j, (r.user ? 1 : 0.42) * k1 * k1);
    }
  }
  P.needsUpdate = S.needsUpdate = A.needsUpdate = true;
  (reqPts.material as THREE.ShaderMaterial).uniforms.uS.value = ctx.size.dpr * (ctx.size.h / 900);
  (reqPts.material as THREE.ShaderMaterial).uniforms.uA.value = build;

  // ---- edges ----
  edgeMat.uniforms.uTime.value = t;
  const draw = edgeMat.uniforms.uDraw.value as Float32Array;
  for (let i = 0; i < NE; i++) draw[i] = clamp01(build * (NE + 5) * 0.5 - i * 0.5);

  // ---- nodes ----
  ORDER.forEach((id, i) => {
    const g = nodeGroups[id]!;
    const k = smooth(clamp01(build * 2.4 - i * 0.14));
    const sc = k * (1 + st.hot[i] * 0.1);
    g.scale.setScalar(Math.max(0.0001, sc));
    g.visible = k > 0.001;
    g.position.y = N[id].y + Math.sin(t * 0.8 + i * 1.7) * 0.012 - (1 - k) * 0.25;
  });
  const sz = ctx.size.dpr * (ctx.size.h / 900);
  clients.rotation.y = t * 0.25;
  (clients.material as THREE.ShaderMaterial).uniforms.uS.value = sz * (1 + st.hot[0] * 0.6);
  tapRing.quaternion.copy(ctx.camera.quaternion).premultiply(q4.copy(group.getWorldQuaternion(q4)).invert());
  const ph = (t * 0.5) % 1;
  tapRing.scale.setScalar(0.75 + ph * 0.5);
  (tapRing.material as THREE.MeshBasicMaterial).opacity = active ? (1 - ph) * 0.8 : 0;
  rows.rotation.y = -t * 0.3 - st.writes;
  (rows.material as THREE.ShaderMaterial).uniforms.uS.value = sz * (1 + st.hot[4] * 1.2);
  apiRing.emissiveIntensity = 0.7 + st.hot[1] * 4;
  dbSeam.emissiveIntensity = 0.9 + st.hot[4] * 6;
  const warm = st.ttl / st.ttlMax;
  cacheDiscs.forEach((m, i) => (m.emissiveIntensity = 0.08 + (warm > 0 ? 1.3 + 0.5 * Math.sin(t * 3 + i) : 0) * smooth(clamp01(warm * 6 - (3 - i) * 0.4)) + st.hot[2] * 2.2));
  (ttlRing.material as THREE.ShaderMaterial).uniforms.uArc.value = warm;
  nodeGroups.R!.rotation.y = t * 0.2;
  for (let i = 0; i < 6; i++) {
    const hop = Math.max(0, Math.sin(t * 9 - i * 1.1)) * st.hot[3] * 0.05;
    const x = ((i % 3) - 1) * 0.19;
    const y = (Math.floor(i / 3) - 0.5) * 0.19 + hop;
    m4.makeTranslation(x, y, 0);
    pods.setMatrixAt(i, m4);
    m4.makeTranslation(x, y - 0.035, 0.078);
    podBars.setMatrixAt(i, m4);
    const busy = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 2.1);
    podBars.setColorAt(i, c3.setRGB(0.25 + busy * 0.5 + st.hot[3] * 3, 0.42 + busy * 0.6 + st.hot[3] * 3, 1 + busy + st.hot[3] * 3));
  }
  pods.instanceMatrix.needsUpdate = podBars.instanceMatrix.needsUpdate = true;
  if (podBars.instanceColor) podBars.instanceColor.needsUpdate = true;
  for (let i = 0; i < 5; i++) queueSlabs.setColorAt(i, i < st.queue ? c3.setRGB(0.6, 0.85, 2.6) : c3.setRGB(0.04, 0.066, 0.14));
  if (queueSlabs.instanceColor) queueSlabs.instanceColor.needsUpdate = true;
  LAMBDAS.forEach((id, i) => {
    const g = nodeGroups[id]!;
    g.rotation.y = t * (0.4 + st.stage[i] * 2.5) + i;
    stageMats[i].emissiveIntensity = 0.9 + st.stage[i] * 5;
  });

  // ---- labels ----
  const la = on * smooth(seg(build, 0.7, 1));
  for (const id of Object.keys(tags) as NodeId[]) {
    const tg = tags[id]!;
    tg.at.copy(N[id]);
    tg.at.y += Number(tg.el.dataset.dy);
    group.localToWorld(tg.at);
    place(ctx, tg, la, dt);
    flag(tg.el, 'hot', st.hot[ORDER.indexOf(id)] > 0.25);
  }
  stageTags.forEach((tg, i) => {
    tg.at.copy(N[(['L1', 'L2', 'L3'] as NodeId[])[i]]);
    tg.at.y += 0.3;
    group.localToWorld(tg.at);
    place(ctx, tg, la * clamp01(st.stage[i] * 2.5), dt);
  });
  if (followReq && followReq.alive) {
    follow.at.set(followReq.hist[0], followReq.hist[1] + 0.13, followReq.hist[2]);
    group.localToWorld(follow.at);
    if (follow.in.textContent !== followReq.say) follow.in.textContent = followReq.say;
    place(ctx, follow, la, dt);
  } else place(ctx, follow, 0, dt);
}

function tap() {
  st.touched = now;
  fire('read');
}

function act(name: string) {
  st.touched = now + 1e6;
  const run = (legs: Leg[], i: number, u: number, say: string) => {
    const r = spawn(legs, true, 0.0001)!;
    r.i = i;
    r.u = u;
    r.say = say;
  };
  if (name === 'miss') {
    run(MISS_TAIL, 1, 0.55, 'SELECT …');
    st.hot[3] = 1;
    status('Cache miss. Read through the service to MySQL, then stored in Redis. Send another: it takes the short path.');
  }
  if (name === 'hit') {
    st.ttl = 6;
    run(HIT_TAIL, 0, 0.5, 'cache hit');
    status('Cache hit. Redis answered; the service and MySQL never heard about it.');
  }
  if (name === 'job') {
    st.queue = 2;
    st.stage[0] = 0.5;
    st.stage[1] = 1.6;
    run(WORK, 2, 0.4, 'step 3 · store');
    status('Accepted and queued: the caller already has its answer. Step Functions now runs three Lambda steps in order.');
  }
}

export const backend: Station = { group, init, update, tap, act };
