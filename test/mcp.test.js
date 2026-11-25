// `wiredown mcp`: the stdio server is spawned, fed newline-delimited JSON-RPC and read back.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeShare } from '../playground/share.js'
import { AI_CONTRACT, WM_LIMITS } from '../src/index.js'
import { PLAYGROUND_URL } from '../bin/link.js'

const bin = fileURLToPath(new URL('../bin/wiredown.js', import.meta.url))
const login = readFileSync(new URL('./fixtures/login.wiredown', import.meta.url), 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const tmp = () => realpathSync(mkdtempSync(join(tmpdir(), 'wm-mcp-')))

const INIT = { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }

/** Send messages (objects, or raw strings sent as they are) and return { byId, lines, stderr, status }. */
function session(messages, { cwd = tmp(), args = [], env } = {}) {
  const input = messages.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('\n') + '\n'
  const r = spawnSync(process.execPath, [bin, 'mcp', ...args], { input, cwd, encoding: 'utf8', env: env ?? process.env, maxBuffer: 64 << 20 })
  const lines = r.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l)) // stdout is protocol only
  const byId = new Map(lines.filter((l) => l.id !== null).map((l) => [l.id, l]))
  return { byId, lines, stderr: r.stderr, status: r.status, cwd }
}
let nextId = 1
const call = (name, args) => ({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } })
/** Run tool calls in one session; returns their results in order. */
function tools(calls, opts) {
  const msgs = calls.map(([n, a]) => call(n, a))
  const s = session([INIT, ...msgs], opts)
  return { ...s, results: msgs.map((m) => s.byId.get(m.id).result) }
}
const textOf = (r) => r.content.map((c) => c.text).join('\n')
const refused = (r, pattern) => {
  assert.equal(r.isError, true, textOf(r))
  assert.match(textOf(r), pattern)
  assert.doesNotMatch(textOf(r), /\n\s+at |Error:/, 'no stack traces in tool errors')
}

test('initialize answers the client\'s version when known, else the newest', () => {
  for (const v of ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']) {
    const s = session([{ ...INIT, params: { ...INIT.params, protocolVersion: v } }])
    assert.equal(s.byId.get(0).result.protocolVersion, v)
  }
  const s = session([{ ...INIT, params: { ...INIT.params, protocolVersion: '1999-01-01' } }])
  const r = s.byId.get(0).result
  assert.equal(r.protocolVersion, '2025-11-25')
  assert.deepEqual(r.serverInfo, { name: 'wiredown', title: 'wiredown', version: pkg.version })
  assert.deepEqual(r.capabilities, { tools: { listChanged: false } })
  assert.equal(s.status, 0)
  assert.match(s.stderr, /wiredown mcp .* ready/)
})

test('tools/list: five tools with titles, schemas and annotations', () => {
  const s = session([INIT, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 1, method: 'tools/list' }])
  assert.equal(s.lines.length, 2, 'the notification gets no answer')
  const list = s.byId.get(1).result.tools
  assert.deepEqual(list.map((t) => t.name), ['get_wiredown_grammar', 'lint_wiredown', 'wiredown_link', 'render_wiredown', 'animate_wiredown'])
  for (const t of list) {
    assert.ok(t.title && t.description, t.name)
    assert.equal(t.inputSchema.type, 'object')
    for (const k of ['readOnlyHint', 'destructiveHint', 'openWorldHint']) assert.equal(typeof t.annotations[k], 'boolean', `${t.name} ${k}`)
    assert.equal(t.annotations.openWorldHint, false)
    assert.equal(t.annotations.destructiveHint, false)
    assert.equal(t.annotations.readOnlyHint, !t.name.startsWith('render') && !t.name.startsWith('animate'))
    assert.doesNotMatch(t.description + t.title, /\u2014/)
  }
})

