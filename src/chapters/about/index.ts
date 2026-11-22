import * as THREE from 'three';
import type { Chapter, Ctx, Frame } from '../../world/types';
import { clamp01, css, damp, flag, mix, seg, show, smooth, win } from '../../world/util';
import { StudioSet } from './set';
import { XRay } from './xray';
import { EXIT, Rift, exitLine, exitOpen, exitWalk } from '../../world/Rift';

/**
 * About. A portrait session in a darkroom.
 *
 * Beginning (p 0 .. 0.6): he walks in and stops, the camera pushes from a three-quarter medium shot to
 * head and shoulders while the two about beats and the fact cards pass.
 * Middle (p 0.6 .. 0.84): the copy steps away and the frame centres on him: the lens is the star. The
 * pointer is a lens: inside it the solid figure is seen as points, as its wire mesh, as its skeleton or
 * as its flat texture.
 * End (p 0.84 .. 1): the lens closes, the camera pulls back to the whole figure, he turns to the
 * visitor and waves, then turns round and walks into a rift of violet light (the next chapter) that has
 * opened behind him, going to points as he crosses it.
 */

const group = new THREE.Group();
const xr = new XRay();
let studio: StudioSet;
let rift: Rift;
/** the way on: a rift of the next chapter's light a few steps behind him */
const VIOLET = '#9b7bff';
const RIFT = new THREE.Vector3(0.3, 0, -2.4);
const WALK_TO = new THREE.Vector3(0.42, 0, -3.5);

const ROSE = '#ff5d8f';
const BG = new THREE.Color('#070304');
const MODES = ['points', 'wire', 'rig', 'tex'] as const;
type Mode = (typeof MODES)[number];
const MODE_NAME: Record<Mode, string> = { points: 'Points', wire: 'Mesh', rig: 'Skeleton', tex: 'Texture' };
const COARSE = matchMedia('(pointer: coarse)').matches;

// ---- timing (fractions of the chapter) ----
const T = {
  /** the camera push from the wide three-quarter shot to head and shoulders */
  pushEnd: 0.6,
  /** copy beats */
  one: [0.02, 0.3] as const,
  two: [0.33, 0.6] as const,
  /** the lens-only stretch: frame centres on him */
  solo: [0.56, 0.66] as const,
  /** the end: lens closes, camera pulls back, he turns to the visitor and waves */
  lensOff: [0.79, 0.85] as const,
  pull: [0.77, 0.89] as const,
  wave: [0.81, 0.87] as const,
  /** then he turns round and walks into the rift behind him */
  back: [0.875, 0.91] as const,
  /** he starts walking here and reaches the rift at the shared crossing moment (world/Rift EXIT) */
  walk: 0.89,
};

// ---- DOM ----
let beatOne: HTMLElement;
let beatTwo: HTMLElement;
let scrim: HTMLElement;
let cards: HTMLElement[] = [];
let tagEl: HTMLElement;
let tagName: HTMLElement;
let modesEl: HTMLElement;
let modeBtns: HTMLButtonElement[] = [];

// ---- interaction state ----
let active = false;
let mode = 0;
let shown = 0;
let sw = 1;
let switchT = -10;
let lensK = 0;
let lensX = -1;
let lensY = -1;
let auto = 1;
let lastPx = 0;
let lastPy = 0;
let lastMove = -100;
let press = 0;
let spin = 0;
let fixedLens: { x: number; y: number } | null = null;
let now = 0;
let downAt = { x: 0, y: 0, t: 0 };
/** set when a view is picked by key or button: the lens goes back to him quickly, whatever the pointer did */
let recentre = false;

const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();
const target = new THREE.Vector3();
const chest = new THREE.Vector3();
const head = new THREE.Vector3();
const scr = { x: 0, y: 0, z: 0 };

/** card anchors around the standing figure, in his space (x right of screen is his left) */
const CARD_AT = [new THREE.Vector3(-0.66, 1.84, 0.5), new THREE.Vector3(0.8, 1.5, -0.35), new THREE.Vector3(-0.7, 0.86, 0.2), new THREE.Vector3(0.78, 0.74, 0.6)];
const CARD_AT_NARROW = [new THREE.Vector3(-0.44, 0.9, 0.2), new THREE.Vector3(0.46, 0.68, 0.2), new THREE.Vector3(-0.44, 0.9, 0.2), new THREE.Vector3(0.46, 0.68, 0.2)];
/** measured card sizes (CSS px, before scale); reset on resize */
let cardSize: ({ w: number; h: number } | undefined)[] = [];
/** top of the copy block on a phone (CSS px, without its scroll offset); 0 = measure again */
let copyTop = 0;

