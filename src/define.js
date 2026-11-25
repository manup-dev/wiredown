// Defines: declaration, $param substitution and use binding.
import { WM_LIMITS } from './limits.js';
import { hasKind } from './kinds.js';
import { isId } from './ids.js';
import { err, readParts, applyParts, warn } from './validate.js';

// Result is cut one character past the label limit so a caller can refuse it; never grows unbounded.
export function substText(s, map) {
  if (s.indexOf('$') < 0) return s;
  let out = '';
  let i = 0;
  while (i < s.length && out.length <= WM_LIMITS.label) {
    if (s[i] === '$') {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9_-]/.test(s[j])) j++;
      const name = s.slice(i + 1, j);
      if (name && map.has(name)) { out += map.get(name); i = j; continue; }
    }
    out += s[i++];
  }
  return out;
}

export function substTokens(tokens, map, ctx, line) {
  return tokens.map((t) => {
    if (t.t !== 'label' && t.t !== 'kv') return t;
    const v = substText(t.v, map);
    if (v.length > WM_LIMITS.label && t.v.length <= WM_LIMITS.label) {
      err(ctx, line, t.col, 'limit_label', `A label may have at most ${WM_LIMITS.label} characters.`);
      ctx.stopped = true;
      return { ...t, v: v.slice(0, WM_LIMITS.label) };
    }
    return { ...t, v };
  });
}

// Walk raw lines (explicit stack) flagging uses of defines that are not declared yet.
function scanUses(body, def, ctx) {
  const stack = [...body];
  while (stack.length) {
    const r = stack.pop();
    const w = r.tokens[0];
    if (w.t === 'word') {
      if (w.v === def.name) {
        def.cyclic = true;
        err(ctx, r.line, w.col, 'define_cycle', `${def.name} uses itself.`);
      } else if (ctx.names.has(w.v) && !ctx.defines.has(w.v)) {
        err(ctx, r.line, w.col, 'define_unknown', `${w.v} is defined further down; define it above its first use.`);
      }
    }
    for (const c of r.children) stack.push(c);
  }
}

export function declareDefine(raw, ctx) {
  const toks = raw.tokens;
  const name = toks[1];
  if (!name || name.t !== 'word' || !isId(name.v)) return err(ctx, raw.line, raw.col, 'bad_value', 'define needs a lowercase name.');
  if (hasKind(name.v) || ctx.defines.has(name.v)) return err(ctx, raw.line, name.col, 'bad_value', `${name.v} is already a kind or a define.`);
  if (ctx.defines.size >= WM_LIMITS.defines) return err(ctx, raw.line, raw.col, 'limit_defines', `A block may have at most ${WM_LIMITS.defines} defines.`);
  const params = [];
  for (const t of toks.slice(2)) {
    if (t.t === 'word') params.push({ name: t.v, def: '' });
    else if (t.t === 'kv') params.push({ name: t.k, def: t.v });
    else return err(ctx, raw.line, t.col, 'bad_value', 'A define takes parameter names, optionally with defaults.');
  }
  if (!raw.children.length) return err(ctx, raw.line, raw.col, 'bad_value', 'A define needs an indented body.');
  const def = { name: name.v, params, body: raw.children, cyclic: false };
  scanUses(raw.children, def, ctx);
  ctx.defines.set(def.name, def);
}

// Bind a use line to the define's params. Returns bindings plus leftovers for the root.
export function bindUse(def, toks, ctx, line) {
  const map = new Map(def.params.map((p) => [p.name, p.def]));
  const extra = { labels: [], kvs: [], flags: [], id: null, link: null };
  const rest = [];
  let pos = 0;
  const bind = (name, t) => {
    if (t.v.length > WM_LIMITS.label) {
      err(ctx, line, t.col, 'limit_label', `A value may have at most ${WM_LIMITS.label} characters.`);
      ctx.stopped = true;
    } else map.set(name, t.v);
  };
  for (const t of toks.slice(1)) {
    if (t.t === 'label') {
      if (pos < def.params.length) bind(def.params[pos++].name, t);
      else err(ctx, line, t.col, 'bad_value', `${def.name} takes ${def.params.length} label${def.params.length === 1 ? '' : 's'}.`);
    } else if (t.t === 'kv' && map.has(t.k)) bind(t.k, t);
    else rest.push(t);
  }
  Object.assign(extra, readParts(rest, ctx, line));
  return { map, extra };
}

export function applyExtra(roots, extra, ctx, line, col) {
  const any = extra.kvs.length || extra.flags.length || extra.id || extra.link;
  if (!any) return;
  if (roots.length === 1) applyParts(roots[0], extra, ctx, line, col);
  else warn(ctx, line, col, 'unknown_attr', 'Extra attributes need a define with a single top element.');
}
