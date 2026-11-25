// Icon packs, checked and branded by wiredown/icons (packs-define.js).
import { has, iconPath, pathFromD } from './icons.js';

const BRAND = new WeakSet();
export const PACK_ID = /^[a-z][a-z0-9-]{0,23}$/;
export const brand = (p) => BRAND.add(p) && p;
export const isIconPack = (p) => p !== null && typeof p === 'object' && BRAND.has(p);

export function packsFrom(opts) {
  const out = [];
  try {
    const list = opts && opts.icons;
    for (let i = 0; Array.isArray(list) && i < list.length && i < 32; i++) if (isIconPack(list[i]) && !out.some((q) => q.id === list[i].id)) out.push(list[i]);
  } catch { /* a hostile list draws no packs */ }
  return out;
}

export const iconPacksKey = (list) => packsFrom({ icons: list }).map((p) => `${p.id}@${p.version}`).sort().join(',');

export const iconContext = (packs, order) => ({ byId: new Map((packs || []).map((p) => [p.id, p])), order: order || [] });

// `p:n` reads pack p; a bare name reads the @icons packs in order, then the built-ins.
export function resolveIcon(name, x, y, size, ctx = iconContext()) {
  if (typeof name !== 'string') return null;
  const colon = name.indexOf(':');
  const bare = name.slice(colon + 1);
  for (const id of colon > 0 ? [name.slice(0, colon)] : ctx.order) {
    const p = ctx.byId.get(id);
    const w = p && p.strokeWidth;
    if (p && has(p.icons, bare)) return { d: pathFromD(p.icons[bare], x, y, size), w: w >= 1 && w <= 3 ? w : 2 };
  }
  const d = iconPath(bare, x, y, size);
  return d === null ? null : { d, w: 2 };
}
