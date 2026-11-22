import * as THREE from 'three';
import type { Chapter, Ctx, Frame } from '../../world/types';
import { clamp01, css, damp, flag, inOutCubic, mix, seg, show, smooth, win } from '../../world/util';
import { COBALT, glowMat, hazeOn, place, tag, type Station, type Tag } from './kit';
import { buildHall, NEXT, type Hall } from './hall';
import { EXIT, Rift, exitCopy, exitLine, exitOpen, exitWalk } from '../../world/Rift';
import { frontend } from './frontend';
import { backend } from './backend';
import { agent } from './agent';
import { craft } from './craft';

/**
 * Range. The hero comes through the rift into a long workshop hall and walks it end to end, past
 * four benches: frontend, backend, agents, visual craft. At each he stops, the camera settles and
 * the bench comes alive as a working model of that part of the stack. Everything is a function of
 * scroll progress; what the visitor does at a bench sits on top of that.
 */

const group = new THREE.Group();
const TINT = new THREE.Color('#9db8ff');
const BG = new THREE.Color('#02030a');
const FOG = new THREE.Color('#03050d');
const NAMES = ['Frontend', 'Backend and cloud', 'AI agents', 'Visual craft'];
const ST = [
  { z: -7, side: 1 },
  { z: -16.5, side: -1 },
  { z: -26, side: 1 },
  { z: -35.5, side: -1 },
];
/** progress at which the hero arrives at / leaves each bench */
const ARR = [0.125, 0.355, 0.58, 0.785];
const LEAVE = [0.3, 0.525, 0.725, 0.875];
/** the rift to the next chapter stands across the aisle near the end wall */
const RIFT_Z = -43.5;
const EX = 2.9; // exhibit distance from the aisle centre
const SCALE = [1, 0.8, 0.86, 1];
/** phones: how much further back the camera stands for the wide exhibits */
const NARROW_D = [1, 1.05, 1.06, 1.05];
const NARROW_FOV = [50, 58, 62, 52];
// the last bench's phone shot leans toward the aisle so he stays in frame beside it
const NARROW_AX = [0, 0, 0.26, 1.0];
const stations: Station[] = [frontend, backend, agent, craft];

let hall: Hall;
let navEl: HTMLElement | null = null;
let rift: Rift;
let el: HTMLElement;
let intro: HTMLElement | null;
let panels: HTMLElement[] = [];
let navBtns: HTMLButtonElement[] = [];
let hint: HTMLElement | null;
const jump: Tag[] = [];
const spots: THREE.SpotLight[] = [];
const washes: THREE.Mesh[] = [];
let key: THREE.SpotLight;
let rim: THREE.SpotLight;
let activeIdx = -1;
let onNow = [0, 0, 0, 0];
let live = false;
let yaw = Math.PI;
let yawInit = false;
let acted = false;

// hero path: key points in (p, x, z)
const PATH: [number, number, number][] = [[0, 0, 4.2]];
ST.forEach((s, i) => {
  PATH.push([ARR[i], s.side * 0.55, s.z + 0.35], [LEAVE[i], s.side * 0.55, s.z + 0.35]);
});
PATH.push([1, 0, -46.5]);
const CUM: number[] = [0];
for (let i = 1; i < PATH.length; i++) CUM.push(CUM[i - 1] + Math.hypot(PATH[i][1] - PATH[i - 1][1], PATH[i][2] - PATH[i - 1][2]));

const heroPos = new THREE.Vector3();
const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const d = new THREE.Vector3();

function heroAt(p: number) {
  let i = 1;
  while (i < PATH.length - 1 && p > PATH[i][0]) i++;
  const A = PATH[i - 1];
  const B = PATH[i];
  const u = A[0] === B[0] ? 1 : seg(p, A[0], B[0]);
  // ease out of and into a stop; the very first and last legs are already in motion
  const e = i === 1 ? 1 - Math.pow(1 - u, 1.6) : i === PATH.length - 1 ? Math.pow(u, 1.5) : smooth(u);
  heroPos.set(mix(A[1], B[1], e), 0, mix(A[2], B[2], e));
  const moving = B[1] !== A[1] || B[2] !== A[2];
  return { dist: CUM[i - 1] + (CUM[i] - CUM[i - 1]) * e, dir: moving ? Math.atan2(B[1] - A[1], B[2] - A[2]) : NaN, u };
}

