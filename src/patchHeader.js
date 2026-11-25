// mockPatch header and variant ops: set, add or remove an @device / @look / @title line, and write
// or update one element's patch line inside a variant block.
import { lexLine } from './lex.js';
import { walk } from './ids.js';
import { rewriteLine, rewritePatchLine, commentStart } from './patchLine.js';
import {
  fail, hasEol, blank, isComment, bare, quote, indentOf, unitOf, eolOf, spanEnd, insertLines, removeLines, badParts,
} from './patchKit.js';

const ORDER = ['device', 'look', 'title', 'flow', 'requires'];
const crOf = (l) => (l.endsWith('\r') ? '\r' : '');
const pickNone = { pick: { id: null } };

function plainWords(v) {
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === ' ')) return null;
  }
  return v.split(' ').filter(Boolean);
}

// The header text to write, or a failure.
function headerText(name, value) {
  if (hasEol(value) || value.length > 200) return fail('bad_op', 'A header value is one line of text.');
  if (name === 'title') return `@title ${quote(value)}`;
  const words = plainWords(value);
  if (!words || !words.length) return fail('bad_op', name === 'look' ? 'look is wire or clean.' : 'A device is phone, tablet, laptop, desktop or WxH, optionally followed by fit.');
  if (name === 'look' && (words.length !== 1 || (words[0] !== 'wire' && words[0] !== 'clean'))) return fail('bad_op', 'look is wire or clean.');
  return `@${name} ${words.join(' ')}`;
}

export function headerOp(lines, mock, op) {
  const name = op.header;
  if (name !== 'device' && name !== 'look' && name !== 'title') return fail('bad_op', 'header is device, look or title.');
  if (op.value !== null && typeof op.value !== 'string') return fail('bad_op', 'A header value is text, or null to remove it.');
  const text = op.value === null ? null : headerText(name, op.value);
  if (text && text.ok === false) return text;
  const found = [];
  for (let j = 0; j < lines.length; j++) {
    const l = bare(lines[j]);
    if (blank(l) || isComment(l) || indentOf(l) > 0) continue;
    if (l[0] !== '@') break;
    let k = 1;
    while (k < l.length && l[k] !== ' ' && l[k] !== '\t') k++;
    found.push({ j, name: l.slice(1, k) });
  }
  const mine = found.find((f) => f.name === name);
  if (mine) {
    const old = bare(lines[mine.j]);
    if (text === null) { removeLines(lines, mine.j, mine.j); return pickNone; }
    const cut = commentStart(old);
    lines[mine.j] = text + (cut >= 0 ? ` ${old.slice(cut)}` : '') + crOf(lines[mine.j]);
    return pickNone;
  }
  if (text === null) return pickNone;
  const rank = ORDER.indexOf(name);
  const later = found.find((f) => ORDER.indexOf(f.name) > rank);
  const index = later ? later.j : found.length ? found[found.length - 1].j + 1 : 0;
  insertLines(lines, index, [text], eolOf(lines));
  return pickNone;
}

export function variantOp(lines, mock, op) {
  if (typeof op.variant !== 'string' || typeof op.set !== 'string') return fail('bad_op', 'A variant patch is { variant, set, attrs?, flags?, hide? }.');
  const v = mock.screens.find((s) => s.id === op.variant && s.variantOf);
  if (!v) return fail('not_found', `No variant ${op.variant}.`);
  const base = mock.screens.find((s) => s.id === v.variantOf && !s.variantOf);
  let node = null;
  walk(base.root, (n) => { if (!node && n !== base.root && n.id === op.set) node = n; });
  if (!node) return fail('not_found', `No element #${op.set} in ${base.id}.`);
  if (node.fromDefine) return fail('in_define', `#${op.set} comes from the define ${node.fromDefine}; edit the define or its use line.`);
  const why = badParts(op.attrs, op.flags);
  if (why) return fail('bad_op', why);
  if (op.flags && Object.prototype.hasOwnProperty.call(op.flags, 'hide')) return fail('bad_op', 'Hide an element with hide: true, not a flag.');
  if (op.hide !== undefined && typeof op.hide !== 'boolean') return fail('bad_op', 'hide is true or false.');
  if (op.pin !== undefined && typeof op.pin !== 'boolean') return fail('bad_op', 'pin is true or false.');
  if (op.attrs === undefined && op.flags === undefined && op.hide === undefined) return fail('bad_op', 'A variant patch needs attrs, flags or hide.');
  if (!node.explicitId && op.pin === undefined) return fail('pin_first', `#${op.set} is derived from its label; pass pin: true to write it on the element first, or pin: false to patch it by its derived id.`);
  if (!node.explicitId && op.pin) {
    const at = node.line - 1;
    const line = rewriteLine(bare(lines[at]), { pin: node.id });
    if (line === null) return fail('bad_op', 'That line cannot be read.');
    lines[at] = line + crOf(lines[at]);
  }
  const head = v.line - 1;
  const end = spanEnd(lines, head);
  let hit = -1;
  let indent = null;
  for (let j = head + 1; j <= end && hit < 0; j++) {
    const l = bare(lines[j]);
    if (blank(l) || isComment(l)) continue;
    if (indent === null) indent = indentOf(l);
    const t = lexLine(l, j + 1).tokens;
    if (t && t[0] && t[0].t === 'id' && t[0].v === op.set) hit = j;
  }
  const patch = { attrs: op.attrs, flags: op.flags, hide: op.hide };
  if (hit >= 0) {
    const r = rewritePatchLine(bare(lines[hit]), patch);
    if (!r) return fail('bad_op', 'That patch line cannot be read.');
    if (r.empty) removeLines(lines, hit, hit); else lines[hit] = r.line + crOf(lines[hit]);
  } else {
    const r = rewritePatchLine(`${' '.repeat(indent ?? unitOf(lines))}#${op.set}`, patch);
    if (!r.empty) insertLines(lines, end + 1, [r.line], eolOf(lines));
  }
  return { pick: { id: op.set, screen: v.id } };
}
