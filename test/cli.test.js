import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const bin = fileURLToPath(new URL('../bin/wiredown.js', import.meta.url))
const doc = fileURLToPath(new URL('./fixtures/cli/doc.md', import.meta.url))
const login = fileURLToPath(new URL('./fixtures/login.wiredown', import.meta.url))
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
  assert.match(readFileSync(join(out, files[0]), 'utf8'), /^<!-- made by wiredown -->\n<svg /, 'the marker the MCP server writes too')
})

test('export --to openui|html, contract, usage', () => {
  const out = mkdtempSync(join(tmpdir(), 'wm-'))
  assert.equal(run('export', login, '--to', 'openui', '--out', out).status, 0)
  assert.ok(readdirSync(out).some((f) => f.endsWith('.openui')))
  assert.match(run('contract').stdout, /wiredown/)
  assert.equal(run('bogus').status, 2)
  assert.equal(run('lint').status, 2)
  assert.equal(run('lint', '/no/such/file.md').status, 2)
  assert.equal(run().status, 2)
  assert.equal(run('--help').status, 0)
})

import { writeFileSync } from 'node:fs'
const tmpMd = (text) => { const d = mkdtempSync(join(tmpdir(), 'wm-')); const f = join(d, 'x.md'); writeFileSync(f, text); return f }

test('export keeps two same-named fences apart', () => {
  const f = tmpMd('```wiredown\nscreen a\n  text "one"\n```\n\n```wiredown\nscreen a\n  text "two"\n```\n')
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
  const f = tmpMd('# T\n\n```wiredown lok=clean\nscreen a\n  text "hi"\n```\n')
  const r = run('lint', f)
  assert.equal(r.status, 0)
  assert.match(r.stdout, /x\.md:3:\d+ warning /)
})

test('an unknown --format is a usage error; the title is escaped', () => {
  const r = run('render', login, '--format', 'pdf')
  assert.equal(r.status, 2)
  assert.match(r.stderr, /--format must be svg or html/)
  const d = mkdtempSync(join(tmpdir(), 'wm-')); const f = join(d, 'a&b.md')
  writeFileSync(f, '```wiredown\nscreen a\n  text "hi"\n```\n')
  const out = mkdtempSync(join(tmpdir(), 'wm-'))
  assert.equal(run('render', f, '--format', 'html', '--out', out).status, 0)
  assert.match(readFileSync(join(out, 'a&b.html'), 'utf8'), /<title>a&amp;b<\/title>/)
})

test('animate writes one animated svg; --block picks a fence; --step, --no-credit', () => {
  const out = mkdtempSync(join(tmpdir(), 'wm-'))
  const file = join(out, 'flow.svg')
  const r = run('animate', login, '--out', file)
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout.trim(), file)
  const svg = readFileSync(file, 'utf8')
  assert.match(svg, /^<!-- made by wiredown -->\n<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /)
  assert.match(svg, /@keyframes wm-a0/)
  assert.match(svg, />wiredown<\/text>/)
  const md = tmpMd('# T\n\n```wiredown\nscreen a "A"\n  button "Go" -> b\nscreen b "B"\n  text "b"\n```\n\n```wiredown\nscreen c "Cee"\n  text "c"\n```\n')
  const two = join(out, 'two.svg')
  assert.equal(run('animate', md, '--out', two, '--block', '2', '--step', '1', '--no-credit').status, 0)
  const text = readFileSync(two, 'utf8')
  assert.ok(text.includes('>Cee</text>') && !text.includes('>wiredown<'))
  const first = join(out, 'one.svg')
  assert.equal(run('animate', md, '--out', first, '--step', '1').status, 0)
  assert.match(readFileSync(first, 'utf8'), /animation-duration:2s/)
})

test('animate refuses a bad block number, step or a block that does not parse', () => {
  const md = tmpMd('```wiredown\nscreen a\n  text "a"\n```\n\n```wiredown\n@device nope\nscreen b\n```\n')
  const out = join(mkdtempSync(join(tmpdir(), 'wm-')), 'x.svg')
  assert.match(run('animate', md, '--out', out, '--block', '3').stderr, /--block must be 1 to 2/)
  assert.equal(run('animate', md, '--out', out, '--block', 'x').status, 2)
  assert.match(run('animate', md, '--out', out, '--step', '0').stderr, /--step must be/)
  assert.match(run('animate', md, '--out', out, '--block', '2').stderr, /block 2 does not parse/)
  assert.equal(run('animate').status, 2)
  assert.match(run('--help').stdout, /animate <file>/)
})

test('animate exits 2 when the block is too large to animate', () => {
  let screen = 'screen a\n'
  for (let i = 0; i < 1200; i++) screen += `  text "${'字'.repeat(40)}"\n`
  const f = tmpMd('```wiredown\n@flow a a a a a a a\n' + screen + '```\n')
  const out = join(mkdtempSync(join(tmpdir(), 'wm-')), 'x.svg')
  const r = run('animate', f, '--out', out)
  assert.equal(r.status, 2)
  assert.match(r.stderr, /block 1 is too large to animate/)
})
