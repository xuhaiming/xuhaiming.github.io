import * as THREE from 'three';
import type { Ctx, Frame } from '../../world/types';
import { clamp01, css, damp, flag, seg, smooth } from '../../world/util';
import { COBALT, FONT, MONO, paint, placeAt, plinth, pointsMat, rr, tag, glowMat, type Paint, type Station, type Tag } from './kit';

/**
 * Station 1, Frontend: one product page taken apart into the five things that make it.
 * Back to front: server HTML, layout, components, state, shipped pixels. The stack fans out as you
 * scroll in; hovering (or tapping a tag) pulls one layer out and names its tools; the render toggle
 * replays first paint as SSR + hydration or as a client render; the locale toggle re-renders every
 * layer that holds a string; tapping the page presses "Add to cart" and the press travels down
 * through components into state and back up into the badge.
 */

const W = 1.7;
const H = 2.2;
const CW = 640;
const CH = 832;

type Locale = 'en' | 'zh' | 'id';
const STR: Record<Locale, { lang: string; nav: string[]; cart: string; title: string[]; price: string; stock: string; add: string; buy: string; tabs: string[]; desc: string; more: string }> = {
  en: { lang: 'en-SG', nav: ['Shop', 'Deals', 'Support'], cart: 'Cart', title: ['Cine camera,', 'cobalt edition'], price: 'S$ 489.00', stock: 'In stock', add: 'Add to cart', buy: 'Buy now', tabs: ['Details', 'Reviews'], desc: 'Hand-cranked 16 mm body, three-lens turret.', more: 'You may also like' },
  zh: { lang: 'zh-CN', nav: ['商城', '优惠', '客服'], cart: '购物车', title: ['电影摄影机', '钴蓝版'], price: '¥ 2,599.00', stock: '有货', add: '加入购物车', buy: '立即购买', tabs: ['商品详情', '用户评价'], desc: '手摇 16 毫米机身，三镜头转塔。', more: '猜你喜欢' },
  id: { lang: 'id-ID', nav: ['Belanja', 'Promo', 'Bantuan'], cart: 'Keranjang', title: ['Kamera sinema,', 'edisi kobalt'], price: 'Rp 5.790.000', stock: 'Stok tersedia', add: 'Tambah ke keranjang', buy: 'Beli sekarang', tabs: ['Detail', 'Ulasan'], desc: 'Bodi 16 mm engkol tangan, turet tiga lensa.', more: 'Mungkin Anda suka' },
};

const LAYERS = [
  { key: 'html', name: 'Server HTML', tools: 'Next.js · SSR · i18n', note: 'Real markup, in the reader’s language, before any script runs.' },
  { key: 'layout', name: 'Layout', tools: 'Tailwind CSS', note: 'Grid, spacing and tokens as utilities.' },
  { key: 'components', name: 'Components', tools: 'React · Vue', note: 'The page as parts that can ship on their own.' },
  { key: 'state', name: 'State and types', tools: 'TypeScript', note: 'What can change, and the shape it must have.' },
  { key: 'pixels', name: 'Shipped page', tools: 'Vite', note: 'Bundled, split per route, on screen.' },
] as const;

// page regions in canvas pixels: x, y, w, h
const R = {
  header: [24, 18, 592, 46],
  gallery: [24, 84, 300, 372],
  buy: [348, 84, 268, 372],
  tabs: [24, 482, 592, 120],
  cards: [24, 630, 592, 176],
} as const;
const BTN = { x: 348, y: 316, w: 268, h: 50 };
const uvOf = (x: number, y: number) => new THREE.Vector2(x / CW, 1 - y / CH);
const UV_BTN = uvOf(BTN.x + BTN.w / 2, BTN.y + BTN.h / 2);
const UV_BUY = uvOf(482, 270);
const UV_CART_STATE = uvOf(470, 118);
const UV_BADGE = uvOf(560, 41);

const group = new THREE.Group();
let now = 0;
const CAN_HOVER = matchMedia('(hover: hover)').matches;
const stack = new THREE.Group();
const meshes: THREE.Mesh[] = [];
const mats: THREE.ShaderMaterial[] = [];
const paints: Paint[] = [];
const tags: Tag[] = [];
let spark: THREE.Points;
let floorGlow: THREE.Mesh;
let photo: HTMLImageElement | null = null;
let statusEl: HTMLElement | null = null;
let panelEl: HTMLElement;

