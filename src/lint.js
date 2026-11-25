// lintMock: parseMock's errors and warnings as one list with a severity. Never throws.
import { wmError } from './limits.js';
import { parseMock } from './parse.js';
import { nearestIcon } from './icons.js';
import { iconContext, packsFrom, resolveIcon } from './packs.js';

export const AS_ERROR = new Set(['unknown_kind', 'unknown_attr', 'dangling_link']);
const MAX = 50;

// Info words the renderer reads: the fence language, v1, look=, view=. Anything else is a typo.
function infoProblems(info) {
  const out = [];
  const words = String(info || '').split(/\s+/).filter(Boolean);
  words.forEach((w, i) => {
    const known = (i === 0 && (w === 'wiredown' || w === 'screens' || w === 'wiremark')) || /^v\d+$/.test(w) || w.startsWith('look=') || w.startsWith('view=');
    if (!known) out.push({ ...wmError(0, 0, 'unknown_info', `The info word ${w.slice(0, 40)} is not known; use v1, look=wire|clean or view=prototype.`), severity: 'warning' });
  });
  return out;
}

// Unknown icons (with a nearby name if any), and each named pack that is not loaded, said once.
function iconProblems(mock, packs) {
  const out = [];
  const ctx = iconContext(packs, mock.icons);
  const said = new Set();
  const lack = (id, at) => {
    if (ctx.byId.has(id) || said.has(id)) return;
    said.add(id);
    out.push({ ...wmError(at.line, at.col, 'icon_pack_missing', `This block uses the "${id}" icon pack, which is not loaded here. Built-in icons are drawn where the names match.`), severity: 'warning' });
  };
  for (const id of ctx.order) lack(id, mock.iconsAt);
  const stack = mock.screens.map((s) => s.root);
  while (stack.length && out.length < MAX) {
    const n = stack.pop();
    for (const c of n.children) stack.push(c);
    const name = n.attrs.icon || (n.kind === 'icon' ? n.labels[0] : '');
    const key = `${n.line}:${n.col}`; // variants repeat nodes
    if (!name || said.has(key)) continue;
    said.add(key);
    if (name.includes(':')) lack(name.split(':')[0], n);
    if (resolveIcon(name, 0, 0, 24, ctx)) continue;
    const near = nearestIcon(name);
    out.push({ ...wmError(n.line, n.col, 'unknown_icon', `No icon named "${String(name).slice(0, 40)}". It draws as a placeholder. ${near ? `Did you mean "${near}"?` : 'The icon list is at https://github.com/manup-dev/wiredown#icons'}`), severity: 'warning' });
  }
  return out;
}

/** opts: { icons } (icon packs the host loads). */
export function lintMock(body, info, opts) {
  const r = parseMock(body, info);
  const packs = packsFrom(opts);
  const found = r.ok
    ? [...r.warnings.map((w) => ({ ...w, severity: AS_ERROR.has(w.code) ? 'error' : 'warning' })), ...iconProblems(r.mock, packs)]
        .sort((a, b) => a.line - b.line || a.column - b.column)
    : r.errors.map((e) => ({ ...e, severity: 'error' }));
  return [...infoProblems(info), ...found].slice(0, MAX);
}
