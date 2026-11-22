import * as THREE from 'three';
import type { Chapter, Ctx, Frame } from '../../world/types';
import { clamp01, css, damp, flag, inOutCubic, mix, seg, show, smooth, win } from '../../world/util';
import { mountConsole, OBS_AT, TOOL_COLOR, type Run, type ToolId, type View } from './agent';
import { buildSet, type StageSet } from './set';
import { EXIT, Rift, exitLine, exitOpen, exitWalk } from '../../world/Rift';

/**
 * Ask the site. The hero becomes the agent: the visitor's question turns into a cluster of points,
 * splits into sub-goals, travels from his hand to the instruments around him (one per chapter) and
 * comes back as packets that merge into the answer. Everything in the scene is a pure function of
 * the console's playhead (step, progress), so any step of a finished run can be replayed from the log.
 */

const group = new THREE.Group();
const VIOLET = new THREE.Color('#9b7bff');
/** the way on to the last chapter: a rift of ice-white light behind him; he turns and walks into it */
const ICE = new THREE.Color('#cfe6ff');
const BG = new THREE.Color('#040309');
const RIFT_Z = -3.3;

const TOOLS: ToolId[] = ['range', 'systems', 'scale', 'path', 'about', 'links'];
/** what the status pill names while a call runs: the place, never the function */
const TARGET_NAME: Record<string, string> = { range: 'Range', systems: 'Systems', scale: 'Work at scale', path: 'the path', about: 'About', links: 'his links', stage: 'this page', all: 'every chapter' };
const ARCH = [205, 152, 108, 72, 28, -25].map((d) => (d * Math.PI) / 180);
const DEPTH = [0.5, 0.05, -0.5, -0.5, 0.05, 0.5];
const PROP = 0.56;

interface Tool {
  id: ToolId;
  color: THREE.Color;
  root: THREE.Group;
  holder: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  glow: THREE.Sprite;
  pos: THREE.Vector3;
  heat: number;
  open: number;
  spin: number;
  tag: HTMLElement | null;
  obsEl: HTMLElement | null;
  fnEl: HTMLElement | null;
  fn: string;
  tagW: number;
  obs: string;
  phase: number;
}

let set: StageSet;
let rift: Rift;
const tools: Tool[] = [];
let rings: THREE.InstancedMesh;
let pts: THREE.Points;
let arcs: THREE.Points;
let lamp: THREE.PointLight;
let core: THREE.Sprite;
let rim: THREE.DirectionalLight;
let agent: ReturnType<typeof mountConsole>;
let view: View;

let side: HTMLElement | null = null;
let head: HTMLElement | null = null;
let card: HTMLElement | null = null;
let tagsEl: HTMLElement | null = null;
let stateEl: HTMLElement | null = null;
let inputEl: HTMLElement | null = null;
let goalEls: HTMLElement[] = [];

/* ---------- particles ---------- */
let N = 0;
let pPos: Float32Array;
let pCol: Float32Array;
let pSize: Float32Array;
let off: Float32Array; // point in the unit ball
let dir: Float32Array; // point on the unit sphere (even spread)
let lat: Float32Array; // lattice coordinate inside a packet, -1..1
let spot: Float32Array; // where a point lands on the floor when a search comes back empty
let seed: Float32Array;
let grp: Uint8Array;
let seq = -1;

const ARC_N = 46;
const ARC_MAX = 6;
const BEADS = 9; // per instrument, running along its inner ring
const ARC_ALL = ARC_MAX * ARC_N;
let aPos: Float32Array;
let aCol: Float32Array;
let aSize: Float32Array;

/* ---------- scratch ---------- */
const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
const hand = new THREE.Vector3();
const C = new THREE.Vector3(); // where the question gathers
const O = new THREE.Vector3(); // where the answer forms
const inW = new THREE.Vector3();
const outW = new THREE.Vector3();
const lampTo = new THREE.Vector3();
const lampCol = new THREE.Color();
const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const q4 = new THREE.Quaternion();
const qT = new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0);
const e4 = new THREE.Euler();
const s4 = new THREE.Vector3();
const col = new THREE.Color();
const BASE = new THREE.Color(0.8, 0.7, 1.15);
const WHITE = new THREE.Color(1, 1, 1);
const GREY = new THREE.Color(0.42, 0.4, 0.52);
const STAGE_AT = new THREE.Vector3(0.15, 0.03, 1.15);
const sub = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const slot = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const ctrl = Array.from({ length: 7 }, () => new THREE.Vector3());
const gcol = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
/** TOOL_COLOR parsed once (the lamp takes these every frame of a run) */
const TOOL_C = Object.fromEntries(Object.entries(TOOL_COLOR).map(([k, v]) => [k, new THREE.Color(v)])) as Record<keyof typeof TOOL_COLOR, THREE.Color>;
const scr = { x: 0, y: 0, z: 0 };
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

let hover = -1;
let activeAt = -1;
let lookY = 0;
let stageHeat = 0;
let typing = 0;
let arrive = 0;
let lastState = '';
let frameNo = 0;
// tag widths, cached: measuring after the per-frame transform writes would force a style pass
const tagRO = new ResizeObserver((es) => {
  for (const e of es) {
    const tool = tools.find((tl) => tl.tag === e.target);
    if (tool) tool.tagW = e.borderBoxSize?.[0]?.inlineSize ?? (e.target as HTMLElement).offsetWidth;
  }
});
let beadScale = 1;