const st = {
  locale: 'en' as Locale,
  mode: 'ssr' as 'ssr' | 'csr',
  cart: 0,
  load: 1, // 0..1 first-paint replay
  loadGo: false,
  press: 1, // 0..1 add-to-cart pulse
  pressStage: 0,
  sel: -1, // layer pinned by a tag
  hover: -1,
  selAt: -99,
  auto: 0,
  touched: false,
  started: false,
  flash: [0, 0, 0, 0, 0],
  lift: [0, 0, 0, 0, 0],
  status: '',
  tiltX: 0,
  tiltY: 0,
};

/* ---------- drawing the five layers ---------- */

const C_INK = '#eef3ff';
const C_INK2 = 'rgba(190,206,240,0.78)';
const C_DIM = 'rgba(150,175,235,0.42)';
const C_BLUE = '#3f6bff';
const C_ICE = '#b9ceff';

function drawPixels(p: Paint) {
  const { g } = p;
  const s = STR[st.locale];
  g.clearRect(0, 0, CW, CH);
  g.textBaseline = 'middle';
  // header
  g.fillStyle = C_BLUE;
  g.beginPath();
  g.moveTo(40, 41);
  g.lineTo(52, 29);
  g.lineTo(64, 41);
  g.lineTo(52, 53);
  g.fill();
  g.font = FONT(17, 560);
  g.fillStyle = C_INK2;
  let x = 92;
  for (const n of s.nav) {
    g.fillText(n, x, 42);
    x += g.measureText(n).width + 26;
  }
  g.font = FONT(16, 620);
  const cartText = `${s.cart}  ${st.cart}`;
  const cw = g.measureText(cartText).width + 30;
  rr(g, 616 - cw, 24, cw, 34, 17);
  g.fillStyle = st.cart ? C_BLUE : 'rgba(63,107,255,0.22)';
  g.fill();
  g.fillStyle = C_INK;
  g.fillText(cartText, 616 - cw + 15, 42);
  g.fillStyle = 'rgba(150,180,255,0.16)';
  g.fillRect(24, 70, 592, 1.5);

  // gallery
  rr(g, 24, 84, 300, 300, 16);
  const gr = g.createLinearGradient(24, 84, 324, 384);
  gr.addColorStop(0, '#16224a');
  gr.addColorStop(1, '#0a1026');
  g.fillStyle = gr;
  g.fill();
  if (photo) {
    g.save();
    rr(g, 24, 84, 300, 300, 16);
    g.clip();
    g.drawImage(photo, 24, 84, 300, 300);
    g.restore();
  }
  for (let i = 0; i < 4; i++) {
    rr(g, 24 + i * 77, 396, 69, 60, 10);
    g.fillStyle = i === 0 ? 'rgba(63,107,255,0.5)' : 'rgba(40,58,120,0.55)';
    g.fill();
    if (photo) {
      g.save();
      rr(g, 24 + i * 77 + 3, 399, 63, 54, 8);
      g.clip();
      g.globalAlpha = i === 0 ? 1 : 0.55;
      const z = 1.3 + i * 0.5;
      g.drawImage(photo, photo.width * (0.5 - 0.5 / z) + (i - 1.5) * 30, photo.height * (0.5 - 0.5 / z), photo.width / z, photo.height / z, 24 + i * 77 + 3, 399, 63, 54);
      g.restore();
    }
  }

  // buy box
  g.fillStyle = C_INK;
  g.font = FONT(29, 740);
  g.fillText(s.title[0], 348, 104);
  g.fillText(s.title[1], 348, 140);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i < 4 ? C_ICE : 'rgba(150,175,235,0.3)';
    g.beginPath();
    g.arc(354 + i * 16, 178, 5, 0, 7);
    g.fill();
  }
  g.font = FONT(15, 520);
  g.fillStyle = C_INK2;
  g.fillText(s.stock, 440, 179);
  g.font = FONT(34, 760);
  g.fillStyle = C_INK;
  g.fillText(s.price, 348, 226);
  const sw = ['#3f6bff', '#1b2233', '#c9cfdc'];
  sw.forEach((c, i) => {
    g.beginPath();
    g.arc(364 + i * 44, 278, 14, 0, 7);
    g.fillStyle = c;
    g.fill();
    if (i === 0) {
      g.beginPath();
      g.arc(364, 278, 19, 0, 7);
      g.strokeStyle = C_INK;
      g.lineWidth = 2;
      g.stroke();
    }
  });
  rr(g, BTN.x, BTN.y, BTN.w, BTN.h, 25);
  g.fillStyle = C_BLUE;
  g.fill();
  g.font = FONT(18, 660);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.fillText(s.add, BTN.x + BTN.w / 2, BTN.y + BTN.h / 2 + 1);
  rr(g, 349, 379, 266, 48, 24);
  g.strokeStyle = 'rgba(185,206,255,0.6)';
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = C_INK;
  g.fillText(s.buy, 482, 404);
  g.textAlign = 'left';

  // tabs
  g.font = FONT(18, 640);
  g.fillStyle = C_INK;
  g.fillText(s.tabs[0], 24, 502);
  const tw = g.measureText(s.tabs[0]).width;
  g.fillStyle = C_INK2;
  g.fillText(s.tabs[1], 24 + tw + 32, 502);
  g.fillStyle = 'rgba(150,180,255,0.16)';
  g.fillRect(24, 522, 592, 1.5);
  g.fillStyle = C_BLUE;
  g.fillRect(24, 520, tw, 3);
  g.font = FONT(17, 440);
  g.fillStyle = C_INK2;
  g.fillText(s.desc, 24, 552);
  g.fillStyle = 'rgba(150,175,235,0.2)';
  rr(g, 24, 574, 470, 10, 5);
  g.fill();
  rr(g, 24, 594, 330, 10, 5);
  g.fill();

  // related
  g.font = FONT(18, 640);
  g.fillStyle = C_INK;
  g.fillText(s.more, 24, 642);
  for (let i = 0; i < 4; i++) {
    const cx = 24 + i * 151;
    rr(g, cx, 664, 139, 142, 12);
    g.fillStyle = 'rgba(28,42,92,0.6)';
    g.fill();
    rr(g, cx + 8, 672, 123, 84, 8);
    const cg = g.createLinearGradient(cx, 672, cx + 123, 756);
    cg.addColorStop(0, ['#22367a', '#1c2a5c', '#2a3f8c', '#18244e'][i]);
    cg.addColorStop(1, '#0c1430');
    g.fillStyle = cg;
    g.fill();
    g.fillStyle = 'rgba(190,206,240,0.55)';
    rr(g, cx + 8, 768, 80 - i * 8, 8, 4);
    g.fill();
    g.fillStyle = C_ICE;
    rr(g, cx + 8, 784, 46, 9, 4);
    g.fill();
  }
  p.done();
}

