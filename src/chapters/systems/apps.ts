import * as THREE from 'three';
import { rng, rr } from './kit';

/**
 * The three internal tools the visitor can ask the builder for, and the wall of published apps.
 * Every pixel of UI here is drawn on a canvas, so the words are real and sharp.
 */

export interface Block {
  /** rect in panel space, 0..1, y down */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'header' | 'stat' | 'calendar' | 'list' | 'form' | 'chart' | 'table' | 'rooms' | 'timeline';
  /** bound to an internal service: stays a skeleton until the data stage. Index into `services`. */
  data?: number;
  title?: string;
  value?: string;
  action?: string;
  rows?: string[][];
}

export interface AppDef {
  chip: string;
  ask: string;
  name: string;
  services: [string, string, string];
  blocks: Block[];
}

const G = 0.022; // gutter
export const APPS: AppDef[] = [
  {
    chip: 'Team leave',
    ask: 'A page where my team can request leave and see who is out this month.',
    name: 'Team leave',
    services: ['People directory', 'Leave records', 'Team calendar'],
    blocks: [
      { x: 0, y: 0, w: 1, h: 0.115, kind: 'header', title: 'Team leave', action: 'Request leave' },
      { x: 0, y: 0.115 + G, w: 0.32, h: 0.17, kind: 'stat', title: 'Out today', value: '2', data: 1 },
      { x: 0.32 + G, y: 0.115 + G, w: 0.32, h: 0.17, kind: 'stat', title: 'Out this week', value: '5', data: 1 },
      { x: 0.64 + 2 * G, y: 0.115 + G, w: 1 - 0.64 - 2 * G, h: 0.17, kind: 'stat', title: 'To approve', value: '3', data: 1 },
      { x: 0, y: 0.285 + 2 * G, w: 0.6, h: 1 - 0.285 - 2 * G, kind: 'calendar', title: 'This month', data: 2 },
      {
        x: 0.6 + G,
        y: 0.285 + 2 * G,
        w: 1 - 0.6 - G,
        h: 1 - 0.285 - 2 * G,
        kind: 'list',
        title: 'Who is out',
        data: 0,
        rows: [
          ['Mei', 'Mon to Wed'],
          ['Arjun', 'Thursday'],
          ['Sofia', 'All week'],
          ['Tomas', 'Friday'],
        ],
      },
    ],
  },
  {
    chip: 'Ticket dashboard',
    ask: "A dashboard of this week's support tickets, grouped by status.",
    name: 'Support tickets',
    services: ['Ticket system', 'Customer records', 'Single sign-on'],
    blocks: [
      { x: 0, y: 0, w: 1, h: 0.115, kind: 'header', title: 'Support tickets', action: 'This week' },
      { x: 0, y: 0.115 + G, w: 0.235, h: 0.17, kind: 'stat', title: 'Open', value: '18', data: 0 },
      { x: 0.235 + G, y: 0.115 + G, w: 0.235, h: 0.17, kind: 'stat', title: 'In progress', value: '9', data: 0 },
      { x: 0.47 + 2 * G, y: 0.115 + G, w: 0.235, h: 0.17, kind: 'stat', title: 'Waiting', value: '4', data: 0 },
      { x: 0.705 + 3 * G, y: 0.115 + G, w: 1 - 0.705 - 3 * G, h: 0.17, kind: 'stat', title: 'Solved', value: '31', data: 0 },
      { x: 0, y: 0.285 + 2 * G, w: 0.54, h: 1 - 0.285 - 2 * G, kind: 'chart', title: 'New per day', data: 0 },
      {
        x: 0.54 + G,
        y: 0.285 + 2 * G,
        w: 1 - 0.54 - G,
        h: 1 - 0.285 - 2 * G,
        kind: 'table',
        title: 'Latest',
        data: 1,
        rows: [
          ['Login loop on mobile', 'Open'],
          ['Export misses a column', 'In progress'],
          ['Invoice shows old address', 'Waiting'],
          ['Cannot reset password', 'Open'],
          ['Slow search on Monday', 'Solved'],
        ],
      },
    ],
  },
  {
    chip: 'Room booking',
    ask: 'A form to book a meeting room on our floor that shows which rooms are free.',
    name: 'Book a room',
    services: ['Room calendar', 'People directory', 'Notifications'],
    blocks: [
      { x: 0, y: 0, w: 1, h: 0.115, kind: 'header', title: 'Book a room', action: 'Today' },
      {
        x: 0,
        y: 0.115 + G,
        w: 0.36,
        h: 1 - 0.115 - G,
        kind: 'form',
        title: 'New booking',
        action: 'Book',
        data: 1,
        rows: [
          ['Date', 'Tomorrow'],
          ['Time', '14:00 to 15:00'],
          ['People', '6'],
        ],
      },
      {
        x: 0.36 + G,
        y: 0.115 + G,
        w: 1 - 0.36 - G,
        h: 0.46,
        kind: 'rooms',
        title: 'Rooms on this floor',
        data: 0,
        rows: [
          ['Harbour', 'Free'],
          ['Orchard', 'Busy'],
          ['Garden', 'Free'],
          ['Summit', 'Free'],
          ['Quay', 'Busy'],
          ['Atrium', 'Free'],
        ],
      },
      { x: 0.36 + G, y: 0.575 + 2 * G, w: 1 - 0.36 - G, h: 1 - 0.575 - 2 * G, kind: 'timeline', title: 'Today', data: 0 },
    ],
  },
];

