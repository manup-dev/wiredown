import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const bin = fileURLToPath(new URL('../bin/wiremark.js', import.meta.url))
const doc = fileURLToPath(new URL('./fixtures/cli/doc.md', import.meta.url))
const login = fileURLToPath(new URL('./fixtures/login.wiremark', import.meta.url))
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' })

test('lint maps lines to the file and exits 1 on errors', () => {
  const r = run('lint', doc)
  assert.equal(r.status, 1)
  assert.match(r.stdout, /doc\.md:7:\d+ error dangling_link /)
  assert.match(r.stdout, /doc\.md:12:\d+ error unknown_kind /)
})

test('lint --json and a clean file', () => {
  const ok = run('lint', login, '--json')
  assert.equal(ok.status, 0)
  assert.deepEqual(JSON.parse(ok.stdout), [])
})

test('render writes one svg per screen', () => {
  const out = mkdtempSync(join(tmpdir(), 'wm-'))
  const r = run('render', login, '--out', out)
  assert.equal(r.status, 0, r.stderr)
  const files = readdirSync(out).filter((f) => f.endsWith('.svg'))
  assert.ok(files.length >= 2)
  assert.match(readFileSync(join(out, files[0]), 'utf8'), /^<svg /)
})

test('export --to openui|html, contract, usage', () => {
  const out = mkdtempSync(join(tmpdir(), 'wm-'))
  assert.equal(run('export', login, '--to', 'openui', '--out', out).status, 0)
  assert.ok(readdirSync(out).some((f) => f.endsWith('.openui')))
  assert.match(run('contract').stdout, /wiremark/)
  assert.equal(run('bogus').status, 2)
  assert.equal(run('lint').status, 2)
  assert.equal(run('lint', '/no/such/file.md').status, 2)
  assert.equal(run().status, 2)
  assert.equal(run('--help').status, 0)
})

import { writeFileSync } from 'node:fs'
const tmpMd = (text) => { const d = mkdtempSync(join(tmpdir(), 'wm-')); const f = join(d, 'x.md'); writeFileSync(f, text); return f }

test('export keeps two same-named fences apart', () => {
  const f = tmpMd('```wiremark\nscreen a\n  text "one"\n```\n\n```wiremark\nscreen a\n  text "two"\n```\n')
  const out = mkdtempSync(join(tmpdir(), 'wm-'))
  const r = run('export', f, '--to', 'openui', '--out', out)
  assert.equal(r.status, 0, r.stderr)
  assert.equal(readdirSync(out).length, 2)
})

test('flags need values; clean lint prints nothing', () => {
  assert.equal(run('render', login, '--out', '--json').status, 2)
  assert.equal(run('render', login, '--out').status, 2)
  const ok = run('lint', login)
  assert.equal(ok.status, 0)
  assert.equal(ok.stdout, '')
})

test('info-string warning maps to the opening line', () => {
  const f = tmpMd('# T\n\n```wiremark lok=clean\nscreen a\n  text "hi"\n```\n')
  const r = run('lint', f)
  assert.equal(r.status, 0)
  assert.match(r.stdout, /x\.md:3:\d+ warning /)
})

test('an unknown --format is a usage error; the title is escaped', () => {
  const r = run('render', login, '--format', 'pdf')
  assert.equal(r.status, 2)
  assert.match(r.stderr, /--format must be svg or html/)
  const d = mkdtempSync(join(tmpdir(), 'wm-')); const f = join(d, 'a&b.md')
  writeFileSync(f, '```wiremark\nscreen a\n  text "hi"\n```\n')
  const out = mkdtempSync(join(tmpdir(), 'wm-'))
  assert.equal(run('render', f, '--format', 'html', '--out', out).status, 0)
  assert.match(readFileSync(join(out, 'a&b.html'), 'utf8'), /<title>a&amp;b<\/title>/)
})