function drawLayout(p: Paint) {
  const { g } = p;
  g.clearRect(0, 0, CW, CH);
  g.textBaseline = 'middle';
  // 12 columns
  const colW = (592 - 11 * 16) / 12;
  for (let i = 0; i < 12; i++) {
    g.fillStyle = 'rgba(63,107,255,0.13)';
    g.fillRect(24 + i * (colW + 16), 8, colW, CH - 16);
  }
  const box = (r: readonly number[], cls: string) => {
    g.setLineDash([7, 6]);
    g.strokeStyle = C_ICE;
    g.lineWidth = 1.6;
    rr(g, r[0], r[1], r[2], r[3], 8);
    g.stroke();
    g.setLineDash([]);
    g.font = MONO(15, 560);
    const w = g.measureText(cls).width + 16;
    rr(g, r[0] + 8, r[1] + 8, w, 24, 6);
    g.fillStyle = 'rgba(10,18,44,0.92)';
    g.fill();
    g.fillStyle = C_INK;
    g.fillText(cls, r[0] + 16, r[1] + 21);
  };
  box(R.header, 'flex h-14 justify-between');
  box(R.gallery, 'col-span-6 aspect-square');
  box(R.buy, 'col-span-6 space-y-4');
  box(R.tabs, 'mt-8 border-b');
  box(R.cards, 'grid grid-cols-4 gap-4');
  // spacing marks
  const gap = (x: number, y0: number, y1: number, t: string) => {
    g.strokeStyle = C_BLUE;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 6, y0);
    g.lineTo(x + 6, y0);
    g.moveTo(x, y0);
    g.lineTo(x, y1);
    g.moveTo(x - 6, y1);
    g.lineTo(x + 6, y1);
    g.stroke();
    g.font = MONO(14, 600);
    g.fillStyle = '#8fb0ff';
    g.fillText(t, x + 12, (y0 + y1) / 2);
  };
  gap(300, 64, 84, 'gap-5');
  gap(300, 456, 482, 'mt-8');
  gap(300, 602, 630, 'gap-6');
  p.done();
}