const INK = '#eaf6d6';
const INK2 = '#9db58a';
const CARD = '#12170f';
const LINE = '#26301f';
const ACC = '#b8ff3c';
const GHOST = '#1f281a';

function drawBlock(c: CanvasRenderingContext2D, b: Block, W: number, H: number, live: boolean) {
  const x = b.x * W;
  const y = b.y * H;
  const w = b.w * W;
  const h = b.h * H;
  const u = W / 1024; // scale unit
  const pad = 16 * u;
  const bound = b.data !== undefined;
  const on = live || !bound;
  c.save();
  rr(c, x, y, w, h, 12 * u);
  c.fillStyle = CARD;
  c.fill();
  c.strokeStyle = LINE;
  c.lineWidth = 1.5 * u;
  c.stroke();
  c.clip();
  const font = (px: number, wt = 500, stretch = '') => (c.font = `${stretch}${wt} ${Math.round(px * u * 1.25)}px Archivo, Arial, sans-serif`);
  const ghost = (gx: number, gy: number, gw: number, gh: number) => {
    rr(c, gx, gy, gw, gh, Math.min(gh / 2, 5 * u));
    c.fillStyle = GHOST;
    c.fill();
  };
  c.textBaseline = 'middle';
  if (b.kind === 'header') {
    c.fillStyle = ACC;
    c.beginPath();
    c.arc(x + pad + 9 * u, y + h / 2, 9 * u, 0, 7);
    c.fill();
    font(27, 700);
    c.fillStyle = INK;
    c.fillText(b.title!, x + pad + 30 * u, y + h / 2 + 1);
    font(17, 600);
    const tw = c.measureText(b.action!).width + 30 * u;
    rr(c, x + w - pad - tw, y + h / 2 - 17 * u, tw, 34 * u, 17 * u);
    c.fillStyle = ACC;
    c.fill();
    c.fillStyle = '#0a1202';
    c.fillText(b.action!, x + w - pad - tw + 15 * u, y + h / 2 + 1);
  } else if (b.kind === 'stat') {
    font(16, 500);
    c.fillStyle = INK2;
    c.fillText(b.title!, x + pad, y + 28 * u);
    if (on) {
      font(50, 760);
      c.fillStyle = INK;
      c.fillText(b.value!, x + pad, y + h - 38 * u);
    } else ghost(x + pad, y + h - 56 * u, 70 * u, 34 * u);
  } else {
    font(17, 600);
    c.fillStyle = INK2;
    c.fillText(b.title!, x + pad, y + 26 * u);
    const top = y + 50 * u;
    const ih = h - 50 * u - pad;
    const iw = w - 2 * pad;
    if (b.kind === 'calendar') {
      const cols = 7;
      const rows = 5;
      const cw = iw / cols;
      const ch = ih / rows;
      const out = [3, 4, 5, 9, 15, 16, 17, 18, 19, 24, 30];
      for (let i = 0; i < cols * rows; i++) {
        const cx = x + pad + (i % cols) * cw;
        const cy = top + Math.floor(i / cols) * ch;
        rr(c, cx + 3 * u, cy + 3 * u, cw - 6 * u, ch - 6 * u, 7 * u);
        const hit = on && out.includes(i);
        c.fillStyle = hit ? ACC : '#182014';
        c.globalAlpha = hit ? (i % 3 === 0 ? 1 : 0.55) : 1;
        c.fill();
        c.globalAlpha = 1;
        font(14, 500);
        c.fillStyle = hit ? '#0a1202' : '#62775a';
        c.fillText(String(i + 1 > 31 ? i - 30 : i + 1), cx + 11 * u, cy + 18 * u);
      }
    } else if (b.kind === 'list' || b.kind === 'table') {
      const rows = b.rows!;
      const rh = Math.min(ih / rows.length, 62 * u);
      rows.forEach((r, i) => {
        const ry = top + i * rh;
        c.fillStyle = LINE;
        c.fillRect(x + pad, ry + rh - 1, iw, 1);
        if (!on) {
          ghost(x + pad, ry + rh / 2 - 7 * u, iw * (0.42 + ((i * 37) % 30) / 100), 14 * u);
          ghost(x + w - pad - 70 * u, ry + rh / 2 - 7 * u, 70 * u, 14 * u);
          return;
        }
        if (b.kind === 'list') {
          c.fillStyle = i === 0 ? ACC : '#2c3a22';
          c.beginPath();
          c.arc(x + pad + 15 * u, ry + rh / 2, 15 * u, 0, 7);
          c.fill();
          font(15, 700);
          c.fillStyle = i === 0 ? '#0a1202' : INK;
          c.fillText(r[0][0], x + pad + 10 * u, ry + rh / 2 + 1);
          font(18, 600);
          c.fillStyle = INK;
          c.fillText(r[0], x + pad + 42 * u, ry + rh / 2 + 1);
          font(15, 500);
          c.fillStyle = INK2;
          const tw = c.measureText(r[1]).width;
          c.fillText(r[1], x + w - pad - tw, ry + rh / 2 + 1);
        } else {
          font(16, 500);
          c.fillStyle = INK;
          c.fillText(r[0], x + pad, ry + rh / 2 + 1);
          font(13, 600);
          const tw = c.measureText(r[1]).width + 18 * u;
          const hot = r[1] === 'Open';
          rr(c, x + w - pad - tw, ry + rh / 2 - 12 * u, tw, 24 * u, 12 * u);
          c.fillStyle = hot ? ACC : '#232d1c';
          c.fill();
          c.fillStyle = hot ? '#0a1202' : INK2;
          c.fillText(r[1], x + w - pad - tw + 9 * u, ry + rh / 2 + 1);
        }
      });
    } else if (b.kind === 'chart') {
      const vals = [0.42, 0.7, 0.55, 0.95, 0.62, 0.3, 0.18];
      const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      const bw = iw / vals.length;
      const base = top + ih - 24 * u;
      for (let g = 0; g < 4; g++) {
        c.fillStyle = LINE;
        c.fillRect(x + pad, base - ((ih - 30 * u) * g) / 3, iw, 1);
      }
      vals.forEach((v, i) => {
        const bh = on ? v * (ih - 34 * u) : 8 * u;
        rr(c, x + pad + i * bw + bw * 0.2, base - bh, bw * 0.6, bh, 6 * u);
        c.fillStyle = on ? (i === 3 ? ACC : '#6f9a2a') : GHOST;
        c.fill();
        font(13, 500);
        c.fillStyle = '#62775a';
        c.fillText(days[i], x + pad + i * bw + bw * 0.5 - 4 * u, base + 14 * u);
      });
    } else if (b.kind === 'form') {
      const rows = b.rows!;
      const fh = Math.min(74 * u, (ih - 64 * u) / rows.length);
      rows.forEach((r, i) => {
        const fy = top + i * fh;
        font(13, 500);
        c.fillStyle = INK2;
        c.fillText(r[0], x + pad, fy + 9 * u);
        rr(c, x + pad, fy + 20 * u, iw, 38 * u, 8 * u);
        c.fillStyle = '#0c1009';
        c.fill();
        c.strokeStyle = i === 1 && on ? ACC : LINE;
        c.stroke();
        if (on) {
          font(17, 500);
          c.fillStyle = INK;
          c.fillText(r[1], x + pad + 12 * u, fy + 40 * u);
        } else ghost(x + pad + 12 * u, fy + 33 * u, iw * 0.4, 12 * u);
      });
      rr(c, x + pad, y + h - pad - 44 * u, iw, 44 * u, 10 * u);
      c.fillStyle = ACC;
      c.fill();
      font(18, 700);
      c.fillStyle = '#0a1202';
      c.fillText(b.action!, x + w / 2 - c.measureText(b.action!).width / 2, y + h - pad - 21 * u);
    } else if (b.kind === 'rooms') {
      const rows = b.rows!;
      const cols = 3;
      const cw = iw / cols;
      const ch = ih / 2;
      rows.forEach((r, i) => {
        const cx = x + pad + (i % cols) * cw;
        const cy = top + Math.floor(i / cols) * ch;
        const free = r[1] === 'Free';
        rr(c, cx + 4 * u, cy + 4 * u, cw - 8 * u, ch - 8 * u, 10 * u);
        c.fillStyle = on && free ? '#1d2a10' : '#151b11';
        c.fill();
        c.strokeStyle = on && free ? '#5c8a1c' : LINE;
        c.stroke();
        font(18, 650);
        c.fillStyle = INK;
        c.fillText(r[0], cx + 18 * u, cy + 30 * u);
        if (on) {
          c.fillStyle = free ? ACC : '#55634c';
          c.beginPath();
          c.arc(cx + 24 * u, cy + ch - 28 * u, 6 * u, 0, 7);
          c.fill();
          font(14, 500);
          c.fillStyle = free ? INK : INK2;
          c.fillText(r[1], cx + 38 * u, cy + ch - 27 * u);
        } else ghost(cx + 18 * u, cy + ch - 34 * u, 56 * u, 12 * u);
      });
    } else if (b.kind === 'timeline') {
      const lanes = 3;
      const lh = ih / lanes;
      const spans = [
        [0.05, 0.3],
        [0.42, 0.2],
        [0.7, 0.22],
        [0.16, 0.34],
        [0.6, 0.15],
        [0.3, 0.26],
      ];
      for (let l = 0; l < lanes; l++) {
        const ly = top + l * lh;
        rr(c, x + pad, ly + lh * 0.2, iw, lh * 0.6, 7 * u);
        c.fillStyle = '#0d1109';
        c.fill();
        if (!on) continue;
        for (let k = 0; k < 2; k++) {
          const s = spans[l * 2 + k];
          rr(c, x + pad + s[0] * iw, ly + lh * 0.2, s[1] * iw, lh * 0.6, 7 * u);
          c.fillStyle = (l + k) % 2 ? '#6f9a2a' : ACC;
          c.fill();
        }
      }
    }
  }
  c.restore();
}

