import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMock } from '../src/index.js';

const codes = (r) => (r.ok ? r.warnings : r.errors).map((e) => e.code);
const KPI = 'define kpi label value delta=""\n  card\n    text "$label"\n    h2 "$value" note="Change $delta"\n';

test('define expands with positional labels and kv', () => {
  const r = parseMock(`${KPI}screen a\n  kpi "MRR" "$48k" delta="+6%"\n  kpi "Churn" "2%"`);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const [a, b] = r.mock.screens[0].root.children;
  assert.equal(a.kind, 'card');
  assert.equal(a.children[0].labels[0], 'MRR');
  assert.equal(a.children[1].labels[0], '$48k');
  assert.equal(a.children[1].note, 'Change +6%');
  assert.equal(b.children[1].note, 'Change ');
});

test('extra attrs on a use apply to the single root', () => {
  const r = parseMock(`${KPI}kpi "A" "1" #k1 w=fill`);
  const n = r.mock.screens[0].root.children[0];
  assert.equal(n.id, 'k1');
  assert.equal(n.attrs.w, 'fill');
});

test('defines can use earlier defines', () => {
  const r = parseMock(`${KPI}define pair a b\n  row\n    kpi "$a" "1"\n    kpi "$b" "2"\npair "X" "Y"`);
  assert.equal(r.ok, true);
  assert.equal(r.mock.screens[0].root.children[0].children[1].children[0].labels[0], 'Y');
});

test('self-use is define_cycle, later define is define_unknown', () => {
  assert.equal(parseMock('define a\n  a\na').errors[0].code, 'define_cycle');
  const r = parseMock('define a\n  b\ndefine b\n  text "x"\na');
  assert.equal(r.errors[0].code, 'define_unknown');
  assert.equal(parseMock('b\ndefine b\n  text "x"').errors[0].code, 'define_unknown');
});

test('fan-out over the node limit stops with limit_nodes', () => {
  const ten = 'define ten\n  stack\n' + Array.from({ length: 10 }, () => '    text "x"').join('\n') + '\n';
  const r = parseMock(ten + 'screen a\n  stack\n' + Array.from({ length: 200 }, () => '    ten').join('\n'));
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'limit_nodes');
});

test('variant patches: attrs, flags, hide', () => {
  const src = 'screen a\n  button "Go" #go\n  text "Hi" #hi\nvariant a2 of a "Loading"\n  #go loading primary\n  #hi hide\n';
  const r = parseMock(src);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const [a, v] = r.mock.screens;
  assert.deepEqual(a.root.children.map((c) => c.id), ['go', 'hi']);
  assert.deepEqual(v.root.children.map((c) => c.id), ['go']);
  assert.deepEqual(v.root.children[0].flags, ['loading', 'primary']);
  assert.deepEqual(a.root.children[0].flags, []);
  assert.equal(v.label, 'Loading');
  assert.equal(v.variantOf, 'a');
});

test('variant errors', () => {
  assert.equal(parseMock('screen a\n  text "x"\nvariant v of zzz\n  #x hide').errors[0].code, 'variant_target');
  assert.equal(parseMock('screen a\n  text "x"\nvariant v of a\n  #nope hide').errors[0].code, 'variant_target');
  assert.equal(parseMock('screen a\n  input "x" #i\nvariant v of a\n  #i error="e"\nvariant v of a\n  #i error="f"').errors[0].code, 'duplicate_id');
  assert.equal(parseMock('screen a\n  input "x" #i\nvariant v of a\n  #i tone=bad').ok, true);
  assert.equal(parseMock('screen a\n  badge "x" #i\nvariant v of a\n  #i tone=purple').errors[0].code, 'bad_value');
});

test('variant limit', () => {
  const src = 'screen a\n  text "x" #t\n' + Array.from({ length: 49 }, (_, i) => `variant v${i} of a\n  #t muted`).join('\n');
  assert.equal(parseMock(src).errors[0].code, 'limit_variants');
});
