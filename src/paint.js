// Box tree → drawing ops. Look-aware, markup-free: only svg.js writes markup.
// Frames, layout, text and unknown kinds live here; controls in paintControls.js, media and
// data/navigation in paintData.js.
import { FONT, LINE, OVERLAYS } from './sizes.js';
import { lookOf } from './looks.js';
import { num, label, textBlock, textWidth, topRounded, inset, xywh } from './paintKit.js';
import { CONTROL_PAINT } from './paintControls.js';
import { DATA_PAINT } from './paintData.js';

const SCREEN_ID = /^[a-z][a-z0-9-]{0,63}$/;
const HEAD = new Set(['h1', 'h2', 'h3']);
const WEIGHT = { h1: 700, h2: 600, h3: 600, text: 400, link: 500 };
const PADS = { card: 16, modal: 16, sheet: 16, toast: 12 };
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function walkNodes(n, f, depth = 0) {
  if (!n || depth > 64) return;
  f(n);
  if (Array.isArray(n.children)) for (const c of n.children) walkNodes(c, f, depth + 1);
}

const noteCache = new WeakMap();

/**
 * Note numbers 1, 2, … in source order across the block. A variant's copy of a node keeps the
 * number of the node it was copied from (same line, column and note text).
 */
export function numberNotes(mock) {
  const hit = noteCache.get(mock);
  if (hit) return hit;
  const out = new Map();
  const byKey = new Map();
  for (const s of mock.screens || []) {
    walkNodes(s.root, (n) => {
      if (typeof n.note !== 'string' || n.note === '') return;
      const key = `${n.line}:${n.col}:${n.note}`;
      if (!byKey.has(key)) byKey.set(key, byKey.size + 1);
      out.set(n, byKey.get(key));
    });
  }
  noteCache.set(mock, out);
  return out;
}

// Which screen "-> back" goes to: the previous screen in @flow, else the one screen that links
// here (variants count as their base), else for a variant the screen it is a state of; else none.
export function backTarget(mock, i) {
  const screens = mock.screens || [];
  const s = screens[i];
  if (!s) return null;
  const baseId = s.variantOf || s.id;
  if (Array.isArray(mock.flow)) {
    let k = mock.flow.indexOf(s.id);
    if (k < 0) k = mock.flow.indexOf(baseId);
    if (k > 0) return mock.flow[k - 1];
  }
  const from = new Set();
  for (const o of screens) {
    const oBase = o.variantOf || o.id;
    if (oBase === baseId) continue;
    walkNodes(o.root, (n) => { if (n.link === s.id || n.link === baseId) from.add(oBase); });
  }
  if (from.size === 1) return [...from][0];
  return s.variantOf || null;
}

function textKind(b, ctx) {
  const n = b.node;
  const k = n.kind;
  const ops = [];
  const muted = n.flags.includes('muted');
  const clean = ctx.look.name === 'clean';
  let tone = muted ? 'muted' : HEAD.has(k) ? 'ink' : 'strong';
  if (k === 'link' && !muted) tone = clean ? 'accent' : 'ink';
  const iconW = n.attrs.icon && !HEAD.has(k) ? 24 : 0;
  const lh = LINE[k];
  const size = FONT[k];
  const align = n.attrs.align === 'center' || n.attrs.align === 'end' ? n.attrs.align : 'start';
  const lines = b.lines || [];
  if (iconW) ops.push({ op: 'icon', name: n.attrs.icon, x: b.x, y: b.y + lh / 2 - 8, size: 16, tone });
  ops.push(...textBlock(lines, { x: b.x + iconW, y: b.y, w: b.w - iconW, size, lh, weight: WEIGHT[k], tone, align }));
  if (k === 'link' && !clean) {
    lines.forEach((l, i) => {
      const tw = textWidth(l, size);
      const x0 = align === 'center' ? b.x + iconW + (b.w - iconW - tw) / 2 : align === 'end' ? b.x + b.w - tw : b.x + iconW;
      const y = b.y + i * lh + lh / 2 + size * 0.35 + 3;
      ops.push({ op: 'line', x1: x0, y1: y, x2: x0 + tw, y2: y, stroke: 'strong' });
    });
  }
  return ops;
}

