// mockPatch structure ops: move, duplicate, add. A position is before/after an element or
// into a container at its start or end; the moved or added lines are re-indented for that depth.
import { canHold, holdMessage } from './hold.js';
import { lexLine } from './lex.js';
import { hasKind } from './kinds.js';
import {
  fail, indentOf, bare, unitOf, eolOf, spanEnd, leadStart, shift, insertLines, removeLines,
  dropIdToken, findNode, lookup, badScope, contains, isImplicit, placeLines,
} from './patchKit.js';

const inDefine = (id, node) => fail('in_define', `#${id} comes from the define ${node.fromDefine}; edit the define or its use line.`);

// Reads a position { before | after | into, at? }: exactly one target, looked up in screen `only`
// when given, else in screen `prefer` first. Returns { index, indent, parent, target, screen }
// (the line index to insert at, the indent, the parent node) or a failure.
export function resolvePlace(lines, mock, place, unit, only, prefer) {
  if (!place || typeof place !== 'object') return fail('bad_op', 'A position is before, after or into an element.');
  const keys = ['before', 'after', 'into'].filter((k) => place[k] !== undefined);
  if (keys.length !== 1 || typeof place[keys[0]] !== 'string') return fail('bad_op', 'A position names one element: before, after or into.');
  if (place.at !== undefined && (keys[0] !== 'into' || (place.at !== 'start' && place.at !== 'end'))) return fail('bad_op', 'at is start or end, and only with into.');
  const id = place[keys[0]];
  const bad = badScope(mock, only);
  if (bad) return bad;
  const hit = findNode(mock, id, only !== undefined ? { only } : { prefer });
  if (!hit) return fail('not_found', `No element #${id}${only !== undefined ? ` in ${only}` : ''}.`);
  const { node, screen, parent } = hit;
  if (node.fromDefine) return inDefine(id, node);
  const isRoot = node === screen.root;
  if (keys[0] !== 'into') {
    if (isRoot) return fail('bad_op', 'Add or move inside a screen, not next to it.');
    const at = node.line - 1;
    return { index: keys[0] === 'before' ? leadStart(lines, at) : spanEnd(lines, at) + 1, indent: indentOf(lines[at]), parent, target: node, screen };
  }
  const implicit = isRoot && isImplicit(screen, lines);
  const kids = node.children;
  const indent = implicit ? 0 : indentOf(lines[node.line - 1]) + unit;
  if (place.at === 'start') {
    const index = implicit ? leadStart(lines, kids[0].line - 1) : node.line;
    return { index, indent, parent: node, target: node, screen };
  }
  const last = implicit ? kids[kids.length - 1].line - 1 : node.line - 1;
  return { index: spanEnd(lines, last) + 1, indent, parent: node, target: node, screen };
}

// The movable source element: not a screen, not from a define.
function source(mock, id, sid, verb) {
  const hit = lookup(mock, id, sid);
  if (hit.ok === false) return hit;
  if (hit.node.fromDefine) return inDefine(id, hit.node);
  if (hit.node === hit.screen.root) return fail('bad_op', `A screen is ${verb} with ${verb === 'moved' ? 'moveScreen' : 'addScreen'}.`);
  return hit;
}

export function moveOp(lines, mock, op) {
  const src = source(mock, op.move, op.screen, 'moved');
  if (src.ok === false) return src;
  const unit = unitOf(lines);
  const place = resolvePlace(lines, mock, op, unit, op.toScreen, src.screen.id);
  if (place.ok === false) return place;
  if (place.target === src.node && op.into === undefined) return { pick: { line: src.node.line - 1 } };
  if (contains(src.node, place.target)) return fail('bad_move', `#${op.move} cannot move into itself.`);
  if (!canHold(place.parent.kind, src.node.kind)) return fail('cannot_hold', holdMessage(place.parent.kind, src.node.kind));
  const at = src.node.line - 1;
  const s = leadStart(lines, at);
  const e = spanEnd(lines, at);
  const delta = place.indent - indentOf(lines[at]);
  const eol = eolOf(lines);
  const moved = lines.slice(s, e + 1).map((l) => shift(l, delta));
  let index = place.index;
  index = index > e ? index - (e - s + 1) : index >= s ? s : index;
  removeLines(lines, s, e);
  insertLines(lines, index, moved, eol);
  return { pick: { line: index + (at - s) } };
}

export function duplicateOp(lines, mock, op) {
  const src = source(mock, op.duplicate, op.screen, 'duplicated');
  if (src.ok === false) return src;
  const at = src.node.line - 1;
  const e = spanEnd(lines, at);
  const eol = eolOf(lines);
  const copy = lines.slice(at, e + 1).map((l) => (lexLine(bare(l), 1).tokens?.length ? dropIdToken(l) : bare(l)));
  insertLines(lines, e + 1, copy, eol);
  return { pick: { line: e + 1 } };
}

export function addOp(lines, mock, op) {
  const hasLine = op.line !== undefined;
  if (hasLine === (op.lines !== undefined)) return fail('bad_op', 'add needs one of line or lines.');
  if (hasLine && (typeof op.line !== 'string' || !op.line.trim() || op.line.includes('\n') || op.line.includes('\r'))) return fail('bad_op', 'add needs one non-empty line.');
  const unit = unitOf(lines);
  const place = resolvePlace(lines, mock, op.add, unit, op.add && op.add.screen);
  if (place.ok === false) return place;
  const placed = placeLines(hasLine ? [op.line.trim()] : op.lines, place.indent, unit);
  if (placed.ok === false) return placed;
  // A define use or an unknown kind is left to the parse (would_break); a known kind must fit.
  for (const t of placed.tops) if (hasKind(t.kind) && !canHold(place.parent.kind, t.kind)) return fail('cannot_hold', holdMessage(place.parent.kind, t.kind));
  insertLines(lines, place.index, placed.lines, eolOf(lines));
  return { pick: { line: place.index + placed.tops[0].at } };
}