function drawComponents(p: Paint) {
  const { g } = p;
  g.clearRect(0, 0, CW, CH);
  g.textBaseline = 'middle';
  const box = (x: number, y: number, w: number, h: number, name: string, big = true) => {
    rr(g, x, y, w, h, 10);
    g.fillStyle = 'rgba(63,107,255,0.14)';
    g.fill();
    g.strokeStyle = C_ICE;
    g.lineWidth = 2;
    g.stroke();
    if (!name) return;
    g.font = MONO(big ? 19 : 14, 620);
    g.fillStyle = C_INK;
    g.textAlign = 'center';
    g.fillText(name, x + w / 2, y + h / 2);
    g.textAlign = 'left';
  };
  box(R.header[0], R.header[1], R.header[2], R.header[3], '<Header />');
  box(24, 84, 300, 372, '<Gallery />');
  box(348, 84, 268, 372, '');
  g.font = MONO(19, 620);
  g.fillStyle = C_INK;
  g.textAlign = 'center';
  g.fillText('<BuyBox />', 482, 130);
  g.textAlign = 'left';
  box(360, 210, 244, 40, '<Price />', false);
  box(360, 262, 244, 40, '<Variants />', false);
  box(360, 316, 244, 48, '<AddToCart />', false);
  box(360, 378, 244, 48, '<BuyNow />', false);
  box(R.tabs[0], R.tabs[1], R.tabs[2], R.tabs[3], '<Tabs />');
  for (let i = 0; i < 4; i++) box(24 + i * 151, 664, 139, 142, i === 0 ? '<Card />' : '', false);
  g.font = MONO(15, 600);
  g.fillStyle = '#8fb0ff';
  g.fillText('related.map(…)', 24, 642);
  p.done();
}

function drawState(p: Paint) {
  const { g } = p;
  g.clearRect(0, 0, CW, CH);
  g.textBaseline = 'middle';
  const chip = (x: number, y: number, key: string, type: string, ax: number, ay: number, hot = false) => {
    g.font = MONO(16, 600);
    const kw = g.measureText(key + ': ').width;
    const w = kw + g.measureText(type).width + 24;
    g.strokeStyle = 'rgba(143,176,255,0.7)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x + w / 2, y + 16);
    g.lineTo(ax, ay);
    g.stroke();
    g.beginPath();
    g.arc(ax, ay, 5, 0, 7);
    g.fillStyle = C_ICE;
    g.fill();
    rr(g, x, y, w, 32, 8);
    g.fillStyle = hot ? 'rgba(63,107,255,0.85)' : 'rgba(18,30,74,0.95)';
    g.fill();
    g.strokeStyle = C_ICE;
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = '#9bb6ff';
    g.fillText(key + ': ', x + 12, y + 17);
    g.fillStyle = C_INK;
    g.fillText(type, x + 12 + kw, y + 17);
  };
  chip(40, 100, 'locale', `'${STR[st.locale].lang}'`, 150, 42);
  chip(356, 100, 'cart', `CartItem[${st.cart}]`, 560, 42, st.cart > 0);
  chip(60, 250, 'product', 'Product', 174, 330);
  chip(372, 196, 'price', 'Money', 420, 240);
  chip(372, 262, 'variant', `'cobalt'`, 364, 300);
  chip(372, 440, 'addToCart', '(id) => void', 482, 344);
  chip(60, 540, 'tab', `'details'`, 60, 506);
  chip(180, 716, 'related', 'Product[]', 94, 760);
  p.done();
}

function drawHtml(p: Paint) {
  const { g } = p;
  const s = STR[st.locale];
  g.clearRect(0, 0, CW, CH);
  g.textBaseline = 'middle';
  g.font = MONO(18, 520);
  const lines: [number, string, string, string][] = [
    [0, `<html lang="${s.lang}">`, '', ''],
    [1, '<header>', ` ${s.nav.join(' · ')} `, '</header>'],
    [1, '<main>', '', ''],
    [2, '<img', ' alt="', '" />'],
    [2, '<h1>', `${s.title.join(' ')}`, '</h1>'],
    [2, '<p>', s.price, '</p>'],
    [2, '<button>', s.add, '</button>'],
    [2, '<button>', s.buy, '</button>'],
    [2, '<section>', '', ''],
    [3, '<h2>', s.tabs[0], '</h2>'],
    [3, '<p>', s.desc.length > 30 ? s.desc.slice(0, 29) + '…' : s.desc, '</p>'],
    [2, '</section>', '', ''],
    [2, '<h2>', s.more, '</h2>'],
    [2, '<ul>', ' 4 × <li> ', '</ul>'],
    [1, '</main>', '', ''],
    [1, '<script', ' src="/_next/…" defer', '>'],
    [0, '</html>', '', ''],
  ];
  let y = 54;
  for (const [ind, a, b, c] of lines) {
    let x = 30 + ind * 26;
    g.fillStyle = 'rgba(120,150,235,0.28)';
    for (let k = 0; k < ind; k++) g.fillRect(36 + k * 26, y - 20, 1.5, 40);
    g.fillStyle = '#7f9dff';
    g.fillText(a, x, y);
    x += g.measureText(a).width;
    g.fillStyle = C_INK;
    g.fillText(b, x, y);
    x += g.measureText(b).width;
    g.fillStyle = '#7f9dff';
    g.fillText(c, x, y);
    y += 44;
  }
  p.done();
}

