// The screen-reader alternative: one <details> with each screen's element tree as nested lists
// of `kind "label" flags…` lines. Every string is escaped; nothing here comes from a stylesheet.
import { escapeXml as esc } from './escape.js';

const TEXT_ATTRS = ['placeholder', 'options', 'error'];
const MAX_DEPTH = 64;
const arr = (v) => (Array.isArray(v) ? v : []);

function lineOf(n, labelOf, notes) {
  let s = n.kind === 'unknown' ? String(n.typed || 'unknown') : String(n.kind || '');
  for (const l of arr(n.labels)) s += ` "${l}"`;
  for (const f of arr(n.flags)) s += ' ' + f;
  const attrs = n.attrs && typeof n.attrs === 'object' ? n.attrs : {};
  for (const k of TEXT_ATTRS) if (typeof attrs[k] === 'string' && attrs[k] !== '') s += ` ${k} "${attrs[k]}"`;
  if (n.kind === 'table' && typeof attrs.cols === 'string' && attrs.cols !== '') s += ` cols "${attrs.cols}"`;
  if (typeof n.link === 'string' && n.link) s += ' → ' + (n.link === 'back' ? 'back' : labelOf(n.link));
  const num = notes && notes.get(n);
  if (num) s += ` (note ${num})`;
  return esc(s);
}

function listOf(children, labelOf, notes, depth) {
  const kids = arr(children).filter((c) => c && typeof c === 'object');
  if (!kids.length || depth > MAX_DEPTH) return '';
  let out = '<ul>';
  for (const c of kids) out += '<li>' + lineOf(c, labelOf, notes) + listOf(c.children, labelOf, notes, depth + 1) + '</li>';
  return out + '</ul>';
}

/** screens: [{ screen, cap }] in storyboard order; labelOf(id) names a link target; notes: node → legend number. */
export function outlineHtml(screens, labelOf, notes) {
  let out = '<details class="wm-outline"><summary>Screen outline</summary>';
  for (const { screen, cap } of screens) {
    out += `<p><strong>${esc(cap)}</strong></p>`;
    out += listOf(screen.root && screen.root.children, labelOf, notes, 0);
  }
  return out + '</details>';
}
