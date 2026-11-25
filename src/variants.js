// Variants: a deep copy of a screen with `#id` patches applied.
import { WM_LIMITS } from './limits.js';
import { err, readParts, applyParts } from './validate.js';
import { isId } from './ids.js';

function clone(n, ctx, raw) {
  if (++ctx.count > WM_LIMITS.nodes) {
    err(ctx, raw.line, raw.col, 'limit_nodes', `A block may have at most ${WM_LIMITS.nodes} elements.`);
    ctx.stopped = true;
    return { ...n, attrs: { ...n.attrs }, flags: [...n.flags], labels: [...n.labels], children: [] };
  }
  return { ...n, attrs: { ...n.attrs }, flags: [...n.flags], labels: [...n.labels], children: n.children.map((c) => clone(c, ctx, raw)) };
}

function find(root, id) {
  const stack = [{ node: root, parent: null }];
  while (stack.length) {
    const cur = stack.pop();
    if (cur.node.id === id) return cur;
    for (const c of cur.node.children) stack.push({ node: c, parent: cur.node });
  }
  return null;
}

// raw: the variant line (tokens already checked by the caller); returns a Screen or null.
export function makeVariant(raw, scr, ctx) {
  const root = clone(scr.root, ctx, raw);
  const t = raw.tokens;
  const id = t[1] && t[1].v;
  const label = t[4] && t[4].t === 'label' ? t[4].v : '';
  const patched = [];
  root.id = id;
  root.labels = label ? [label] : [];
  for (const p of raw.children) {
    const first = p.tokens[0];
    if (first.t !== 'id' || !isId(first.v)) { err(ctx, p.line, first.col, 'bad_value', 'A patch starts with #id.'); continue; }
    if (p.children.length) err(ctx, p.children[0].line, p.children[0].col, 'bad_value', 'A patch cannot have children.');
    const hit = find(root, first.v);
    if (!hit || hit.node === root) { err(ctx, p.line, first.col, 'variant_target', `No element #${first.v} in ${scr.id}.`); continue; }
    patched.push(first.v);
    const parts = readParts(p.tokens.slice(1), ctx, p.line);
    if (parts.id) err(ctx, p.line, p.col, 'bad_value', 'A patch cannot rename an element.');
    parts.id = null;
    if (parts.link) ctx.patchLinks.push({ link: parts.link, line: p.line, col: first.col });
    const hide = parts.flags.includes('hide');
    parts.flags = parts.flags.filter((f) => f !== 'hide');
    if (parts.labels.length) err(ctx, p.line, p.col, 'bad_value', 'A patch cannot change labels.');
    if (hide) hit.parent.children = hit.parent.children.filter((c) => c !== hit.node);
    else applyParts(hit.node, parts, ctx, p.line, p.col);
  }
  // patched: the element ids this variant's patch lines name (mockTree's `referenced`).
  return { id, label, root, variantOf: scr.id, line: raw.line, patched };
}
