import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { playgroundLink, linkText, PLAYGROUND_URL } from '../bin/link.js'
import { decodeShare, encodeShare } from '../playground/share.js'
import { parseMock, WM_LIMITS } from '../src/index.js'

const bin = fileURLToPath(new URL('../bin/wiredown.js', import.meta.url))
const loginPath = fileURLToPath(new URL('./fixtures/login.wiredown', import.meta.url))
const login = readFileSync(loginPath, 'utf8')
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' })
const hashOf = (url) => { assert.ok(url.startsWith(PLAYGROUND_URL + '#v1:'), url); return url.slice(PLAYGROUND_URL.length) }

test('the playground URL is the package homepage', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(PLAYGROUND_URL, pkg.homepage)
  assert.equal(PLAYGROUND_URL, 'https://manup-dev.github.io/wiredown/')
})

test('links decode with the playground\'s own decodeShare, unicode included', async () => {
  for (const text of [login, 'screen a "Café ✓ 日本 😀"\n  button "Go"\n', 'screen a\r\n  text "x"\r\n']) {
    const url = playgroundLink(text)
    assert.deepEqual(await decodeShare(hashOf(url)), { ok: true, text })
    assert.deepEqual(await decodeShare('#' + hashOf(url).slice(1) + '!play'), { ok: true, text })
  }
})

test('node:zlib deflate-raw gives the same bytes as the playground\'s CompressionStream', async () => {
  for (const text of [login, 'x'.repeat(5000), '日本'.repeat(300)]) {
    assert.equal(hashOf(playgroundLink(text)), '#' + (await encodeShare(text)))
  }
})

test('a fence look= travels as @look; the drawing is the same', async () => {
  const body = 'screen a "A"\n  button "Go"\n'
  const { text } = await decodeShare(hashOf(playgroundLink(body, 'wiredown look=clean')))
  assert.equal(text, '@look clean\n' + body)
  assert.equal(parseMock(text, 'wiredown').mock.look, 'clean')
  assert.equal(linkText(body, 'wiredown'), body)
  assert.equal(linkText('@look wire\n' + body, 'wiremark look=clean'), '@look clean\n' + body)
  assert.equal(linkText('screen a\nscreen a\n', 'wiredown look=clean'), 'screen a\nscreen a\n')
})

test('a block over the limit has no link', async () => {
  assert.equal(playgroundLink('x'.repeat(WM_LIMITS.body + 1)), null)
  const full = 'x'.repeat(WM_LIMITS.body)
  assert.equal((await decodeShare(hashOf(playgroundLink(full)))).ok, true)
})

test('wiredown link prints the link; --block picks a fence', async () => {
  const r = run('link', loginPath)
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(await decodeShare(hashOf(r.stdout.trim())), { ok: true, text: login })
  const d = mkdtempSync(join(tmpdir(), 'wm-'))
  const md = join(d, 'two.md')
  writeFileSync(md, '# Two\n\n```wiredown\nscreen a\n  text "one"\n```\n\n```screens look=clean\nscreen b\n  text "two"\n```\n')
  const two = run('link', md, '--block', '2')
  assert.equal(two.status, 0, two.stderr)
  assert.deepEqual(await decodeShare(hashOf(two.stdout.trim())), { ok: true, text: '@look clean\nscreen b\n  text "two"\n' })
  assert.equal(run('link', md, '--block', '3').status, 2)
  assert.equal(run('link').status, 2)
  assert.match(run('--help').stdout, /link <file> \[--block N\]/)
  assert.match(run('--help').stdout, /mcp \[--root <folder>\]/)
})
