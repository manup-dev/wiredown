// Shared helpers for the paint files: text blocks, fitting, shapes built from numbers only.
import { textWidth } from './measure.js';

export const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
export const label = (n) => (n.labels && n.labels[0]) || '';

/** Baseline for a line box of height lh starting at top, for a font of `size`. */
export const base = (top, lh, size) => top + lh / 2 + size * 0.35;

/** One line of text cut with an ellipsis to fit maxW (linear in the text). */
export function fit(text, size, maxW, weight = 'normal') {
  const s = String(text);
  if (textWidth(s, size, weight) <= maxW) return s;
  const ell = textWidth('…', size, weight);
  let out = '';
  let w = 0;
  for (const ch of s) {
    const cw = textWidth(ch, size, weight);
    if (w + cw + ell > maxW) break;
    out += ch;
    w += cw;
  }
  return out.trimEnd() + '…';
}

/**
 * A block of lines. o: { x, y (top), w, size, lh, weight?, tone?, align?: start|center|end }.
 * Returns a single text op (multi-line via tspans).
 */
export function textBlock(lines, o) {
  if (!lines || !lines.length) return [];
  const anchor = o.align === 'center' ? 'middle' : o.align === 'end' ? 'end' : 'start';
  const x = anchor === 'middle' ? o.x + o.w / 2 : anchor === 'end' ? o.x + o.w : o.x;
  return [{ op: 'text', x, y: base(o.y, o.lh, o.size), lines, lh: o.lh, size: o.size, weight: o.weight, anchor, tone: o.tone || 'ink' }];
}

/** Rectangle path with the chosen corners rounded: corners = { tl, tr, br, bl } booleans. */
export function roundRect(x, y, w, h, r, corners) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const f = (v) => String(Math.round(v * 2) / 2);
  const c = (on, dx, dy) => (on && rr ? `a${f(rr)} ${f(rr)} 0 0 1 ${f(dx * rr)} ${f(dy * rr)}` : '');
  const k = (on) => (on ? rr : 0);
  return `M${f(x + k(corners.tl))} ${f(y)}H${f(x + w - k(corners.tr))}${c(corners.tr, 1, 1)}` +
    `V${f(y + h - k(corners.br))}${c(corners.br, -1, 1)}H${f(x + k(corners.bl))}${c(corners.bl, -1, -1)}` +
    `V${f(y + k(corners.tl))}${c(corners.tl, 1, -1)}z`;
}

/** Rectangle path with only the top corners rounded. */
export const topRounded = (x, y, w, h, r) => roundRect(x, y, w, h, r, { tl: true, tr: true });

/** A spinner: faint ring plus a quarter arc, centred at (cx, cy). */
export function spinner(cx, cy, r, tone) {
  const f = (v) => String(Math.round(v * 2) / 2);
  return [
    { op: 'circle', cx, cy, r, stroke: 'hair', sw: 2 },
    { op: 'path', d: `M${f(cx)} ${f(cy - r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}`, stroke: tone, sw: 2, cap: true },
  ];
}

/** Initials from a label: the first character of up to two words. */
export function initials(text) {
  const words = String(text).split(' ').filter(Boolean).slice(0, 2);
  return words.map((w) => [...w][0] || '').join('').toUpperCase();
}

/** Stroke inset so a w-wide stroke stays inside its box. */
export const inset = (b, sw) => ({ x: b.x + sw / 2, y: b.y + sw / 2, w: Math.max(0, b.w - sw), h: Math.max(0, b.h - sw) });

export const xywh = (b) => ({ x: b.x, y: b.y, w: b.w, h: b.h });

export { textWidth };
