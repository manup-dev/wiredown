import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vsctm from 'vscode-textmate'
import oniguruma from 'vscode-oniguruma'

const require = createRequire(import.meta.url)
const wasm = readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'))
const grammarPath = fileURLToPath(new URL('../syntaxes/wiredown.tmLanguage.json', import.meta.url))

const onigLib = oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)).then(() => ({
  createOnigScanner: (p) => new oniguruma.OnigScanner(p),
  createOnigString: (s) => new oniguruma.OnigString(s),
}))
const registry = new vsctm.Registry({
  onigLib,
  loadGrammar: async () => vsctm.parseRawGrammar(readFileSync(grammarPath, 'utf8'), grammarPath),
})

test('tokens carry the expected scopes', async () => {
  const grammar = await registry.loadGrammar('source.wiredown')
  const line = '  button "Sign in" primary w=fill #submit -> home // x'
  const { tokens } = grammar.tokenizeLine(line, vsctm.INITIAL)
  const scopesOf = (text) => {
    const at = line.indexOf(text)
    const t = tokens.find((k) => k.startIndex <= at && at < k.endIndex)
    return t ? t.scopes : []
  }
  assert.ok(scopesOf('button').includes('entity.name.tag.wiredown'))
  assert.ok(scopesOf('"Sign in"').includes('string.quoted.double.wiredown'))
  assert.ok(scopesOf('w=').includes('entity.other.attribute-name.wiredown'))
  assert.ok(scopesOf('#submit').includes('variable.other.id.wiredown'))
  assert.ok(scopesOf('->').includes('keyword.operator.link.wiredown'))
  assert.ok(scopesOf('// x').includes('comment.line.double-slash.wiredown'))
})
