// Generates the PWA / apple-touch icons as real PNG files.
// No dependencies - hand-rolled PNG codec on top of node's zlib.
// Run:  node tools/make-icons.js
//
// The icon is a photo of Santi. `assets/icons/source-icon.png` is the
// master; replace that and re-run this to change every icon at once.
// (The .jpeg beside it is the original off a phone - node has no JPEG
// decoder, so it was converted once through a browser canvas.)
//
// Two shapes come out of it:
//
//   icon-192 / icon-512 / apple-touch-icon   the photo, full bleed
//   icon-512-maskable                        the photo inset on a dark
//                                            ground
//
// The maskable one exists because Android crops a maskable icon to
// whatever shape the launcher likes - a circle on most - and only the
// middle 80% is guaranteed to survive. Full bleed there would cut the
// top of his hair off.
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

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let pos = 8, w = 0, h = 0, depth = 0, color = 0, interlace = 0;
  const idat = [];
  let pal = null, trns = null;

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; color = data[9]; interlace = data[12];
    } else if (type === 'PLTE') pal = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }

  if (depth !== 8) throw new Error('unsupported bit depth ' + depth);
  if (interlace !== 0) throw new Error('interlaced pngs not supported');

  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
  if (!CH) throw new Error('unsupported colour type ' + color);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * CH;
  const out = Buffer.alloc(h * stride);

  // undo per-row filters
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= CH ? cur[i - CH] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= CH ? prev[i - CH] : 0;
      let v = src[i];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error('bad filter ' + filter);
      }
      cur[i] = v & 0xff;
    }
  }

  // normalise to RGBA
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    if (color === 6) { out.copy(rgba, p, i * 4, i * 4 + 4); }
    else if (color === 2) { rgba[p] = out[i * 3]; rgba[p + 1] = out[i * 3 + 1]; rgba[p + 2] = out[i * 3 + 2]; rgba[p + 3] = 255; }
    else if (color === 0) { rgba[p] = rgba[p + 1] = rgba[p + 2] = out[i]; rgba[p + 3] = 255; }
    else if (color === 4) { rgba[p] = rgba[p + 1] = rgba[p + 2] = out[i * 2]; rgba[p + 3] = out[i * 2 + 1]; }
    else if (color === 3) {
      const idx = out[i];
      rgba[p] = pal[idx * 3]; rgba[p + 1] = pal[idx * 3 + 1]; rgba[p + 2] = pal[idx * 3 + 2];
      rgba[p + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }
  return { w, h, data: rgba };
}

function resize(src, tw, th) {
  const dst = Buffer.alloc(tw * th * 4);
  const xr = src.w / tw, yr = src.h / th;
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor(y * yr), y1 = Math.min(src.h, Math.max(y0 + 1, Math.ceil((y + 1) * yr)));
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor(x * xr), x1 = Math.min(src.w, Math.max(x0 + 1, Math.ceil((x + 1) * xr)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * src.w + sx) * 4;
          const al = src.data[i + 3] / 255;
          // premultiply so transparent pixels don't bleed their colour in
          r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al;
          a += src.data[i + 3];
          n++;
        }
      }
      const o = (y * tw + x) * 4;
      const am = a / n;
      const un = am > 0.5 ? 255 / am : 0;
      dst[o] = Math.min(255, Math.round((r / n) * un));
      dst[o + 1] = Math.min(255, Math.round((g / n) * un));
      dst[o + 2] = Math.min(255, Math.round((b / n) * un));
      dst[o + 3] = Math.round(am);
    }
  }
  return dst;
}

// Centre-crop to a square first, so a future replacement can be any shape.
function square(src) {
  const side = Math.min(src.w, src.h);
  const ox = Math.floor((src.w - side) / 2), oy = Math.floor((src.h - side) / 2);
  const out = Buffer.alloc(side * side * 4);
  for (let y = 0; y < side; y++) {
    src.data.copy(out, y * side * 4,
      ((y + oy) * src.w + ox) * 4, ((y + oy) * src.w + ox + side) * 4);
  }
  return { w: side, h: side, data: out };
}

// Flatten onto the app's own background - a photo has no alpha, but a
// replacement might, and a launcher icon should never be see-through.
const BG = [11, 13, 26];

function flatten(px, size) {
  for (let i = 0; i < size * size; i++) {
    const a = px[i * 4 + 3] / 255;
    if (a === 1) continue;
    for (let c = 0; c < 3; c++) {
      px[i * 4 + c] = Math.round(px[i * 4 + c] * a + BG[c] * (1 - a));
    }
    px[i * 4 + 3] = 255;
  }
  return px;
}

function fullBleed(src, size) {
  return flatten(resize(src, size, size), size);
}

// The photo at `inset` of the width, centred on the flat background.
function masked(src, size, inset) {
  const inner = Math.round(size * inset);
  const small = resize(src, inner, inner);
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = BG[0]; px[i * 4 + 1] = BG[1]; px[i * 4 + 2] = BG[2]; px[i * 4 + 3] = 255;
  }
  const off = Math.round((size - inner) / 2);
  for (let y = 0; y < inner; y++) {
    small.copy(px, ((y + off) * size + off) * 4, y * inner * 4, (y + 1) * inner * 4);
  }
  return flatten(px, size);
}

const iconDir = path.join(__dirname, '..', 'assets', 'icons');
const srcPath = path.join(iconDir, 'source-icon.png');
if (!fs.existsSync(srcPath)) {
  console.error('missing ' + srcPath + ' - that file is the master icon');
  process.exit(1);
}

const src = square(decodePNG(fs.readFileSync(srcPath)));
console.log('source ' + src.w + 'x' + src.h);

const JOBS = [
  ['icon-192.png', 192, null],
  ['icon-512.png', 512, null],
  ['apple-touch-icon.png', 180, null],
  ['icon-512-maskable.png', 512, 0.78],
];

for (const [name, size, inset] of JOBS) {
  const px = inset ? masked(src, size, inset) : fullBleed(src, size);
  const out = path.join(iconDir, name);
  fs.writeFileSync(out, encodePNG(size, size, px));
  console.log(name + '  ' + size + 'x' + size + '  ' +
              (fs.statSync(out).size / 1024).toFixed(1) + 'kB');
}
