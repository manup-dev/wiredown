import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vsctm from 'vscode-textmate'
import oniguruma from 'vscode-oniguruma'

const require = createRequire(import.meta.url)
const wasm = readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'))
const grammarPath = fileURLToPath(new URL('../syntaxes/wiremark.tmLanguage.json', import.meta.url))

const onigLib = oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)).then(() => ({
  createOnigScanner: (p) => new oniguruma.OnigScanner(p),
  createOnigString: (s) => new oniguruma.OnigString(s),
}))
const registry = new vsctm.Registry({
  onigLib,
  loadGrammar: async () => vsctm.parseRawGrammar(readFileSync(grammarPath, 'utf8'), grammarPath),
})

test('tokens carry the expected scopes', async () => {
  const grammar = await registry.loadGrammar('source.wiremark')
  const line = '  button "Sign in" primary w=fill #submit -> home // x'
  const { tokens } = grammar.tokenizeLine(line, vsctm.INITIAL)
  const scopesOf = (text) => {
    const at = line.indexOf(text)
    const t = tokens.find((k) => k.startIndex <= at && at < k.endIndex)
    return t ? t.scopes : []
  }
  assert.ok(scopesOf('button').includes('entity.name.tag.wiremark'))
  assert.ok(scopesOf('"Sign in"').includes('string.quoted.double.wiremark'))
  assert.ok(scopesOf('w=').includes('entity.other.attribute-name.wiremark'))
  assert.ok(scopesOf('#submit').includes('variable.other.id.wiremark'))
  assert.ok(scopesOf('->').includes('keyword.operator.link.wiremark'))
  assert.ok(scopesOf('// x').includes('comment.line.double-slash.wiremark'))
})
