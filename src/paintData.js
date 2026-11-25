// Paint for media and data/navigation kinds: image, icon, avatar, badge, list, item, table,
// tabs, tab, navbar, tabbar.
import { FONT, LINE, S } from './sizes.js';
import { wrapText } from './measure.js';
import { num, label, fit, textBlock, textWidth, initials, topRounded, roundRect, inset, xywh } from './paintKit.js';
import { toneOf } from './looks.js';
import { colsOf } from './leaf.js';

const clean = (ctx) => ctx.look.name === 'clean';
const MAX_ROWS = 200;

function image(b, ctx) {
  const ops = [{ op: 'rect', ...inset(b, 1), r: ctx.look.radius.control, fill: 'faint', stroke: 'line' }];
  // the classic placeholder cross in wire; clean keeps just the picture glyph and caption
  if (!clean(ctx)) ops.push({ op: 'cross', x: b.x + 1, y: b.y + 1, w: b.w - 2, h: b.h - 2, stroke: 'hair' });
  const t = label(b.node);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (b.h >= 56 && b.w >= 48) ops.push({ op: 'icon', name: 'image', x: cx - 12, y: cy - 12 - (t ? 9 : 0), size: 24, tone: 'muted' });
  if (t && b.h >= 40) {
    ops.push(...textBlock([fit(t, FONT.small, b.w - 16, 'bold')], { x: b.x, y: cy + (b.h >= 56 ? 6 : -9), w: b.w, size: FONT.small, lh: LINE.small, weight: 600, tone: 'muted', align: 'center' }));
  }
  return ops;
}

function avatar(b) {
  const d = Math.min(b.w, b.h);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const ops = [{ op: 'circle', cx, cy, r: d / 2 - 0.5, fill: 'soft', stroke: 'hair' }];
  const ini = initials(label(b.node));
  if (ini) {
    const size = Math.max(9, Math.round(d * 0.38));
    ops.push({ op: 'text', x: cx, y: cy + size * 0.35, text: ini, size, weight: 600, anchor: 'middle', tone: 'strong' });
  } else {
    const s = Math.round(d * 0.55);
    ops.push({ op: 'icon', name: 'user', x: cx - s / 2, y: cy - s / 2, size: s, tone: 'muted' });
  }
  return ops;
}

function icon(b) {
  const n = b.node;
  const s = Math.max(8, Math.min(b.w, b.h));
  return [{ op: 'icon', name: n.attrs.icon || label(n), x: b.x + (b.w - s) / 2, y: b.y + (b.h - s) / 2, size: s, tone: 'strong' }];
}

function badge(b, ctx) {
  const n = b.node;
  const tone = toneOf(n.attrs.tone);
  const muted = n.flags.includes('muted');
  const ops = [];
  if (muted) ops.push({ op: 'rect', ...inset(b, 1), r: (b.h - 1) / 2, stroke: 'line' });
  else ops.push({ op: 'rect', ...xywh(b), r: b.h / 2, fill: tone && clean(ctx) ? `${tone}Soft` : 'soft' });
  const ink = tone && clean(ctx) && !muted ? tone : muted ? 'muted' : 'strong';
  const t = label(n);
  const ic = n.attrs.icon ? 16 : 0;
  const tw = textWidth(t, FONT.small, 'bold');
  const sx = b.x + Math.max(0, (b.w - tw - ic) / 2);
  if (ic) ops.push({ op: 'icon', name: n.attrs.icon, x: sx - 2, y: b.y + b.h / 2 - 6, size: 12, tone: ink });
  ops.push(...textBlock([t], { x: sx + ic, y: b.y + (b.h - LINE.small) / 2, w: tw, size: FONT.small, lh: LINE.small, weight: 600, tone: ink, align: 'center' }));
  return ops;
}