const DRAW = [drawHtml, drawLayout, drawComponents, drawState, drawPixels];
const redraw = (...idx: number[]) => idx.forEach((i) => DRAW[i](paints[i]));

/* ---------- build ---------- */

function layerMat(tex: THREE.Texture) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: tex },
      uA: { value: 1 },
      uGlow: { value: 0 },
      uDim: { value: 1 },
      uPaint: { value: 1 },
      uShell: { value: 0 },
      uHyd: { value: 1 },
      uBar: { value: 0 },
      uFlash: { value: 0 },
      uPulse: { value: 1 },
      uPulseAt: { value: new THREE.Vector2(0.5, 0.5) },
      uHot: { value: 0 },
      uTime: { value: 0 },
      uCol: { value: COBALT.clone() },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uA, uGlow, uDim, uPaint, uShell, uHyd, uBar, uFlash, uPulse, uHot, uTime; uniform vec2 uPulseAt; uniform vec3 uCol;
      varying vec2 vUv;
      float sdRR(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec2 p = (vUv - 0.5) * vec2(${W.toFixed(2)}, ${H.toFixed(2)});
        float d = sdRR(p, vec2(${(W / 2).toFixed(3)}, ${(H / 2).toFixed(3)}), 0.07);
        if (d > 0.0) discard;
        float edge = smoothstep(-0.016, -0.003, d);
        float inner = smoothstep(-0.35, 0.0, d);
        vec4 t = texture2D(uMap, vUv);
        float y = 1.0 - vUv.y;
        float vis = max(uPaint, uShell * step(y, 0.082));
        float h = uHyd >= 0.999 ? 1.0 : smoothstep(uHyd + 0.004, uHyd - 0.02, y);
        vec3 c = t.rgb;
        float l = dot(c, vec3(0.3, 0.6, 0.1));
        c = mix(vec3(l) * vec3(0.5, 0.56, 0.7), c, h);
        float line = (uHyd > 0.001 && uHyd < 0.999) ? smoothstep(0.022, 0.0, abs(y - uHyd)) : 0.0;
        // client render: the bundle bar
        float bar = 0.0;
        if (uBar > 0.001) {
          float by = smoothstep(0.012, 0.006, abs(y - 0.5));
          bar = by * step(0.2, vUv.x) * step(vUv.x, 0.8) * (0.25 + 0.75 * step(vUv.x, 0.2 + 0.6 * uBar));
        }
        // a press: ring that opens from a point
        vec2 q = (vUv - uPulseAt) * vec2(${W.toFixed(2)}, ${H.toFixed(2)});
        float pr = uPulse * 0.55;
        float ring = smoothstep(0.03, 0.0, abs(length(q) - pr)) * (1.0 - uPulse) * step(uPulse, 0.999);
        // the affordance: a slow ring breathing on the buy button
        vec2 hq = (vUv - vec2(${UV_BTN.x.toFixed(4)}, ${UV_BTN.y.toFixed(4)})) * vec2(${W.toFixed(2)}, ${H.toFixed(2)});
        float ph = fract(uTime * 0.45);
        float hot = smoothstep(0.018, 0.0, abs(length(hq) - 0.05 - ph * 0.2)) * (1.0 - ph) * uHot;

        vec3 glass = vec3(0.012, 0.022, 0.062) * (0.55 + 0.45 * vUv.y) + uCol * inner * 0.035;
        vec3 col = glass + c * t.a * vis * (0.82 + uGlow * 0.45) * uDim;
        col += uCol * edge * (0.5 + uGlow * 1.6) * (0.35 + 0.65 * uDim);
        col += mix(uCol, vec3(1.0), 0.5) * (line * 1.6 + ring * 1.8 + hot * 1.2 + bar * 1.4);
        col += uCol * uFlash * (0.22 + 0.5 * t.a);
        float a = mix(0.74, 0.95, clamp(t.a * vis + edge + uGlow * 0.3, 0.0, 1.0)) * uA;
        gl_FragColor = vec4(col, a);
      }`,
  });
}

function init(ctx: Ctx, panel: HTMLElement, layer: HTMLElement) {
  panelEl = panel;
  statusEl = panel.querySelector('.r-status');
  stack.position.y = 1.62;
  group.add(stack);
  const geo = new THREE.PlaneGeometry(W, H);
  LAYERS.forEach((L, i) => {
    const p = paint(CW, CH, ctx);
    paints.push(p);
    const m = layerMat(p.tex);
    mats.push(m);
    const mesh = new THREE.Mesh(geo, m);
    mesh.renderOrder = 10 + i;
    mesh.userData.i = i;
    meshes.push(mesh);
    stack.add(mesh);
    const t = tag(layer, `<b>${L.name}</b><i>${L.tools}</i><em>${L.note}</em>`, 'r-layer', true);
    t.el.dataset.i = String(i);
    t.el.addEventListener('click', () => {
      st.sel = st.sel === i ? -1 : i;
      st.selAt = now;
      st.touched = true;
    });
    t.el.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') {
        st.hover = i;
        st.touched = true;
      }
    });
    t.el.addEventListener('pointerleave', () => (st.hover = -1));
    tags.push(t);
  });
  redraw(0, 1, 2, 3, 4);
  document.fonts?.load(FONT(20, 600)).then(() => redraw(0, 1, 2, 3, 4));
  const img = new Image();
  img.onload = () => {
    photo = img;
    redraw(4);
  };
  img.src = '/assets/range/camera-512.webp';

  // the press that travels between layers
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 8), 3));
  sg.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(8).map((_, i) => 9 - i), 1));
  sg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(8).map((_, i) => 1 - i / 8), 1));
  spark = new THREE.Points(sg, pointsMat('#dfe9ff'));
  spark.frustumCulled = false;
  spark.renderOrder = 30;
  stack.add(spark);

  const pl = plinth(1.05, 0.14);
  group.add(pl);
  floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), glowMat());
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = 0.15;
  group.add(floorGlow);

  // controls
  panel.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      st.mode = b.dataset.mode as 'ssr' | 'csr';
      st.load = 0;
      st.loadGo = true;
      st.touched = true;
      syncButtons();
    }),
  );
  panel.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach((b) =>
    b.addEventListener('click', () => {
      setLocale(b.dataset.locale as Locale);
      st.touched = true;
    }),
  );
  syncButtons();
}

function setLocale(l: Locale) {
  if (st.locale === l) return;
  st.locale = l;
  redraw(0, 3, 4);
  st.flash[0] = st.flash[3] = st.flash[4] = 1;
  syncButtons();
}

function syncButtons() {
  panelEl.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === st.mode)));
  panelEl.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.locale === st.locale)));
}

function status(text: string) {
  if (st.status === text || !statusEl) return;
  st.status = text;
  statusEl.textContent = text;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const PATH: [number, THREE.Vector2][] = [
  [4, UV_BTN],
  [2, UV_BUY],
  [3, UV_CART_STATE],
  [4, UV_BADGE],
];
function uvToLocal(layer: number, uv: THREE.Vector2, out: THREE.Vector3) {
  const m = meshes[layer];
  return out.set((uv.x - 0.5) * W, (uv.y - 0.5) * H, 0.01).add(m.position);
}

function update(s: number, on: number, pre: number, f: Frame, ctx: Ctx) {
  const { t, dt } = f;
  now = t;
  const narrow = ctx.size.narrow;
  const e = Math.max(smooth(seg(s, 0.02, 0.5)), pre);
  const active = on > 0.6;

  if (active && !st.started) {
    st.started = true;
    st.load = ctx.shot ? 1 : 0;
    st.loadGo = true;
  }
  if (on < 0.05) st.started = false;

  // ---- which layer is out ----
  let sel = st.hover;
  if (sel < 0 && active && ctx.pointer.seen && !narrow && CAN_HOVER) {
    const hit = ctx.ray().intersectObjects(meshes, false)[0];
    if (hit) {
      sel = hit.object.userData.i;
      st.touched = true;
      st.selAt = t;
    }
  }
  if (sel < 0) sel = st.sel;
  if (sel < 0 && active && !st.touched && e > 0.9 && !ctx.still) sel = Math.floor(t / 2.8) % 5; // idle: walk through the layers
  if (sel < 0 && ctx.shot && e > 0.9) sel = 2;

  // ---- first paint replay ----
  if (st.loadGo && st.load < 1) st.load = Math.min(1, st.load + dt / 3.4);
  const L = st.load;
  let paintA = 1;
  let hyd = 1;
  let shell = 0;
  let bar = 0;
  let htmlA = 1;
  if (st.mode === 'ssr') {
    paintA = smooth(seg(L, 0.12, 0.22));
    hyd = L >= 1 ? 1 : seg(L, 0.42, 0.97);
    htmlA = 1;
    status(L < 0.12 ? 'Request sent' : L < 0.42 ? 'HTML arrives from the server: the page is already readable' : L < 1 ? 'Hydrating: handlers attach, top to bottom' : 'Server-rendered, then hydrated. Readable first, interactive second.');
  } else {
    shell = smooth(seg(L, 0.08, 0.14));
    bar = L > 0.14 && L < 0.7 ? seg(L, 0.14, 0.66) : 0;
    paintA = smooth(seg(L, 0.68, 0.8));
    hyd = 1;
    htmlA = 0.22;
    status(L < 0.14 ? 'Request sent' : L < 0.68 ? 'An empty shell arrives. The bundle downloads and runs' : L < 1 ? 'The browser builds the page' : 'Client-rendered. Nothing to read until the script has run.');
  }

  // ---- add-to-cart press ----
  if (st.press < 1) {
    st.press = Math.min(1, st.press + dt / 1.7);
    if (st.pressStage === 0 && st.press > 0.55) {
      st.pressStage = 1;
      st.cart += 1;
      redraw(3);
      st.flash[3] = 1;
    }
    if (st.pressStage === 1 && st.press > 0.86) {
      st.pressStage = 2;
      redraw(4);
      st.flash[4] = 0.6;
    }
  }
  const pk = st.press * 3; // 3 legs
  const leg = Math.min(2, Math.floor(pk));
  const lt = smooth(pk - leg);

  // ---- layers ----
  const tx = active && !ctx.still ? ctx.pointer.x * 0.16 : 0;
  const ty = active && !ctx.still ? ctx.pointer.y * 0.08 : 0;
  st.tiltX += (tx - st.tiltX) * damp(4, dt);
  st.tiltY += (ty - st.tiltY) * damp(4, dt);
  stack.rotation.y = st.tiltX + Math.sin(t * 0.4) * 0.025;
  stack.rotation.x = -st.tiltY;
  stack.position.y = 1.62 + Math.sin(t * 0.7) * 0.012;

  const gap = narrow ? 0.34 : 0.4;
  for (let i = 0; i < 5; i++) {
    const m = meshes[i];
    const u = mats[i].uniforms;
    const k = i - 2;
    const isSel = sel === i ? 1 : 0;
    st.lift[i] += (isSel - st.lift[i]) * damp(7, dt);
    st.flash[i] *= Math.exp(-dt * 2.6);
    const lift = st.lift[i];
    m.position.set(-k * (narrow ? 0.12 : 0.27) * e - lift * 0.1 * e, -k * 0.1 * e + lift * 0.07 * e, k * gap * e + lift * 0.22 * e + i * 0.004);
    m.rotation.y = lift * 0.08 * e;
    u.uGlow.value = lift;
    u.uDim.value = sel >= 0 ? 0.3 + 0.7 * lift : 0.85;
    u.uA.value = i === 4 ? 1 : Math.max(e, 0.0);
    u.uFlash.value = st.flash[i];
    u.uTime.value = t;
    u.uPulse.value = 1;
    u.uHot.value = 0;
    u.uShell.value = 0;
    u.uBar.value = 0;
    u.uPaint.value = 1;
    u.uHyd.value = 1;
    m.visible = i === 4 || e > 0.01;
  }
  // per-layer first paint
  mats[0].uniforms.uPaint.value = htmlA * smooth(seg(L, 0.06, 0.16));
  mats[2].uniforms.uHyd.value = hyd;
  mats[2].uniforms.uPaint.value = st.mode === 'csr' ? paintA : 1;
  mats[3].uniforms.uPaint.value = st.mode === 'csr' ? paintA : smooth(seg(hyd, 0.0, 0.2));
  mats[3].uniforms.uHyd.value = hyd;
  mats[4].uniforms.uPaint.value = paintA;
  mats[4].uniforms.uShell.value = shell;
  mats[4].uniforms.uBar.value = bar;
  mats[4].uniforms.uHyd.value = hyd;
  mats[4].uniforms.uHot.value = L >= 1 && st.press >= 1 && active ? 1 : 0;
  if (st.mode === 'ssr' && L > 0.1 && L < 0.3) st.flash[0] = Math.max(st.flash[0], 0.8);
  // press rings
  if (st.press < 1) {
    mats[4].uniforms.uPulseAt.value.copy(pk < 2 ? UV_BTN : UV_BADGE);
    mats[4].uniforms.uPulse.value = pk < 2 ? clamp01(pk / 0.9) : clamp01((pk - 2.5) / 0.5);
    mats[2].uniforms.uPulseAt.value.copy(UV_BUY);
    mats[2].uniforms.uPulse.value = clamp01((pk - 0.9) / 0.9);
    mats[3].uniforms.uPulseAt.value.copy(UV_CART_STATE);
    mats[3].uniforms.uPulse.value = clamp01((pk - 1.8) / 0.9);
  }
  // spark with a short trail
  const sp = spark.geometry.attributes.position as THREE.BufferAttribute;
  spark.visible = st.press < 1 && e > 0.2;
  if (spark.visible) {
    for (let j = 0; j < 8; j++) {
      const kk = Math.max(0, pk - j * 0.035);
      const lg = Math.min(2, Math.floor(kk));
      const tt = smooth(kk - lg);
      uvToLocal(PATH[lg][0], PATH[lg][1], _a);
      uvToLocal(PATH[lg + 1][0], PATH[lg + 1][1], _b);
      _a.lerp(_b, tt);
      _a.x -= Math.sin(tt * Math.PI) * 0.18; // arc out of the stack so the hop reads
      sp.setXYZ(j, _a.x, _a.y, _a.z);
    }
    sp.needsUpdate = true;
    (spark.material as THREE.ShaderMaterial).uniforms.uS.value = ctx.size.dpr * (ctx.size.h / 900) * 2.2;
  }
  void leg;
  void lt;

  (floorGlow.material as THREE.ShaderMaterial).uniforms.uA.value = 0.05 + 0.08 * on;

  // ---- tags ----
  const showTags = on * smooth(seg(e, 0.55, 0.95));
  // tags sit in one column to the right of the stack, each on a leader back to its own layer
  let col = 0;
  let top = 1e9;
  for (let i = 0; i < 5; i++) {
    _a.set(W / 2, H / 2 - 0.25 - i * 0.2, 0);
    meshes[i].localToWorld(_a);
    ctx.project(_a, scr[i]);
    col = Math.max(col, scr[i].x);
    top = Math.min(top, scr[i].y);
  }
  col = Math.min(col + 26, ctx.size.w - (narrow ? 118 : 250));
  let y = top;
  const row = narrow ? 30 : 40;
  for (let i = 0; i < 5; i++) {
    const tg = tags[i];
    placeAt(tg, col, y, scr[i].z > 1 ? 0 : showTags, dt);
    css(tg.in, '--lead', `${Math.max(0, col - scr[i].x).toFixed(0)}px`);
    flag(tg.el, 'on', sel === i);
    y += row + st.lift[i] * (narrow ? 16 : 66);
  }
}

const scr = [0, 1, 2, 3, 4].map(() => ({ x: 0, y: 0, z: 0 }));

function tap(ctx: Ctx) {
  // any tap on the exhibit presses the button; the layers show what that touches
  const hit = ctx.ray().intersectObjects(meshes, false)[0];
  if (!hit) return;
  if (st.load < 1 || st.press < 1) return;
  st.press = 0;
  st.pressStage = 0;
  st.touched = true;
}

function act(name: string) {
  st.touched = true;
  if (name === 'csr' || name === 'ssr') {
    st.mode = name;
    st.load = 0.55;
    st.loadGo = false;
    st.started = true;
    syncButtons();
  }
  if (name === 'zh' || name === 'id') setLocale(name);
  if (name === 'press') {
    st.press = 0.5;
    st.started = true;
    st.cart = 1;
    redraw(3, 4);
  }
  if (/^layer-\d$/.test(name)) st.sel = Number(name.slice(6));
}

export const frontend: Station = { group, init, update, tap, act };