const outBack = (t: number) => {
  t = clamp01(t);
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

function toolIndex(id: string) {
  return TOOLS.indexOf(id as ToolId);
}

/* ================================================================== */

function init(ctx: Ctx, el: HTMLElement) {
  const params = new URLSearchParams(location.search);
  side = el.querySelector<HTMLElement>('.a-side');
  head = el.querySelector<HTMLElement>('.a-head');
  card = el.querySelector<HTMLElement>('.a-card');
  tagsEl = el.querySelector<HTMLElement>('.a-tags');
  stateEl = el.querySelector<HTMLElement>('.a-state');
  inputEl = el.querySelector<HTMLElement>('.a-form');
  goalEls = Array.from(el.querySelectorAll<HTMLElement>('.a-goals span'));

  agent = mountConsole(el, {
    quick: ctx.shot,
    act: ctx.shot ? params.get('act') : null,
    step: ctx.shot && params.has('step') ? Number(params.get('step')) : null,
    stepU: ctx.shot && params.has('u') ? Number(params.get('u')) : null,
    live: ctx.shot ? params.get('live') : null,
    ff: Number(params.get('ff') ?? 3),
    replay: ctx.shot && params.has('replay') ? Number(params.get('replay')) : null,
    // 'chapter' or 'chapter@progress'
    go: (id) => {
      const [c, at] = id.split('@');
      ctx.goTo(c, at ? Number(at) : 0.02);
    },
  });
  view = agent.view;
  el.dataset.mounted = '';

  /* ---- light: a cool key from the console side, a violet rim, and a lamp that rides the packets ---- */
  const key = new THREE.DirectionalLight('#ece6ff', 1.9);
  key.position.set(-3.2, 3.6, 4.2);
  rim = new THREE.DirectionalLight(VIOLET, 9);
  rim.position.set(2.6, 2.4, -4);
  const kick = new THREE.DirectionalLight('#6a54e0', 3.2);
  kick.position.set(-3.5, 1.2, -3);
  const fill = new THREE.HemisphereLight('#8f82ff', '#07060d', 0.7);
  lamp = new THREE.PointLight('#ffffff', 0, 6.5, 1.8);
  group.add(key, rim, kick, fill, lamp);

  set = buildSet(ctx, group);
  rift = new Rift(ctx, { color: ICE, height: 3.6, width: 1.25, light: 6, floor: 0.7 });
  rift.object3D.position.set(0, 0, RIFT_Z);
  group.add(rift.object3D);

  /* ---- the instruments ---- */
  const glowTex = radialTexture();
  TOOLS.forEach((id, i) => {
    const color = new THREE.Color(TOOL_COLOR[id]);
    const root = new THREE.Group();
    const holder = new THREE.Group();
    root.add(holder);
    // stand-in until the generated prop arrives (or if it never does)
    const mat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.55), roughness: 0.38, metalness: 0.35, flatShading: true, emissive: color, emissiveIntensity: 0.05 });
    const stand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mat);
    holder.add(stand);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    glow.scale.setScalar(1.5);
    glow.renderOrder = -1;
    root.add(glow);
    group.add(root);
    const tool: Tool = { id, color, root, holder, mats: [mat], glow, pos: new THREE.Vector3(), heat: 0, open: 0, spin: i * 1.3, tag: el.querySelector<HTMLElement>(`.a-tag[data-tool="${id}"]`), obsEl: el.querySelector<HTMLElement>(`.a-tag[data-tool="${id}"] .o`), obs: '', fnEl: el.querySelector<HTMLElement>(`.a-tag[data-tool="${id}"] i`), fn: '', tagW: 80, phase: i * 1.7 };
    tools.push(tool);
    if (tool.tag) tagRO.observe(tool.tag);

    ctx
      .glb(`/assets/ask/tool-${id}.glb`)
      .then(({ scene }) => {
        const mats: THREE.MeshStandardMaterial[] = [];
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const sm = m.material as THREE.MeshStandardMaterial;
          sm.envMapIntensity = 2.6;
          sm.emissive = color.clone().lerp(WHITE, 0.55);
          sm.emissiveMap = sm.map;
          sm.emissiveIntensity = 0.05;
          mats.push(sm);
        });
        holder.remove(stand);
        stand.geometry.dispose();
        holder.add(scene);
        tool.mats = mats;
      })
      .catch(() => {});
  });

  core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  core.renderOrder = 4;
  group.add(core);

  // each instrument sits in a three-ring gimbal that lies flat when closed and unfolds when called
  rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.011, 6, 96), new THREE.MeshBasicMaterial({ color: '#ffffff' }), TOOLS.length * 3);
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rings.frustumCulled = false;
  for (let i = 0; i < TOOLS.length * 3; i++) rings.setColorAt(i, col.set('#000000'));
  group.add(rings);

  /* ---- the points that carry the question ---- */
  N = [700, 1300, 2000][ctx.tier];
  pPos = new Float32Array(N * 3);
  pCol = new Float32Array(N * 3);
  pSize = new Float32Array(N);
  off = new Float32Array(N * 3);
  dir = new Float32Array(N * 3);
  lat = new Float32Array(N * 3);
  spot = new Float32Array(N * 3);
  seed = new Float32Array(N);
  grp = new Uint8Array(N);
  let sd = 20261;
  const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    do {
      x = rnd() * 2 - 1;
      y = rnd() * 2 - 1;
      z = rnd() * 2 - 1;
    } while (x * x + y * y + z * z > 1);
    off.set([x, y, z], i * 3);
    const fy = 1 - ((i + 0.5) / N) * 2;
    const fr = Math.sqrt(1 - fy * fy);
    const fa = i * 2.399963;
    dir.set([Math.cos(fa) * fr, fy, Math.sin(fa) * fr], i * 3);
    const a = rnd() * Math.PI * 2;
    const r = 0.5 + rnd() * 1.5;
    spot.set([Math.cos(a) * r, 0.02 + rnd() * 0.03, Math.sin(a) * r * 0.8 + 0.5], i * 3);
    seed[i] = rnd();
  }
  pts = new THREE.Points(pointGeometry(pPos, pCol, pSize), pointMaterial(1));
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  group.add(pts);

  aPos = new Float32Array((ARC_ALL + 6 * BEADS) * 3);
  aCol = new Float32Array((ARC_ALL + 6 * BEADS) * 3);
  aSize = new Float32Array(ARC_ALL + 6 * BEADS);
  arcs = new THREE.Points(pointGeometry(aPos, aCol, aSize), pointMaterial(0.8));
  arcs.frustumCulled = false;
  arcs.renderOrder = 2;
  group.add(arcs);

  // pressing an instrument in the scene asks the question that belongs to it
  addEventListener('click', (e) => {
    if (performance.now() - activeAt > 200 || hover < 0) return;
    if ((e.target as Element).closest?.('a, button, input, label, [data-hit], .top')) return;
    agent.askTool(TOOLS[hover]);
  });
}

function pointGeometry(pos: Float32Array, color: Float32Array, size: Float32Array) {
  const g = new THREE.BufferGeometry();
  for (const [name, arr, n] of [
    ['position', pos, 3],
    ['aCol', color, 3],
    ['aSize', size, 1],
  ] as const) {
    const a = new THREE.BufferAttribute(arr, n);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(name, a);
  }
  return g;
}

