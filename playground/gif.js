// A small GIF89a encoder for the Play panel: no dependencies, the same bytes for the same frames.
// One fixed 256-colour palette (32 greys, the 6x6x6 cube, the clean look's accent and its tints
// over white), each pixel mapped to its nearest colour, no dithering. A frame that equals the one
// before it only adds its delay to that one; a later frame stores just the box that changed and
// leaves the rest in place (disposal 1). Loops forever.
import { ACCENT } from '../src/looks.js';

const MAX_SIDE = 65535;

function palette() {
  const out = new Uint8Array(768);
  let i = 0;
  const put = (r, g, b) => { out[i++] = r; out[i++] = g; out[i++] = b; };
  for (let k = 0; k < 32; k++) { const v = Math.round((k * 255) / 31); put(v, v, v); }
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) put(r * 51, g * 51, b * 51);
  const a = [1, 3, 5].map((at) => parseInt(ACCENT.slice(at, at + 2), 16));
  for (const op of [1, 0.8, 0.6, 0.5, 0.35, 0.2, 0.1, 0.05]) put(...a.map((v) => Math.round(255 + (v - 255) * op)));
  return out;
}
/** The 256 colours, as r g b bytes. */
export const PALETTE = palette();

/** The palette index nearest to r g b (weighted distance; the first wins a tie). */
export function nearestIndex(r, g, b) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < 256; i++) {
    const dr = PALETTE[i * 3] - r, dg = PALETTE[i * 3 + 1] - g, db = PALETTE[i * 3 + 2] - b;
    const d = 3 * dr * dr + 4 * dg * dg + 2 * db * db;
    if (d < bestD) { bestD = d; best = i; if (d === 0) break; }
  }
  return best;
}

// A cache of colour → index, open addressing, emptied when it gets full.
const CACHE_BITS = 16, CACHE_MASK = (1 << CACHE_BITS) - 1;
function colourCache() {
  const keys = new Int32Array(1 << CACHE_BITS).fill(-1), vals = new Uint8Array(1 << CACHE_BITS);
  let used = 0;
  return (key) => {
    let h = Math.imul(key, 0x9e3779b1) >>> (32 - CACHE_BITS);
    for (;;) {
      const k = keys[h];
      if (k === key) return vals[h];
      if (k === -1) break;
      h = (h + 1) & CACHE_MASK;
    }
    if (used > (CACHE_MASK * 3) >> 2) { keys.fill(-1); used = 0; h = Math.imul(key, 0x9e3779b1) >>> (32 - CACHE_BITS); }
    const v = nearestIndex(key >> 16, (key >> 8) & 255, key & 255);
    keys[h] = key; vals[h] = v; used++;
    return v;
  };
}

// Bytes, grown as needed.
function writer() {
  let buf = new Uint8Array(1 << 16), n = 0;
  const room = (k) => { if (n + k <= buf.length) return; let size = buf.length * 2; while (size < n + k) size *= 2; const b = new Uint8Array(size); b.set(buf.subarray(0, n)); buf = b; };
  return {
    byte(v) { room(1); buf[n++] = v; },
    u16(v) { room(2); buf[n++] = v & 255; buf[n++] = (v >> 8) & 255; },
    bytes(a) { room(a.length); buf.set(a, n); n += a.length; },
    done: () => buf.slice(0, n),
  };
}

