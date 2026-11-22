// Builds every icon file in public/ from the H mark (an H whose crossbar is the light rift).
// Run: node tools/gen/favicon/build.mjs
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const DEFS = '<defs><radialGradient id="g"><stop offset="0" stop-color="#4f7dff" stop-opacity=".95"/><stop offset=".5" stop-color="#2f58f0" stop-opacity=".4"/><stop offset="1" stop-color="#2f58f0" stop-opacity="0"/></radialGradient></defs>';
const MARK = '<ellipse cx="32" cy="32" rx="27" ry="17" fill="url(#g)"/><path d="M13 11h11v42H13zM40 11h11v42H40z" fill="#eef4ff"/><path d="M19 32C27 26.5 37 26.5 45 32C37 37.5 27 37.5 19 32Z" fill="#fff"/>';
const svg = (bg, k) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${DEFS}${bg}<g transform="translate(${(64 - 64 * k) / 2} ${(64 - 64 * k) / 2}) scale(${k})">${MARK}</g></svg>`;
const rounded = svg('<rect width="64" height="64" rx="14" fill="#05070d"/>', 1);
// full-bleed squares (the OS rounds them); the mark a little smaller
const square = (k) => svg('<rect width="64" height="64" fill="#05070d"/>', k);
const png = (s, size) => sharp(Buffer.from(s), { density: 1200 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

const out = 'public/';
writeFileSync(out + 'favicon.svg', rounded + '\n');
writeFileSync(out + 'favicon-96.png', await png(rounded, 96));
writeFileSync(out + 'apple-touch-icon.png', await png(square(0.86), 180));
writeFileSync(out + 'icon-192.png', await png(rounded, 192));
writeFileSync(out + 'icon-512.png', await png(rounded, 512));
writeFileSync(out + 'icon-maskable-512.png', await png(square(0.66), 512));

// favicon.ico: 16, 32, 48 as PNG entries
const sizes = [16, 32, 48];
const imgs = await Promise.all(sizes.map((s) => png(rounded, s)));
const head = Buffer.alloc(6 + 16 * imgs.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
let off = head.length;
imgs.forEach((b, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(sizes[i], e); head.writeUInt8(sizes[i], e + 1);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(b.length, e + 8); head.writeUInt32LE(off, e + 12);
  off += b.length;
});
writeFileSync(out + 'favicon.ico', Buffer.concat([head, ...imgs]));