function setMode(i: number, t: number, centre = false) {
  if (centre) {
    // picked without aiming (key 1-4 or the switch): bring the lens back onto him so the view is seen
    lastMove = -100;
    recentre = true;
  }
  const next = ((i % MODES.length) + MODES.length) % MODES.length;
  if (next === mode) return;
  mode = next;
  sw = 0;
  switchT = t;
  modeBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === mode)));
}

function init(ctx: Ctx, el: HTMLElement) {
  // build the lens layers in idle time once the hero exists, so the first frame in About doesn't pay for it
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
  const prebuild = () => {
    if (!xr.build(ctx)) idle(prebuild);
  };
  idle(prebuild);
  const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const $$ = <T extends HTMLElement>(s: string) => Array.from(el.querySelectorAll<T>(s));
  beatOne = $('.a-one');
  beatTwo = $('.a-two');
  scrim = $('.a-scrim');
  cards = $$('.a-card');
  tagEl = $('.a-tag');
  tagName = $('.a-tag b');
  modesEl = $('.a-modes');
  modeBtns = $$<HTMLButtonElement>('.a-modes button');

  studio = new StudioSet(ctx);
  group.add(studio.group, xr.group);
  rift = new Rift(ctx, { color: VIOLET, height: 3.1, width: 1.1, light: 7, floor: 0.75 });
  rift.object3D.position.copy(RIFT);
  rift.object3D.rotation.y = 0.12;
  group.add(rift.object3D);

  modeBtns.forEach((b, i) => b.addEventListener('click', () => setMode(i, now, true)));

  // a tap or click on the scene (not on a control, not a drag or a scroll) turns the lens to its next view
  addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY, t: performance.now() }), { passive: true });
  addEventListener(
    'pointerup',
    (e) => {
      if (!active || lensK < 0.5) return;
      if ((e.target as HTMLElement | null)?.closest?.('a, button, input, [data-hit]')) return;
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10 || performance.now() - downAt.t > 450) return;
      setMode(mode + 1, now);
    },
    { passive: true },
  );
  addEventListener('keydown', (e) => {
    if (!active || lensK < 0.5 || e.metaKey || e.ctrlKey || e.altKey) return;
    const tgt = e.target as HTMLElement | null;
    if (tgt && /INPUT|TEXTAREA|SELECT/.test(tgt.tagName)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= MODES.length) setMode(n - 1, now, true);
  });

  // capture hooks: &act=points|wire|rig|tex (lens view), &lx=0.6&ly=0.4 (lens position, fractions of the viewport)
  const q = new URLSearchParams(location.search);
  const mi = MODES.indexOf((q.get('act') ?? '') as Mode);
  if (mi >= 0) {
    mode = shown = mi;
    modeBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === mode)));
  }
  if (q.has('lx') || q.has('ly')) fixedLens = { x: Number(q.get('lx') ?? 0.5), y: Number(q.get('ly') ?? 0.4) };
}

function update(f: Frame, ctx: Ctx) {
  try {
    frame(f, ctx);
  } catch (e) {
    xr.release();
    throw e;
  }
}

