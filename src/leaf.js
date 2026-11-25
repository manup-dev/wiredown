// Intrinsic widths and wrapped heights of nodes that have no laid-out children.
import { longestWord, textWidth, wrapText } from './measure.js';
import { FONT, LINE, S } from './sizes.js';

const label = (n) => n.labels[0] || '';
const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const BOLD = new Set(['h1', 'h2', 'h3']);

export const colsOf = (n) => (n.attrs.cols ? n.attrs.cols.split(',').map((s) => s.trim()).filter(Boolean) : []);

/** Natural (unwrapped) width. */
export function leafHug(n) {
  const k = n.kind;
  const t = label(n);
  if (k === 'h1' || k === 'h2' || k === 'h3') return textWidth(t, FONT[k], 'bold');
  if (k === 'text' || k === 'link') return textWidth(t, FONT.text) + (n.attrs.icon ? 24 : 0);
  if (k === 'button') return textWidth(t, FONT.text, 'bold') + 32 + (n.attrs.icon ? 24 : 0);
  if (k === 'input' || k === 'textarea' || k === 'select') return Math.max(S.inputHug, textWidth(t, FONT.small));
  if (k === 'checkbox' || k === 'radio') return S.check + 8 + textWidth(t, FONT.text);
  if (k === 'toggle') return S.toggleW + 8 + textWidth(t, FONT.text);
  if (k === 'image') return S.image;
  if (k === 'avatar') return S.avatar;
  if (k === 'icon') return S.icon;
  if (k === 'badge') return textWidth(t, FONT.small) + 16 + (n.attrs.icon ? 16 : 0);
  if (k === 'item') return Math.max(textWidth(t, FONT.text), textWidth(n.labels[1] || '', FONT.small)) + 32;
  if (k === 'tab') return textWidth(t, FONT.text) + 24;
  if (k === 'navbar') return textWidth(t, 18, 'bold') + 32;
  if (k === 'table') return Math.max(1, colsOf(n).length) * 80;
  if (k === 'toast') return textWidth(t, FONT.text) + 32;
  if (k === 'spacer') return 0;
  if (k === 'divider') return 0;
  return textWidth(t || n.typed || '', FONT.text) + 24;
}

/** Min-content width: the narrowest the node can be drawn without breaking a word inside its
 *  label (its widest word plus the kind's own padding and icon). Kinds that draw their label on
 *  one line, and pictures, keep their natural width. Never more than leafHug. */
export function leafMin(n) {
  const k = n.kind;
  const t = label(n);
  const lw = (size, weight) => longestWord(t, size, weight);
  let v;
  if (k === 'h1' || k === 'h2' || k === 'h3') v = lw(FONT[k], 'bold');
  else if (k === 'text' || k === 'link') v = lw(FONT.text) + (n.attrs.icon ? 24 : 0);
  else if (k === 'button') v = lw(FONT.text, 'bold') + 32 + (n.attrs.icon ? 24 : 0);
  else if (k === 'input' || k === 'textarea' || k === 'select') v = Math.max(S.fieldMin, lw(FONT.small));
  else if (k === 'checkbox' || k === 'radio') v = S.check + 8 + lw(FONT.text);
  else if (k === 'toggle') v = S.toggleW + 8 + lw(FONT.text);
  else if (k === 'item') v = Math.max(lw(FONT.text), longestWord(n.labels[1] || '', FONT.small)) + 32;
  else if (k === 'toast') v = lw(FONT.text) + 32;
  else return leafHug(n);
  return Math.min(v, leafHug(n));
}

/** Height at width w, the wrapped lines and (field kinds) the field's y offset. */
export function leafSize(n, w) {
  const k = n.kind;
  const t = label(n);
  if (k === 'h1' || k === 'h2' || k === 'h3' || k === 'text' || k === 'link') {
    const lines = wrapText(t, FONT[k], w - (n.attrs.icon && !BOLD.has(k) ? 24 : 0), BOLD.has(k) ? 'bold' : 'normal');
    return { h: lines.length * LINE[k], lines };
  }
  if (k === 'button') {
    const lines = wrapText(t, FONT.text, w - 32 - (n.attrs.icon ? 24 : 0), 'bold');
    return { h: Math.max(S.button, lines.length * 20 + 24), lines };
  }
  if (k === 'input' || k === 'textarea' || k === 'select') {
    const lines = t ? wrapText(t, FONT.small, w) : [];
    const top = lines.length * S.fieldLabel;
    const field = k === 'textarea' ? Math.max(S.field, num(n.attrs.rows, 3) * S.textareaRow + 22) : S.field;
    return { h: top + field + (n.attrs.error ? S.fieldError : 0), lines, fieldY: top };
  }
  if (k === 'checkbox' || k === 'radio' || k === 'toggle') {
    const lines = wrapText(t, FONT.text, w - (k === 'toggle' ? S.toggleW : S.check) - 8);
    return { h: Math.max(S.check, lines.length * LINE.text), lines };
  }
  if (k === 'divider') return { h: S.divider };
  if (k === 'spacer') return { h: 0 };
  if (k === 'image') {
    const [a, b] = String(n.attrs.ratio || '').split(':').map(Number);
    return { h: a && b ? Math.round(Math.min(800, Math.max(32, (w * b) / a))) : S.image, lines: t ? [t] : [] };
  }
  if (k === 'avatar') return { h: S.avatar, lines: t ? [t] : [] };
  if (k === 'icon') return { h: S.icon };
  if (k === 'badge') return { h: S.badge, lines: [t] };
  if (k === 'tab') return { h: S.tab, lines: [t] };
  if (k === 'navbar') return { h: S.navbar, lines: wrapText(t, 18, w - 32, 'bold').slice(0, 1) };
  if (k === 'item') {
    const lines = wrapText(t, FONT.text, w - 24);
    const sub = n.labels[1] ? wrapText(n.labels[1], FONT.small, w - 24) : [];
    const h = Math.max(sub.length ? S.item2 : S.item, lines.length * LINE.text + sub.length * LINE.small + 24);
    return { h, lines: lines.concat(sub) };
  }
  if (k === 'table') {
    const rows = num(n.attrs.rows, 3);
    return { h: (1 + rows) * S.tableRow, lines: colsOf(n) };
  }
  if (k === 'toast') {
    const lines = wrapText(t, FONT.text, w - 32);
    return { h: Math.max(S.toast, lines.length * LINE.text + 22), lines };
  }
  return { h: S.placeholder, lines: [t || n.typed || ''] };
}
