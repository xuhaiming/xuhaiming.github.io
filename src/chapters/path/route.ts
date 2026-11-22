import { css, flag } from '../../world/util';
import { L, PLACES, STOPS, pOf } from './data';

/**
 * The route instrument: a dot-matrix chart of the journey (Eindhoven, Beijing, Shenzhen, Singapore)
 * with his position on it, and under it a timeline that can be dragged to travel.
 */

// Land on a 4-degree grid, as [lat, [lonFrom, lonTo] ...] with cell centres. Coarse on purpose:
// it is drawn as a dot matrix, the way a departure board would show a map.
const LAND: [number, ...[number, number][]][] = [
  [66, [14, 146]],
  [62, [6, 146]],
  [58, [-6, -2], [10, 14], [22, 138]],
  [54, [-6, -2], [6, 138], [142, 142]],
  [50, [2, 138], [142, 142]],
  [46, [-2, 46], [54, 138], [142, 142]],
  [42, [-10, 2], [10, 26], [42, 46], [54, 130], [142, 142]],
  [38, [-10, -2], [14, 14], [22, 46], [54, 118], [126, 126], [138, 138]],
  [34, [-6, 10], [34, 118], [126, 138]],
  [30, [-10, 122], [130, 130]],
  [26, [-10, 122]],
  [22, [-10, 34], [42, 58], [70, 114], [122, 122]],
  [18, [-10, 54], [74, 82], [94, 110], [122, 122]],
  [14, [-10, 50], [74, 78], [98, 106], [122, 122]],
  [10, [-10, 50], [78, 78], [98, 98], [106, 106], [122, 126]],
  [6, [-10, 46], [82, 82], [102, 102], [114, 118], [126, 126]],
  [2, [10, 42], [98, 102], [110, 118]],
  [-2, [10, 38], [102, 114], [122, 122], [130, 138]],
  [-6, [14, 38], [106, 114], [138, 146]],
];

const VW = 160;
const VH = 76;
const mx = (lon: number) => lon + 12;
const my = (lat: number) => 68 - lat;

// quadratic arcs between consecutive cities, in chart units; the first bows north like a great circle
const CTRL: [number, number][] = [
  [70, -7],
  [133, 37],
  [126, 58],
];
const SEG = 28;

export interface RouteApi {
  update(x: number, route: number, year: number, stop: number, dt: number): void;
  resize(): void;
  /** true while the visitor holds the timeline */
  readonly dragging: boolean;
  /** capture hook: show the timeline in its held state */
  hold(on: boolean): void;
}

