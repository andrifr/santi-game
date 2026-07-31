// Downscales the character art so the game loads fast on mobile.
// The source files are ~1.4 MB each; in game they're never drawn much
// bigger than 300px. No dependencies - PNG decode/encode by hand.
//
//   node tools/optimize-faces.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const MAX = 512;

/* ---------------- PNG decode ---------------- */
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

/* ---------------- PNG encode ---------------- */
const T = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = b => { let c = -1; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  // Paeth-filter every row - roughly halves the output on this kind of art
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 4;
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? rgba[y * stride + i - 4] : 0;
      const b = y > 0 ? rgba[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= 4 ? rgba[(y - 1) * stride + i - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      raw[y * (stride + 1) + 1 + i] = (rgba[y * stride + i] - pred) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- box-filter downscale (premultiplied) ---------------- */
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

/* ---------------- crop to the opaque bounding box ---------------- */
function trim(src) {
  let minX = src.w, minY = src.h, maxX = -1, maxY = -1;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (src.data[(y * src.w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return src;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    src.data.copy(data, y * w * 4, ((y + minY) * src.w + minX) * 4, ((y + minY) * src.w + minX + w) * 4);
  }
  return { w, h, data };
}

/* ---------------- run ---------------- */
// Every source already ships with a proper alpha channel, so this is
// purely a trim + downscale + re-encode pass.
const JOBS = [
  ['santi1nobg.png', 'santi.png'],
  ['santi2nobg.png', 'santi-side.png'],
  ['santi3nobg.png', 'santi-chain.png'],
  ['santi4nog-michaeljackson.png', 'santi-mj.png'],
  ['daley1nobg.png', 'daley-side.png'],
  ['daley2nobg.png', 'daley.png'],
  ['daley3nobg.png', 'daley-alt.png'],
  ['ruecart1.png', 'rue-face.png'],
  ['ruecart2.png', 'rue.png'],
  ['ruecart3.png', 'rue-side.png'],
];

const dir = path.join(__dirname, '..', 'assets', 'faces');
let before = 0, after = 0;

for (const [from, to] of JOBS) {
  const p = path.join(dir, from);
  if (!fs.existsSync(p)) { console.log('skip (missing)', from); continue; }
  const srcBytes = fs.statSync(p).size;
  const img = trim(decodePNG(fs.readFileSync(p)));
  const scale = Math.min(1, MAX / Math.max(img.w, img.h));
  const tw = Math.max(1, Math.round(img.w * scale));
  const th = Math.max(1, Math.round(img.h * scale));
  const out = scale < 1 ? resize(img, tw, th) : img.data;
  const png = encodePNG(tw, th, out);
  fs.writeFileSync(path.join(dir, to), png);
  before += srcBytes;
  after += png.length;
  console.log(
    from.padEnd(32), '->', to.padEnd(18),
    `${img.w}x${img.h} -> ${tw}x${th}`,
    `${(srcBytes / 1024).toFixed(0)}KB -> ${(png.length / 1024).toFixed(0)}KB`
  );
}
console.log(`\ntotal ${(before / 1048576).toFixed(2)}MB -> ${(after / 1048576).toFixed(2)}MB`);
