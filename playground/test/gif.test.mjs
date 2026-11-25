import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PALETTE, nearestIndex, createGifEncoder, encodeGif } from '../gif.js'
import { decodeGif, stats } from './gif-decode.mjs'
import { ACCENT } from '../../src/looks.js'

const rgb = (i) => [PALETTE[i * 3], PALETTE[i * 3 + 1], PALETTE[i * 3 + 2]]
function image(w, h, colourAt) {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = colourAt(x, y); px.set([r, g, b, 255], (y * w + x) * 4) }
  return px
}

test('the palette: 256 colours, 32 greys, the 6x6x6 cube and the accent', () => {
  assert.equal(PALETTE.length, 768)
  const hex = (i) => '#' + rgb(i).map((v) => v.toString(16).padStart(2, '0')).join('')
  const all = new Set(Array.from({ length: 256 }, (_, i) => hex(i)))
  for (const v of [0, 51, 102, 153, 204, 255]) assert.ok(all.has('#' + [v, v, 0].map((n) => n.toString(16).padStart(2, '0')).join('')))
  assert.ok(all.has('#ffffff') && all.has('#000000'))
  assert.ok(all.has(ACCENT), 'the accent itself')
  const greys = [...all].filter((h) => h.slice(1, 3) === h.slice(3, 5) && h.slice(3, 5) === h.slice(5, 7))
  assert.ok(greys.length >= 32)
  assert.equal(nearestIndex(255, 255, 255), nearestIndex(254, 254, 254))
  assert.deepEqual(rgb(nearestIndex(0x3b, 0x5b, 0xdb)), [0x3b, 0x5b, 0xdb])
})

test('header, screen size, global table and the loop extension', () => {
  const gif = encodeGif(3, 2, [{ rgba: image(3, 2, () => [255, 255, 255]), delay: 10 }])
  assert.equal(String.fromCharCode(...gif.slice(0, 6)), 'GIF89a')
  assert.deepEqual([...gif.slice(6, 10)], [3, 0, 2, 0])
  assert.equal(gif[10], 0xf7, 'global table of 256 colours')
  const d = decodeGif(gif)
  assert.equal(d.globalTableSize, 256)
  assert.equal(d.loop, 0, 'loops forever')
  assert.equal(gif[gif.length - 1], 0x3b)
  const text = String.fromCharCode(...gif)
  assert.ok(text.includes('NETSCAPE2.0'))
})

test('a 4x4 image round trips exactly', () => {
  const colours = [0, 40, 100, 200, 247, 250, 7, 129]
  const px = image(4, 4, (x, y) => rgb(colours[(x + y * 4) % colours.length]))
  const d = decodeGif(encodeGif(4, 4, [{ rgba: px, delay: 8 }]))
  assert.equal(d.frames.length, 1)
  assert.deepEqual([...d.frames[0].rgba], [...px])
  assert.equal(d.frames[0].delay, 8)
})

test('frames: count, delays, identical frames merged, later frames only their changed box', () => {
  const white = image(8, 8, () => [255, 255, 255])
  const dot = image(8, 8, (x, y) => (x >= 2 && x < 4 && y >= 5 && y < 7 ? [59, 91, 219] : [255, 255, 255]))
  const enc = createGifEncoder(8, 8)
  enc.addFrame(white, 8); enc.addFrame(white, 9); enc.addFrame(dot, 8); enc.addFrame(dot, 8); enc.addFrame(white, 9)
  const d = decodeGif(enc.finish())
  assert.equal(d.frames.length, 3)
  assert.deepEqual(d.frames.map((f) => f.delay), [17, 16, 9])
  assert.deepEqual(d.frames[0].rect, [0, 0, 8, 8])
  assert.deepEqual(d.frames[1].rect, [2, 5, 2, 2])
  assert.deepEqual([...d.frames[1].rgba], [...dot])
  assert.deepEqual([...d.frames[2].rgba], [...white])
})

