// mockTree: the block as a host's editor sees it. Each screen lists its elements in source order
// with the facts a direct-manipulation editor needs: where each is written, its parent and place,
// how a container lays children out (axis) and what it accepts, and whether it can be edited
// directly (not a screen frame, not made by a define, not a variant's copy), and whether something
// else in the block names it by id (`referenced`: a variant patch line), so a host pins a derived id
// before relabelling it.
import { parseMock } from './parse.js';
import { KINDS, hasKind } from './kinds.js';
import { axisOf } from './plan.js';
import { isFrameLine } from './patchKit.js';
import { WM_LIMITS } from './limits.js';

const MAX_MEMO = 32;
const memo = new Map();
const AXIS = { col: 'column', row: 'row', grid: 'grid' };

function element(n, parent, index, depth, frame, variant, refs) {
  const known = hasKind(n.kind);
  const kids = known ? KINDS[n.kind].children : 'none';
  const container = kids !== 'none';
  const e = {
    id: n.id, kind: n.kind, typed: n.typed ?? null, line: n.line, parent: parent ? parent.id : null, index, depth,
    labels: Object.freeze([...n.labels]), flags: Object.freeze([...n.flags]), attrs: Object.freeze({ ...n.attrs }),
    link: n.link, note: n.note, explicitId: n.explicitId, fromDefine: n.fromDefine ?? null, container,
    axis: container ? AXIS[axisOf(n.kind)] : null, accepts: Array.isArray(kids) ? Object.freeze([...kids]) : kids,
    editable: !frame && !n.fromDefine && !variant,
    referenced: !frame && refs.has(n.id),
  };
  if (frame) e.reason = 'frame';
  else if (n.fromDefine) e.reason = 'define';
  else if (variant) e.reason = 'variant';
  return Object.freeze(e);
}

function screenOf(s, lines, refs) {
  const implicit = !s.variantOf && !isFrameLine(lines[s.line - 1]);
  const elements = [];
  const stack = [[s.root, null, 0, 0]];
  while (stack.length) {
    const [n, p, index, depth] = stack.pop();
    const e = element(n, p, index, depth, n === s.root, Boolean(s.variantOf), refs);
    elements.push(n === s.root && implicit ? Object.freeze({ ...e, line: null }) : e);
    for (let i = n.children.length - 1; i >= 0; i--) stack.push([n.children[i], n, i, depth + 1]);
  }
  return Object.freeze({ id: s.id, label: s.label, line: implicit ? null : s.line, variantOf: s.variantOf, implicit, elements: Object.freeze(elements) });
}

function build(body, info) {
  const r = parseMock(body, info);
  if (!r.ok) return Object.freeze({ ok: false, errors: r.errors });
  const lines = body.split('\n');
  // The ids each base screen's variants patch: renaming one would orphan its patch line.
  const refs = new Map();
  for (const s of r.mock.screens) {
    if (!s.variantOf) continue;
    const set = refs.get(s.variantOf) ?? new Set();
    for (const id of s.patched ?? []) set.add(id);
    refs.set(s.variantOf, set);
  }
  const none = new Set();
  return Object.freeze({ ok: true, screens: Object.freeze(r.mock.screens.map((s) => screenOf(s, lines, refs.get(s.variantOf ?? s.id) ?? none))) });
}

// Returns { ok: true, screens } or { ok: false, errors }; results are frozen and memoised.
export function mockTree(body, info) {
  if (typeof body !== 'string') return build(body, '');
  const inf = typeof info === 'string' ? info : '';
  if (body.length > WM_LIMITS.body) return build(body, inf);
  const key = `${inf}\0${body}`;
  let t = memo.get(key);
  if (t === undefined) {
    t = build(body, inf);
    memo.set(key, t);
    if (memo.size > MAX_MEMO) memo.delete(memo.keys().next().value);
  }
  return t;
}
