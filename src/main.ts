import Lenis from 'lenis';
import './styles.css';
import { World } from './world/World';
import { mountNav } from './nav';
import type { ChapterModule, Tier } from './world/types';

// every chapter brings its own stylesheet; all of them are needed up front for layout
import.meta.glob('./chapters/*/style.css', { eager: true });
const modules = import.meta.glob<ChapterModule>('./chapters/*/index.ts');

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** ?shot = capture mode. ?shot&c=<chapter>&p=<0..1> freezes the story at that point of that chapter. */
const shot = params.has('shot');
/** ?only=<chapter> keeps a single chapter in the page, for working on one in isolation */
const only = params.get('only');
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends HTMLElement>(s: string) => Array.from(document.querySelectorAll<T>(s));

if (shot) root.classList.add('shot');
if (only) $$('main > .chapter').forEach((el) => el.id !== only && el.remove());

const sections = $$('main > .chapter');
const loaders: Record<string, () => Promise<ChapterModule>> = {};
for (const [path, load] of Object.entries(modules)) loaders[path.split('/')[2]] = load;

function tier(): Tier {
  const forced = params.get('tier');
  if (forced) return Math.min(2, Math.max(0, Number(forced))) as Tier;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse || innerWidth <= 860) return 0;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return cores >= 8 && mem >= 8 ? 2 : 1;
}

let closeMenu = () => {};

const scrollTo0 = (y: number) => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
const chapterAt = (y: number) => {
  let id = '';
  for (const s of sections) if (s.getBoundingClientRect().top + scrollY <= y + 1) id = s.id;
  return id;
};
const veil = $('.veil');
let veilT = 0;
/** viewports: a jump to another chapter further than this cuts through black instead of scrolling all the way */
const FAR = 6;

/**
 * Every programmatic travel goes through here (top bar, node navigator, chapters' ctx.goTo).
 * Near: one smooth Lenis glide, its duration growing with the distance and capped.
 * Far, into another chapter: a short fade to black, a jump to just before the target, then a glide
 * through the last stretch so the chapter's own hand-over plays.
 */
const scrollTo = (y: number, instant = false, glide = false) => {
  closeMenu();
  if (!lenis || instant) return scrollTo0(y);
  const from = lenis.targetScroll ?? scrollY;
  const d = Math.abs(y - from) / innerHeight;
  clearTimeout(veilT);
  if (glide) {
    // previous / next: always a continuous glide, like a quick flick of the wheel, never a cut
    veil.classList.remove('on');
    lenis.scrollTo(y, { duration: Math.min(2.4, 0.7 + d * 0.11), easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), force: true });
    return;
  }
  if (d <= FAR || chapterAt(from) === chapterAt(y)) {
    veil.classList.remove('on');
    lenis.scrollTo(y, { duration: Math.min(1.5, 0.65 + d * 0.14), force: true });
    return;
  }
  veil.classList.add('on');
  veilT = window.setTimeout(() => {
    lenis.scrollTo(y - Math.sign(y - from) * innerHeight * 0.35, { immediate: true, force: true });
    // a beat for the new chapter to draw a frame under the veil (a timer, so a background tab cannot leave it shut)
    veilT = window.setTimeout(() => {
      veil.classList.remove('on');
      lenis.scrollTo(y, { duration: 1.1, force: true });
    }, 60);
  }, 280);
};

let world: World | null = null;
try {
  world = new World($<HTMLCanvasElement>('#stage') as HTMLCanvasElement, sections, loaders, { tier: tier(), still, shot, scrollTo });
  root.classList.add('gl');
} catch (err) {
  console.warn('WebGL unavailable, showing the page without the scene.', err);
  root.classList.add('no-gl');
}

// one animation loop: with the scene up, Lenis is stepped at the top of each rendered frame
const lenis = still || shot ? null : new Lenis({ autoRaf: !world, lerp: 0.1, anchors: false });
if (world && lenis) world.before.push((now) => lenis.raf(now));

if (import.meta.env.DEV) Object.assign(window, { __world: world });

/* ---------- Navigation ---------- */

const goTo = (href: string) => {
  const id = href.replace('#', '');
  if (world) world.ctx.goTo(id, 0.02);
  else document.getElementById(id)?.scrollIntoView();
  history.replaceState(null, '', href);
};

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
  if (!a || a.dataset.native !== undefined) return;
  e.preventDefault();
  goTo(a.getAttribute('href')!);
});

const topBar = $('.top');
const links = $$<HTMLAnchorElement>('.top nav a');
// scale is the second half of Work. Contact is the closing page, not part of Ask: no top link is
// marked there, matching the breadcrumb, which names it on its own.
const group: Record<string, string> = { scale: 'systems' };

if (world) {
  world.onActive = (id) => {
    const key = `#${group[id] ?? id}`;
    links.forEach((a) => {
      const on = a.getAttribute('href') === key;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    const el = document.getElementById(id);
    if (el) root.style.setProperty('--accent', getComputedStyle(el).getPropertyValue('--accent').trim() || '#cfe6ff');
  };
  world.onFirstFrame = () => root.classList.add('gl-ready');
  const c = params.get('c');
  if (shot && c) world.pinTo(c, Number(params.get('p') ?? 0.5));
  world.start();
  mountNav(world, (y, glide) => scrollTo(y, false, glide), { shot });
}

/* ---------- First-screen scroll hint ---------- */

// the hint itself lives in the origin chapter (and fades with its progress); if the visitor has not
// scrolled a few seconds after the scene is up, it is emphasised once (CSS: .nudge)
if (world && !shot) {
  let idle = 0;
  const arm = () => {
    idle = window.setTimeout(() => {
      if (scrollY < 8) root.classList.add('nudge');
    }, 5200);
  };
  const ready = setInterval(() => {
    if (!root.classList.contains('gl-ready')) return;
    clearInterval(ready);
    arm();
  }, 200);
  // once is enough: after the first real scroll the hint is done for good
  const off = () => {
    if (scrollY < 8) return;
    clearInterval(ready);
    clearTimeout(idle);
    root.classList.remove('nudge');
    removeEventListener('scroll', off);
  };
  addEventListener('scroll', off, { passive: true });
}

// the top bar hides while reading downwards. With the scene up this follows the frame's own scroll y
// (no layout-forcing scrollY read after the chapters' style writes); without it, the scroll event.
let lastY = scrollY;
let away = false;
const follow = (y: number) => {
  if (Math.abs(y - lastY) < 6) return;
  const a = y > lastY && y > innerHeight * 0.5;
  if (a !== away) topBar.classList.toggle('away', (away = a));
  lastY = y;
};
if (world) {
  if (!shot) world.after.push(() => follow(world!.now.y));
} else addEventListener('scroll', () => follow(scrollY), { passive: true });

/* ---------- Phone menu ---------- */

const menu = $<HTMLButtonElement>('.menu');
const setMenu = (open: boolean) => {
  topBar.classList.toggle('open', open);
  menu.setAttribute('aria-expanded', String(open));
  menu.textContent = open ? 'Close' : 'Menu';
  if (open) lenis?.stop();
  else lenis?.start();
  // the open menu is opaque and covers the whole viewport: stop rendering under it once it has faded in
  clearTimeout(menuT);
  if (open) menuT = window.setTimeout(() => world?.hold('menu', topBar.classList.contains('open')), 450);
  else world?.hold('menu', false);
};
let menuT = 0;
menu.addEventListener('click', () => setMenu(!topBar.classList.contains('open')));
closeMenu = () => topBar.classList.contains('open') && setMenu(false);
addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));
addEventListener('resize', () => innerWidth > 860 && setMenu(false));
