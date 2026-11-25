import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeShare, decodeShare, splitPlay, PLAY_SUFFIX } from '../share.js'

test('round trip, unicode included', async () => {
  const text = 'screen a "Café ✓ 日本"\n  button "Go"\n'
  const h = await encodeShare(text)
  assert.match(h, /^v1:[A-Za-z0-9_-]+$/)
  assert.deepEqual(await decodeShare('#' + h), { ok: true, text })
})

test('refuses bad and oversized input', async () => {
  assert.equal((await decodeShare('#nope')).reason, 'format')
  assert.equal((await decodeShare('#v1:!!!')).reason, 'corrupt')
  const big = await encodeShare('x'.repeat(70000))
  assert.equal((await decodeShare(big)).reason, 'too_large')
})

const raw = async (bytes) => {
  const r = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw')).getReader()
  const parts = []
  for (;;) { const { done, value } = await r.read(); if (done) break; parts.push(Buffer.from(value)) }
  return 'v1:' + Buffer.concat(parts).toString('base64url')
}

test('CJK within the core limit round trips, over it is too_large', async () => {
  const ok = '日'.repeat(30000)
  assert.deepEqual(await decodeShare(await encodeShare(ok)), { ok: true, text: ok })
  assert.equal((await decodeShare(await encodeShare('日'.repeat(65537)))).reason, 'too_large')
})

test('astral characters round trip', async () => {
  const t = 'screen a "😀 𝒳"\n'
  assert.deepEqual(await decodeShare(await encodeShare(t)), { ok: true, text: t })
})

test('invalid utf-8, truncated hash, deflate bomb, huge payload', async () => {
  assert.equal((await decodeShare(await raw(new Uint8Array([0xff, 0xfe, 0xfd])))).reason, 'corrupt')
  const h = await encodeShare('screen a "A"\n  button "Go"\n'.repeat(50))
  assert.equal((await decodeShare(h.slice(0, h.length - 8))).reason, 'corrupt')
  assert.equal((await decodeShare(await raw(new Uint8Array(50_000_000).fill(97)))).reason, 'too_large')
  assert.equal((await decodeShare('v1:' + 'A'.repeat(300001))).reason, 'too_large')
})

test('a trailing !play asks for the Play panel; the text decodes the same', async () => {
  const text = 'screen a "A"\n  button "Go" -> b\nscreen b "B"\n'
  const h = await encodeShare(text)
  assert.deepEqual(splitPlay('#' + h + PLAY_SUFFIX), { hash: h, play: true })
  assert.deepEqual(splitPlay('#' + h), { hash: h, play: false })
  assert.deepEqual(await decodeShare('#' + h + PLAY_SUFFIX), { ok: true, text })
  assert.equal((await decodeShare('#' + h + '!other')).reason, 'corrupt')
  assert.equal(PLAY_SUFFIX, '!play')
})
