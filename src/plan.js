// Flex planning for container nodes: child rectangles (relative to the node) for a width.
import { longestWord, wrapText } from './measure.js';
import { leafHug, leafMin, leafSize } from './leaf.js';
import { LINE, FILL_KINDS, OVERLAYS, S } from './sizes.js';

const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const FRAME_HEADER = new Set(['card', 'modal', 'sheet']);
const ALWAYS = new Set(['screen', 'stack', 'row', 'grid', 'card', 'list', 'tabs', 'tabbar', 'modal', 'sheet']);
const WITH_KIDS = new Set(['item', 'navbar', 'toast', 'table']);
const ROWS = new Set(['row', 'tabs', 'tabbar', 'item', 'navbar', 'toast']);
const PADS = { screen: S.rootPad, card: S.cardPad, modal: S.overlayPad, sheet: S.overlayPad, item: 12, navbar: 16, toast: 12 };
const MIN_H = { navbar: S.navbar, tabbar: S.tabbar, item: S.item, toast: S.toast, tabs: S.tab };

// How a container lays its children out: 'grid', 'row' or 'col'.
export const axisOf = (kind) => (kind === 'grid' ? 'grid' : ROWS.has(kind) ? 'row' : 'col');
export const isContainer = (n) => ALWAYS.has(n.kind) || (WITH_KIDS.has(n.kind) && n.children.length > 0);
export const flowKids = (n) => (n.kind === 'screen' ? n.children.filter((c) => !OVERLAYS.has(c.kind)) : n.children);

function spec(n) {
  const dir = axisOf(n.kind);
  const gapDefault = n.kind === 'list' || n.kind === 'tabs' || n.kind === 'tabbar' || n.kind === 'table' ? 0 : S.gap;
  return { dir, pad: num(n.attrs.pad, PADS[n.kind] || 0), gap: num(n.attrs.gap, gapDefault), minH: MIN_H[n.kind] || 0 };
}

export function newCtx() { return { hug: new Map(), nat: new Map(), min: new Map() }; }

const hNum = (c) => (c.attrs.h !== undefined && c.attrs.h !== 'fill' && c.attrs.h !== 'hug' ? num(c.attrs.h, null) : null);
const wNum = (c) => (c.attrs.w !== undefined && c.attrs.w !== 'fill' && c.attrs.w !== 'hug' ? num(c.attrs.w, null) : null);
const grow = (c) => num(c.attrs.grow, 0);

export function hugW(n, ctx) {
  if (!isContainer(n)) return leafHug(n);
  let v = ctx.hug.get(n);
  if (v !== undefined) return v;
  const sp = spec(n);
  const kids = flowKids(n);
  const ws = kids.map((c) => wNum(c) ?? hugW(c, ctx));
  const gaps = Math.max(0, kids.length - 1) * sp.gap;
  let inner = 0;
  if (sp.dir === 'row') inner = ws.reduce((a, b) => a + b, 0) + gaps;
  else if (sp.dir === 'col') inner = Math.max(0, ...ws);
  else {
    const cols = gridCols(n);
    inner = cols * Math.max(0, ...kids.map((c, i) => ws[i] / Math.min(cols, num(c.attrs.span, 1)))) + (cols - 1) * sp.gap;
  }
  v = inner + 2 * sp.pad;
  ctx.hug.set(n, v);
  return v;
}

// Min-content width: the narrowest a node can be without breaking a word that would fit
// (a row shrinks its children toward this before any label breaks inside a word).
export function minW(n, ctx) {
  if (!isContainer(n)) return leafMin(n);
  let v = ctx.min.get(n);
  if (v !== undefined) return v;
  const sp = spec(n);
  const kids = flowKids(n);
  const ws = kids.map((c) => wNum(c) ?? minW(c, ctx));
  let inner;
  if (sp.dir === 'row') inner = ws.reduce((a, b) => a + b, 0) + Math.max(0, kids.length - 1) * sp.gap;
  else if (sp.dir === 'col') inner = Math.max(0, ...ws, FRAME_HEADER.has(n.kind) && n.labels[0] ? longestWord(n.labels[0], 18, 'bold') : 0);
  else {
    const cols = gridCols(n);
    inner = cols * Math.max(0, ...kids.map((c, i) => ws[i] / Math.min(cols, num(c.attrs.span, 1)))) + (cols - 1) * sp.gap;
  }
  v = Math.min(inner + 2 * sp.pad, hugW(n, ctx));
  ctx.min.set(n, v);
  return v;
}

