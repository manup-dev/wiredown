// Validation helpers: context, token parts, attribute/flag checks, placement.
import { WM_LIMITS, wmError } from './limits.js';
import { KINDS } from './kinds.js';
import { isId } from './ids.js';

export function makeCtx() {
  return { errors: [], warnings: [], seenE: new Set(), seenW: new Set(), site: null, patchLinks: [], work: 0, count: 0, notes: 0, stopped: false, defines: new Map(), names: new Set() };
}

function push(list, seen, ctx, line, col, code, msg) {
  if (ctx.site) { line = ctx.site.line; col = ctx.site.col; }
  const key = `${line}:${col}:${code}`;
  if (seen.has(key) || list.length >= 2000) return;
  seen.add(key);
  list.push(wmError(line, col, code, msg));
}
export const err = (ctx, line, col, code, msg) => push(ctx.errors, ctx.seenE, ctx, line, col, code, msg);
export const warn = (ctx, line, col, code, msg) => push(ctx.warnings, ctx.seenW, ctx, line, col, code, msg);

function isNum(v, lo, hi) {
  if (typeof v !== 'string' || v === '' || v.length > 9) return false;
  let dot = false;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === '.') {
      if (dot || i === 0 || i === v.length - 1) return false;
      dot = true;
    } else if (c < '0' || c > '9') return false;
  }
  const n = Number(v);
  return (lo === undefined || n >= lo) && (hi === undefined || n <= hi);
}

function isColor(v) {
  if (v[0] !== '#' || (v.length !== 4 && v.length !== 7)) return false;
  for (let i = 1; i < v.length; i++) {
    const c = v[i].toLowerCase();
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
  }
  return true;
}

export function checkValue(type, v) {
  if (type === 'string') return true;
  if (type === 'size') return v === 'fill' || v === 'hug' || isNum(v);
  if (type === 'color') return isColor(v);
  if (type.startsWith('enum:')) return type.slice(5).split('|').includes(v);
  if (type.startsWith('number:')) {
    const [lo, hi] = type.slice(7).split('-').map(Number);
    return isNum(v, lo, hi);
  }
  return isNum(v);
}

// Split a token list (after the kind word) into labels, kvs, flags, id, link.
export function readParts(toks, ctx, line) {
  const p = { labels: [], kvs: [], flags: [], id: null, link: null };
  for (const t of toks) {
    if (t.t === 'label') {
      p.labels.push(t.v);
      if (t.v.length > WM_LIMITS.label) err(ctx, line, t.col, 'limit_label', `A label may have at most ${WM_LIMITS.label} characters.`);
    } else if (t.t === 'kv') {
      p.kvs.push({ k: t.k, v: t.v, col: t.col });
      if (t.v.length > WM_LIMITS.label) err(ctx, line, t.col, 'limit_label', `A value may have at most ${WM_LIMITS.label} characters.`);
    } else if (t.t === 'word') p.flags.push(t.v);
    else if (t.t === 'id') {
      if (p.id !== null) err(ctx, line, t.col, 'bad_value', 'A line may have only one #id.');
      else if (!isId(t.v)) err(ctx, line, t.col, 'bad_value', 'An id is lowercase letters, digits and hyphens, starting with a letter.');
      else p.id = t.v;
    } else if (t.t === 'link') {
      if (p.link !== null) err(ctx, line, t.col, 'bad_value', 'A line may have only one link.');
      else if (t.v === '') err(ctx, line, t.col, 'bad_value', 'A link needs a target screen.');
      else p.link = t.v;
    } else err(ctx, line, t.col, 'bad_value', 'Unexpected item on this line.');
  }
  return p;
}

// Apply parsed attrs/flags/id/link to a node, validating against its kind.
export function applyParts(node, p, ctx, line, col) {
  const spec = KINDS[node.kind];
  for (const { k, v, col: c } of p.kvs) {
    if (k === 'note') {
      if (++ctx.notes > WM_LIMITS.notes) err(ctx, line, c, 'limit_notes', `A block may have at most ${WM_LIMITS.notes} notes.`);
      else node.note = v;
      continue;
    }
    const type = spec && spec.attrs[k];
    if (spec && !type) {
      warn(ctx, line, c, 'unknown_attr', `${node.kind} has no attribute ${k}.`);
      node.attrs[k] = v;
    } else if (type && !checkValue(type, v)) {
      err(ctx, line, c, 'bad_value', `${k}=${v} is not a valid value for ${node.kind}.`);
    } else node.attrs[k] = v;
  }
  for (const f of p.flags) {
    if (spec && !spec.flags.includes(f)) warn(ctx, line, col, 'unknown_attr', `${node.kind} has no flag ${f}.`);
    if (!node.flags.includes(f)) node.flags.push(f);
  }
  if (p.id) { node.id = p.id; node.explicitId = true; }
  if (p.link) node.link = p.link;
}

// Placement warnings: tab outside tabs, item outside list/tabbar, restricted children.
export function checkPlacement(child, parentKind, ctx) {
  const spec = KINDS[parentKind];
  const bad = (child.kind === 'tab' && parentKind !== 'tabs')
    || (child.kind === 'item' && parentKind !== 'list' && parentKind !== 'tabbar')
    || (spec && Array.isArray(spec.children) && child.kind !== 'unknown' && !spec.children.includes(child.kind));
  if (bad) warn(ctx, child.line, child.col, 'bad_value', `${child.kind} does not belong inside ${parentKind}.`);
}
