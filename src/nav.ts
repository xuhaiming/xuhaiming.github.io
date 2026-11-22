import { STORY, type StoryNode } from './nodes';
import type { World } from './world/World';

/**
 * The node navigator. Three views of one table (src/nodes.ts):
 *  - the rail along the bottom edge: one segment per chapter, a tick per beat, the passed part filled
 *    in each chapter's colour. Hover or focus lifts it and shows the chapter names; every tick is a
 *    button with its label on hover / focus.
 *  - the step buttons at the top right (previous / next node, plus the current node's name on wide
 *    screens). Keyboard: J = next node, K = previous node.
 *  - node chips under each link in the phone menu.
 * Travel goes through `travel(y)`, the same smooth scroll the rest of the site uses, so scrolling and
 * clicking drive the same story.
 */

interface Flat extends StoryNode {
  ch: string;
  ci: number;
  first: boolean;
  chLabel: string;
  btns: HTMLElement[];
}

const SVG_UP = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 10.5 8 5.5l5 5"/></svg>';
const SVG_DOWN = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5 8 10.5l5-5"/></svg>';

export function mountNav(world: World, travel: (y: number, glide?: boolean) => void, opts: { shot: boolean }) {
  const root = document.documentElement;
  const sections = Array.from(document.querySelectorAll<HTMLElement>('main > .chapter'));
  const present = new Set(sections.map((s) => s.id));
  const story = STORY.filter((c) => present.has(c.id));
  const order = story.map((c) => c.id);
  const flat: Flat[] = story.flatMap((c, ci) => c.nodes.map((n, k) => ({ ...n, ch: c.id, ci, first: k === 0, chLabel: c.label, btns: [] as HTMLElement[] })));
  const accent = (id: string) => getComputedStyle(document.getElementById(id)!).getPropertyValue('--accent').trim() || '#cfe6ff';
  const name = (n: Flat) => (n.first ? n.chLabel : `${n.chLabel}: ${n.label}`);

  /** glide: previous / next always scroll continuously to the neighbouring beat, never cut through black */
  const go = (n: Flat, glide = false) => {
    const y = world.yOf(n.ch, n.p);
    if (y === null) return;
    travel(y, glide);
    history.replaceState(null, '', `#${n.ch}`);
  };

  /* ---------- rail ---------- */

  const rail = document.querySelector<HTMLElement>('.rail')!;
  rail.innerHTML = '';
  const list = document.createElement('ol');
  list.className = 'nv-chs';
  const segs = story.map((c) => {
    const li = document.createElement('li');
    li.className = 'nv-ch';
    li.dataset.ch = c.id;
    li.style.setProperty('--c', accent(c.id));
    li.innerHTML = '<i class="nv-line" aria-hidden="true"><b></b></i>';
    const ol = document.createElement('ol');
    ol.className = 'nv-nodes';
    li.append(ol);
    list.append(li);
    return { id: c.id, li, ol, fill: li.querySelector<HTMLElement>('b')!, f: '', top: 0, len: 0 };
  });
  for (const n of flat) {
    const li = document.createElement('li');
    li.className = n.first ? 'nv-n nv-head' : 'nv-n';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nv-btn';
    b.dataset.node = n.id;
    b.setAttribute('aria-label', name(n));
    b.innerHTML = `<i aria-hidden="true"></i><span aria-hidden="true">${n.first ? n.chLabel : n.label}</span>`;
    b.addEventListener('click', () => go(n));
    li.append(b);
    segs[n.ci].ol.append(li);
    n.btns.push(b);
  }
  rail.append(list);

  // geometry: segments sized by their chapter's scroll length, ticks at their node's y
  const layout = () => {
    const total = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    sections.forEach((s) => {
      const seg = segs.find((g) => g.id === s.id);
      if (!seg) return;
      const top = s.getBoundingClientRect().top + scrollY;
      const next = s.nextElementSibling as HTMLElement | null;
      const end = next?.classList.contains('chapter') ? next.getBoundingClientRect().top + scrollY : total;
      const len = Math.max(1, end - top);
      seg.li.style.setProperty('--a', (top / total).toFixed(4));
      seg.li.style.setProperty('--w', (Math.min(len, total - top) / total).toFixed(4));
      seg.top = top;
      seg.len = len;
      for (const n of flat) {
        if (n.ch !== s.id) continue;
        const y = world.yOf(n.ch, n.p) ?? top;
        (n.btns[0].parentElement as HTMLElement).style.setProperty('--x', Math.min(1, Math.max(0, (y - top) / len)).toFixed(4));
      }
    });
  };
  layout();
  let lt = 0;
  const relayout = () => {
    clearTimeout(lt);
    lt = window.setTimeout(layout, 250);
  };
  addEventListener('resize', relayout);
  addEventListener('load', relayout);
  document.fonts?.ready.then(relayout);

  /* ---------- step buttons ---------- */

  const step = document.querySelector<HTMLElement>('.step')!;
  const prevBtn = step.querySelector<HTMLButtonElement>('.step-prev')!;
  const nextBtn = step.querySelector<HTMLButtonElement>('.step-next')!;
  const nowEl = step.querySelector<HTMLElement>('.step-now')!;
  prevBtn.innerHTML = SVG_UP;
  nextBtn.innerHTML = SVG_DOWN;
  let prevT: Flat | null = null;
  let nextT: Flat | null = null;
  // a press during a glide steps on from where the glide is heading, so quick repeated presses chain.
  // The glide is identified by its destination y: once the frame's scroll y reaches it (or it has had
  // more than enough time, e.g. the reader took over with the wheel), the next press starts from here.
  let aim = -1;
  let aimY = 0;
  let aimAt = 0;
  const gliding = () => aim >= 0 && Math.abs(world.now.y - aimY) > 2 && performance.now() - aimAt < 2600;
  const stepBy = (dir: 1 | -1) => {
    const t = gliding() ? flat[aim + dir] : dir > 0 ? nextT : prevT;
    if (!t) return;
    const y = world.yOf(t.ch, t.p);
    if (y === null) return;
    aim = flat.indexOf(t);
    aimY = y;
    aimAt = performance.now();
    go(t, true);
  };
  prevBtn.addEventListener('click', () => stepBy(-1));
  nextBtn.addEventListener('click', () => stepBy(1));

  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t.closest?.('input, textarea, select, [contenteditable]')) return;
    if (root.querySelector('.top.open')) return;
    const k = e.key.toLowerCase();
    if (k === 'j') stepBy(1);
    else if (k === 'k') stepBy(-1);
  });

  /* ---------- phone menu chips ---------- */

  const groups: Record<string, string[]> = { systems: ['systems', 'scale'], ask: ['ask', 'contact'] };
  document.querySelectorAll<HTMLAnchorElement>('.top nav a[href^="#"]').forEach((a) => {
    const id = a.getAttribute('href')!.slice(1);
    const chs = groups[id] ?? [id];
    const nodes = flat.filter((n) => chs.includes(n.ch) && !(n.ch === id && n.first));
    if (!nodes.length) return;
    const box = document.createElement('div');
    box.className = 'nav-nodes';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', `${a.textContent} beats`);
    for (const n of nodes) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nav-node';
      b.textContent = n.first ? n.chLabel : n.label;
      b.setAttribute('aria-label', name(n));
      b.addEventListener('click', () => go(n));
      box.append(b);
      n.btns.push(b);
    }
    a.after(box);
  });

  /* ---------- follow the story ---------- */

  let cur = -1;
  let lastPrev: Flat | null | undefined;
  let lastNext: Flat | null | undefined;
  const tick = () => {
    const { id, p } = world.now;
    const ci = order.indexOf(id);
    if (ci >= 0) {
      let c = 0;
      for (let i = 0; i < flat.length; i++) {
        const n = flat[i];
        if (n.ci < ci || (n.ci === ci && (n.first || n.p <= p + 0.025))) c = i;
      }
      if (aim >= 0 && !gliding()) aim = -1;
      if (c !== cur) {
        if (cur >= 0) flat[cur].btns.forEach((b) => b.removeAttribute('aria-current'));
        cur = c;
        flat[cur].btns.forEach((b) => b.setAttribute('aria-current', 'step'));
        segs.forEach((s, i) => s.li.classList.toggle('on', i === ci));
        const n = flat[cur];
        nowEl.innerHTML = n.first ? `<b>${n.chLabel}</b>` : `<span>${n.chLabel}</span><b>${n.label}</b>`;
      }
      // previous: back to the start of this beat if well past it, else the one before
      const here = flat[cur];
      prevT = here.ci === ci && p > here.p + 0.05 ? here : flat[cur - 1] ?? null;
      nextT = flat[cur + 1] ?? null;
      if (prevT !== lastPrev) {
        lastPrev = prevT;
        prevBtn.disabled = !prevT;
        prevBtn.setAttribute('aria-label', prevT ? `Previous: ${name(prevT)}` : 'Previous');
        prevBtn.title = prevT ? `${name(prevT)} (K)` : '';
      }
      if (nextT !== lastNext) {
        lastNext = nextT;
        nextBtn.disabled = !nextT;
        nextBtn.setAttribute('aria-label', nextT ? `Next: ${name(nextT)}` : 'Next');
        nextBtn.title = nextT ? `${name(nextT)} (J)` : '';
      }
      // fill each segment by how far the reader is through it
      // the y the frame was drawn for: reading scrollY here, after the chapters' style writes, would force a layout
      const y = opts.shot ? (world.yOf(id, p) ?? world.now.y) : world.now.y;
      for (const s of segs) {
        const f = s.len ? Math.min(1, Math.max(0, (y - s.top) / s.len)).toFixed(3) : '0';
        if (f !== s.f) {
          s.f = f;
          s.fill.style.setProperty('--f', f);
        }
      }
    }
  };
  // runs at the end of each rendered frame (one loop for the whole page; nothing to do while it is paused)
  tick();
  world.after.push(tick);
}