// GIF LZW (min code size 8) of `pixels`, written as data sub-blocks. `dict` is scratch space.
function lzw(out, pixels, dict) {
  const CLEAR = 256, EOI = 257;
  let size = 9, next = 258, acc = 0, bits = 0;
  const block = new Uint8Array(255);
  let fill = 0;
  const flushByte = (v) => { block[fill++] = v; if (fill === 255) { out.byte(255); out.bytes(block); fill = 0; } };
  const emit = (code) => {
    acc |= code << bits; bits += size;
    while (bits >= 8) { flushByte(acc & 255); acc >>>= 8; bits -= 8; }
  };
  out.byte(8);
  dict.fill(0);
  emit(CLEAR);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i], key = (prefix << 8) | k, c = dict[key];
    if (c) { prefix = c; continue; }
    emit(prefix);
    if (next === 4096) { emit(CLEAR); dict.fill(0); next = 258; size = 9; }
    else { if (next >= 1 << size) size++; dict[key] = next++; }
    prefix = k;
  }
  emit(prefix);
  // A reader adds one more entry after the last code; when that fills the width, it reads the
  // end code one bit wider (giflib bumps here too).
  if (next < 4096 && next === 1 << size && size < 12) size++;
  emit(EOI);
  if (bits > 0) flushByte(acc & 255);
  if (fill) { out.byte(fill); out.bytes(block.subarray(0, fill)); }
  out.byte(0);
}

/** An encoder for `width` x `height` frames: addFrame(rgba, delay in 1/100 s), then finish() → bytes. */
export function createGifEncoder(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) {
    throw new RangeError('GIF size must be 1 to 65535 pixels a side');
  }
  const out = writer(), dict = new Uint16Array(4096 * 256), lookup = colourCache(), count = width * height;
  out.bytes(new TextEncoder().encode('GIF89a'));
  out.u16(width); out.u16(height); out.byte(0xf7); out.byte(0); out.byte(0);
  out.bytes(PALETTE);
  out.bytes([0x21, 0xff, 11, ...new TextEncoder().encode('NETSCAPE2.0'), 3, 1, 0, 0, 0]);
  let last = null, pending = null, frames = 0;

  function index(rgba) {
    const idx = new Uint8Array(count);
    for (let i = 0, p = 0; i < count; i++, p += 4) {
      let r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
      const a = rgba[p + 3];
      if (a !== 255) { r = Math.round(255 + ((r - 255) * a) / 255); g = Math.round(255 + ((g - 255) * a) / 255); b = Math.round(255 + ((b - 255) * a) / 255); }
      idx[i] = lookup((r << 16) | (g << 8) | b);
    }
    return idx;
  }
  // The box where two indexed frames differ, or null.
  function changed(a, b) {
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        if (a[row + x] === b[row + x]) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y;
      }
    }
    return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
  }
  function write(f) {
    const [x, y, w, h] = f.rect;
    out.bytes([0x21, 0xf9, 4, 0x04]); out.u16(Math.min(65535, f.delay)); out.byte(0); out.byte(0);
    out.byte(0x2c); out.u16(x); out.u16(y); out.u16(w); out.u16(h); out.byte(0);
    const px = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) px.set(f.idx.subarray((y + j) * width + x, (y + j) * width + x + w), j * w);
    lzw(out, px, dict);
    frames++;
  }
  return {
    addFrame(rgba, delay) {
      if (!rgba || rgba.length !== count * 4) throw new RangeError('a frame must be width x height RGBA pixels');
      const d = Math.max(0, Math.round(Number(delay) || 0));
      const idx = index(rgba);
      const rect = last ? changed(last, idx) : [0, 0, width, height];
      if (!rect) { pending.delay += d; return; }
      if (pending) write(pending);
      pending = { idx, rect, delay: d };
      last = idx;
    },
    /** The same picture as the last frame, for `delay` more. */
    repeat(delay) {
      if (!pending) throw new Error('no frame to repeat');
      pending.delay += Math.max(0, Math.round(Number(delay) || 0));
    },
    get frames() { return frames + (pending ? 1 : 0); },
    finish() {
      if (!pending) throw new Error('no frame to write');
      write(pending); pending = null;
      out.byte(0x3b);
      return out.done();
    },
  };
}

/** frames: [{ rgba, delay }] → GIF bytes. */
export function encodeGif(width, height, frames) {
  const enc = createGifEncoder(width, height);
  for (const f of frames) enc.addFrame(f.rgba, f.delay);
  return enc.finish();
}