function header(b, ctx, top) {
  const n = b.node;
  const pad = num(n.attrs.pad, PADS[n.kind] || 0);
  return textBlock(b.lines, { x: b.x + pad, y: top ?? b.y + pad, w: b.w - 2 * pad, size: 18, lh: LINE.h3, weight: 600, tone: 'ink' });
}

const FRAME_PAINT = {
  card(b, ctx) {
    const clean = ctx.look.name === 'clean';
    return [{ op: 'rect', ...inset(b, 1), r: ctx.look.radius.card, fill: clean ? 'wash' : 'none', stroke: clean ? 'hair' : 'line' }]
      .concat(header(b, ctx));
  },
  modal(b, ctx) {
    const r = ctx.look.radius.card + 4;
    return [{ op: 'rect', ...inset(b, 1), r, fill: 'surface' }, { op: 'rect', ...inset(b, 1), r, fill: 'faint', stroke: 'strong' }]
      .concat(header(b, ctx));
  },
  sheet(b, ctx) {
    const d = topRounded(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 0.5, 16);
    return [
      { op: 'path', d, fill: 'surface' },
      { op: 'path', d, fill: 'faint', stroke: 'strong' },
      { op: 'rect', x: b.x + b.w / 2 - 18, y: b.y + 6, w: 36, h: 4, r: 2, fill: 'mid' },
    ].concat(header(b, ctx));
  },
  toast(b, ctx) {
    const clean = ctx.look.name === 'clean';
    const tone = ['good', 'bad', 'warn', 'info'].includes(b.node.attrs.tone) ? b.node.attrs.tone : null;
    const ops = [
      { op: 'rect', ...inset(b, 1), r: 10, fill: 'surface' },
      { op: 'rect', ...inset(b, 1), r: 10, fill: tone && clean ? `${tone}Soft` : 'soft', stroke: tone && clean ? tone : 'line' },
    ];
    if (b.children.length) return ops;
    const lines = b.lines || [];
    ops.push(...textBlock(lines, { x: b.x + 16, y: b.y + (b.h - lines.length * LINE.text) / 2, w: b.w - 32, size: FONT.text, lh: LINE.text, weight: 500, tone: 'ink' }));
    return ops;
  },
  divider(b) {
    const y = b.y + b.h / 2;
    return [{ op: 'line', x1: b.x, y1: y, x2: b.x + b.w, y2: y, stroke: 'hair' }];
  },
  unknown(b, ctx) {
    const n = b.node;
    const t = label(n) || n.typed || '';
    const cy = b.y + Math.min(b.h, 44) / 2;
    return [
      { op: 'rect', ...inset(b, 1), r: ctx.look.radius.control, stroke: 'strong', dash: true },
      { op: 'circle', cx: b.x + 18, cy, r: 8, stroke: 'line' },
      { op: 'text', x: b.x + 18, y: cy + 4, text: '?', size: 11, weight: 700, anchor: 'middle', tone: 'muted' },
      ...textBlock([t], { x: b.x + 34, y: cy - LINE.text / 2, w: b.w - 46, size: FONT.text, lh: LINE.text, tone: 'muted' }),
    ];
  },
};
for (const k of ['h1', 'h2', 'h3', 'text', 'link']) FRAME_PAINT[k] = textKind;

function paintOwn(b, ctx, parent) {
  const k = b.node.kind;
  if (own(FRAME_PAINT, k)) return FRAME_PAINT[k](b, ctx, parent);
  if (own(CONTROL_PAINT, k)) return CONTROL_PAINT[k](b, ctx, parent);
  if (own(DATA_PAINT, k)) return DATA_PAINT[k](b, ctx, parent);
  return [];
}

