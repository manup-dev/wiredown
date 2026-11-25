// Ids: slug, derived ids per screen, duplicate explicit ids across a block.
export function slug(label) {
  let out = '';
  for (let i = 0; i < label.length; i++) {
    let c = label[i];
    if (c >= 'A' && c <= 'Z') c = c.toLowerCase();
    if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) out += c;
    else if (out !== '' && out[out.length - 1] !== '-') out += '-';
  }
  out = out.slice(0, 40);
  while (out.endsWith('-')) out = out.slice(0, -1);
  return out;
}

export function isId(v) {
  if (typeof v !== 'string' || v.length < 1 || v.length > 64) return false;
  if (v[0] < 'a' || v[0] > 'z') return false;
  for (let i = 1; i < v.length; i++) {
    const c = v[i];
    if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '-')) return false;
  }
  return true;
}

// Source-order walk (explicit stack, no recursion).
function walk(root, fn) {
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    fn(n);
    for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]);
  }
}

export function deriveIds(screen) {
  const used = new Set();
  walk(screen.root, (n) => { if (n.explicitId) used.add(n.id); });
  const counts = new Map();
  walk(screen.root, (n) => {
    if (n.explicitId) return;
    const kind = n.kind === 'unknown' ? slug(n.typed || '') || 'unknown' : n.kind;
    const s = n.labels.length ? slug(n.labels[0]) : '';
    const base = s ? `${kind}-${s}` : kind;
    let k = counts.get(base) || 0;
    let id;
    do { k++; id = k === 1 ? base : `${base}-${k}`; } while (used.has(id));
    counts.set(base, k);
    used.add(id);
    n.id = id;
  });
}

// Explicit ids must be unique across the block; returns the later duplicates.
export function findDuplicateIds(screens) {
  const seen = new Set();
  const dups = [];
  for (const s of screens) {
    walk(s.root, (n) => {
      if (!n.explicitId || n === s.root) return;
      if (seen.has(n.id)) dups.push({ id: n.id, line: n.line, col: n.col });
      else seen.add(n.id);
    });
  }
  return dups;
}

export { walk };