test('a large noisy image (the table fills and clears) round trips, deterministically', () => {
  let s = 7
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s }
  const px = image(160, 120, () => rgb(rnd() % 256))
  const a = encodeGif(160, 120, [{ rgba: px, delay: 8 }])
  const b = encodeGif(160, 120, [{ rgba: px, delay: 8 }])
  assert.deepEqual(a, b)
  assert.deepEqual([...decodeGif(a).frames[0].rgba], [...px])
})

test('colours off the palette map to the nearest one; alpha sits on white', () => {
  const px = new Uint8ClampedArray([250, 250, 250, 255, 0, 0, 0, 0, 59, 91, 219, 255, 10, 10, 10, 255])
  const d = decodeGif(encodeGif(2, 2, [{ rgba: px, delay: 8 }]))
  const out = [...d.frames[0].rgba]
  assert.deepEqual(out.slice(4, 8), [255, 255, 255, 255], 'transparent pixel reads as paper')
  assert.deepEqual(out.slice(8, 11), [59, 91, 219])
  assert.ok(Math.abs(out[0] - 250) <= 5 && Math.abs(out[12] - 10) <= 5)
})

test('refuses bad sizes', () => {
  assert.throws(() => createGifEncoder(0, 4))
  assert.throws(() => createGifEncoder(70000, 4))
  const enc = createGifEncoder(2, 2)
  assert.throws(() => enc.addFrame(new Uint8ClampedArray(3), 8))
  assert.throws(() => createGifEncoder(2, 2).finish(), /no frame/)
})

test('repeat(delay) shows the last frame longer without passing its pixels again', () => {
  const white = image(4, 4, () => [255, 255, 255])
  const enc = createGifEncoder(4, 4)
  enc.addFrame(white, 8); enc.repeat(9); enc.repeat(8)
  const d = decodeGif(enc.finish())
  assert.equal(d.frames.length, 1)
  assert.equal(d.frames[0].delay, 25)
  assert.throws(() => createGifEncoder(4, 4).repeat(8), /no frame/)
})

// A de Bruijn walk over the palette indices that keep their own colour: no pair of pixels repeats,
// so each pixel is one LZW code and adds one table entry (3839 pixels fill the table and clear it).
function noRepeatPixels(n) {
  const keep = []
  for (let i = 0; i < 256; i++) if (nearestIndex(PALETTE[i * 3], PALETTE[i * 3 + 1], PALETTE[i * 3 + 2]) === i) keep.push(i)
  const m = keep.length, a = [0, 0, 0], walk = []
  ;(function db(t, p) {
    if (t > 2) { if (2 % p === 0) for (let j = 1; j <= p; j++) walk.push(a[j]); return }
    a[t] = a[t - p]; db(t + 1, p)
    for (let j = a[t - p] + 1; j < m; j++) { a[t] = j; db(t + 1, t) }
  })(1, 1)
  const px = new Uint8Array(n * 4)
  for (let i = 0; i < n; i++) { const k = keep[walk[i]]; px.set([PALETTE[k * 3], PALETTE[k * 3 + 1], PALETTE[k * 3 + 2], 255], i * 4) }
  return px
}

test('a table that ends exactly at 512, 1024 or 2048 codes: the end code is as wide as a strict reader reads it', () => {
  // After k full tables the end code sits at a different bit offset; some of those end on a byte,
  // where an end code one bit too narrow makes a strict reader run out of data.
  for (const end of [512, 1024, 2048]) {
    for (let k = 0; k < 16; k++) {
      const n = k * 3839 + end - 257, px = noRepeatPixels(n)
      const g = decodeGif(encodeGif(n, 1, [{ rgba: px, delay: 0 }]))
      assert.equal(stats.endTable, end, `table size at the end (${end}, ${k} clears)`)
      assert.equal(stats.clears, k + 1)
      assert.ok(g.frames[0].rgba.every((v, i) => v === px[i]), `pixels (${end}, ${k} clears)`)
    }
  }
})