/** the composed shot for bench i */
function shot(i: number, narrow: boolean, pos: THREE.Vector3, aim: THREE.Vector3, s: number) {
  const { z, side } = ST[i];
  if (narrow) {
    // straight on, exhibit in the upper half, copy below
    const m = NARROW_D[i];
    pos.set(side * (EX - 3.15 * m), 2.15 + (m - 1) * 0.6, z + 6.9 * m);
    aim.set(side * EX * 0.98 + NARROW_AX[i], 0.42 - (m - 1) * 2.3, z);
    pos.z -= s * 0.35;
  } else {
    pos.set(-side * 1.45, 1.66, z + 6.1);
    aim.set(side * 1.72, 1.42, z - 0.3);
    // a slow push and drift while the visitor scrolls through the stop
    pos.x += side * s * 0.5;
    pos.z -= s * 0.45;
    pos.y += s * 0.05;
  }
}

function init(ctx: Ctx, section: HTMLElement) {
  el = section;
  intro = el.querySelector('.r-intro');
  hint = el.querySelector('.r-scroll');
  panels = Array.from(el.querySelectorAll<HTMLElement>('.r-st'));
  navBtns = Array.from(el.querySelectorAll<HTMLButtonElement>('.r-nav button'));
  navEl = el.querySelector<HTMLElement>('.r-nav');
  const layer = el.querySelector<HTMLElement>('.r-labels')!;
  const go = (i: number) => ctx.goTo('range', ARR[i] + (LEAVE[i] - ARR[i]) * 0.42);
  navBtns.forEach((bt, i) => bt.addEventListener('click', () => go(i)));

  hall = buildHall(ctx, ST, NAMES);
  group.add(hall.group);
  rift = new Rift(ctx, { color: NEXT, height: 3.8, width: 1.3, light: 12, floor: 0.55 });
  rift.object3D.position.set(0, 0, RIFT_Z);
  group.add(rift.object3D);

  // the hero carries his own two lights down the hall, so the hall itself can stay dark
  key = new THREE.SpotLight('#dfe9ff', 48, 13, 0.5, 0.9, 1.5);
  rim = new THREE.SpotLight(COBALT, 85, 12, 0.6, 0.8, 1.5);
  group.add(key, key.target, rim, rim.target, new THREE.HemisphereLight('#6f8fe0', '#04050a', 0.16));

  stations.forEach((st, i) => {
    const { z, side } = ST[i];
    st.group.position.set(side * EX, 0, z);
    st.group.rotation.y = -side * 0.44;
    st.group.scale.setScalar(SCALE[i]);
    group.add(st.group);
    st.init(ctx, panels[i], layer);

    const sp = new THREE.SpotLight('#b9ccff', 0, 12, 0.62, 0.85, 1.4);
    sp.position.set(side * 0.6, 5.2, z + 2.6);
    sp.target.position.set(side * EX, 1.2, z);
    group.add(sp, sp.target);
    spots.push(sp);
    // a wash of light on the wall behind, so the exhibit has something to stand against
    const w = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), glowMat());
    w.position.set(side * 5.3, 2.2, z - 0.6);
    w.rotation.y = -side * 1.1;
    group.add(w);
    washes.push(w);

    const t = tag(layer, `<s>0${i + 1}</s><b>${NAMES[i]}</b>`, 'r-jump', true);
    t.el.addEventListener('click', () => go(i));
    jump.push(t);
  });

  // taps on the canvas go to the bench in focus. Scrolling is never blocked: we only listen.
  let dx = 0;
  let dy = 0;
  let t0 = 0;
  addEventListener('pointerdown', (e) => ((dx = e.clientX), (dy = e.clientY), (t0 = performance.now())), { passive: true });
  addEventListener(
    'pointerup',
    (e) => {
      if (!live || activeIdx < 0 || onNow[activeIdx] < 0.6) return;
      if (Math.hypot(e.clientX - dx, e.clientY - dy) > 9 || performance.now() - t0 > 450) return;
      const tg = e.target as HTMLElement;
      if (tg.closest?.('a, button, input, label, [data-hit], header')) return;
      ctx.pointer.x = ctx.pointer.rx;
      ctx.pointer.y = ctx.pointer.ry;
      ctx.camera.updateMatrixWorld();
      stations[activeIdx].tap(ctx);
    },
    { passive: true },
  );
}