function list(b, ctx) {
  const ops = [{ op: 'rect', ...inset(b, 1), r: ctx.look.radius.card, stroke: 'line' }];
  const kids = b.children;
  for (let i = 0; i + 1 < kids.length; i++) {
    const y = kids[i].y + kids[i].h;
    ops.push({ op: 'line', x1: b.x + 16, y1: y, x2: b.x + b.w, y2: y, stroke: 'hair' });
  }
  return ops;
}

function tabbarItem(b, ctx) {
  const n = b.node;
  const on = n.flags.includes('selected');
  const tone = on ? (clean(ctx) ? 'accent' : 'ink') : 'muted';
  const cx = b.x + b.w / 2;
  const top = b.y + Math.max(0, (b.h - 40) / 2);
  const ops = [];
  if (n.attrs.icon) ops.push({ op: 'icon', name: n.attrs.icon, x: cx - 11, y: top, size: 22, tone });
  else ops.push({ op: 'circle', cx, cy: top + 11, r: 9, stroke: tone === 'muted' ? 'line' : clean(ctx) ? 'accent' : 'ink', sw: 1.5 });
  ops.push({ op: 'text', x: cx, y: top + 37, text: fit(label(n), 11, b.w - 4), size: 11, weight: on ? 600 : 500, anchor: 'middle', tone });
  return ops;
}

function item(b, ctx, parent) {
  if (parent && parent.kind === 'tabbar') return tabbarItem(b, ctx);
  const n = b.node;
  const ops = [];
  const inList = parent && parent.kind === 'list';
  const fill = clean(ctx) ? 'accentSoft' : 'soft';
  if (n.flags.includes('selected')) {
    if (inList) {
      // stay inside the list's rounded outline: round only the corners the item shares with it
      const kids = parent.children;
      const first = kids[0] === n;
      const last = kids[kids.length - 1] === n;
      const R = ctx.look.radius.card - 1;
      ops.push({ op: 'path', d: roundRect(b.x + 1, b.y + (first ? 1 : 0), b.w - 2, b.h - (first ? 1 : 0) - (last ? 1 : 0), R, { tl: first, tr: first, br: last, bl: last }), fill });
    } else ops.push({ op: 'rect', ...xywh(b), r: ctx.look.radius.control, fill });
  }
  if (b.children.length) return ops;
  const ic = n.attrs.icon ? 32 : 0;
  if (ic) ops.push({ op: 'icon', name: n.attrs.icon, x: b.x + 12, y: b.y + b.h / 2 - 10, size: 20, tone: 'strong' });
  const linked = !!n.link;
  const room = b.w - 24 - ic - (linked ? 24 : 0);
  const mainN = wrapText(label(n), FONT.text, b.w - 24).length;
  const all = b.lines || [];
  const main = all.slice(0, mainN).map((l) => fit(l, FONT.text, room));
  const sub = all.slice(mainN).map((l) => fit(l, FONT.small, room));
  const block = main.length * LINE.text + sub.length * LINE.small;
  const top = b.y + (b.h - block) / 2;
  const muted = n.flags.includes('muted');
  ops.push(...textBlock(main, { x: b.x + 12 + ic, y: top, w: room, size: FONT.text, lh: LINE.text, weight: 500, tone: muted ? 'muted' : 'ink' }));
  ops.push(...textBlock(sub, { x: b.x + 12 + ic, y: top + main.length * LINE.text, w: room, size: FONT.small, lh: LINE.small, tone: 'muted' }));
  if (linked) ops.push({ op: 'icon', name: 'chevron-right', x: b.x + b.w - 28, y: b.y + b.h / 2 - 8, size: 16, tone: 'muted' });
  return ops;
}

const BAR = [0.72, 0.46, 0.6, 0.34, 0.54, 0.4];

