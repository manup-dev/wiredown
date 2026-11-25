// mockPatch screen ops: addScreen, renameScreen, removeScreen, moveScreen. A base screen's block
// travels with the variants written right after it; blank lines between blocks keep the body's style.
import { parseMock } from './parse.js';
import { lexLine } from './lex.js';
import { isId, slug, walk } from './ids.js';
import { hasKind } from './kinds.js';
import { canHold, holdMessage } from './hold.js';
import {
  fail, blank, isComment, bare, quote, indentOf, unitOf, eolOf, spanEnd, leadStart, shift, insertLines,
  removeLines, after, tokenEnd, cutToken, isImplicit, isLabelText, placeLines, isFrameLine,
} from './patchKit.js';

const screenOf = (mock, id) => mock.screens.find((s) => s.id === id) || null;
const crOf = (l) => (l.endsWith('\r') ? '\r' : '');

// Blank lines between top-level blocks: the body's style, assumed with fewer than two screens.
function blankStyle(lines, mock) {
  if (mock.screens.length < 2) return true;
  return mock.screens.some((s) => {
    const at = leadStart(lines, s.line - 1);
    return at > 0 && isFrameLine(lines[s.line - 1]) && blank(lines[at - 1]);
  });
}

const blockOf = (lines, s) => ({ s: leadStart(lines, s.line - 1), e: spanEnd(lines, s.line - 1) });

// A base screen's block plus the blocks of its variants that follow it directly.
function groupOf(lines, mock, screen) {
  const b = blockOf(lines, screen);
  if (screen.variantOf) return b;
  const mine = new Set(mock.screens.filter((x) => x.variantOf === screen.id).map((x) => x.line - 1));
  for (let j = b.e + 1; j < lines.length; j++) {
    if (blank(lines[j]) || isComment(lines[j])) continue;
    if (!mine.has(j)) break;
    b.e = spanEnd(lines, j);
    j = b.e;
  }
  return b;
}

// Removes a block and one blank line beside it (the one before, else the one after it).
function cutBlock(lines, s, e) {
  let a = s;
  let b = e;
  const prev = a > 0 && blank(lines[a - 1]);
  const next = b + 1 < lines.length && blank(lines[b + 1]);
  if (prev && next) a--;
  else if (!prev && next && b + 1 < lines.length - 1) b++;
  removeLines(lines, a, b);
  return { from: a, to: b };
}

// Writes the implicit screen's `screen main` line and indents its elements under it.
function explicitFirst(lines, mock, label) {
  const imp = mock.screens.find((s) => !s.variantOf && isImplicit(s, lines));
  if (!imp) return { mock };
  const kids = imp.root.children;
  const first = leadStart(lines, kids[0].line - 1);
  const last = spanEnd(lines, kids[kids.length - 1].line - 1);
  const own = new Set(kids.map((k) => k.line - 1));
  for (let j = first; j <= last; j++) {
    const l = lines[j];
    if (!blank(l) && !isComment(l) && indentOf(l) === 0 && !own.has(j)) return fail('bad_op', 'Move the defines and variants above or below the elements first.');
  }
  const unit = unitOf(lines);
  const eol = eolOf(lines);
  for (let j = first; j <= last; j++) lines[j] = shift(lines[j], unit) + crOf(lines[j]);
  insertLines(lines, first, [`screen main${label ? ` ${quote(label)}` : ''}`], eol);
  const r = parseMock(lines.join('\n'));
  return r.ok ? { mock: r.mock } : fail('would_break', 'That change would leave the block with errors.');
}

function freshId(label, mock) {
  const used = new Set();
  for (const s of mock.screens) { used.add(s.id); if (!s.variantOf) walk(s.root, (n) => used.add(n.id)); }
  let base = slug(label) || 'screen';
  if (!isId(base)) base = `screen-${base}`;
  let id = base;
  for (let k = 2; used.has(id); k++) id = `${base}-${k}`;
  return { id, used };
}

export function addScreenOp(lines, mock0, op) {
  const a = op.addScreen;
  if (!a || typeof a !== 'object') return fail('bad_op', 'addScreen takes { label, id?, after?, lines? }.');
  if (!isLabelText(a.label)) return fail('bad_op', 'A screen label is one line of text, at most 200 characters.');
  if (a.id !== undefined && !isId(a.id)) return fail('bad_op', 'A screen id is lowercase letters, digits and hyphens, starting with a letter.');
  if (a.after !== undefined && typeof a.after !== 'string') return fail('bad_op', 'after names a screen id.');
  const conv = explicitFirst(lines, mock0, '');
  if (conv.ok === false) return conv;
  const { mock } = conv;
  const fresh = freshId(a.label, mock);
  if (a.id !== undefined && fresh.used.has(a.id)) return fail('id_taken', `The id ${a.id} is already used in this block.`);
  const id = a.id ?? fresh.id;
  const unit = unitOf(lines);
  const body = a.lines === undefined ? { lines: [`${' '.repeat(unit)}stack pad=16 gap=12`], tops: [] } : placeLines(a.lines, unit, unit);
  if (body.ok === false) return body;
  for (const t of body.tops) if (hasKind(t.kind) && !canHold('screen', t.kind)) return fail('cannot_hold', holdMessage('screen', t.kind));
  let index = lines.length;
  if (a.after !== undefined) {
    const t = screenOf(mock, a.after);
    if (!t) return fail('not_found', `No screen ${a.after}.`);
    index = groupOf(lines, mock, t).e + 1;
  } else while (index > 0 && blank(lines[index - 1])) index--;
  const block = [`screen ${id}${a.label ? ` ${quote(a.label)}` : ''}`, ...body.lines];
  insertLines(lines, index, blankStyle(lines, mock) && index > 0 ? ['', ...block] : block, eolOf(lines));
  return { pick: { id, screen: id } };
}

