// Builds Nodes from raw lines (kinds, defines, limits).
import { WM_LIMITS } from './limits.js';
import { KINDS } from './kinds.js';
import { err, warn, readParts, applyParts, checkPlacement } from './validate.js';
import { substTokens, bindUse, applyExtra } from './define.js';

function fatal(ctx, line, col, code, msg) {
  err(ctx, line, col, code, msg);
  ctx.stopped = true;
}

export function newNode(kind, raw, ctx) {
  if (++ctx.count > WM_LIMITS.nodes) {
    fatal(ctx, raw.line, raw.col, 'limit_nodes', `A block may have at most ${WM_LIMITS.nodes} elements after defines expand.`);
    return null;
  }
  const s = ctx.site;
  const node = { kind, id: '', explicitId: false, labels: [], attrs: {}, flags: [], link: null, note: null, children: [], line: s ? s.line : raw.line, col: s ? s.col : raw.col, endCol: s ? s.endCol : raw.endCol };
  if (s) node.fromDefine = s.name;
  return node;
}

// Labels, attrs, flags, id and link of a node from its tokens after the kind word.
export function fillNode(node, toks, raw, ctx) {
  const parts = readParts(toks, ctx, raw.line);
  const spec = KINDS[node.kind];
  if (spec && parts.labels.length > spec.labels) {
    err(ctx, raw.line, raw.col, 'bad_value', `${node.kind} takes ${spec.labels} label${spec.labels === 1 ? '' : 's'}.`);
  }
  node.labels = parts.labels;
  applyParts(node, parts, ctx, raw.line, raw.col);
}

export function buildChildren(raw, depth, subst, ctx, node) {
  for (const c of raw.children) node.children.push(...buildNodes(c, depth + 1, subst, ctx));
  for (const c of node.children) checkPlacement(c, node.kind, ctx);
}

export function buildNodes(raw, depth, subst, ctx) {
  if (ctx.stopped) return [];
  if (depth > WM_LIMITS.depth) {
    fatal(ctx, raw.line, raw.col, 'limit_depth', `Elements may nest at most ${WM_LIMITS.depth} levels deep.`);
    return [];
  }
  if (++ctx.work > WM_LIMITS.nodes * 2) {
    fatal(ctx, raw.line, raw.col, 'limit_nodes', `A block may have at most ${WM_LIMITS.nodes} elements after defines expand.`);
    return [];
  }
  const toks = subst ? substTokens(raw.tokens, subst, ctx, raw.line) : raw.tokens;
  const first = toks[0];
  if (first.t !== 'word') {
    err(ctx, raw.line, first.col, 'bad_value', 'A line starts with a kind such as button or stack.');
    return [];
  }
  const def = ctx.defines.get(first.v);
  if (def) return def.cyclic ? [] : expandUse(def, toks, raw, depth, ctx);
  if (ctx.names.has(first.v)) {
    err(ctx, raw.line, first.col, 'define_unknown', `${first.v} is defined further down; define it above its first use.`);
    return [];
  }
  const known = Object.prototype.hasOwnProperty.call(KINDS, first.v);
  const node = newNode(known ? first.v : 'unknown', raw, ctx);
  if (!node) return [];
  if (!known) {
    node.typed = first.v;
    warn(ctx, raw.line, first.col, 'unknown_kind', `${first.v} is not a known kind.`);
  }
  fillNode(node, toks.slice(1), raw, ctx);
  if (known && KINDS[first.v].children === 'none') {
    if (raw.children.length) err(ctx, raw.children[0].line, raw.children[0].col, 'bad_value', `${first.v} cannot have children.`);
  } else buildChildren(raw, depth, subst, ctx, node);
  return [node];
}

function expandUse(def, toks, raw, depth, ctx) {
  if (raw.children.length) err(ctx, raw.children[0].line, raw.children[0].col, 'bad_value', `${def.name} cannot have children.`);
  const { map, extra } = bindUse(def, toks, ctx, raw.line);
  const roots = [];
  const outer = !ctx.site;
  if (outer) ctx.site = { line: raw.line, col: raw.col, endCol: raw.endCol, name: def.name };
  for (const b of def.body) roots.push(...buildNodes(b, depth, map, ctx));
  if (outer) ctx.site = null;
  applyExtra(roots, extra, ctx, raw.line, raw.col);
  return roots;
}
