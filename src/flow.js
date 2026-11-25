// Storyboard order: groups of screen indexes, each a base screen followed by its variants in
// source order. With @flow, groups follow the first flow entry naming any member; groups the
// flow never names follow in source order. `start` is the first screen a prototype shows.

export function storyboard(mock) {
  const screens = mock && Array.isArray(mock.screens) ? mock.screens : [];
  const groupOf = new Map(); // base id -> group (array of indexes)
  const groups = [];
  screens.forEach((s, i) => {
    if (!s || typeof s !== 'object') return;
    const base = s.variantOf && groupOf.has(s.variantOf) ? s.variantOf : null;
    if (base) { groupOf.get(base).push(i); return; }
    const g = [i];
    groups.push(g);
    if (typeof s.id === 'string' && !groupOf.has(s.id)) groupOf.set(s.id, g);
  });
  const byId = new Map();
  screens.forEach((s, i) => { if (s && typeof s.id === 'string' && !byId.has(s.id)) byId.set(s.id, i); });
  const groupAt = new Map();
  for (const g of groups) for (const i of g) groupAt.set(i, g);
  const ordered = [];
  const placed = new Set();
  let start = groups.length ? groups[0][0] : -1;
  const flow = Array.isArray(mock && mock.flow) ? mock.flow : [];
  let first = true;
  for (const id of flow) {
    const i = byId.get(id);
    if (i === undefined) continue;
    if (first) { start = i; first = false; }
    const g = groupAt.get(i);
    if (g && !placed.has(g)) { placed.add(g); ordered.push(g); }
  }
  for (const g of groups) if (!placed.has(g)) ordered.push(g);
  return { groups: ordered, start };
}