export function renameScreenOp(lines, mock, op) {
  const label = op.label;
  if (label !== null && !isLabelText(label)) return fail('bad_op', 'renameScreen takes a label of one line (at most 200 characters), or null to remove it.');
  const s = screenOf(mock, op.renameScreen);
  if (!s) return fail('not_found', `No screen ${op.renameScreen}.`);
  if (isImplicit(s, lines)) {
    const conv = label ? explicitFirst(lines, mock, label) : null;
    return conv && conv.ok === false ? conv : { pick: { id: s.id, screen: s.id } };
  }
  const at = s.line - 1;
  const text = bare(lines[at]);
  const t = lexLine(text, 1).tokens || [];
  const tok = s.variantOf ? (t[4] && t[4].t === 'label' ? t[4] : null) : t.slice(2).find((x) => x.t === 'label') || null;
  let out = text;
  if (tok) out = label ? text.slice(0, tok.col - 1) + quote(label) + text.slice(tokenEnd(text, tok)) : cutToken(text, tok);
  else if (label) {
    const end = tokenEnd(text, t[s.variantOf ? 3 : 1]);
    out = `${text.slice(0, end)} ${quote(label)}${text.slice(end)}`;
  }
  lines[at] = out + crOf(lines[at]);
  return { pick: { id: s.id, screen: s.id } };
}

// Lines outside `skip` whose links (or @flow entries) name one of `ids`.
function linksTo(lines, ids, skip) {
  const hits = [];
  for (let j = 0; j < lines.length; j++) {
    if (skip(j)) continue;
    const l = bare(lines[j]);
    const flowLine = l.startsWith('@flow');
    if (!flowLine && l.indexOf('->') < 0) continue;
    const lx = lexLine(l, j + 1);
    if (lx.error) continue;
    const toks = lx.tokens.filter((x) => (x.t === 'link' || (flowLine && x.t === 'word')) && ids.has(x.v));
    if (toks.length) hits.push({ j, toks, flowLine });
  }
  return hits;
}

export function removeScreenOp(lines, mock, op) {
  const s = screenOf(mock, op.removeScreen);
  if (!s) return fail('not_found', `No screen ${op.removeScreen}.`);
  if (op.unlink !== undefined && typeof op.unlink !== 'boolean') return fail('bad_op', 'unlink is true or false.');
  if (!s.variantOf && mock.screens.filter((x) => !x.variantOf).length < 2) return fail('last_screen', 'A block keeps at least one screen.');
  const gone = s.variantOf ? [s] : [s, ...mock.screens.filter((x) => x.variantOf === s.id)];
  const ids = new Set(gone.map((x) => x.id));
  const ranges = gone.map((x) => blockOf(lines, x));
  const hits = linksTo(lines, ids, (j) => ranges.some((r) => j >= r.s && j <= r.e));
  if (hits.length && op.unlink !== true) {
    const n = hits.length;
    return fail('dangling_link', `${n} line${n === 1 ? ' links' : 's link'} to ${s.label ? `"${s.label}"` : s.id}; pass unlink: true to remove those links too.`);
  }
  const cuts = ranges.map((r) => ({ ...r, block: true }));
  for (const h of hits) {
    let text = bare(lines[h.j]);
    for (const t of [...h.toks].sort((x, y) => y.col - x.col)) text = cutToken(text, t);
    if (h.flowLine && (lexLine(text, 1).tokens || []).length < 2) cuts.push({ s: h.j, e: h.j, block: false });
    else lines[h.j] = text + crOf(lines[h.j]);
  }
  for (const c of cuts.sort((x, y) => y.s - x.s)) {
    if (c.block) cutBlock(lines, c.s, c.e); else removeLines(lines, c.s, c.e);
  }
  return { pick: { id: null } };
}

export function moveScreenOp(lines, mock, op) {
  const s = screenOf(mock, op.moveScreen);
  if (!s) return fail('not_found', `No screen ${op.moveScreen}.`);
  const keys = ['before', 'after'].filter((k) => op[k] !== undefined);
  if (keys.length !== 1 || typeof op[keys[0]] !== 'string') return fail('bad_op', 'moveScreen takes one of before or after: a screen id.');
  const t = screenOf(mock, op[keys[0]]);
  if (!t) return fail('not_found', `No screen ${op[keys[0]]}.`);
  if (t === s) return { pick: { id: s.id, screen: s.id } };
  if (isImplicit(s, lines)) return fail('bad_op', 'This screen has no screen line to move.');
  const g = groupOf(lines, mock, s);
  if (t.line - 1 >= g.s && t.line - 1 <= g.e) return fail('bad_move', `${t.id} moves with ${s.id}; move the variant on its own instead.`);
  const tg = groupOf(lines, mock, t);
  const sep = blankStyle(lines, mock);
  const eol = eolOf(lines);
  const before = keys[0] === 'before';
  const block = lines.slice(g.s, g.e + 1).map(bare);
  const cut = cutBlock(lines, g.s, g.e);
  const index = after(before ? tg.s : tg.e + 1, cut);
  insertLines(lines, index, sep ? (before ? [...block, ''] : ['', ...block]) : block, eol);
  return { pick: { id: s.id, screen: s.id } };
}
