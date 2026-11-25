// Icon packs for the playground: a pack's module is fetched the first time a block names it
// (an @icons header or a `pack:name` prefix), never before.
const KNOWN = ['lucide', 'tabler', 'heroicons'];
const loaded = new Map();

export function neededPacks(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/^[ \t]*@icons\b(.*)$/gm)) for (const id of m[1].split(/[\s,]+/)) if (KNOWN.includes(id)) out.add(id);
  for (const m of String(text).matchAll(/\b(lucide|tabler|heroicons):/g)) out.add(m[1]);
  return [...out];
}

/** The packs loaded so far. Starts loading any the text needs; `done` runs after each one arrives. */
export function packsFor(text, done) {
  for (const id of neededPacks(text)) {
    if (loaded.has(id)) continue;
    loaded.set(id, null);
    import(`./packs/${id}/index.js`).then((m) => { loaded.set(id, m.default); done(); }, () => {});
  }
  return [...loaded.values()].filter(Boolean);
}