const gridCols = (n) => Math.min(12, Math.max(1, Math.round(num(n.attrs.cols, 2))));

export function naturalH(n, w, ctx) {
  if (!isContainer(n)) return leafSize(n, w).h;
  let m = ctx.nat.get(n);
  if (!m) { m = new Map(); ctx.nat.set(n, m); }
  let h = m.get(w);
  if (h === undefined) { h = plan(n, w, null, ctx).h; m.set(w, h); }
  return h;
}

function colW(c, align, iw, ctx) {
  const wn = wNum(c);
  if (wn !== null) return Math.min(wn, iw);
  if (c.attrs.w === 'fill') return iw;
  if (c.attrs.w === 'hug') return Math.min(hugW(c, ctx), iw);
  if (align === 'stretch' || (align === undefined && FILL_KINDS.has(c.kind))) return iw;
  return Math.min(hugW(c, ctx), iw);
}

const offset = (align, free) => (align === 'center' ? free / 2 : align === 'end' ? free : 0);

function justify(kind, free, count) {
  if (free <= 0) return { start: 0, extra: 0 };
  if (kind === 'center') return { start: free / 2, extra: 0 };
  if (kind === 'end') return { start: free, extra: 0 };
  if (kind === 'between' && count > 1) return { start: 0, extra: free / (count - 1) };
  return { start: 0, extra: 0 };
}

function headerOf(n, iw) {
  if (!FRAME_HEADER.has(n.kind) || !n.labels[0]) return { lines: n.labels[0] ? [n.labels[0]] : undefined, h: 0 };
  const lines = wrapText(n.labels[0], 18, iw, 'bold');
  return { lines, h: lines.length * LINE.h3 + S.gap };
}

function planCol(n, w, hForce, sp, ctx) {
  const iw = Math.max(0, w - 2 * sp.pad);
  const align = n.attrs.align;
  const head = headerOf(n, iw);
  const kids = flowKids(n);
  const cws = kids.map((c) => colW(c, align, iw, ctx));
  const fixed = kids.map((c) => hNum(c));
  const weight = kids.map((c) => (c.attrs.h === 'fill' ? grow(c) || 1 : grow(c) || (c.kind === 'spacer' && fixed[kids.indexOf(c)] === null ? 1 : 0)));
  const hs = kids.map((c, i) => (fixed[i] !== null ? fixed[i] : c.attrs.h === 'fill' ? 0 : naturalH(c, cws[i], ctx)));
  const gaps = Math.max(0, kids.length - 1) * sp.gap;
  const used = hs.reduce((a, b) => a + b, 0) + gaps;
  const natural = Math.max(sp.minH, 2 * sp.pad + head.h + used);
  const H = hForce ?? natural;
  const free = H - 2 * sp.pad - head.h - used;
  const wsum = weight.reduce((a, b) => a + b, 0);
  let start = 0;
  let extra = 0;
  if (free > 0 && wsum > 0) kids.forEach((_, i) => { hs[i] += (free * weight[i]) / wsum; });
  else ({ start, extra } = justify(n.attrs.justify, free, kids.length));
  let y = sp.pad + head.h + start;
  const out = kids.map((c, i) => {
    const r = { c, x: sp.pad + offset(align, iw - cws[i]), y, w: cws[i], h: hs[i] };
    y += hs[i] + sp.gap + extra;
    return r;
  });
  return { h: H, kids: out, lines: head.lines };
}