function update(f: Frame, ctx: Ctx) {
  const { p, io, t, dt } = f;
  const hero = ctx.hero;
  const narrow = ctx.size.narrow;

  if (ctx.shot && !acted) {
    acted = true;
    const act = new URLSearchParams(location.search).get('act');
    if (act) for (const one of act.split(',')) stations.forEach((s) => s.act(one, ctx));
  }

  // ---- hero ----
  const h = heroAt(p);
  // the way out: from the last bench straight through the rift, reaching it at the shared moment
  if (p > LEAVE[3]) {
    const sx = ST[3].side * 0.55;
    const sz = ST[3].z + 0.35;
    const len = Math.hypot(sx, RIFT_Z - sz);
    const dw = exitWalk(p, LEAVE[3], len);
    heroPos.set(sx - (sx / len) * dw, 0, sz + ((RIFT_Z - sz) / len) * dw);
    h.dist = CUM[PATH.length - 2] + dw;
  }
  let focus = -1;
  for (let i = 0; i < 4; i++) {
    onNow[i] = win(p, ARR[i] - 0.03, LEAVE[i] + 0.012, 0.035);
    if (onNow[i] > 0.5) focus = i;
  }
  activeIdx = focus;
  hero.root.position.copy(heroPos);
  let want = Number.isNaN(h.dir) ? yaw : h.dir;
  for (let i = 0; i < 4; i++) {
    // at a bench he turns to face it
    const k = win(p, ARR[i] - 0.012, LEAVE[i] + 0.004, 0.012);
    if (k > 0.5) want = Math.atan2(ST[i].side * EX - heroPos.x, ST[i].z - 0.5 - heroPos.z);
  }
  let dy = want - yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  if (!yawInit || ctx.shot) {
    yaw = want;
    yawInit = true;
  } else yaw += dy * damp(5, dt);
  hero.root.rotation.y = yaw;
  hero.walkTo(h.dist);
  hero.form = 1 - io;
  hero.scatter = 1 - io;
  hero.shadow = 0.85;
  hero.push = 1;
  hero.tint.copy(TINT);
  hero.tintMix = 0.55;
  if (focus === 1 || focus === 2) {
    const s = seg(p, ARR[focus], LEAVE[focus]);
    if (s > 0.12 && s < 0.86) hero.pose = 'think';
  }

  // ---- camera ----
  const pre = 1 - smooth(seg(p, 0.035, 0.085));
  // overview: down the nave, all four benches lit
  a.set(0, 4.7, narrow ? 30 : 24);
  b.set(0, narrow ? 2.6 : 1.1, -24);
  shot(0, narrow, c, d, seg(p, ARR[0] - 0.025, LEAVE[0]));
  let k = inOutCubic(seg(p, 0.03, ARR[0] + 0.012));
  let fov = mix(narrow ? 34 : 21, narrow ? NARROW_FOV[0] : 35, k);
  camPos.lerpVectors(a, c, k);
  camAim.lerpVectors(b, d, k);
  for (let i = 1; i < 4; i++) {
    k = inOutCubic(seg(p, LEAVE[i - 1] - 0.004, ARR[i] + 0.014));
    if (k <= 0) break;
    shot(i, narrow, c, d, seg(p, ARR[i] - 0.025, LEAVE[i]));
    // swing wide through the aisle between two benches so the move reads as a walk, not a wipe
    const arc = Math.sin(k * Math.PI);
    if (narrow) fov = mix(fov, NARROW_FOV[i], k);
    camPos.lerp(c, k);
    camAim.lerp(d, k);
    camPos.y += arc * 0.35;
    camPos.z += arc * 1.6;
    camAim.y -= arc * 0.1;
  }
  // exit: fall in behind him, facing the rift; stop a few steps short and let him walk on into it
  // a long, continuous move (about two thirds of a viewport of scroll), not a cut
  const ex = inOutCubic(seg(p, LEAVE[3] - 0.01, EXIT.cam[1] + 0.01));
  if (ex > 0) {
    c.set(narrow ? 0.35 : 1.0, 1.65, Math.max(heroPos.z + (narrow ? 7.5 : 5.6), RIFT_Z + (narrow ? 10.5 : 9.4)));
    d.set(0, 1.55, RIFT_Z - 3);
    camPos.lerp(c, ex);
    camAim.lerp(d, ex);
  }
  if (!ctx.still) {
    camPos.x += ctx.pointer.x * 0.16;
    camPos.y += ctx.pointer.y * 0.08;
  }
  ctx.camera.fov = narrow ? mix(fov, 50, ex) : fov;
  ctx.camera.position.copy(camPos);
  ctx.camera.lookAt(camAim);

  // ---- light ----
  key.position.set(mix(heroPos.x, camPos.x, 0.6), 4.2, heroPos.z + 3.4);
  key.target.position.copy(heroPos).setY(1);
  rim.position.set(heroPos.x * 3, 3.4, heroPos.z - 3.6);
  rim.target.position.copy(heroPos).setY(1.2);
  const exit = exitOpen(p);
  rim.intensity = 85 * (1 - 0.75 * exit);
  rim.color.setRGB(mix(COBALT.r, 0.45, exit * 0.6), mix(COBALT.g, 0.9, exit * 0.6), mix(COBALT.b, 0.12, exit * 0.6));
  for (let i = 0; i < 4; i++) {
    spots[i].intensity = 8 + onNow[i] * 52 + pre * 70;
    (washes[i].material as THREE.ShaderMaterial).uniforms.uA.value = 0.012 + onNow[i] * 0.05 + pre * 0.02;
  }
  hazeOn(io > 0.01);
  hall.update(t, ctx, heroPos, onNow, exit, pre);
  rift.update(exit, t, ctx, exitLine(p));
  rift.cross(hero);

  // ---- benches ----
  for (let i = 0; i < 4; i++) {
    const s = seg(p, ARR[i] - 0.025, LEAVE[i]);
    const vis = pre > 0.01 || Math.abs(ST[i].z - camPos.z) < 30;
    stations[i].group.visible = vis;
    if (vis || onNow[i] > 0) stations[i].update(s, onNow[i] * io, pre, f, ctx);
  }

  // ---- frame ----
  ctx.bg.copy(BG);
  ctx.fog.color.copy(FOG);
  ctx.fog.density = mix(0.015, 0.006, pre);
  ctx.post.bloom = 0.36;
  ctx.post.threshold = 0.88;
  ctx.post.vignette = 0.4;
  ctx.scene.environmentIntensity = 0.5;

  // ---- copy ----
  show(intro, (1 - smooth(seg(p, 0.045, 0.085))) * 1);
  show(hint, 1 - smooth(seg(p, 0.01, 0.05)));
  for (let i = 0; i < 4; i++) {
    const v = win(p, ARR[i] - 0.012, LEAVE[i] + 0.004, 0.022);
    show(panels[i], v);
    css(panels[i], '--in', v);
    flag(navBtns[i], 'on', focus === i);
    flag(navBtns[i], 'done', p > LEAVE[i]);
    const j = jump[i];
    j.at.set(ST[i].side * EX, 3.1, ST[i].z);
    place(ctx, j, pre * io, dt);
  }
  css(el, '--p', clamp01(p));
  // the bench chips step away before the rift splits
  css(navEl, 'opacity', p > 0.86 ? exitCopy(p).toFixed(3) : '');
  flag(el, 'r-focus', focus >= 0 && onNow[focus] > 0.6);
  flag(el, 'r-over', pre > 0.5);
}

const chapter: Chapter = {
  id: 'range',
  group,
  init,
  update,
  enter: () => (live = true),
  leave: () => {
    live = false;
    hazeOn(false);
  },
};
export default chapter;