test('ping, unknown method, unknown tool, bad JSON, batches, bad requests', () => {
  const s = session([
    INIT,
    { jsonrpc: '2.0', id: 'p', method: 'ping' },
    { jsonrpc: '2.0', id: 2, method: 'resources/list' },
    call('no_such_tool', {}),
    '{not json',
    '[{"jsonrpc":"2.0","id":9,"method":"ping"}]',
    '{"id":3,"method":"ping"}',
    '{"jsonrpc":"2.0","id":{"x":1},"method":"ping"}',
    '{"jsonrpc":"2.0","id":null,"method":"ping"}',
    '42',
    '{"jsonrpc":"2.0","id":7,"result":{}}',
    '{"jsonrpc":"2.0","id":4,"method":"ping"}\r',
  ])
  assert.deepEqual(s.byId.get('p').result, {})
  assert.equal(s.byId.get(2).error.code, -32601)
  assert.equal(s.byId.get(nextId - 1).error.code, -32602)
  const nulls = s.lines.filter((l) => l.id === null).map((l) => l.error.code)
  assert.equal(nulls.length, 5)
  assert.equal(nulls.filter((c) => c === -32700).length, 1, 'one parse error')
  assert.equal(nulls.filter((c) => c === -32600).length, 4, 'batch, object id, null id, a bare number')
  assert.match(s.lines.find((l) => l.id === null && l.error.message.includes('Batch')).error.message, /one message per line/)
  assert.equal(s.byId.get(3).error.code, -32600)
  assert.equal(s.byId.has(7), false, 'a client response gets no answer')
  assert.deepEqual(s.byId.get(4).result, {}, 'CRLF lines are read')
  assert.equal(s.byId.has(9), false)
})

test('a line over 1 MiB is refused and the next one is still answered', () => {
  const big = JSON.stringify(call('lint_wiredown', { source: 'x'.repeat(1 << 21) }))
  const s = session([INIT, big, { jsonrpc: '2.0', id: 'after', method: 'ping' }])
  assert.equal(s.lines.filter((l) => l.id === null)[0].error.code, -32600)
  assert.deepEqual(s.byId.get('after').result, {})
})