function pointMaterial(soft: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uS: { value: 1 }, uSoft: { value: soft } },
    vertexShader: /* glsl */ `
      uniform float uS; attribute vec3 aCol; attribute float aSize; varying vec3 vCol;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uS * (7.0 / -mv.z);
        vCol = aCol * step(0.001, aSize);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uSoft; varying vec3 vCol;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.5 - 0.42 * uSoft, d);
        if (a < 0.004) discard;
        gl_FragColor = vec4(vCol * a, 1.0);
      }`,
  });
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.28)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ================================================================== */

/** quadratic curve a -> (c) -> b */
function bez(out: THREE.Vector3, a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number) {
  const k = 1 - t;
  out.x = k * k * a.x + 2 * k * t * c.x + t * t * b.x;
  out.y = k * k * a.y + 2 * k * t * c.y + t * t * b.y;
  out.z = k * k * a.z + 2 * k * t * c.z + t * t * b.z;
  return out;
}

function targetPos(target: string, i: number, out: THREE.Vector3) {
  if (target === 'stage') return out.copy(STAGE_AT);
  if (target === 'all') return out.copy(tools[i % tools.length].pos);
  return out.copy(tools[Math.max(0, toolIndex(target))].pos);
}

/** new question: deal the points into one group per call and give each its place in a packet */
function assign(run: Run) {
  const n = run.topic.calls.length;
  const per = Math.ceil(N / n);
  // a packet is a small cube of dots; several points share a cell so each dot reads clearly
  const sideN = Math.min(6, Math.ceil(Math.cbrt(per)));
  for (let i = 0; i < N; i++) {
    grp[i] = i % n;
    const q = Math.floor(i / n) % (sideN * sideN * sideN);
    const lx = q % sideN;
    const ly = Math.floor(q / sideN) % sideN;
    const lz = Math.floor(q / (sideN * sideN));
    const d = Math.max(1, sideN - 1);
    lat[i * 3] = (lx / d) * 2 - 1;
    lat[i * 3 + 1] = (ly / d) * 2 - 1;
    lat[i * 3 + 2] = (lz / d) * 2 - 1;
  }
}

function screenToWorld(el: HTMLElement | null, fx: number, fy: number, zPlane: number, ctx: Ctx, out: THREE.Vector3) {
  if (!el) return out.set(-2, 1, zPlane);
  const r = el.getBoundingClientRect();
  ndc.set(((r.left + r.width * fx) / ctx.size.w) * 2 - 1, -(((r.top + r.height * fy) / ctx.size.h) * 2 - 1));
  ray.setFromCamera(ndc, ctx.camera);
  const o = ray.ray.origin;
  const d = ray.ray.direction;
  const t = (zPlane - o.z) / d.z;
  return out.set(o.x + d.x * t, o.y + d.y * t, zPlane);
}

/* ---------- the run, acted out ---------- */

