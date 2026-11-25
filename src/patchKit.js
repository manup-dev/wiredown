// Shared helpers for mockPatch: line spans, indentation, line endings, node lookup.
// Lines are the body split on '\n' and keep their own '\r'; new or moved lines take the body's EOL.
import { walk } from './ids.js';
import { lexLine } from './lex.js';

export const fail = (error, message) => ({ ok: false, error, message });
const NAME = /^[a-z][a-z0-9-]*$/;
export const hasEol = (v) => typeof v === 'string' && (v.includes('\r') || v.includes('\n'));
export const indentOf = (s) => { let i = 0; while (s[i] === ' ') i++; return i; };
export const blank = (s) => s.trim() === '';
export const isComment = (s) => s.trimStart().startsWith('//');
export const bare = (s) => (s.endsWith('\r') ? s.slice(0, -1) : s);
export const quote = (v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
export const isFrameLine = (text) => { const t = (text || '').trim(); return t.startsWith('screen ') || t === 'screen' || t.startsWith('variant '); };
// A message when attrs or flags could change structure (bad names, multi-line values), else null.
export function badParts(attrs, flags) {
  if (attrs !== undefined && (attrs === null || typeof attrs !== 'object')) return 'attrs is an object of names and values.';
  if (flags !== undefined && (flags === null || typeof flags !== 'object')) return 'flags is an object of names and true or false.';
  for (const [k, v] of Object.entries(attrs || {})) {
    if (!NAME.test(k)) return `${k.slice(0, 40)} is not an attribute name.`;
    if (v !== null && (typeof v !== 'string' || hasEol(v))) return 'An attribute value is one line of text, or null to remove it.';
  }
  for (const [f, on] of Object.entries(flags || {})) {
    if (!NAME.test(f)) return `${f.slice(0, 40)} is not a flag name.`;
    if (typeof on !== 'boolean') return 'A flag is true or false.';
  }
  return null;
}

export const isLabelText = (v, max = 200) => typeof v === 'string' && !hasEol(v) && v.length <= max;

// The body's line ending: '\r' when it uses CRLF anywhere.
export const eolOf = (lines) => (lines.some((l) => l.endsWith('\r')) ? '\r' : '');

// Indent unit the parser reads: the first indented line with content; 2 when none.
export function unitOf(lines) {
  for (const l of lines) if (!blank(l) && !isComment(l) && indentOf(l) > 0) return indentOf(l);
  return 2;
}

// Last line index of the subtree written at `at`: every following deeper line (children, and
// comments among or right after them that are indented deeper); a comment at the element's own
// indent or shallower never extends the span, but a deeper element after it does.
export function spanEnd(lines, at) {
  const base = indentOf(lines[at]);
  let last = at;
  for (let j = at + 1; j < lines.length; j++) {
    const l = lines[j];
    if (blank(l)) continue;
    if (indentOf(l) > base) { last = j; continue; }
    if (isComment(l)) continue;
    break;
  }
  return last;
}

// First line of the comments attached directly above `at` (same indent, no blank line between).
export function leadStart(lines, at) {
  const ind = indentOf(lines[at]);
  let s = at;
  while (s > 0 && isComment(lines[s - 1]) && indentOf(lines[s - 1]) === ind) s--;
  return s;
}

// Re-indents one line by `delta` spaces (never below 0); blank lines are kept as they are.
export function shift(line, delta) {
  const l = bare(line);
  if (!delta || blank(l)) return l;
  const cur = indentOf(l);
  return ' '.repeat(Math.max(0, cur + delta)) + l.slice(cur);
}

// Inserts `add` (lines without '\r') at `at`, giving each the body's EOL. Appending after a final
// line that had no newline gives that line the EOL and leaves the new last line without one.
export function insertLines(lines, at, add, eol) {
  if (!add.length) return;
  const out = add.map((l) => bare(l) + eol);
  if (at >= lines.length) {
    if (lines.length && eol && !lines[lines.length - 1].endsWith('\r')) lines[lines.length - 1] += eol;
    out[out.length - 1] = bare(out[out.length - 1]);
    lines.push(...out);
  } else lines.splice(at, 0, ...out);
}

// Removes lines a..b; a new last line drops the EOL it had before its newline went away.
export function removeLines(lines, a, b) {
  const wasLast = b >= lines.length - 1;
  lines.splice(a, b - a + 1);
  if (wasLast && lines.length) lines[lines.length - 1] = bare(lines[lines.length - 1]);
}

// A position (line index) before a removal of { from, to }, mapped to the array after it.
export const after = (p, cut) => (p > cut.to ? p - (cut.to - cut.from + 1) : p >= cut.from ? cut.from : p);

// Where a token ends (exclusive index) in `text`, for splicing it out or replacing it.
export function tokenEnd(text, tok) {
  let i = tok.col - 1;
  const word = () => { while (i < text.length && text[i] !== ' ' && text[i] !== '\t') i++; };
  const quoted = () => { i++; while (i < text.length && text[i] !== '"') i += text[i] === '\\' && i + 1 < text.length ? 2 : 1; i = Math.min(i + 1, text.length); };
  if (tok.t === 'label') quoted();
  else if (tok.t === 'kv') { i = text.indexOf('=', i) + 1; if (text[i] === '"') quoted(); else word(); }
  else if (tok.t === 'link') { i += 2; while (text[i] === ' ' || text[i] === '\t') i++; word(); }
  else word();
  return i;
}

// The line with token `tok` and the white space before it removed.
export function cutToken(text, tok) {
  let a = tok.col - 1;
  while (a > 0 && (text[a - 1] === ' ' || text[a - 1] === '\t')) a--;
  return text.slice(0, a) + text.slice(tokenEnd(text, tok));
}

// The line without its `#id` token (a copy must not repeat an explicit id).
export function dropIdToken(line) {
  const text = bare(line);
  const lx = lexLine(text, 1);
  if (lx.error || !lx.tokens.length || lx.tokens[0].t !== 'word') return text;
  const tok = lx.tokens.find((t) => t.t === 'id');
  return tok ? cutToken(text, tok) : text;
}

// The first node with `id` in the base screens (variant clones share the base's lines), with its
// screen and parent (null for the screen root). scope: { only } looks in that screen alone,
// { prefer } in that screen first, then the rest in source order.
export function findNode(mock, id, scope) {
  const bases = mock.screens.filter((s) => !s.variantOf);
  const only = scope ? scope.only : undefined;
  const prefer = scope ? scope.prefer : undefined;
  const order = only !== undefined ? bases.filter((s) => s.id === only)
    : prefer ? [...bases.filter((s) => s.id === prefer), ...bases.filter((s) => s.id !== prefer)] : bases;
  for (const s of order) {
    const stack = [[s.root, null]];
    while (stack.length) {
      const [n, p] = stack.pop();
      if (n.id === id) return { node: n, screen: s, parent: p };
      for (let i = n.children.length - 1; i >= 0; i--) stack.push([n.children[i], n]);
    }
  }
  return null;
}

// Checks an optional screen scope: undefined, or a base screen's id. Returns a failure or null.
export function badScope(mock, sid) {
  if (sid === undefined) return null;
  if (typeof sid !== 'string') return fail('bad_op', 'screen names a screen id.');
  const s = mock.screens.find((x) => x.id === sid);
  if (!s) return fail('not_found', `No screen ${sid.slice(0, 64)}.`);
  if (s.variantOf) return fail('not_found', `${sid} is a variant; change its elements with a variant patch.`);
  return null;
}

// Finds the element `id` (in screen `sid` when given) or answers not_found.
export function lookup(mock, id, sid) {
  const bad = badScope(mock, sid);
  if (bad) return bad;
  return findNode(mock, id, sid === undefined ? null : { only: sid }) || fail('not_found', sid === undefined ? `No element #${id}.` : `No element #${id} in ${sid}.`);
}

export const contains = (root, node) => { let hit = false; walk(root, (n) => { if (n === node) hit = true; }); return hit; };

// The element written on line index `at` after a change (outermost node there) and its screen,
// or { id: null, screen: null }.
export function idAtLine(mock, at, lines) {
  for (const s of mock.screens) {
    if (s.variantOf) continue;
    if (s.line === at + 1 && isFrameLine(lines[at])) return { id: s.id, screen: s.id };
    let hit = null;
    walk(s.root, (n) => { if (!hit && n !== s.root && n.line === at + 1) hit = n; });
    if (hit) return { id: hit.id, screen: s.id };
  }
  return { id: null, screen: null };
}

// Is this screen written without a `screen` line (bare elements, the implicit `main`)?
export const isImplicit = (screen, lines) => !screen.variantOf && !isFrameLine(lines[screen.line - 1]);

// Normalises lines to add: relative indentation kept, re-based at `indent` with the body's unit.
// Returns { lines, tops: [{ at, kind }] } (tops = level-0 element lines) or a failure.
export function placeLines(texts, indent, unit) {
  if (!Array.isArray(texts) || !texts.length || texts.length > 40) return fail('bad_op', 'Add 1 to 40 lines.');
  const rows = [];
  for (const t of texts) {
    if (typeof t !== 'string' || hasEol(t) || blank(t)) return fail('bad_op', 'Each added line is one non-empty line of text.');
    if (t.length > 500) return fail('bad_op', 'A line may have at most 500 characters.');
    let i = 0; while (t[i] === ' ' || t[i] === '\t') { if (t[i] === '\t') return fail('bad_op', 'Indent with spaces, not tabs.'); i++; }
    rows.push({ ind: i, text: t.slice(i).trimEnd(), comment: t.slice(i).startsWith('//') });
  }
  const els = rows.filter((r) => !r.comment);
  if (!els.length) return fail('bad_op', 'Add at least one element line.');
  const base = Math.min(...els.map((r) => r.ind));
  if (els[0].ind !== base) return fail('bad_op', 'The first added element must be the least indented.');
  let step = 0;
  for (const r of els) { const d = r.ind - base; if (d > 0 && (!step || d < step)) step = d; }
  step = step || unit;
  const out = [];
  const tops = [];
  for (const r of rows) {
    const rel = Math.max(0, r.ind - base);
    if (!r.comment && rel % step) return fail('bad_op', 'The added lines are not indented in even steps.');
    const level = Math.floor(rel / step);
    if (!r.comment && level === 0) tops.push({ at: out.length, kind: r.text.split(/[ \t]/, 1)[0] });
    out.push(' '.repeat(indent + level * unit) + r.text);
  }
  return { lines: out, tops };
}
