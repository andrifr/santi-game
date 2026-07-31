// Generates the PWA / apple-touch icons as real PNG files.
// No dependencies - hand-rolled PNG encoder on top of node's zlib.
// Run:  node tools/make-icons.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 5x7 bitmap of the letter S
const GLYPH_S = [
  '.###.',
  '#...#',
  '#....',
  '.###.',
  '....#',
  '#...#',
  '.###.',
];

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const na = a / 255;
    px[i]     = Math.round(px[i]     * (1 - na) + r * na);
    px[i + 1] = Math.round(px[i + 1] * (1 - na) + g * na);
    px[i + 2] = Math.round(px[i + 2] * (1 - na) + b * na);
    px[i + 3] = Math.max(px[i + 3], a);
  };

  // background: deep navy -> plum diagonal gradient, full bleed (maskable-safe)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x / size) * 0.45 + (y / size) * 0.55;
      set(x, y, Math.round(14 + 40 * t), Math.round(16 + 14 * t), Math.round(38 + 48 * t), 255);
    }
  }

  // warm glow behind the mark
  const cx = size / 2, cy = size * 0.48, glow = size * 0.42;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy) / glow;
      if (d < 1) set(x, y, 255, 130, 30, Math.round(110 * Math.pow(1 - d, 2.2)));
    }
  }

  // solid orange disc
  const rDisc = size * 0.30;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const a = Math.max(0, Math.min(1, rDisc - d + 0.5));
      if (a > 0) set(x, y, 255, 176, 46, Math.round(255 * a));
    }
  }

  // "S" punched out in dark ink
  const cell = Math.max(1, Math.round(size * 0.072));
  const gw = 5 * cell, gh = 7 * cell;
  const gx = Math.round(cx - gw / 2), gy = Math.round(cy - gh / 2);
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      if (GLYPH_S[r][c] !== '#') continue;
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) set(gx + c * cell + x, gy + r * cell + y, 23, 18, 10, 255);
      }
    }
  }

  return encodePNG(size, size, px);
}

const outDir = path.join(__dirname, '..', 'assets', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(outDir, name), makeIcon(size));
  console.log('wrote', name, size + 'px');
}
