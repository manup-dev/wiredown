// Where an element is written: the body line a host anchors a comment (or any reference) to.
// Rules: a node is written on its own line; an element a define expanded is the use (the
// expansion's top element, on the USE line); an element seen in a variant is written on the
// base screen's line (variant clones share the base spans and ids); a screen frame is its
// `screen` / `variant` line (an implicit screen has none).
import { parseMock } from './parse.js';
import { isId, walk } from './ids.js';
import { lexLine } from './lex.js';
import { WM_LIMITS } from './limits.js';

// Parses are memoised by body + info: hosts ask about the same block over and over. A body
// over the parse limit is refused by parseMock at once and never held.
const MAX_MEMO = 32;
const memo = new Map();
function parsed(body, info) {
  if (body.length > WM_LIMITS.body) return parseMock(body, info);
  const key = `${info}\0${body}`;
  let r = memo.get(key);
  if (r === undefined) {
    r = parseMock(body, info);
    memo.set(key, r);
    if (memo.size > MAX_MEMO) memo.delete(memo.keys().next().value);
  }
  return r;
}

const kindWord = (n) => (n.kind === 'unknown' ? n.typed || 'element' : n.kind);
const labelOf = (n) => (n.labels[0] ? `${kindWord(n)} "${n.labels[0].slice(0, 60)}"` : `${kindWord(n)} #${n.id}`);
const isFrameLine = (text) => { const t = (text || '').trim(); return t.startsWith('screen ') || t.startsWith('variant '); };

// A define's use reads as the use line does: `field "Email"`.
function useLabel(n, lines) {
  const lexed = lexLine(lines[n.line - 1] || '', n.line);
  const first = lexed.tokens ? lexed.tokens.find((t) => t.t === 'label') : null;
  return first ? `${n.fromDefine} "${first.v.slice(0, 60)}"` : `${n.fromDefine} #${n.id}`;
}

function withParents(root) {
  const parent = new Map();
  const nodes = [];
  const stack = [[root, null]];
  while (stack.length) {
    const [n, p] = stack.pop();
    if (p) parent.set(n, p);
    nodes.push(n);
    for (let i = n.children.length - 1; i >= 0; i--) stack.push([n.children[i], n]);
  }
  return { parent, nodes };
}

// The first non-variant node carrying `id` (the one mockPatch edits).
function patchTarget(screens, id) {
  let hit = null;
  for (const s of screens) {
    if (s.variantOf) continue;
    walk(s.root, (n) => { if (!hit && n.id === id) hit = n; });
    if (hit) break;
  }
  return hit;
}

function describe(screens, screen, node, parent, lines) {
  if (node === screen.root) {
    if (!isFrameLine(lines[screen.line - 1])) return null;
    return { line: screen.line, elementId: node.id, screenId: screen.id, label: `screen "${screen.label || screen.id}"`, pin: null, frame: true };
  }
  let n = node;
  if (n.fromDefine) for (let p = parent.get(n); p && p.fromDefine && p.line === n.line; p = parent.get(p)) n = p;
  let pin = null;
  if (!n.explicitId) {
    if (n.fromDefine) pin = 'use';
    else if (patchTarget(screens, n.id)?.line === n.line) pin = 'patch';
  }
  return { line: n.line, elementId: n.id, screenId: screen.variantOf ?? screen.id, label: n.fromDefine ? useLabel(n, lines) : labelOf(n), pin, frame: false };
}

// The element `elementId` drawn in screen `screenId` (that screen first, then the rest).
// Returns { line, elementId, screenId, label, pin: null | 'patch' | 'use', frame } or null.
// `elementId` may come back different: the use's id for an element a define expanded.
export function locateElement(body, info, elementId, screenId) {
  if (typeof body !== 'string' || !isId(elementId)) return null;
  const r = parsed(body, typeof info === 'string' ? info : '');
  if (!r.ok) return null;
  const screens = r.mock.screens;
  const ordered = [...screens.filter((s) => s.id === screenId), ...screens.filter((s) => s.id !== screenId)];
  const lines = body.split('\n');
  for (const screen of ordered) {
    const { parent, nodes } = withParents(screen.root);
    const node = nodes.find((n) => n.id === elementId);
    if (node) return describe(screens, screen, node, parent, lines);
  }
  return null;
}

// The one element written on body line `line` (1-based), described as locateElement does,
// or null when the line holds none (a header, define body, comment, patch line) or the
// block does not parse.
export function elementAtLine(body, info, line) {
  if (typeof body !== 'string' || !Number.isInteger(line) || line < 1) return null;
  const r = parsed(body, typeof info === 'string' ? info : '');
  if (!r.ok) return null;
  const lines = body.split('\n');
  for (const screen of r.mock.screens) {
    if (screen.variantOf) continue;
    if (screen.line === line && isFrameLine(lines[line - 1])) return describe(r.mock.screens, screen, screen.root, new Map(), lines);
    const { parent, nodes } = withParents(screen.root);
    const node = nodes.find((n) => n !== screen.root && n.line === line);
    if (node) return describe(r.mock.screens, screen, node, parent, lines);
  }
  return null;
}

// Body line `line` (1-based) of the fence whose opening line starts at `fenceFrom` in `text`:
// { from, to } of its text without indent, container prefix or trailing blanks, and `at`,
// where the body's own text starts in the source line (after a list indent or `> ` the
// markdown renderer strips). Null when the source line does not end with the body line.
export function bodyLineSpan(text, fenceFrom, body, line) {
  if (typeof text !== 'string' || typeof body !== 'string' || !Number.isInteger(line) || line < 1) return null;
  let from = text.indexOf('\n', fenceFrom);
  for (let i = 1; i < line && from >= 0; i++) from = text.indexOf('\n', from + 1);
  if (from < 0) return null;
  from += 1;
  let end = text.indexOf('\n', from);
  if (end < 0) end = text.length;
  if (text[end - 1] === '\r') end -= 1;
  const src = text.slice(from, end);
  const own = (body.split('\n')[line - 1] ?? '').replace(/\r$/, '');
  if (!src.endsWith(own)) return null;
  const at = from + src.length - own.length;
  let a = at;
  while (a < end && (text[a] === ' ' || text[a] === '\t')) a++;
  let b = end;
  while (b > a && (text[b - 1] === ' ' || text[b - 1] === '\t')) b--;
  return b > a ? { from: a, to: b, at, end } : null;
}