// Clean: an accent dot straddling the top-right corner. Wire: a ring beside the corner when there
// is room, else just inside it. Both sit on the opaque surface so nothing shows through.
function noteBadge(b, num_, ctx) {
  const clean = ctx.look.name === 'clean';
  let cx = b.x + b.w;
  let cy = b.y;
  if (!clean) {
    if (b.x + b.w + 14 <= ctx.width - 4) { cx = b.x + b.w + 12; cy = b.y + 9; } else { cx = b.x + b.w - 12; cy = b.y + 12; }
  }
  return [
    { op: 'circle', cx, cy, r: 9, fill: 'surface' },
    { op: 'circle', cx, cy, r: 9, fill: clean ? 'accent' : 'soft', stroke: clean ? undefined : 'ink', sw: 1.5 },
    { op: 'text', x: cx, y: cy + 4, text: String(num_), size: 11, weight: 700, anchor: 'middle', tone: clean ? 'onAccent' : 'ink' },
  ];
}

function linkOf(n, ctx) {
  let t = n.link;
  if (typeof t !== 'string' || !t) return null;
  if (t === 'back') t = ctx.back;
  return typeof t === 'string' && SCREEN_ID.test(t) && ctx.ids.has(t) ? t : null;
}

function paintBox(b, ctx, parent, inLink, depth) {
  const n = b.node;
  if (depth > 64) return [];
  const target = inLink ? null : linkOf(n, ctx);
  const ops = paintOwn(b, ctx, parent);
  for (const c of b.children) ops.push(...paintBox(c, ctx, n, inLink || !!target, depth + 1));
  const note = ctx.notes.get(n);
  if (note) ops.push(...noteBadge(b, note, ctx));
  const g = { op: 'group', el: typeof n.id === 'string' ? n.id : '', ops };
  if (n.flags.includes('disabled')) g.opacity = '.45';
  if (!target) return [g];
  return [{ op: 'link', target, ops: [{ op: 'rect', ...xywh(b), fill: 'clear' }, g] }];
}

/** layout: layoutScreen output; returns the screen's ops (the frame is the serializer's). */
export function paintScreen(layout, mock, screenIndex, blockIndex = 0) {
  const look = lookOf(mock.look);
  const ids = new Set((mock.screens || []).map((s) => s.id).filter((id) => typeof id === 'string' && SCREEN_ID.test(id)));
  const ctx = { look, notes: numberNotes(mock), ids, back: backTarget(mock, screenIndex), block: blockIndex, width: layout.width };
  const root = layout.root;
  const flow = [];
  const over = [];
  for (const c of root.children) (OVERLAYS.has(c.node.kind) ? over : flow).push(c);
  let ops = [];
  for (const c of flow) ops.push(...paintBox(c, ctx, root.node, false, 1));
  const dims = over.some((c) => c.node.kind !== 'toast');
  if (dims) {
    const fr = layout.width < 600 ? look.radius.frameSmall : look.radius.frameLarge; // the serializer's frame
    ops = [{ op: 'group', opacity: '.35', ops }, { op: 'rect', x: 0.5, y: 0.5, w: layout.width - 1, h: layout.height - 1, r: fr, fill: 'faint' }];
  }
  for (const c of over) ops.push(...paintBox(c, ctx, root.node, false, 1));
  const rootNote = ctx.notes.get(root.node);
  if (rootNote) ops.push(...noteBadge({ x: 12, y: 12, w: layout.width - 24, h: 0 }, rootNote, ctx));
  if (layout.fold) {
    const y = layout.fold;
    ops.push({ op: 'line', x1: 0, y1: y, x2: layout.width, y2: y, stroke: 'strong', dash: true });
    ops.push({ op: 'text', x: layout.width - 8, y: y - 5, text: 'fold', size: 10, weight: 600, anchor: 'end', tone: 'muted' });
  }
  return ops;
}
