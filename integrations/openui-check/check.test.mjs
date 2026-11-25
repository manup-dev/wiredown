// Every OpenUI file wiredown exports must parse with zero errors in OpenUI's own parser (@openuidev/lang-core),
// against the schema @openuidev/react-ui's library produces itself. Also checks what the parser does not:
// child components are ones their parent's slot accepts, and every Icon name resolves in lucide.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createParser } from '@openuidev/lang-core'
import { toOpenUI } from 'wiredown/export'
import { CONTRACT_EXAMPLE } from '../../src/contract.js'
import { loadLibrary, buildTable, tableModule, versionOf } from './table.mjs'

const { root, schema } = await loadLibrary()
const parser = createParser(schema, root)
const lucide = new Set(Object.keys((await import('lucide-react/dynamicIconImports.mjs')).default))
const fallbacks = { brands: 'box' } // react-ui src/components/_shared/icons/categoryFallbacks.ts

const fixtures = new URL('../../test/fixtures/', import.meta.url)
const bodies = readdirSync(fixtures).filter((f) => f.endsWith('.wiredown')).sort()
  .map((f) => [f, readFileSync(new URL(f, fixtures), 'utf8')])
bodies.push(['contract', CONTRACT_EXAMPLE])
for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty'])
  bodies.push([`prototype-${name}`, `icon #i1 icon=${name}\nbadge "B" icon=${name}\nbutton #b1 icon=${name}`])

const isElement = (v) => v && typeof v === 'object' && v.type === 'element'

// Walks the parsed tree: every element in an array argument must be one its parent's slot names.
function walk(node, problems, opts = { icons: true }) {
  const def = schema.$defs[node.typeName]
  for (const [arg, value] of Object.entries(node.props)) {
    const items = def.properties[arg]?.items
    const allowed = items ? (items.anyOf ?? [items]).map((s) => s.$ref?.split('/').pop()).filter(Boolean) : []
    const kids = Array.isArray(value) ? value : [value]
    for (const kid of kids) {
      if (!isElement(kid)) continue
      if (Array.isArray(value) && allowed.length && !allowed.includes(kid.typeName))
        problems.push(`${node.typeName}.${arg} does not accept ${kid.typeName}`)
      if (kid.typeName === 'Icon' && opts.icons && !lucide.has(kid.props.name) && !lucide.has(fallbacks[kid.props.category]))
        problems.push(`Icon "${kid.props.name}" does not resolve`)
      walk(kid, problems, opts)
    }
  }
  return problems
}

test('the committed table is what the installed packages produce', () => {
  const table = buildTable(schema, root, versionOf('@openuidev/react-ui'), versionOf('@openuidev/lang-core'))
  const committed = readFileSync(new URL('../../src/export/openui-schema.js', import.meta.url), 'utf8')
  assert.equal(committed, tableModule(table), 'run `npm run gen`')
})

test('positional arguments land on the names the table gives', () => {
  const res = parser.parse('root = Stack([b], "row", "s")\nb = Button("Go", null, "primary")')
  assert.deepEqual(res.meta.errors, [])
  assert.equal(res.root.props.direction, 'row')
  assert.equal(res.root.props.gap, 's')
  assert.equal(res.root.props.children[0].props.variant, 'primary')
})

test('every exported file parses with zero errors in OpenUI lang-core', () => {
  let n = 0
  for (const [name, body] of bodies) {
    const r = toOpenUI(body)
    if (!r.ok) continue // fixtures with deliberate errors
    for (const f of r.files) {
      const res = parser.parse(f.text)
      const where = `${name}/${f.name}\n${f.text}`
      assert.deepEqual(res.meta.errors, [], where)
      assert.deepEqual(res.meta.unresolved, [], where)
      assert.deepEqual(res.meta.orphaned, [], where)
      assert.equal(res.meta.incomplete, false, where)
      assert.equal(res.root?.typeName, root, where)
      assert.equal(res.meta.statementCount, f.text.split('\n').filter((l) => /^[a-z_]/.test(l)).length, where)
      // made-up icon names (the prototype bodies) are allowed not to resolve; they must still parse
      assert.deepEqual(walk(res.root, [], { icons: !name.startsWith('prototype-') }), [], where)
      n++
    }
  }
  assert.ok(n >= 15, `only ${n} files checked`)
})

test('author text survives the round trip exactly', () => {
  const label = 'a"b // c # d \\ e \u{1F600} \t x'
  const body = `button "${label.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" #x note="n // m"\ntext "line\\nbreak"`
  const r = toOpenUI(body)
  assert.equal(r.ok, true)
  const res = parser.parse(r.files[0].text)
  assert.deepEqual(res.meta.errors, [])
  const [button, text] = res.root.props.children
  assert.equal(button.props.label, label)
  assert.equal(text.props.text, 'line\\nbreak')
})