function flow(t: number, ctx: Ctx, vis: number) {
  const run = view.run;
  const sizeAttr = pts.geometry.attributes.aSize as THREE.BufferAttribute;
  if (!run || vis < 0.01) {
    if (pSize[0] !== 0 || pSize[N - 1] !== 0 || pSize[N >> 1] !== 0) {
      pSize.fill(0);
      sizeAttr.needsUpdate = true;
    }
    return;
  }
  if (view.seq !== seq) {
    seq = view.seq;
    assign(run);
  }
  const calls = run.topic.calls;
  const nc = calls.length;
  const k = view.k;
  const u = view.u;
  const step = run.steps[k];
  const fb = run.fallback;
  const cr = Math.cos(t * 0.6);
  const sr = Math.sin(t * 0.6);
  const cr2 = Math.cos(t * 1.7);
  const sr2 = Math.sin(t * 1.7);
  const j = step.kind === 'call' ? step.ci : step.kind === 'answer' ? nc : -1;
  const answering = step.kind === 'answer';
  const m = run.merge;
  const base = 1.3 * vis;

  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    const g = grp[i];
    const s = seed[i];
    // the cloud turns slowly so nothing ever sits still
    const ox = off[i3] * cr + off[i3 + 2] * sr;
    const oy = off[i3 + 1];
    const oz = -off[i3] * sr + off[i3 + 2] * cr;
    let x = 0;
    let y = 0;
    let z = 0;
    let size = base * (0.55 + s * 0.9);
    let toolMix = 0;
    let bright = 1;
    let grey = 0;
    const tc = fb ? tools[i % 6].color : gcol[g];

    if (k === 0) {
      // the question leaves the text field and gathers in front of him
      const a = inOutCubic(clamp01(u * 1.7 - s * 0.7));
      v0.set(inW.x + oy * 0.05, inW.y + ox * 0.06, inW.z + oz * 0.05);
      v1.set(C.x + ox * 0.23, C.y + oy * 0.23, C.z + oz * 0.23);
      const k1 = 1 - a;
      x = k1 * k1 * v0.x + 2 * k1 * a * ((v0.x + v1.x) * 0.5) + a * a * v1.x;
      y = k1 * k1 * v0.y + 2 * k1 * a * (Math.max(v0.y, v1.y) + 0.35 + s * 0.3) + a * a * v1.y;
      z = k1 * k1 * v0.z + 2 * k1 * a * (v1.z + 0.5) + a * a * v1.z;
      if (a <= 0.001) size = 0;
      bright = 1.1;
    } else if (k === 1) {
      // plan: the cluster tightens, then splits into one sub-goal per call
      const tight = smooth(seg(u, 0, 0.38));
      const r = mix(0.23, 0.13, tight);
      const sp = inOutCubic(clamp01(seg(u, 0.4, 1) * 1.35 - s * 0.35));
      const sg = sub[g];
      const ax = off[i3] * cr2 + off[i3 + 2] * sr2;
      const az = -off[i3] * sr2 + off[i3 + 2] * cr2;
      const bx = mix(ox, ax, tight * (1 - sp));
      const bz = mix(oz, az, tight * (1 - sp));
      x = mix(C.x + bx * r, sg.x + ox * 0.1, sp);
      y = mix(C.y + oy * r, sg.y + oy * 0.1, sp) + Math.sin(sp * Math.PI) * 0.06 * (s - 0.5);
      z = mix(C.z + bz * r, sg.z + oz * 0.1, sp);
      toolMix = sp * 0.5;
    } else if (!answering && g > j) {
      const sg = sub[g];
      x = sg.x + ox * 0.1;
      y = sg.y + oy * 0.1;
      z = sg.z + oz * 0.1;
      toolMix = 0.5;
      size *= 0.9;
    } else if (!answering && g === j) {
      const call = calls[j];
      const c = ctrl[fb ? i % 6 : j];
      targetPos(call.target, i, v1);
      if (u < 0.42) {
        // out: sub-goal -> hand -> along the arc
        const a = clamp01((u / 0.42) * 1.5 - s * 0.5);
        if (a < 0.24) {
          const b = smooth(a / 0.24);
          const sg = sub[g];
          x = mix(sg.x + ox * 0.1, hand.x + ox * 0.03, b);
          y = mix(sg.y + oy * 0.1, hand.y + oy * 0.03, b);
          z = mix(sg.z + oz * 0.1, hand.z + oz * 0.03, b);
        } else {
          const b = inOutCubic((a - 0.24) / 0.76);
          bez(v0, hand, c, v1, b);
          const w = Math.sin(b * Math.PI) * (fb ? 0.03 : 0.05) + 0.015;
          x = v0.x + ox * w;
          y = v0.y + oy * w;
          z = v0.z + oz * w;
          size *= 1 + Math.sin(b * Math.PI) * 0.35;
        }
        toolMix = 0.5 + a * 0.2;
        bright = 1.25;
      } else if (u < OBS_AT) {
        // at the instrument: drawn into a tightening orbit while it opens
        const b = (u - 0.42) / (OBS_AT - 0.42);
        const ang = s * 6.283 + t * (5 + s * 3) + b * 4;
        const r = call.target === 'stage' ? mix(0.2, 0.75, b) : mix(0.5, 0.4, b) * (0.86 + s * 0.28);
        x = v1.x + Math.cos(ang) * r;
        y = v1.y + (call.target === 'stage' ? 0.03 + s * 0.1 * (1 - b) : Math.sin(ang) * r * 0.3 + oy * 0.05);
        z = v1.z + Math.sin(ang) * r * 0.8;
        toolMix = mix(0.7, 1, b);
        bright = 0.8;
        size *= 0.8;
        if (fb) {
          // an empty search: the points lose their colour at the instrument
          grey = b;
          bright = 1.1 - b * 0.4;
        }
      } else if (!fb) {
        // back: one tight packet in the instrument's colour, along the same arc
        const b = inOutCubic(clamp01(seg(u, OBS_AT, 1) * 1.03 - s * 0.03));
        bez(v0, v1, c, slot[g], b);
        const e = mix(0.14, 0.085, smooth(seg(u, OBS_AT, OBS_AT + 0.12)));
        const lx = lat[i3] * cr2 + lat[i3 + 2] * sr2;
        const lz = -lat[i3] * sr2 + lat[i3 + 2] * cr2;
        x = v0.x + lx * e;
        y = v0.y + lat[i3 + 1] * e;
        z = v0.z + lz * e;
        toolMix = 1;
        bright = 1.9 - b * 0.4;
      } else {
        // nothing to bring back: the points fall to the floor, grey
        const b = inOutCubic(clamp01(seg(u, OBS_AT, 1) * 1.4 - s * 0.4));
        v0.set(spot[i3], spot[i3 + 1], spot[i3 + 2]);
        x = mix(v1.x + ox * 0.18, v0.x, b);
        y = mix(v1.y + oy * 0.18, v0.y, b * b) + Math.sin(b * Math.PI) * 0.25 * s;
        z = mix(v1.z + oz * 0.18, v0.z, b);
        grey = 1;
        bright = mix(0.7, 0.42, b);
        size *= mix(1, 0.75, b);
      }
    } else {
      // a packet he is holding, or (answer) the packets merging into one
      const sl = slot[g];
      let px = 0;
      let py = 0;
      let pz = 0;
      if (fb) {
        px = spot[i3];
        py = spot[i3 + 1];
        pz = spot[i3 + 2];
        grey = 1;
        bright = 0.42;
        size *= 0.75;
      } else {
        const lx = lat[i3] * cr + lat[i3 + 2] * sr;
        const lz = -lat[i3] * sr + lat[i3 + 2] * cr;
        px = sl.x + lx * 0.085;
        py = sl.y + lat[i3 + 1] * 0.085 + Math.sin(t * 1.3 + g * 2) * 0.015;
        pz = sl.z + lz * 0.085;
        toolMix = 1;
        bright = 1.5;
      }
      if (!answering) {
        x = px;
        y = py;
        z = pz;
      } else {
        const a = inOutCubic(clamp01((u / m) * 1.35 - s * 0.35));
        const breathe = 1 + 0.05 * Math.sin(t * 1.6 + s * 6);
        let qx = 0;
        let qy = 0;
        let qz = 0;
        if (fb) {
          // an honest empty hand: a thin open ring instead of a full answer
          const ang = s * 6.283 + t * 0.4;
          qx = O.x + Math.cos(ang) * 0.2;
          qy = O.y + Math.sin(ang) * 0.2;
          qz = O.z + oz * 0.02;
        } else {
          const dx = dir[i3] * cr + dir[i3 + 2] * sr;
          const dz = -dir[i3] * sr + dir[i3 + 2] * cr;
          const rr = 0.2 * breathe * (0.82 + 0.18 * s);
          qx = O.x + dx * rr;
          qy = O.y + dir[i3 + 1] * rr;
          qz = O.z + dz * rr;
        }
        const lift = Math.sin(a * Math.PI) * 0.22;
        x = mix(px, qx, a);
        y = mix(py, qy, a) + lift * (0.4 + s);
        z = mix(pz, qz, a) + lift * 0.4;
        if (fb) {
          bright = mix(0.42, 0.7, a);
          size *= mix(1, 1.2, a);
        } else {
          toolMix = mix(1, 0.72, a);
          bright = 1.15 + a * 0.15;
          size = base * (0.5 + s * 0.8);
        }
        // while the words are being typed, a thread of points runs from the answer to the console
        if (typing > 0.01 && s < 0.16) {
          const q = (t * 0.55 + s * 23) % 1;
          v0.set(qx, qy, qz);
          v1.set((qx + outW.x) * 0.5, Math.max(qy, outW.y) + 0.25, qz + 0.4);
          bez(v1, v0, v1, outW, q);
          x = mix(x, v1.x + ox * 0.02, typing);
          y = mix(y, v1.y + oy * 0.02, typing);
          z = mix(z, v1.z, typing);
          size *= mix(1, Math.sin(q * Math.PI) * 1.2, typing);
        }
      }
    }

    pPos[i3] = x;
    pPos[i3 + 1] = y;
    pPos[i3 + 2] = z;
    pSize[i] = size;
    const tw = bright * (0.85 + 0.15 * Math.sin(t * 3 + s * 40));
    const r0 = mix(BASE.r, tc.r * 1.5 + 0.08, toolMix);
    const g0 = mix(BASE.g, tc.g * 1.5 + 0.08, toolMix);
    const b0 = mix(BASE.b, tc.b * 1.5 + 0.08, toolMix);
    pCol[i3] = mix(r0, GREY.r, grey) * tw;
    pCol[i3 + 1] = mix(g0, GREY.g, grey) * tw;
    pCol[i3 + 2] = mix(b0, GREY.b, grey) * tw;
  }
  pts.geometry.attributes.position.needsUpdate = true;
  pts.geometry.attributes.aCol.needsUpdate = true;
  sizeAttr.needsUpdate = true;
}