/** One texture per app: top half is the skeleton (no data yet), bottom half is the live app. */
export function appTexture(app: AppDef, width: number) {
  const W = width;
  const H = Math.round(width * 0.625);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H * 2;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#080b06';
  c.fillRect(0, 0, W, H * 2);
  for (let s = 0; s < 2; s++) {
    c.save();
    c.translate(0, s * H);
    for (const b of app.blocks) drawBlock(c, b, W, H, s === 1);
    c.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/* ---------- the wall: 84 small published apps, each a different layout ---------- */

export const WALL_COLS = 12;
export const WALL_ROWS = 7;
export const TILE_NAMES = [
  'On-call roster', 'Budget tracker', 'Release checklist', 'Vendor list', 'Shift swap', 'Asset register', 'Onboarding steps',
  'Meeting notes', 'Expense check', 'Campaign planner', 'Stock count', 'Interview loop', 'Bug triage', 'Travel requests',
  'Policy finder', 'Team directory', 'Feedback inbox', 'Launch calendar', 'Training log', 'Access requests', 'Contract dates',
  'Survey results', 'Content queue', 'Desk map', 'Incident log', 'Order lookup', 'Price sheet', 'Roadmap view',
];

export function wallAtlas(cell = 168) {
  const cw = cell;
  const ch = Math.round(cell * 0.76);
  const cv = document.createElement('canvas');
  cv.width = cw * WALL_COLS;
  cv.height = ch * WALL_ROWS;
  const c = cv.getContext('2d')!;
  const accents = ['#b8ff3c', '#d8ff8a', '#8fe04a', '#f1ffd0', '#7ad6a0', '#e0f25a'];
  const r = rng(90210);
  for (let i = 0; i < WALL_COLS * WALL_ROWS; i++) {
    const ox = (i % WALL_COLS) * cw;
    const oy = Math.floor(i / WALL_COLS) * ch;
    const acc = accents[Math.floor(r() * accents.length)];
    c.save();
    c.translate(ox, oy);
    c.fillStyle = '#0b0f08';
    c.fillRect(0, 0, cw, ch);
    // header
    c.fillStyle = '#161c12';
    c.fillRect(0, 0, cw, 20);
    c.fillStyle = acc;
    c.beginPath();
    c.arc(11, 10, 4, 0, 7);
    c.fill();
    c.fillStyle = '#5d6f52';
    rr(c, 22, 7, 30 + r() * 44, 6, 3);
    c.fill();
    const layout = Math.floor(r() * 6);
    const m = 8;
    const top = 28;
    const ih = ch - top - m;
    const iw = cw - 2 * m;
    const card = (x: number, y: number, w: number, h: number) => {
      rr(c, x, y, w, h, 4);
      c.fillStyle = '#141a10';
      c.fill();
    };
    if (layout === 0) {
      // stats + chart
      for (let k = 0; k < 3; k++) {
        card(m + (k * iw) / 3, top, iw / 3 - 4, 24);
        c.fillStyle = k === 0 ? acc : '#8ea07f';
        c.fillRect(m + (k * iw) / 3 + 6, top + 9, 14 + r() * 14, 7);
      }
      card(m, top + 30, iw, ih - 30);
      for (let k = 0; k < 9; k++) {
        const bh = 6 + r() * (ih - 46);
        c.fillStyle = k % 4 === 1 ? acc : '#52702a';
        c.fillRect(m + 8 + (k * (iw - 16)) / 9, top + ih - 6 - bh, (iw - 16) / 9 - 4, bh);
      }
    } else if (layout === 1) {
      // list
      for (let k = 0; k < 5; k++) {
        const y = top + (k * ih) / 5;
        card(m, y, iw, ih / 5 - 4);
        c.fillStyle = k === Math.floor(r() * 5) ? acc : '#39472d';
        c.beginPath();
        c.arc(m + 10, y + ih / 10 - 2, 4.5, 0, 7);
        c.fill();
        c.fillStyle = '#7f9172';
        c.fillRect(m + 22, y + ih / 10 - 5, 30 + r() * 60, 5);
      }
    } else if (layout === 2) {
      // sidebar + grid
      card(m, top, 34, ih);
      for (let k = 0; k < 4; k++) {
        c.fillStyle = k === 1 ? acc : '#3d4b31';
        c.fillRect(m + 6, top + 8 + k * 14, 22, 5);
      }
      for (let k = 0; k < 6; k++) {
        const gx = m + 40 + (k % 3) * ((iw - 40) / 3);
        const gy = top + Math.floor(k / 3) * (ih / 2);
        card(gx, gy, (iw - 40) / 3 - 4, ih / 2 - 4);
        c.fillStyle = r() > 0.6 ? acc : '#31402a';
        c.fillRect(gx + 6, gy + 6, 14, 14);
      }
    } else if (layout === 3) {
      // form
      card(m, top, iw, ih);
      for (let k = 0; k < 3; k++) {
        c.fillStyle = '#0b0f08';
        rr(c, m + 8, top + 8 + k * 22, iw - 16, 15, 3);
        c.fill();
        c.fillStyle = '#6f8163';
        c.fillRect(m + 14, top + 13 + k * 22, 20 + r() * 50, 4);
      }
      rr(c, m + 8, top + ih - 22, 52, 15, 7);
      c.fillStyle = acc;
      c.fill();
    } else if (layout === 4) {
      // kanban
      for (let k = 0; k < 3; k++) {
        const kx = m + (k * iw) / 3;
        card(kx, top, iw / 3 - 4, ih);
        const n = 1 + Math.floor(r() * 3);
        for (let j = 0; j < n; j++) {
          rr(c, kx + 5, top + 6 + j * 22, iw / 3 - 14, 17, 3);
          c.fillStyle = j === 0 && k === 1 ? acc : '#2a3622';
          c.fill();
        }
      }
    } else {
      // line chart + table
      card(m, top, iw, ih * 0.5);
      c.strokeStyle = acc;
      c.lineWidth = 2;
      c.beginPath();
      for (let k = 0; k <= 10; k++) {
        const px = m + 6 + (k * (iw - 12)) / 10;
        const py = top + 8 + r() * (ih * 0.5 - 16);
        if (k === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.stroke();
      for (let k = 0; k < 3; k++) {
        c.fillStyle = '#39472d';
        c.fillRect(m, top + ih * 0.5 + 8 + k * 12, iw * (0.5 + r() * 0.5), 5);
      }
    }
    c.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