function table(b, ctx) {
  const n = b.node;
  const R = ctx.look.radius.card;
  const ops = [];
  if (b.children.length) return [{ op: 'rect', ...inset(b, 1), r: R, stroke: 'line' }];
  const cols = colsOf(n);
  const nc = Math.max(1, Math.min(50, cols.length));
  const cw = b.w / nc;
  const hr = S.tableRow;
  ops.push({ op: 'path', d: topRounded(b.x + 0.5, b.y + 0.5, b.w - 1, hr - 0.5, R - 0.5), fill: 'faint' });
  ops.push({ op: 'rect', ...inset(b, 1), r: R, stroke: 'line' });
  for (let i = 0; i < nc; i++) {
    const t = cols[i] ? fit(cols[i], FONT.small, cw - 24, 'bold') : '';
    if (t) ops.push(...textBlock([t], { x: b.x + i * cw + 12, y: b.y, w: cw - 24, size: FONT.small, lh: hr, weight: 600, tone: 'strong' }));
  }
  const rows = Math.max(0, Math.min(MAX_ROWS, Math.floor(b.h / hr) - 1, Math.round(num(n.attrs.rows, 3))));
  for (let r = 0; r < rows; r++) {
    const y = b.y + hr * (r + 1);
    ops.push({ op: 'line', x1: b.x + 1, y1: y, x2: b.x + b.w - 1, y2: y, stroke: 'hair' });
    for (let i = 0; i < nc; i++) {
      const bw = Math.max(8, (cw - 24) * BAR[(r * 3 + i * 2) % BAR.length]);
      ops.push({ op: 'rect', x: b.x + i * cw + 12, y: y + hr / 2 - 4, w: bw, h: 8, r: 4, fill: i === 0 ? 'mid' : 'soft' });
    }
  }
  return ops;
}

function tabs(b) {
  return [{ op: 'line', x1: b.x, y1: b.y + b.h - 0.5, x2: b.x + b.w, y2: b.y + b.h - 0.5, stroke: 'hair' }];
}

function tab(b, ctx) {
  const n = b.node;
  const on = n.flags.includes('selected');
  const ops = [];
  const t = fit(label(n), FONT.text, b.w - 16 - (n.attrs.icon ? 22 : 0), on ? 'bold' : 'normal');
  const tw = textWidth(t, FONT.text, on ? 'bold' : 'normal');
  const ic = n.attrs.icon ? 22 : 0;
  const sx = b.x + (b.w - tw - ic) / 2;
  const tone = on ? (clean(ctx) ? 'accent' : 'ink') : 'muted';
  if (ic) ops.push({ op: 'icon', name: n.attrs.icon, x: sx, y: b.y + b.h / 2 - 8, size: 16, tone });
  ops.push(...textBlock([t], { x: sx + ic, y: b.y + (b.h - LINE.text) / 2, w: tw, size: FONT.text, lh: LINE.text, weight: on ? 600 : 500, tone, align: 'center' }));
  if (on) ops.push({ op: 'rect', x: b.x + 8, y: b.y + b.h - 2, w: Math.max(0, b.w - 16), h: 2, r: 1, fill: clean(ctx) ? 'accent' : 'ink' });
  return ops;
}

function navbar(b) {
  const n = b.node;
  const ops = [{ op: 'line', x1: b.x, y1: b.y + b.h - 0.5, x2: b.x + b.w, y2: b.y + b.h - 0.5, stroke: 'hair' }];
  if (b.children.length) return ops;
  const back = n.flags.includes('back');
  const cy = b.y + b.h / 2;
  if (back) ops.push({ op: 'icon', name: 'chevron-left', x: b.x + 8, y: cy - 12, size: 24, tone: 'ink' });
  const t = fit(label(n), 17, b.w - (back ? 96 : 32), 'bold');
  ops.push(...textBlock([t], { x: b.x, y: cy - 13, w: b.w, size: 17, lh: 26, weight: 600, tone: 'ink', align: 'center' }));
  return ops;
}

function tabbar(b) {
  return [{ op: 'line', x1: b.x, y1: b.y + 0.5, x2: b.x + b.w, y2: b.y + 0.5, stroke: 'hair' }];
}

export const DATA_PAINT = { image, avatar, icon, badge, list, item, table, tabs, tab, navbar, tabbar };
