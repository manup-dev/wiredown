// mockPatch: edits by element id, touching only the lines an edit needs. Untouched lines stay
// byte-identical; indentation unit and line endings are kept. Each op applies to a fresh parse of
// the body so far; a change that leaves the block with more errors is refused (would_break).
import { parseMock } from './parse.js';
import { AS_ERROR } from './lint.js';
import { KINDS, hasKind } from './kinds.js';
import { isId } from './ids.js';
import { rewriteLine } from './patchLine.js';
import { canHold, holdMessage } from './hold.js';
import { fail, hasEol, bare, spanEnd, removeLines, lookup, idAtLine, badParts } from './patchKit.js';
import { moveOp, duplicateOp, addOp } from './patchMove.js';
import { addScreenOp, renameScreenOp, removeScreenOp, moveScreenOp } from './patchScreens.js';
import { headerOp, variantOp } from './patchHeader.js';

const errors = (r) => r.warnings.filter((w) => AS_ERROR.has(w.code)).length;
const isLeaf = (k) => hasKind(k) && KINDS[k].children === 'none' && KINDS[k].labels >= 1;

function badSet(op, node) {
  const { attrs, flags, label, link, kind } = op;
  if (attrs === undefined && flags === undefined && label === undefined && link === undefined && kind === undefined && op.pin !== true) return 'set needs attrs, flags, label, link, kind or pin.';
  if (op.pin !== undefined && typeof op.pin !== 'boolean') return 'pin is true or false.';
  const parts = badParts(attrs, flags);
  if (parts) return parts;
  if (label !== undefined && label !== null && (typeof label !== 'string' || hasEol(label))) return 'A label is one line of text.';
  if (link !== undefined && link !== null && link !== 'back' && !isId(link)) return 'A link is a screen id, back, or null to remove it.';
  const at = op.labelIndex ?? 0;
  if (at !== 0 && at !== 1) return 'labelIndex is 0 or 1.';
  const max = hasKind(node.kind) ? KINDS[node.kind].labels : 2;
  if (label !== undefined && at >= max) return max ? `A ${node.kind} has ${max === 1 ? 'one label' : `${max} labels`}.` : `A ${node.kind} has no label.`;
  if (typeof label === 'string' && at > node.labels.length) return 'Give it a first label before a second one.';
  if (label === null && at !== node.labels.length - 1) return node.labels.length ? 'Only the last label can be removed.' : 'There is no label to remove.';
  if (kind !== undefined) {
    if (typeof kind !== 'string' || !hasKind(kind)) return `${String(kind).slice(0, 40)} is not a kind.`;
    if (!isLeaf(node.kind) || !isLeaf(kind)) return 'The kind changes only between elements with a label and no children, such as button, link or text.';
  }
  return null;
}

function setOp(lines, mock, op) {
  const hit = lookup(mock, op.set, op.screen);
  if (hit.ok === false) return hit;
  const { node, screen, parent } = hit;
  if (node.fromDefine) return fail('in_define', `#${op.set} comes from the define ${node.fromDefine}; edit the define or its use line.`);
  if (node === screen.root) return fail('bad_op', 'A screen line is changed with renameScreen.');
  const why = badSet(op, node);
  if (why) return fail('bad_op', why);
  if (op.kind && !canHold(parent.kind, op.kind)) return fail('cannot_hold', holdMessage(parent.kind, op.kind));
  if (!node.explicitId && op.pin === undefined) return fail('pin_first', `#${op.set} is derived from its label; pass pin: true to write it first, or pin: false to let it follow the change.`);
  const at = node.line - 1;
  const cr = lines[at].endsWith('\r') ? '\r' : '';
  const line = rewriteLine(bare(lines[at]), {
    attrs: op.attrs, flags: op.flags, label: op.label, labelIndex: op.labelIndex, link: op.link, kind: op.kind,
    pin: !node.explicitId && op.pin === true ? node.id : null,
  });
  if (line === null) return fail('bad_op', 'That line cannot be read.');
  lines[at] = line + cr;
  return { pick: { line: at } };
}

function removeOp(lines, mock, op) {
  const hit = lookup(mock, op.remove, op.screen);
  if (hit.ok === false) return hit;
  if (hit.node.fromDefine) return fail('in_define', `#${op.remove} comes from the define ${hit.node.fromDefine}; edit the define or its use line.`);
  if (hit.node === hit.screen.root) return fail('bad_op', 'A screen is removed with removeScreen.');
  const at = hit.node.line - 1;
  removeLines(lines, at, spanEnd(lines, at));
  return { pick: { id: null } };
}

const KEYS = [['set', setOp], ['remove', removeOp], ['move', moveOp], ['duplicate', duplicateOp], ['addScreen', addScreenOp],
  ['renameScreen', renameScreenOp], ['removeScreen', removeScreenOp], ['moveScreen', moveScreenOp], ['header', headerOp]];

function applyOne(lines, mock, op) {
  if (!op || typeof op !== 'object' || Array.isArray(op)) return fail('bad_op', 'An operation is an object.');
  if (op.variant !== undefined) return variantOp(lines, mock, op);
  if (op.add !== undefined) return addOp(lines, mock, op);
  for (const [key, fn] of KEYS) {
    if (op[key] === undefined) continue;
    if (key !== 'addScreen' && key !== 'header' && typeof op[key] !== 'string') return fail('bad_op', 'An operation names an element or screen id.');
    return fn(lines, mock, op);
  }
  return fail('bad_op', 'Unknown operation.');
}

// ops: one op or a list (1 to 100). Returns { ok, body, id, screen, ids }: id is the last op's
// element (or screen) id after the change and screen the screen it is in, both null when the op
// leaves nothing to select; ids has one id per op. Element ids repeat across screens (derived ids
// are unique per screen), so element ops take an optional `screen` to say which one is meant.
export function mockPatch(body, ops) {
  if (typeof body !== 'string') return fail('bad_op', 'The body is text.');
  const list = Array.isArray(ops) ? ops : [ops];
  if (!list.length || list.length > 100) return fail('bad_op', 'Send 1 to 100 operations.');
  let cur = body;
  let r = parseMock(cur);
  if (!r.ok) return fail('invalid_body', 'The block has errors; fix them first.');
  const ids = [];
  let picked = null;
  for (const op of list) {
    const lines = cur.split('\n');
    let res;
    try { res = applyOne(lines, r.mock, op); } catch { res = fail('bad_op', 'That change could not be made.'); }
    if (res.ok === false) return res;
    const next = lines.join('\n');
    const after = parseMock(next);
    if (!after.ok || errors(after) > errors(r)) return fail('would_break', 'That change would leave the block with errors.');
    picked = res.pick.line !== undefined ? idAtLine(after.mock, res.pick.line, lines) : { id: res.pick.id, screen: res.pick.screen ?? null };
    ids.push(picked.id);
    cur = next;
    r = after;
  }
  return { ok: true, body: cur, id: picked.id, screen: picked.screen, ids };
}