/** dotted traces between his hand and every instrument the run has touched */
function trace(t: number, vis: number) {
  const run = view.run;
  const sizeAttr = arcs.geometry.attributes.aSize as THREE.BufferAttribute;
  aSize.fill(0);
  if (run && vis > 0.01 && view.k >= 2) {
    const calls = run.topic.calls;
    const step = run.steps[view.k];
    const j = step.kind === 'call' ? step.ci : calls.length;
    const u = view.u;
    let a = 0;
    for (let c = 0; c <= Math.min(j, calls.length - 1); c++) {
      const call = calls[c];
      const many = call.target === 'all' ? 6 : 1;
      for (let w = 0; w < many && a < ARC_MAX; w++, a++) {
        const cur = c === j;
        targetPos(call.target, w, v1);
        const tc = call.target === 'all' ? tools[w].color : gcol[c];
        const cp = ctrl[call.target === 'all' ? w : c];
        // how far the lit part reaches, and which way it is flowing
        const reach = cur ? clamp01(u / 0.36) : 1;
        const back = !cur || u > OBS_AT;
        const live = cur ? (u < 0.42 ? 1 : u < OBS_AT ? 0.7 : 1 - smooth(seg(u, 0.9, 1)) * 0.6) : 0;
        const dim = run.fallback && back ? 0.35 : 1;
        for (let d = 0; d < ARC_N; d++) {
          const f = d / (ARC_N - 1);
          const o = (a * ARC_N + d) * 3;
          bez(v0, hand, cp, v1, f);
          aPos[o] = v0.x;
          aPos[o + 1] = v0.y;
          aPos[o + 2] = v0.z;
          const dash = 0.5 + 0.5 * Math.sin((back ? f : -f) * 26 + t * 7);
          const lit = f <= reach ? 1 : 0;
          const ends = Math.sin(f * Math.PI);
          const amt = lit * (0.4 + live * (0.1 + 0.9 * dash * dash)) * (0.35 + 0.65 * ends) * dim;
          aSize[a * ARC_N + d] = (2.1 + live * 1.6 * dash) * lit * vis * (ends > 0.02 ? 1 : 0);
          aCol[o] = (tc.r + 0.06) * amt * 1.6;
          aCol[o + 1] = (tc.g + 0.06) * amt * 1.6;
          aCol[o + 2] = (tc.b + 0.06) * amt * 1.6;
        }
      }
    }
  }
  // beads on each instrument's inner ring: slow when idle, quick when it is lit
  const st = Math.sin(0.3);
  const ct = Math.cos(0.3);
  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    const r = 0.4 * (1 + tool.open * 0.22) * beadScale;
    for (let b = 0; b < BEADS; b++) {
      const n = ARC_ALL + i * BEADS + b;
      const lead = b / BEADS;
      const ang = tool.spin * 1.4 + tool.phase - lead * 1.1;
      aPos[n * 3] = tool.pos.x + Math.cos(ang) * r;
      aPos[n * 3 + 1] = tool.pos.y + Math.sin(ang) * r * st;
      aPos[n * 3 + 2] = tool.pos.z + Math.sin(ang) * r * ct;
      const amt = (1 - lead) * (1 - lead) * (1.1 + tool.heat * 1.6) * vis;
      aSize[n] = (1.2 + (1 - lead) * 2.2) * vis * beadScale;
      aCol[n * 3] = (tool.color.r + 0.1) * amt * 1.5;
      aCol[n * 3 + 1] = (tool.color.g + 0.1) * amt * 1.5;
      aCol[n * 3 + 2] = (tool.color.b + 0.1) * amt * 1.5;
    }
  }
  arcs.geometry.attributes.position.needsUpdate = true;
  arcs.geometry.attributes.aCol.needsUpdate = true;
  sizeAttr.needsUpdate = true;
}

/* ================================================================== */