function planRow(n, w, hForce, sp, ctx) {
  const iw = Math.max(0, w - 2 * sp.pad);
  const kids = flowKids(n);
  const gaps = Math.max(0, kids.length - 1) * sp.gap;
  const ws = [];
  const weight = [];
  let hugSum = 0;
  let fixedSum = 0;
  kids.forEach((c, i) => {
    const wn = wNum(c);
    const g = c.attrs.w === 'fill' ? grow(c) || 1 : grow(c) || (n.kind === 'tabbar' || (c.kind === 'spacer' && wn === null) ? 1 : 0);
    weight[i] = wn !== null ? 0 : g;
    if (wn !== null) { ws[i] = Math.min(wn, iw); fixedSum += ws[i]; } else if (g) ws[i] = 0;
    else { ws[i] = Math.min(hugW(c, ctx), iw); hugSum += ws[i]; }
  });
  const wsum = weight.reduce((a, b) => a + b, 0);
  const room = iw - gaps - fixedSum;
  if (fixedSum > iw - gaps) {
    const f = Math.max(0, iw - gaps) / fixedSum;
    kids.forEach((c, i) => { if (wNum(c) !== null) ws[i] *= f; });
    hugSum = 0;
    kids.forEach((c, i) => { if (wNum(c) === null && !weight[i]) { ws[i] = 0; } });
  }
  if (hugSum > room && wsum === 0 && hugSum > 0) {
    // Shrink toward each child's min-content width first (the widest gives way most), so no label
    // breaks inside a word while the row has room for every word; only past that do all shrink.
    const mins = kids.map((c, i) => (wNum(c) === null ? Math.min(ws[i], minW(c, ctx)) : 0));
    const minSum = mins.reduce((a, b) => a + b, 0);
    const k = minSum >= room ? 0 : (room - minSum) / (hugSum - minSum);
    const f = minSum >= room && minSum > 0 ? Math.max(0, room) / minSum : 1;
    kids.forEach((c, i) => { if (wNum(c) === null) ws[i] = minSum >= room ? mins[i] * f : mins[i] + (ws[i] - mins[i]) * k; });
  }
  const free = iw - gaps - ws.reduce((a, b) => a + b, 0);
  let start = 0;
  let extra = 0;
  if (free > 0 && wsum > 0) kids.forEach((_, i) => { if (weight[i]) ws[i] += (free * weight[i]) / wsum; });
  else ({ start, extra } = justify(n.attrs.justify, free, kids.length));
  const align = n.attrs.align || 'center';
  const nat = kids.map((c, i) => hNum(c) ?? (c.attrs.h === 'fill' ? 0 : naturalH(c, ws[i], ctx)));
  const natural = Math.max(sp.minH, 2 * sp.pad + Math.max(0, ...nat));
  const H = hForce ?? natural;
  const ih = H - 2 * sp.pad;
  let x = sp.pad + start;
  const out = kids.map((c, i) => {
    const stretch = hNum(c) === null && (align === 'stretch' || c.attrs.h === 'fill');
    const h = stretch ? ih : nat[i];
    const r = { c, x, y: sp.pad + offset(align, ih - h), w: ws[i], h };
    x += ws[i] + sp.gap + extra;
    return r;
  });
  return { h: H, kids: out, lines: n.labels[0] ? [n.labels[0]] : undefined };
}

function planGrid(n, w, hForce, sp, ctx) {
  const iw = Math.max(0, w - 2 * sp.pad);
  const cols = gridCols(n);
  const head = headerOf(n, iw);
  const track = (iw - (cols - 1) * sp.gap) / cols;
  const out = [];
  let col = 0;
  let y = sp.pad + head.h;
  let rowH = 0;
  for (const c of flowKids(n)) {
    const span = Math.min(cols, Math.max(1, Math.round(num(c.attrs.span, 1))));
    if (col + span > cols) { y += rowH + sp.gap; col = 0; rowH = 0; }
    const cw = span * track + (span - 1) * sp.gap;
    const wn = wNum(c);
    const w2 = wn !== null ? Math.min(wn, cw) : cw;
    const h = hNum(c) ?? naturalH(c, w2, ctx);
    out.push({ c, x: sp.pad + col * (track + sp.gap), y, w: w2, h });
    rowH = Math.max(rowH, h);
    col += span;
  }
  const natural = Math.max(sp.minH, y + rowH + sp.pad);
  return { h: hForce ?? natural, kids: out, lines: head.lines };
}

export function plan(n, w, hForce, ctx) {
  const sp = spec(n);
  if (sp.dir === 'row') return planRow(n, w, hForce, sp, ctx);
  if (sp.dir === 'grid') return planGrid(n, w, hForce, sp, ctx);
  return planCol(n, w, hForce, sp, ctx);
}