function frame(f: Frame, ctx: Ctx) {
  const { p, io, t, dt } = f;
  now = t;
  const hero = ctx.hero;
  const narrow = ctx.size.narrow;
  const { w, h } = ctx.size;
  xr.build(ctx);
  xr.begin();

  // ---------------------------------------------------------------- clocks
  const arrive = smooth(seg(p, 0, 0.1));
  const turn = smooth(seg(p, 0.04, 0.12));
  const solo = smooth(seg(p, T.solo[0], T.solo[1]));
  const pull = smooth(seg(p, T.pull[0], T.pull[1]));
  const back = smooth(seg(p, T.back[0], T.back[1]));
  const walkLen = WALK_TO.length();
  // WALK_TO runs past the rift: reach its plane (RIFT's distance) at the crossing moment
  const walkK = exitWalk(p, T.walk, RIFT.length()) / walkLen;

  // ---------------------------------------------------------------- hero
  const restYaw = narrow ? 0.16 : 0.3;
  const inX = (1 - arrive) * -1.25;
  hero.root.position.set(inX, 0, 0).addScaledVector(WALK_TO, walkK);
  // in the end he turns to the visitor, then round to the rift behind him
  hero.root.rotation.y = mix(mix(mix(Math.PI / 2, restYaw, turn), narrow ? 0.05 : 0.14, pull), Math.atan2(WALK_TO.x, WALK_TO.z), back);
  hero.walkTo(arrive * 1.25 + walkK * walkLen);
  hero.root.updateMatrixWorld(true);

  hero.tint.set(ROSE);
  hero.tintMix = 0.42;
  hero.glow = 1.15;
  hero.grain = 1.05;
  // his points only give way to a pointer that is really there
  hero.push = 1 - auto;
  hero.shadow = io;
  if (p > T.wave[0] && p < T.wave[1] && !ctx.still) hero.pose = 'wave';
  hero.form = 1 - io;
  hero.scatter = 1 - io;

  hero.bone('Spine2', chest);
  hero.bone('Head', head);
  target.set(hero.root.position.x, 1.25, hero.root.position.z);

  // ---------------------------------------------------------------- camera
  // beginning: a push from a three-quarter medium shot to head and shoulders, him to the right of the copy
  const push = seg(p, 0, T.pushEnd);
  const pk = mix(push, smooth(push), 0.6);
  if (narrow) {
    va.set(1.3, 1.45, 6.6);
    vb.set(0.9, 1.5, 4.0);
    vc.set(0.42, 1.6, 2.35);
  } else {
    va.set(2.5, 1.35, 5.7);
    vb.set(1.75, 1.5, 3.5);
    vc.set(0.66, 1.64, 1.8);
  }
  bez(camPos, va, vb, vc, pk);
  if (narrow) {
    va.set(0, 0.62, 0);
    vb.set(0, 0.98, 0);
    vc.set(0, 1.34, 0);
  } else {
    va.set(-1.05, 0.98, 0);
    vb.set(-0.72, 1.2, 0);
    vc.set(-0.34, 1.52, 0);
  }
  bez(camAim, va, vb, vc, pk);
  // middle: no copy, so he takes the centre of the frame
  if (solo > 0) {
    if (narrow) {
      va.set(0.36, 1.56, 2.2);
      vb.set(0, 1.47, 0);
    } else {
      va.set(0.42, 1.6, 1.95);
      vb.set(0, 1.48, 0);
    }
    camPos.lerp(va, solo);
    camAim.lerp(vb, solo);
  }
  // end: back out to the whole figure, centred
  if (pull > 0) {
    if (narrow) {
      va.set(0.5, 1.3, 5.6);
      vb.set(0, 0.95, 0);
    } else {
      va.set(0.7, 1.62, 4.9);
      vb.set(0, 0.9, 0);
    }
    camPos.lerp(va, pull);
    camAim.lerp(vb, pull);
  }
  // he walks away into the rift: the camera follows a step and lifts its eye to frame the whole rift
  const tail = smooth(seg(p, T.back[0], EXIT.cam[1] + 0.04));
  if (tail > 0) {
    camPos.z += tail * (narrow ? 0.8 : 1.3);
    camPos.y += tail * 0.15;
    camAim.lerp(va.set(RIFT.x * 0.6, narrow ? 1.15 : 1.6, RIFT.z), tail * 0.9);
  }
  if (!ctx.still) {
    const par = mix(mix(0.2, 0.07, pk), 0.16, pull);
    camPos.x += ctx.pointer.x * par;
    camPos.y += ctx.pointer.y * par * 0.45;
    // handheld breath
    camPos.x += Math.sin(t * 0.31) * 0.012;
    camPos.y += Math.sin(t * 0.43 + 1.0) * 0.008;
  }
  ctx.camera.position.copy(camPos);
  ctx.camera.lookAt(camAim);
  ctx.camera.updateMatrixWorld();

  // ---------------------------------------------------------------- lens
  lensK = io * smooth(seg(p, 0.05, 0.11)) * (1 - smooth(seg(p, T.lensOff[0], T.lensOff[1])));
  const ptr = ctx.pointer;
  if (ptr.px !== lastPx || ptr.py !== lastPy) {
    if (ptr.seen && !recentre) lastMove = t;
    lastPx = ptr.px;
    lastPy = ptr.py;
  }
  // a real move after a re-centre hands the lens back to the pointer
  if (recentre && auto > 0.98) recentre = false;
  const idleAfter = COARSE ? 3.5 : 7;
  const manual = ptr.seen && t - lastMove < idleAfter && !ctx.shot;
  auto += ((manual ? 0 : 1) - auto) * damp(manual ? 9 : recentre ? 7 : 1.6, dt);
  // on its own the lens wanders between his face and his chest
  const wob = ctx.still || ctx.shot ? 0.35 : 0.5 + 0.5 * Math.sin(t * 0.42);
  va.copy(head).lerp(chest, wob * 0.85);
  va.y += 0.04;
  ctx.project(va, scr);
  let ax = scr.x + (ctx.still || ctx.shot ? 0 : Math.sin(t * 0.63) * w * (narrow ? 0.05 : 0.025));
  let ay = scr.y;
  if (fixedLens) {
    ax = fixedLens.x * w;
    ay = fixedLens.y * h;
  }
  // a little larger while it has the frame to itself
  const baseR = (narrow ? w * 0.27 : Math.min(h * 0.2, w * 0.14)) * (1 + 0.14 * solo * (1 - pull));
  const tx = mix(ptr.px, ax, auto);
  let ty = mix(ptr.py, ay, auto);
  if (narrow) {
    // phone: the ring (and the name inside its foot) stays in the upper 3D area, clear of the copy block
    if (!copyTop) copyTop = Math.min(beatOne.offsetTop, beatTwo.offsetTop) || h * 0.75;
    // and no lower than his chest band, so the fact cards beside his waist keep clear of the ring
    ty = Math.max(120 + baseR * 0.5, Math.min(ty, copyTop - 16 - baseR, h * 0.42));
  }
  if (lensX < 0 || ctx.shot) {
    lensX = tx;
    lensY = ty;
  }
  const follow = damp(14, dt);
  const vx = (tx - lensX) * follow;
  const vy = (ty - lensY) * follow;
  lensX += vx;
  lensY += vy;
  press += ((ptr.down && manual ? 1 : 0) - press) * damp(10, dt);
  if (sw < 1) {
    const before = sw;
    sw = Math.min(1, sw + dt / 0.42);
    if (before < 0.5 && sw >= 0.5) shown = mode;
  } else shown = mode;
  spin += dt * (0.22 + Math.min(4, Math.hypot(vx, vy) / Math.max(dt, 0.001) / 500));
  const r = baseR * (0.4 + 0.6 * lensK) * (1 + 0.24 * press) * (1 - 0.34 * Math.sin(Math.PI * sw)) * (lensK > 0.02 ? 1 : 0);
  xr.lens.x = lensX;
  xr.lens.y = lensY;
  xr.lens.r = r;
  xr.glass.k = lensK;
  xr.glass.spin = spin;
  xr.glass.flash = clamp01(1 - (t - switchT) / 0.7);
  xr.glass.press = press;
  if (lensK > 0.02) {
    xr.solidLens = 1;
    const m = MODES[shown];
    const st = xr.state;
    if (m === 'points') st.pts.lens = 1;
    if (m === 'wire') st.clay.lens = 1;
    if (m === 'rig') {
      st.ghost.lens = 1;
      st.bones.lens = 1;
      st.lines.lens = 1;
      xr.linesGlow = 0.28;
    }
    if (m === 'tex') st.flat.lens = 1;
  }
  xr.apply(ctx, t);

  // ---------------------------------------------------------------- set
  // the room dims to its safelight as he goes to points
  studio.update({ io, dark: smooth(seg(p, 0.86, 1)) * 0.7, target, close: pk * (1 - pull) }, ctx, t, dt);
  // after the set, so the fog and the camera are this frame's
  rift.update(exitOpen(p), t, ctx, exitLine(p) * io);
  rift.cross(hero);

  // ---------------------------------------------------------------- frame
  ctx.bg.copy(BG);
  ctx.fog.color.copy(BG);
  ctx.fog.density = 0.05;
  ctx.post.bloom = 0.5;
  ctx.post.threshold = 0.9;
  ctx.post.vignette = 0.62;
  ctx.post.grain = 0.7;
  ctx.scene.environmentIntensity = 0.32;

  // ---------------------------------------------------------------- copy
  const one = win(p, T.one[0], T.one[1], 0.035);
  const two = win(p, T.two[0], T.two[1], 0.035);
  show(beatOne, one);
  show(beatTwo, two);
  css(beatOne, '--y', `${(1 - one) * (p < 0.15 ? 18 : -18)}px`);
  css(beatTwo, '--y', `${(1 - two) * (p < 0.45 ? 18 : -18)}px`);
  css(scrim, 'opacity', Math.max(one, two));

  // fact cards: DOM glass pinned to points in his space, sized by their distance to the camera, kept
  // off the lens and inside the frame. On a phone they come in pairs beside his waist, above the copy.
  const anchors = narrow ? CARD_AT_NARROW : CARD_AT;
  const gut = narrow ? 14 : 28;
  if (narrow && !copyTop) copyTop = Math.min(beatOne.offsetTop, beatTwo.offsetTop) || h * 0.75;
  for (let i = 0; i < cards.length; i++) {
    const a = (narrow ? (i < 2 ? win(p, 0.06, 0.3, 0.035) : win(p, 0.31, 0.55, 0.035)) : win(p, 0.05 + i * 0.035, 0.4 + i * 0.015, 0.035)) * io;
    show(cards[i], a);
    if (a < 0.01) continue;
    const size = (cardSize[i] ??= { w: cards[i].offsetWidth, h: cards[i].offsetHeight });
    va.copy(anchors[i]);
    if (!ctx.still) va.y += Math.sin(t * 0.7 + i * 1.9) * 0.018;
    va.applyMatrix4(hero.root.matrixWorld);
    // they do not walk in with him: hold them where he will stand
    va.x -= inX;
    const d = va.distanceTo(ctx.camera.position);
    ctx.project(va, scr);
    const sc = Math.min(narrow ? 1 : 1.5, Math.max(0.62, (narrow ? 4.6 : 4.4) / d));
    const hw = (size.w * sc) / 2;
    const hh = (size.h * sc) / 2;
    let cx = scr.x;
    let cy = scr.y;
    // step out of the lens: push the card centre to just outside the ring
    if (r > 1) {
      const dx = cx - lensX;
      const dy = cy - lensY;
      const dl = Math.hypot(dx, dy) || 1;
      const need = r * 1.06 + Math.abs(dx / dl) * hw + Math.abs(dy / dl) * hh;
      if (dl < need) {
        cx = lensX + (dx / dl) * need;
        cy = lensY + (dy / dl) * need;
      }
    }
    cx = Math.min(w - gut - hw, Math.max(gut + hw, cx));
    cy = Math.min((narrow ? copyTop - 18 : h - 120) - hh, Math.max((narrow ? 132 : 96) + hh, cy));
    css(cards[i], 'transform', `translate3d(${cx.toFixed(1)}px, ${(cy + (1 - a) * 14).toFixed(1)}px, 0) translate(-50%, -50%) scale(${sc.toFixed(3)})`);
    css(cards[i], '--blur', `${Math.max(0, (sc - 1.12) * 9).toFixed(2)}px`);
  }

  // lens tag and switch
  const tagA = lensK * (1 - Math.sin(Math.PI * sw) * 0.9);
  show(tagEl, tagA);
  if (tagA > 0.01) {
    const m = MODES[shown];
    if (tagName.textContent !== MODE_NAME[m]) tagName.textContent = MODE_NAME[m];
    if (narrow) {
      // on a phone the name sits inside the foot of the ring: the cards are kept outside the ring, so
      // nothing can cover it and it never reaches the copy
      css(tagEl, 'transform', `translate3d(${lensX.toFixed(1)}px, ${(lensY + r * 0.6).toFixed(1)}px, 0) translate(-50%, 0)`);
      flag(tagEl, 'flip', false);
    } else {
      const off = r * 0.74;
      const flip = lensX + off + 190 > w;
      css(tagEl, 'transform', `translate3d(${(lensX + (flip ? -off : off)).toFixed(1)}px, ${(lensY + off).toFixed(1)}px, 0) translate(${flip ? '-100%' : '0'}, 0)`);
      flag(tagEl, 'flip', flip);
    }
    flag(tagEl, 'auto', auto > 0.6);
  }
  show(modesEl, lensK);
}

function bez(out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number) {
  const i = 1 - t;
  out.set(i * i * a.x + 2 * i * t * b.x + t * t * c.x, i * i * a.y + 2 * i * t * b.y + t * t * c.y, i * i * a.z + 2 * i * t * b.z + t * t * c.z);
}

const chapter: Chapter = {
  id: 'about',
  group,
  init,
  update,
  enter() {
    active = true;
    lensX = -1;
    studio?.enter();
  },
  resize() {
    cardSize = [];
    copyTop = 0;
  },
  leave() {
    active = false;
    xr.release();
    studio?.leave();
  },
};
export default chapter;
