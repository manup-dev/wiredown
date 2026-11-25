// A small GIF89a reader for the tests: blocks, LZW, frames composed over the previous one
// (disposal 1, the only one the encoder writes). Returns RGBA frames and their delays.
export function decodeGif(bytes) {
  const b = bytes
  let p = 0
  const u16 = () => { const v = b[p] | (b[p + 1] << 8); p += 2; return v }
  const sig = String.fromCharCode(...b.slice(0, 6)); p = 6
  const width = u16(), height = u16(), packed = b[p++]; p += 2
  let gct = null
  if (packed & 0x80) { const n = 2 << (packed & 7); gct = b.slice(p, p + n * 3); p += n * 3 }
  const frames = [], canvas = new Uint8Array(width * height * 4)
  let loop = null, delay = 0
  const subBlocks = () => { const out = []; for (let n = b[p++]; n; n = b[p++]) { out.push(...b.slice(p, p + n)); p += n } return out }
  for (;;) {
    const t = b[p++]
    if (t === 0x3b) break
    if (t === 0x21) {
      const label = b[p++]
      if (label === 0xf9) { p++; p++; delay = u16(); p++; p++ }
      else if (label === 0xff) {
        const n = b[p++]; const app = String.fromCharCode(...b.slice(p, p + n)); p += n
        const data = subBlocks()
        if (app === 'NETSCAPE2.0') loop = data[1] | (data[2] << 8)
      } else subBlocks()
      continue
    }
    if (t !== 0x2c) throw new Error('bad block ' + t + ' at ' + (p - 1))
    const x = u16(), y = u16(), w = u16(), h = u16(), ip = b[p++]
    let table = gct
    if (ip & 0x80) { const n = 2 << (ip & 7); table = b.slice(p, p + n * 3); p += n * 3 }
    const min = b[p++]
    const idx = lzwDecode(subBlocks(), min, w * h)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const c = idx[j * w + i], o = ((y + j) * width + x + i) * 4
      canvas[o] = table[c * 3]; canvas[o + 1] = table[c * 3 + 1]; canvas[o + 2] = table[c * 3 + 2]; canvas[o + 3] = 255
    }
    frames.push({ rgba: canvas.slice(), delay, rect: [x, y, w, h] })
  }
  return { sig, width, height, loop, frames, globalTableSize: gct ? gct.length / 3 : 0 }
}

/** What the last LZW read saw: the table size and code width when the end code came. */
export const stats = { endTable: 0, endSize: 0, clears: 0, bits: 0 }

function lzwDecode(data, min, count) {
  const clear = 1 << min, eoi = clear + 1
  let size = min + 1, next = eoi + 1, prev = -1, bit = 0
  stats.clears = 0
  const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), len = new Int32Array(4096)
  for (let i = 0; i < clear; i++) { suffix[i] = i; len[i] = 1; prefix[i] = -1 }
  const out = []
  const str = (c) => { const s = new Array(len[c]); for (let k = len[c] - 1; k >= 0; k--) { s[k] = suffix[c]; c = prefix[c] } return s }
  for (;;) {
    let code = 0
    for (let k = 0; k < size; k++, bit++) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << k
    if (bit > data.length * 8) throw new Error('ran out of data')
    if (code === clear) { stats.clears++; size = min + 1; next = eoi + 1; prev = -1; continue }
    if (code === eoi) { stats.endTable = next; stats.endSize = size; stats.bits = bit; break }
    let s
    if (prev < 0) s = str(code)
    else {
      if (code < next) s = str(code)
      else if (code === next) { const ps = str(prev); s = [...ps, ps[0]] }
      else throw new Error('bad code ' + code)
      if (next < 4096) { prefix[next] = prev; suffix[next] = s[0]; len[next] = len[prev] + 1; next++ }
      if (next === 1 << size && size < 12) size++
    }
    out.push(...s)
    prev = code
  }
  if (out.length !== count) throw new Error(`decoded ${out.length} pixels, expected ${count}`)
  // Strict: the end code must finish inside the data, with less than a byte of padding after it.
  if (data.length * 8 - bit >= 8) throw new Error('data after the end code')
  return out
}