function update(f: Frame, ctx: Ctx) {
  const { p, io, t, dt } = f;
  const hero = ctx.hero;
  const narrow = ctx.size.narrow;
  activeAt = performance.now();
  frameNo++;
  agent.tick(dt);

  arrive = smooth(seg(p, 0, 0.13));
  // the exit: the instruments settle and their rings and tags go out before the rift appears
  const leave = smooth(seg(p, 0.8, 0.88));
  const here = Math.min(io, 1 - leave);
  const run = view.run;
  const step = run ? run.steps[view.k] : null;
  const calls = run ? run.topic.calls : null;
  const k = view.k;
  const u = view.u;

  /* ---- hero ---- */
  const planning = !!step && step.kind === 'plan' && (view.live || view.replay || u < 1);
  const lookTo = ctx.still ? 0 : ctx.pointer.x * 0.26;
  lookY += (lookTo - lookY) * damp(3, dt);
  const turn = smooth(seg(p, 0.855, 0.9));
  const walkOut = exitWalk(p, 0.885, -RIFT_Z);
  hero.root.position.set(0, 0, -walkOut);
  hero.root.rotation.y = mix((narrow ? 0 : -0.14) + lookY * (view.live ? 0.35 : 1), Math.PI, turn);
  hero.walkTo(walkOut);
  hero.form = Math.max(1 - arrive, 1 - io);
  hero.scatter = Math.max((1 - arrive) * 0.12, 1 - io);
  hero.tint.copy(VIOLET);
  hero.tintMix = 0.72;
  hero.glow = 1.1;
  hero.push = 1;
  hero.shadow = 0.9 * arrive;
  if (planning) hero.pose = 'think';
  hero.root.updateWorldMatrix(true, true);
  hero.bone('RightHand', hand);
  if (!hero.ready) hand.set(0.42, 0.95, 0.2);

  /* ---- camera ---- */
  const gA = view.glanceAmt;
  if (narrow) {
    camPos.set(0, mix(1.9, 1.25, arrive), mix(13.5, 10.2, arrive));
    camAim.set(0, 0.02, 0);
  } else {
    camPos.set(mix(-0.2, -0.8, arrive), mix(2.1, 1.42, arrive), mix(9.4, 7.1, arrive));
    camAim.set(mix(-0.4, -1.42, arrive), 1.3, 0);
  }
  // a slow drift with scroll so the plateau never feels frozen
  const drift = seg(p, 0.13, 0.82) - 0.5;
  camPos.x += drift * (narrow ? 0.5 : 0.9);
  camPos.y += leave * 1.3;
  camPos.z += leave * 2.4;
  // and settle on the rift he walks into
  camAim.lerp(v0.set(0, narrow ? 0.9 : 1.5, RIFT_Z), smooth(seg(p, 0.82, 0.95)) * (narrow ? 0.85 : 0.75));
  if (!ctx.still) {
    camPos.x += ctx.pointer.x * 0.24;
    camPos.y += ctx.pointer.y * 0.1;
  }
  if (view.glance && gA > 0) {
    const g = tools[toolIndex(view.glance)];
    camAim.lerp(v0.copy(g.pos), gA * 0.55);
    camPos.lerp(v0.set(g.pos.x * 0.5, g.pos.y, camPos.z - 1.6), gA * 0.3);
  }
  ctx.camera.position.copy(camPos);
  ctx.camera.lookAt(camAim);
  ctx.camera.updateMatrixWorld();

  /* ---- anchors of the run ---- */
  C.set(narrow ? -0.3 : -0.42, narrow ? 1.3 : 1.36, 0.62);
  O.set(narrow ? -0.3 : -0.46, narrow ? 1.25 : 1.3, 0.7);
  const nc = calls ? calls.length : 1;
  for (let g = 0; g < 3; g++) {
    if (nc === 1) sub[g].copy(C);
    else {
      const a = (g / nc) * Math.PI * 2 + Math.PI / 2 + (nc === 2 ? Math.PI / 4 : 0);
      sub[g].set(C.x + Math.cos(a) * 0.27, C.y + Math.sin(a) * 0.24, C.z + (g - (nc - 1) / 2) * 0.05);
    }
    slot[g].set(0.5 + g * 0.04, 0.98 + g * 0.27, 0.42 - g * 0.05);
    if (calls && calls[g]) gcol[g].set(TOOL_COLOR[calls[g].target]);
  }
  if (run && frameNo % 6 === 0) {
    screenToWorld(inputEl, 0.35, 0.5, 0.8, ctx, inW);
    const ans = run.steps[run.steps.length - 1].li ?? null;
    screenToWorld(ans ?? card, 0.6, 0.3, 0.8, ctx, outW);
  } else if (!run && frameNo % 30 === 0) screenToWorld(inputEl, 0.35, 0.5, 0.8, ctx, inW);

  /* ---- instruments ---- */
  const cx = 0;
  const cy = narrow ? 1.2 : 1.22;
  const rx = narrow ? 1.14 : 1.62;
  const ry = narrow ? 1.2 : 1.38;
  let best = -1;
  let bestD = 0.36 * 0.36;
  if (ctx.pointer.seen && !view.live && here > 0.9) {
    ndc.set(ctx.pointer.rx, ctx.pointer.ry);
    ray.setFromCamera(ndc, ctx.camera);
  }
  const cur = step && step.kind === 'call' ? step.call! : null;
  const done = !!run && !view.live && !view.replay && k === run.steps.length - 1 && u >= 1;
  const jumpTool = run?.topic.jump?.tool ?? null;
  let stageT = 0;
  if (cur && cur.target === 'stage') stageT = smooth(seg(u, 0.3, 0.45)) * (1 - smooth(seg(u, 0.75, 1)) * 0.7);

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    const rise = outBack(seg(p, 0.015 + i * 0.012, 0.11 + i * 0.012));
    const a = ARCH[i];
    const bob = ctx.still ? 0 : Math.sin(t * 0.7 + tool.phase) * 0.035;
    const sway = ctx.still ? 0 : Math.cos(t * 0.5 + tool.phase * 1.3) * 0.02;
    const sx = cx + Math.cos(a) * rx + sway;
    const sy = cy + Math.sin(a) * ry + bob;
    const sz = DEPTH[i] * (narrow ? 0.6 : 1);
    // leaving: the instruments settle into a ring on the floor around him, with a gap behind him
    // (toward the rift) so his way out and the rift's foot stay clear
    const la = 1.5 * Math.PI + ((i + 0.5) / tools.length) * Math.PI * 2;
    tool.pos.set(mix(mix(sx * 0.5, sx, rise), Math.cos(la) * 1.9, leave), mix(mix(-0.5, sy, rise), 0.3, leave), mix(sz, Math.sin(la) * 1.9, leave));
    tool.root.position.copy(tool.pos);

    // how lit and how open it should be
    let heat = 0.0;
    let open = 0;
    let obs = '';
    let fn = '';
    if (view.hot === tool.id) heat = 0.75;
    if (view.pulse === tool.id) heat = Math.max(heat, view.pulseAmt * 0.7);
    if (hover === i) heat = Math.max(heat, 0.85);
    if (run && calls) {
      const j = cur ? step!.ci : step!.kind === 'answer' ? calls.length : -1;
      for (let c = 0; c < calls.length; c++) {
        const tg = calls[c].target;
        if (tg !== tool.id && tg !== 'all') continue;
        if (tg !== 'all' && c <= j) fn = calls[c].tool;
        if (tg !== 'all' && (c < j || (c === j && u >= 0.5))) obs = calls[c].obs;
        if (c < j) heat = Math.max(heat, tg === 'all' ? 0 : 0.34);
        else if (c === j) {
          if (tg === 'all') {
            // a search that finds nothing: every instrument flickers, none opens
            const fl = smooth(seg(u, 0.3, 0.42)) * (1 - smooth(seg(u, OBS_AT, OBS_AT + 0.1)));
            heat = Math.max(heat, fl * (0.25 + 0.3 * Math.max(0, Math.sin(t * 17 + i * 2.1))));
          } else {
            const on = smooth(seg(u, 0.3, 0.44));
            heat = Math.max(heat, on * mix(1, 0.5, smooth(seg(u, 0.78, 1))));
            open = on * (1 - smooth(seg(u, 0.74, 0.96)));
          }
        }
      }
      if (done && jumpTool === tool.id) heat = Math.max(heat, 0.55 + 0.2 * Math.sin(t * 2.4));
    }
    if (view.glance === tool.id) {
      heat = Math.max(heat, gA);
      open = Math.max(open, gA);
    }
    tool.heat += (heat - tool.heat) * damp(7, dt);
    tool.open += (open - tool.open) * damp(6, dt);
    const h = tool.heat;
    const o = tool.open;

    tool.spin += dt * (0.3 + o * 3.2 + h * 0.5) * (ctx.still ? 0.3 : 1);
    tool.holder.rotation.set(Math.sin(t * 0.4 + tool.phase) * 0.12, tool.spin, 0.08);
    tool.holder.scale.setScalar(PROP * rise * (1 + o * 0.28 + h * 0.06) * (narrow ? 0.9 : 1));
    for (const mm of tool.mats) mm.emissiveIntensity = 0.14 + h * 0.12 + o * 0.05;
    tool.glow.material.opacity = (0.04 + h * 0.1 + o * 0.05) * rise * here;
    tool.glow.visible = tool.glow.material.opacity > 0.001;
    tool.glow.scale.setScalar(1.3 + o * 0.7 + h * 0.3);

    // gimbal: flat and quiet when closed, unfolded and turning when open
    for (let r = 0; r < 3; r++) {
      const rad = (0.4 + r * 0.05) * rise * (1 + o * 0.22) * (narrow ? 0.9 : 1);
      // closed: three concentric rings in one tilted plane. open: the outer two swing out of it and turn
      const un = o * (1.15 + Math.sin(tool.spin * 0.8 + r) * 0.35);
      e4.set(r === 1 ? un : 0, r === 2 ? un : 0, tool.spin * (r === 1 ? 0.5 : -0.4));
      q4.setFromEuler(e4);
      qT.setFromAxisAngle(AX, Math.PI / 2 - 0.3 + Math.sin(t * 0.45 + tool.phase) * 0.06).multiply(q4);
      q4.copy(qT);
      s4.setScalar(Math.max(0.0001, rad));
      m4.compose(v0.copy(tool.pos), q4, s4);
      rings.setMatrixAt(i * 3 + r, m4);
      const lum = (r === 0 ? 0.42 : r === 1 ? 0.2 : 0.1) + h * (r === 0 ? 1.2 : 0.6) + o * 0.5;
      col.copy(tool.color).multiplyScalar(lum * here);
      rings.setColorAt(i * 3 + r, col);
    }

    if (ctx.pointer.seen && !view.live && here > 0.9) {
      const d = ray.ray.distanceSqToPoint(tool.pos);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    set.setTool(i, tool.pos, tool.color, (0.1 + h * 0.9 + o * 0.6) * rise * here);

    // the tag that names it
    if (tool.tag) {
      // the two at the top of the arch carry their tag above, so a result never hangs over his head
      const up = !narrow && (i === 2 || i === 3);
      // the scale lamp is the tallest instrument: its tag rides higher so the object never covers it
      ctx.project(v0.copy(tool.pos).setY(tool.pos.y + (up ? (TOOLS[i] === 'scale' ? 0.72 : 0.42) : narrow ? -0.36 : -0.44)), scr);
      const half = tool.tagW / 2 + 10;
      const tx = Math.min(ctx.size.w - half, Math.max(half, scr.x));
      css(tool.tag, 'transform', `translate3d(${tx.toFixed(1)}px, ${scr.y.toFixed(1)}px, 0) translate(-50%, ${up ? '-100%' : '0'})`);
      show(tool.tag, clamp01(rise) * (1 - smooth(seg(leave, 0, 0.5))));
      flag(tool.tag, 'hot', h > 0.45);
      flag(tool.tag, 'open', o > 0.4);
      // what it returned stays pinned under it for the rest of the run
      if (obs && obs !== tool.obs && tool.obsEl) tool.obsEl.textContent = obs;
      tool.obs = obs || tool.obs;
      if (tool.fnEl) {
        if (!tool.fn) tool.fn = tool.fnEl.textContent ?? '';
        const want = fn || tool.fn;
        if (tool.fnEl.textContent !== want) tool.fnEl.textContent = want;
      }
      flag(tool.tag, 'has-obs', !!obs && !narrow);
    }
  }
  // black rings would still draw as dark ellipses: hide them once they are out
  rings.visible = here > 0.01;
  rings.instanceMatrix.needsUpdate = true;
  if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
  if (hover !== best) {
    hover = best;
    document.documentElement.style.cursor = best >= 0 ? 'pointer' : '';
  }

  /* ---- arcs: one control point per call, bowed up and toward the camera ---- */
  if (calls) {
    for (let c = 0; c < 7; c++) {
      const call = calls.length === 1 && calls[0].target === 'all' ? calls[0] : calls[Math.min(c, calls.length - 1)];
      if (c >= calls.length && call.target !== 'all') break;
      targetPos(call.target, c, v1);
      const floorish = call.target === 'stage';
      ctrl[c].set((hand.x + v1.x) * 0.5, Math.max(hand.y, v1.y) + (floorish ? 0.5 : 0.45), Math.max(hand.z, v1.z) + (floorish ? 0.5 : 0.85));
      if (c >= 6) break;
    }
  }

  /* ---- the run ---- */
  const typeTo = run && step!.kind === 'answer' && u > run.merge && u < 1 ? 1 : 0;
  typing += (typeTo - typing) * damp(5, dt);
  stageHeat += (stageT - stageHeat) * damp(7, dt);
  beadScale = clamp01(arrive * 1.2) * (narrow ? 0.9 : 1);
  flow(t, ctx, here);
  trace(t, here);
  const ps = ctx.size.dpr * (ctx.size.h / 900) * (narrow ? 0.9 : 1);
  (pts.material as THREE.ShaderMaterial).uniforms.uS.value = ps;
  (arcs.material as THREE.ShaderMaterial).uniforms.uS.value = ps;

  /* ---- the lamp rides whatever is carrying the question ---- */
  let lampI = 0;
  lampCol.copy(VIOLET);
  lampTo.copy(C);
  if (run && step) {
    if (step.kind === 'you') lampI = u * 1.4;
    else if (step.kind === 'plan') lampI = 1.6;
    else if (step.kind === 'call') {
      const cp = ctrl[run.fallback ? 2 : step.ci];
      targetPos(step.call!.target, 2, v1);
      if (u < 0.42) {
        bez(lampTo, hand, cp, v1, inOutCubic(u / 0.42));
        lampI = 1.3;
      } else if (u < OBS_AT) {
        lampTo.copy(v1);
        lampCol.copy(TOOL_C[step.call!.target]);
        lampTo.z += 0.5;
        lampI = run.fallback ? 0.8 : 1.1;
      } else {
        bez(lampTo, v1, cp, slot[Math.min(2, step.ci)], inOutCubic(seg(u, OBS_AT, 1)));
        lampCol.copy(TOOL_C[step.call!.target]);
        lampI = run.fallback ? 0.3 : 3.2;
      }
    } else {
      lampTo.copy(O);
      lampCol.copy(run.fallback ? GREY : BASE);
      lampI = run.fallback ? 0.6 : 2.2 + typing * 0.8;
    }
  }
  lamp.position.lerp(lampTo, damp(10, dt));
  lamp.color.lerp(lampCol, damp(8, dt));
  lamp.intensity += (lampI * here - lamp.intensity) * damp(6, dt);
  rim.intensity = 9 * arrive;
  core.position.copy(lamp.position);
  core.material.color.copy(lamp.color);
  core.material.opacity = Math.min(0.32, lamp.intensity * 0.06);
  core.visible = core.material.opacity > 0.001;
  core.scale.setScalar(0.75 + lamp.intensity * 0.08);

  /* ---- world ---- */
  set.update(t, here, arrive, hero.root.position, stageHeat, lamp, ctx);
  rift.update(exitOpen(p), t, ctx, exitLine(p));
  rift.cross(hero);
  ctx.bg.copy(BG);
  ctx.fog.color.copy(ctx.bg);
  ctx.fog.density = 0.01;
  ctx.post.bloom = 0.33;
  ctx.post.threshold = 0.94;
  ctx.post.vignette = 0.42;
  ctx.scene.environmentIntensity = 0.7;

  /* ---- DOM ---- */
  const cardIn = win(p, 0.05, 0.84, 0.06);
  show(side, cardIn);
  css(side, '--in', cardIn);
  if (!narrow && card && !ctx.still) {
    css(card, '--tx', (ctx.pointer.x * -5).toFixed(2) + 'px');
    css(card, '--ty', (ctx.pointer.y * 4).toFixed(2) + 'px');
  }
  css(card, '--run', run ? (view.replay ? (k + u) / run.steps.length : view.live ? (k + u) / run.steps.length : 1) : 0);
  flag(tagsEl, 'busy', view.live);

  // sub-goal labels ride their clusters between the plan and the call that spends them
  for (let g = 0; g < goalEls.length; g++) {
    const elG = goalEls[g];
    let a = 0;
    if (run && calls && g < calls.length && here > 0.5) {
      if (step!.kind === 'plan') a = smooth(seg(u, 0.62, 0.85));
      else if (step!.kind === 'call') a = g > step!.ci ? 1 : g === step!.ci ? 1 - smooth(seg(u, 0.04, 0.16)) : 0;
      if (a > 0.01) {
        if (elG.textContent !== calls[g].goal) elG.textContent = calls[g].goal;
        css(elG, '--tool', TOOL_COLOR[calls[g].target]);
        ctx.project(v0.copy(sub[g]), scr);
        const dx = nc === 1 ? 0 : Math.cos((g / nc) * Math.PI * 2 + Math.PI / 2 + (nc === 2 ? Math.PI / 4 : 0));
        css(elG, 'transform', `translate3d(${scr.x.toFixed(1)}px, ${scr.y.toFixed(1)}px, 0) translate(${dx < -0.3 ? '-100%' : dx > 0.3 ? '0%' : '-50%'}, ${dx < -0.3 || dx > 0.3 ? '-50%' : '-260%'}) translate(${dx < -0.3 ? -22 : dx > 0.3 ? 22 : 0}px, 0)`);
      }
    }
    show(elG, a);
  }

  // one line under his feet that says what he is doing
  let state = '';
  if (run && step) {
    if (view.replay) state = `Replaying step ${k + 1} of ${run.steps.length}`;
    else if (view.live || u < 1) {
      if (step.kind === 'you') state = 'Reading the question';
      else if (step.kind === 'plan') state = 'Planning';
      else if (step.kind === 'call') state = u < 0.42 ? `Checking ${TARGET_NAME[step.call!.target] ?? 'the site'}` : u < OBS_AT ? (run.fallback ? 'Searching' : 'Waiting for the tool') : run.fallback ? 'It came back empty' : 'Reading the result';
      else state = run.fallback ? 'Saying so' : u < run.merge ? 'Putting it together' : 'Answering';
    }
  }
  if (stateEl) {
    if (state && state !== lastState) stateEl.textContent = state;
    lastState = state || lastState;
    if (narrow) {
      scr.x = ctx.size.w / 2;
      scr.y = 62;
    } else ctx.project(v0.set(0, -0.06, 0.5), scr);
    css(stateEl, 'transform', `translate3d(${scr.x.toFixed(1)}px, ${scr.y.toFixed(1)}px, 0) translate(-50%, 0)`);
    show(stateEl, state ? here : 0);
    css(stateEl, '--tool', cur && u >= 0.42 ? TOOL_COLOR[cur.target] : '#9b7bff');
  }
}

function leave() {
  set?.pause();
  document.documentElement.style.cursor = '';
  hover = -1;
}

const chapter: Chapter = { id: 'ask', group, init, update, leave };
export default chapter;
