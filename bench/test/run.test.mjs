import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const here = new URL('..', import.meta.url).pathname
const pre = new URL('./no-network.mjs', import.meta.url).pathname
const env = { PATH: process.env.PATH }  // no API keys
const run = (args) => spawnSync(process.execPath, ['--import', pre, 'run.mjs', ...args], { cwd: here, env, encoding: 'utf8' })

test('--fake writes 20 scored rows without touching the network', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'wmb-')), 'sub', 'r.json')
  const r = run(['--fake', '--models', 'anthropic:fake-model', '--out', out])
  assert.equal(r.status, 0, r.stderr)
  const j = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(j.rows.length, 20)
  for (const row of j.rows) assert.equal(typeof row.first.pass, 'boolean')
  const firstPass = j.rows.filter((x) => x.first.pass).length
  const repairedPass = j.rows.filter((x) => x.first.pass || x.repaired?.pass).length
  assert.ok(firstPass === 14, `first ${firstPass}`)
  assert.equal(repairedPass, 18)
})

test('--estimate prints a call count and uses no network or keys', () => {
  const r = run(['--estimate', '--models', 'anthropic:x,openai:y'])
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /\d+ calls/)
  assert.match(r.stdout, /80 calls/)
})

test('--estimate prices only when given --price', () => {
  const r = run(['--estimate', '--models', 'anthropic:x', '--price', 'anthropic:x=3/15'])
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /\$/)
})

const keyed = { PATH: process.env.PATH, ANTHROPIC_API_KEY: 'dummy' }

test('a real run with a fake fetch that always answers 429 records only the status and keeps the file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wmb-'))
  const pre429 = join(dir, 'fetch429.mjs')
  writeFileSync(pre429, "globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: 'secret provider text' }) })\n")
  const out = join(dir, 'real.json')
  const r = spawnSync(process.execPath, ['--import', pre429, 'run.mjs', '--models', 'anthropic:m', '--pause', '0', '--out', out], { cwd: here, env: keyed, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /20 rows ended in a provider error/)
  const j = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(j.rows.length, 20)
  assert.ok(j.rows.every((x) => x.error === '429'))
  assert.ok(!JSON.stringify(j).includes('secret'))
  assert.ok(!existsSync(out.replace(/\.json$/, '.tmp.json')))
  const rep = spawnSync(process.execPath, ['report.mjs', out], { cwd: here, encoding: 'utf8' })
  assert.match(rep.stdout, /\| anthropic:m \| 0 \| 20 \| n\/a \| n\/a \| n\/a \|/)
})

test('a real run without the key refuses with exit 2 before any call', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'wmb-')), 'x.json')
  const r = spawnSync(process.execPath, ['--import', pre, 'run.mjs', '--models', 'openai:m,anthropic:m', '--out', out], { cwd: here, env, encoding: 'utf8' })
  assert.equal(r.status, 2)
  assert.match(r.stderr, /OPENAI_API_KEY/)
  assert.ok(!existsSync(out))
})

test('the pause is applied before every call but the first', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wmb-'))
  const preF = join(dir, 'f.mjs')
  writeFileSync(preF, 'globalThis.fetch = async () => ({ ok: false, status: 500 })\n')
  const t = Date.now()
  const r = spawnSync(process.execPath, ['--import', preF, 'run.mjs', '--models', 'anthropic:m', '--pause', '60', '--out', join(dir, 'p.json')], { cwd: here, env: keyed, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.ok(Date.now() - t >= 19 * 60 - 50)
})