test('get_wiredown_grammar, lint_wiredown, wiredown_link', async () => {
  const { results: [g, bad, clean, link] } = tools([
    ['get_wiredown_grammar', {}],
    ['lint_wiredown', { source: 'screen a "A"\n  button "Go" -> b\n' }],
    ['lint_wiredown', { source: login, info: 'wiremark' }],
    ['wiredown_link', { source: login, info: 'wiredown look=clean view=prototype' }],
  ])
  assert.equal(textOf(g), AI_CONTRACT)
  assert.match(bad.content[0].text, /^2:3 error dangling_link /)
  assert.equal(bad.structuredContent.ok, false)
  assert.deepEqual(JSON.parse(bad.content[1].text), bad.structuredContent)
  assert.deepEqual(clean.structuredContent, { ok: true, problems: [] })
  assert.equal(clean.content[0].text, 'No problems.')
  assert.match(link.content[0].text, /^Open this link to see the screens drawn: https:\/\/manup-dev\.github\.io\/wiredown\/#v1:/)
  assert.match(link.content[0].text, /pick Prototype/)
  const decoded = await decodeShare(link.structuredContent.url.slice(PLAYGROUND_URL.length))
  assert.equal(decoded.ok, true)
  assert.equal(decoded.text, login.replace('@device phone\n', '@device phone\n@look clean\n'))
})

test('render_wiredown returns the figure, or writes <screen-id>.svg files inside the root', () => {
  const s = tools([
    ['render_wiredown', { source: login }],
    ['render_wiredown', { source: login, outDir: 'screens/v1' }],
    ['render_wiredown', { source: login, outDir: 'screens/v1' }],
    ['animate_wiredown', { source: login, out: 'flow.svg' }],
    ['animate_wiredown', { source: login, out: 'out/flow.svg' }],
  ])
  const [fig, w1, w2, an, an2] = s.results
  assert.equal(fig.isError, undefined)
  assert.match(textOf(fig), /^<figure[\s\S]*<svg /)
  for (const w of [w1, w2]) assert.match(textOf(w), /^Wrote \d+ files:\nscreens\/v1\/login\.svg/)
  const files = readdirSync(join(s.cwd, 'screens/v1')).sort()
  assert.ok(files.includes('login.svg') && files.includes('reset.svg'), files.join())
  assert.ok(files.every((f) => f.endsWith('.svg')), 'no temp files left')
  assert.match(readFileSync(join(s.cwd, 'screens/v1/login.svg'), 'utf8'), /^<!-- made by wiredown -->\n<svg /)
  assert.match(textOf(an), /^Wrote flow\.svg \(\d+ KB\)/)
  assert.match(readFileSync(join(s.cwd, 'flow.svg'), 'utf8'), /^<!-- made by wiredown -->\n<svg[\s\S]*<style>/)
  assert.ok(existsSync(join(s.cwd, 'out/flow.svg')), textOf(an2))
})

test('an absolute path inside the root is allowed', () => {
  const cwd = tmp()
  const { results: [r] } = tools([['animate_wiredown', { source: login, out: join(cwd, 'abs.svg') }]], { cwd })
  assert.equal(r.isError, undefined, textOf(r))
  assert.ok(existsSync(join(cwd, 'abs.svg')))
})

test('writes refuse "..", absolute paths outside the root, escaping links and non-svg names', () => {
  const cwd = tmp()
  const outside = tmp()
  writeFileSync(join(outside, 'keep.svg'), 'outside')
  symlinkSync(outside, join(cwd, 'escape'))
  mkdirSync(join(cwd, 'real'))
  symlinkSync(join(cwd, 'real'), join(cwd, 'inner'))
  symlinkSync(join(outside, 'keep.svg'), join(cwd, 'planted.svg'))
  symlinkSync(join(outside, 'nowhere'), join(cwd, 'broken'))
  const { results } = tools([
    ['render_wiredown', { source: login, outDir: '../x' }],
    ['render_wiredown', { source: login, outDir: 'a/../../x' }],
    ['render_wiredown', { source: login, outDir: outside }],
    ['render_wiredown', { source: login, outDir: 'escape' }],
    ['render_wiredown', { source: login, outDir: 'escape/deeper' }],
    ['animate_wiredown', { source: login, out: '../flow.svg' }],
    ['animate_wiredown', { source: login, out: join(outside, 'flow.svg') }],
    ['animate_wiredown', { source: login, out: 'escape/flow.svg' }],
    ['animate_wiredown', { source: login, out: 'notes.txt' }],
    ['animate_wiredown', { source: login, out: 'package.json' }],
    ['animate_wiredown', { source: login, out: 'real' }],
    ['animate_wiredown', { source: login, out: 'broken/flow.svg' }],
    ['animate_wiredown', { source: login, out: 'a\0b.svg' }],
    ['render_wiredown', { source: login, outDir: 'inner' }],
    ['animate_wiredown', { source: login, out: 'planted.svg' }],
  ], { cwd })
  const patterns = [/may not contain "\.\."/, /may not contain "\.\."/, /must be inside/, /points outside/, /points outside/,
    /may not contain "\.\."/, /must be inside/, /points outside/, /\.svg file/, /\.svg file/, /\.svg file/, /broken link/, /not a usable path/]
  patterns.forEach((p, i) => refused(results[i], p))
  assert.equal(results[13].isError, undefined, 'a link that stays inside the root is fine')
  assert.ok(existsSync(join(cwd, 'real/login.svg')))
  // A link planted at the target is not ours: refused, never written through or replaced.
  refused(results[14], /planted\.svg already exists and was not made by wiredown/)
  assert.equal(lstatSync(join(cwd, 'planted.svg')).isSymbolicLink(), true)
  assert.equal(readFileSync(join(outside, 'keep.svg'), 'utf8'), 'outside')
  assert.deepEqual(readdirSync(outside), ['keep.svg'])
})

test('inputs are checked: size, types, unknown arguments, info, parse errors', () => {
  const { results } = tools([
    ['lint_wiredown', { source: 'x'.repeat(WM_LIMITS.body + 1) }],
    ['lint_wiredown', { source: 42 }],
    ['lint_wiredown', {}],
    ['lint_wiredown', { source: 'screen a\n', extra: 'x' }],
    ['lint_wiredown', { source: 'screen a\n', info: 'js' }],
    ['render_wiredown', { source: 'screen a\nscreen a\n' }],
    ['animate_wiredown', { source: 'screen a\nscreen a\n', out: 'f.svg' }],
    ['animate_wiredown', { source: login }],
    ['wiredown_link', { source: 'x'.repeat(WM_LIMITS.body + 1) }],
  ])
  const patterns = [/at most 65536/, /must be text/, /needs source/, /no argument named extra/, /info must start with wiredown/,
    /does not parse/, /does not parse/, /needs out/, /at most 65536/]
  patterns.forEach((p, i) => refused(results[i], p))
})

test('the filesystem root and the home folder are never write roots; lint still works there', () => {
  const home = tmp()
  const s = tools([['render_wiredown', { source: login, outDir: 'x' }], ['lint_wiredown', { source: login }]], { cwd: home, env: { ...process.env, HOME: home } })
  refused(s.results[0], /filesystem root, the home folder or a folder above it/)
  assert.equal(s.results[1].structuredContent.ok, true)
  assert.equal(existsSync(join(home, 'x')), false)
  const r = tools([['animate_wiredown', { source: login, out: 'flow.svg' }]], { cwd: '/' })
  refused(r.results[0], /filesystem root/)
})

test('--root sets the write folder; a bad --root stops the server at start', () => {
  const root = tmp()
  const s = tools([['animate_wiredown', { source: login, out: 'flow.svg' }]], { args: ['--root', root] })
  assert.equal(s.results[0].isError, undefined, textOf(s.results[0]))
  assert.ok(existsSync(join(root, 'flow.svg')))
  const bad = spawnSync(process.execPath, [bin, 'mcp', '--root', join(root, 'missing')], { input: '', encoding: 'utf8' })
  assert.equal(bad.status, 2)
  assert.equal(bad.stdout, '')
  assert.match(bad.stderr, /--root: The folder .* does not exist/)
})

const SCREENS = 'screen login "Sign in"\n  button "Go" -> reset\nscreen reset "Reset"\n  text "x"\n'

test('a file wiredown did not make is kept; its own files are replaced; a mixed batch writes nothing', () => {
  const cwd = tmp()
  mkdirSync(join(cwd, 'public'))
  writeFileSync(join(cwd, 'public/logo.svg'), '<svg>my logo</svg>')
  writeFileSync(join(cwd, 'flow.svg'), '<svg>hand made</svg>')
  const { results: [logo, flow, first, again, changed] } = tools([
    ['render_wiredown', { source: 'screen logo "Logo"\n  text "x"\n', outDir: 'public' }],
    ['animate_wiredown', { source: login, out: 'flow.svg' }],
    ['render_wiredown', { source: SCREENS, outDir: 'mix' }],
    ['render_wiredown', { source: SCREENS, outDir: 'mix' }],
    ['render_wiredown', { source: SCREENS.replace('"x"', '"changed"'), outDir: 'mix' }],
  ], { cwd })
  refused(logo, /public\/logo\.svg already exists and was not made by wiredown, so it was kept/)
  assert.equal(readFileSync(join(cwd, 'public/logo.svg'), 'utf8'), '<svg>my logo</svg>')
  refused(flow, /flow\.svg already exists and was not made by wiredown/)
  assert.equal(readFileSync(join(cwd, 'flow.svg'), 'utf8'), '<svg>hand made</svg>')
  for (const r of [first, again, changed]) assert.equal(r.isError, undefined, textOf(r))
  assert.match(readFileSync(join(cwd, 'mix/reset.svg'), 'utf8'), /changed/, 'a re-render of our own file replaces it')

  // Mixed: login.svg is ours, reset.svg is someone's. Nothing is written, not even login.svg.
  writeFileSync(join(cwd, 'mix/reset.svg'), '<svg>theirs</svg>')
  const before = readFileSync(join(cwd, 'mix/login.svg'), 'utf8')
  const { results: [mixed] } = tools([['render_wiredown', { source: SCREENS.replace('"Go"', '"Go now"'), outDir: 'mix' }]], { cwd })
  refused(mixed, /mix\/reset\.svg already exists and was not made by wiredown/)
  assert.equal(readFileSync(join(cwd, 'mix/login.svg'), 'utf8'), before)
  assert.equal(readFileSync(join(cwd, 'mix/reset.svg'), 'utf8'), '<svg>theirs</svg>')
  assert.deepEqual(readdirSync(join(cwd, 'mix')).sort(), ['login.svg', 'reset.svg'])
})

test('a file the command line wrote can be replaced by an MCP write', () => {
  const cwd = tmp()
  const src = join(cwd, 'flow.md')
  writeFileSync(src, '```wiredown\n' + login + '```\n')
  const cli = spawnSync(process.execPath, [bin, 'animate', src, '--out', 'flow.svg', '--no-credit'], { cwd, encoding: 'utf8' })
  assert.equal(cli.status, 0, cli.stderr)
  const before = readFileSync(join(cwd, 'flow.svg'), 'utf8')
  assert.match(before, /^<!-- made by wiredown -->\n<svg /)
  assert.doesNotMatch(before, />wiredown<\/text>/)
  const { results: [flow] } = tools([['animate_wiredown', { source: login, out: 'flow.svg' }]], { cwd })
  assert.equal(flow.isError, undefined, textOf(flow))
  assert.match(readFileSync(join(cwd, 'flow.svg'), 'utf8'), />wiredown<\/text>/, 'the MCP write replaced the file (it carries the credit)')
})

test('path parts: ~, %, \\, dot-files and bare .svg are refused; ..foo is a name; refusals make no folders', () => {
  const cwd = tmp()
  const { results } = tools([
    ['animate_wiredown', { source: login, out: '~/x.svg' }],
    ['animate_wiredown', { source: login, out: 'a/%2e%2e/x.svg' }],
    ['animate_wiredown', { source: login, out: 'C:\\x.svg' }],
    ['animate_wiredown', { source: login, out: '.svg' }],
    ['animate_wiredown', { source: login, out: 'deep/.hidden.svg' }],
    ['animate_wiredown', { source: login, out: 'x'.repeat(201) + '.svg' }],
    ['render_wiredown', { source: 'screen a\nscreen a\n', outDir: 'never' }],
    ['animate_wiredown', { source: login, out: '..foo/x.svg' }],
  ], { cwd })
  const patterns = [/part that starts with ~/, /may not contain %/, /may not contain \\/, /hidden file/, /hidden file/, /over 200 characters/, /does not parse/]
  patterns.forEach((p, i) => refused(results[i], p))
  assert.equal(results[7].isError, undefined, textOf(results[7]))
  assert.deepEqual(readdirSync(cwd).sort(), ['..foo'], 'no folder is made by a refused call')
})

test('a root above the home folder is refused; --root belongs to mcp only', () => {
  const cwd = tmp()
  mkdirSync(join(cwd, 'me'))
  const s = tools([['animate_wiredown', { source: login, out: 'flow.svg' }]], { cwd, env: { ...process.env, HOME: join(cwd, 'me') } })
  refused(s.results[0], /a folder above it/)
  const r = spawnSync(process.execPath, [bin, 'lint', '--root', cwd, 'x.md'], { encoding: 'utf8' })
  assert.equal(r.status, 2)
  assert.match(r.stderr, /--root is only for mcp/)
})

test('an icon pack that prints cannot corrupt stdout', () => {
  const cwd = tmp()
  const define = new URL('../src/packs-define.js', import.meta.url).href
  writeFileSync(join(cwd, 'noisy.mjs'), `import { defineIconPack } from ${JSON.stringify(define)}
console.log('hello from a pack'); console.info('info'); console.debug('debug')
export default defineIconPack({ id: 'noisy', name: 'noisy', version: '1', icons: { dot: 'M1 1h2v2h-2z' } })
`)
  const s = session([INIT, call('lint_wiredown', { source: '@icons noisy\nscreen a\n  icon "dot"\n' })], { cwd, args: ['--icons', './noisy.mjs'] })
  assert.equal(s.status, 0, s.stderr)
  assert.equal(s.lines.length, 2) // every stdout line parsed as JSON in session()
  assert.match(s.stderr, /hello from a pack[\s\S]*info[\s\S]*debug/)
  assert.equal(s.lines[1].result.structuredContent.ok, true, JSON.stringify(s.lines[1]))
})