export function makeRoute(root: HTMLElement, go: { scrub(p: number): void; walk(p: number): void }): RouteApi {
  const map = root.querySelector<HTMLElement>('.p-map')!;
  const canvas = root.querySelector<HTMLCanvasElement>('.p-land')!;
  const base = root.querySelector<SVGPathElement>('.p-arc-base')!;
  const done = root.querySelector<SVGPathElement>('.p-arc-done')!;
  const dot = root.querySelector<HTMLElement>('.p-dot')!;
  const cities = Array.from(root.querySelectorAll<HTMLButtonElement>('.p-city'));
  const ruler = root.querySelector<HTMLElement>('.p-ruler')!;
  const fill = root.querySelector<HTMLElement>('.p-fill')!;
  const ticks = root.querySelector<HTMLElement>('.p-ticks')!;
  const thumb = root.querySelector<HTMLElement>('.p-thumb')!;
  const thumbLabel = thumb.querySelector<HTMLElement>('b')!;

  // ---- route polyline ----
  const pts: number[] = [];
  for (let s = 0; s < PLACES.length - 1; s++) {
    const a = PLACES[s];
    const b = PLACES[s + 1];
    const ax = mx(a.lon);
    const ay = my(a.lat);
    const bx = mx(b.lon);
    const by = my(b.lat);
    const [cx, cy] = CTRL[s];
    for (let i = s === 0 ? 0 : 1; i <= SEG; i++) {
      const t = i / SEG;
      const u = 1 - t;
      pts.push(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by);
    }
  }
  const N = pts.length / 2;
  const dAll = (upto: number) => {
    // upto in polyline-vertex units (fractional)
    let d = '';
    const whole = Math.floor(upto);
    for (let i = 0; i <= whole && i < N; i++) d += `${i ? 'L' : 'M'}${pts[i * 2].toFixed(2)} ${pts[i * 2 + 1].toFixed(2)}`;
    const f = upto - whole;
    if (f > 0.001 && whole + 1 < N) {
      const x = pts[whole * 2] + (pts[whole * 2 + 2] - pts[whole * 2]) * f;
      const y = pts[whole * 2 + 1] + (pts[whole * 2 + 3] - pts[whole * 2 + 1]) * f;
      d += `L${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return d;
  };
  base.setAttribute('d', dAll(N - 1));

  cities.forEach((b, i) => {
    b.style.left = `${(mx(PLACES[i].lon) / VW) * 100}%`;
    b.style.top = `${(my(PLACES[i].lat) / VH) * 100}%`;
    b.addEventListener('click', () => {
      const first = STOPS.find((s) => s.place === i)!;
      go.walk(pOf(first.x - 1.2));
    });
  });

  // ---- timeline ticks: one per stop, at the road position where its years begin ----
  const tickEls: HTMLElement[] = [];
  const addTick = (x: number, label: string, cls = '') => {
    const t = document.createElement('span');
    t.className = `p-tick ${cls}`;
    t.style.left = `${(x / L) * 100}%`;
    t.innerHTML = `<i></i><em>${label}</em>`;
    ticks.appendChild(t);
    return t;
  };
  STOPS.forEach((s) => tickEls.push(addTick(s.a, String(s.from))));
  addTick(L, '2025', 'p-tick-end');
  const gemEls = STOPS.map((s) => {
    const g = document.createElement('span');
    g.className = 'p-gem';
    g.style.left = `${(s.x / L) * 100}%`;
    ticks.appendChild(g);
    return g;
  });

  // ---- dragging ----
  let dragging = false;
  let held = false;
  let moved = 0;
  let downX = 0;
  let curX = 0;
  const xAt = (clientX: number) => {
    const r = ruler.getBoundingClientRect();
    const pad = 14;
    return Math.min(1, Math.max(0, (clientX - r.left - pad) / Math.max(1, r.width - pad * 2))) * L;
  };
  ruler.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = 0;
    downX = e.clientX;
    try {
      ruler.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events have no capture */
    }
    root.classList.add('used');
    // a press on the thumb itself holds it; a press elsewhere on the track waits to see if it is a tap
    const r = thumb.getBoundingClientRect();
    if (Math.abs(e.clientX - (r.left + r.width / 2)) > 22) return;
    e.preventDefault();
  });
  ruler.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    moved = Math.max(moved, Math.abs(e.clientX - downX));
    if (moved > 4) go.scrub(pOf(xAt(e.clientX)));
  });
  const up = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (moved <= 4 && e.type === 'pointerup') {
      // a tap: walk to the nearest stop if the tap is close to one, otherwise to that point
      const x = xAt(e.clientX);
      let best = x;
      for (const s of STOPS) if (Math.abs(s.x - 1.2 - x) < 2.2) best = s.x - 1.2;
      go.walk(pOf(best));
    }
  };
  ruler.addEventListener('pointerup', up);
  ruler.addEventListener('pointercancel', up);
  ruler.addEventListener('keydown', (e) => {
    let x: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') x = STOPS.find((s) => s.x - 1.2 > curX + 0.6)?.x ?? L + 1.2;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') x = [...STOPS].reverse().find((s) => s.x - 1.2 < curX - 0.6)?.x ?? 1.2;
    else if (e.key === 'Home') x = 1.2;
    else if (e.key === 'End') x = L + 1.2;
    if (x === null) return;
    e.preventDefault();
    root.classList.add('used');
    go.walk(pOf(x - 1.2));
  });

  // ---- land ----
  function draw() {
    const w = map.clientWidth;
    const h = map.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const sx = w / VW;
    const sy = h / VH;
    // every 4-degree cell is drawn as four small dots: same coastline, a finer screen
    const r = Math.max(0.7, Math.min(sx, sy) * 0.48);
    for (const [lat, ...runs] of LAND) {
      for (const [a, b] of runs) {
        for (let lon = a; lon <= b; lon += 4) {
          const k = 0.24 + 0.2 * Math.min(1, Math.max(0, (lon + 10) / 130));
          g.fillStyle = `rgba(150, 232, 214, ${k.toFixed(3)})`;
          for (let q = 0; q < 4; q++) {
            g.beginPath();
            g.arc((mx(lon) + (q % 2 ? 1 : -1)) * sx, (my(lat) + (q < 2 ? -1 : 1)) * sy, r, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
  }

  let lastUpto = -1;
  let lastYear = -1;
  let glow = 0;

  return {
    get dragging() {
      return dragging || held;
    },
    hold(on) {
      held = on;
      if (on) root.classList.add('used');
    },
    resize: draw,
    update(x, route, year, stop, dt) {
      curX = x;
      // the dot and the travelled part of the route
      const upto = Math.min(N - 1, route * SEG);
      if (Math.abs(upto - lastUpto) > 0.01) {
        lastUpto = upto;
        done.setAttribute('d', dAll(upto));
        const i = Math.min(N - 2, Math.floor(upto));
        const f = upto - i;
        const px = pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * f;
        const py = pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * f;
        css(dot, 'left', `${((px / VW) * 100).toFixed(2)}%`);
        css(dot, 'top', `${((py / VH) * 100).toFixed(2)}%`);
      }
      const flying = Math.abs(route - Math.round(route)) > 0.02;
      flag(dot, 'fly', flying);
      const here = Math.round(route);
      cities.forEach((b, i) => {
        flag(b, 'on', !flying && i === here);
        flag(b, 'past', i < here || (i === here && !flying));
      });

      const f = Math.min(1, Math.max(0, x / L));
      css(fill, 'transform', `scaleX(${f.toFixed(4)})`);
      css(thumb, '--f', `${(f * 100).toFixed(2)}%`);
      const yr = Math.min(2025, Math.floor(year + 1e-4));
      if (yr !== lastYear) {
        lastYear = yr;
        thumbLabel.textContent = String(yr);
        ruler.setAttribute('aria-valuenow', String(yr));
      }
      tickEls.forEach((t, i) => {
        flag(t, 'on', i === stop);
        flag(t, 'past', STOPS[i].a <= x + 0.01);
      });
      gemEls.forEach((g, i) => flag(g, 'past', STOPS[i].x <= x + 0.4));
      const want = dragging || held ? 1 : 0;
      glow += (want - glow) * Math.min(1, dt * 10);
      flag(root, 'held', dragging || held);
    },
  };
}
