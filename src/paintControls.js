// Paint for controls: button, input, textarea, select, checkbox, radio, toggle.
// Pictures of controls only, never real form elements.
import { FONT, LINE, S } from './sizes.js';
import { num, fit, textBlock, textWidth, spinner, inset, xywh } from './paintKit.js';

const clean = (ctx) => ctx.look.name === 'clean';

function button(b, ctx) {
  const n = b.node;
  const R = ctx.look.radius.control;
  const primary = n.flags.includes('primary');
  const selected = n.flags.includes('selected');
  const ops = [];
  let tone = 'ink';
  let weight = 600;
  if (primary && clean(ctx)) {
    ops.push({ op: 'rect', ...xywh(b), r: R, fill: 'accent' });
    tone = 'onAccent';
  } else if (primary) {
    ops.push({ op: 'rect', ...inset(b, 2), r: R - 1, fill: 'faint', stroke: 'ink', sw: 2 });
    weight = 700;
  } else {
    ops.push({ op: 'rect', ...inset(b, 1), r: R, fill: selected ? 'soft' : 'none', stroke: clean(ctx) ? 'line' : 'strong' });
  }
  const lines = b.lines && b.lines.length ? b.lines : [''];
  const loading = n.flags.includes('loading');
  // an unknown icon name still takes its slot: the serializer draws a dashed placeholder ring
  const icon = n.attrs.icon ? n.attrs.icon : n.flags.includes('back') ? 'chevron-left' : null;
  const slot = loading || icon ? 24 : 0;
  const tw = Math.max(...lines.map((l) => textWidth(l, FONT.text, 'bold')));
  const total = tw + slot;
  const sx = b.x + Math.max(0, (b.w - total) / 2);
  const cy = b.y + b.h / 2;
  if (loading) ops.push(...spinner(sx + 8, cy, 7, tone === 'onAccent' ? 'onAccent' : 'ink'));
  else if (icon) ops.push({ op: 'icon', name: icon, x: sx, y: cy - 9, size: 18, tone: tone === 'onAccent' ? 'onAccent' : 'ink' });
  const top = b.y + (b.h - lines.length * 20) / 2;
  ops.push(...textBlock(lines, { x: sx + slot, y: top, w: tw, size: FONT.text, lh: 20, weight, tone: loading ? (tone === 'ink' ? 'muted' : tone) : tone, align: 'center' }));
  return ops;
}

function field(b, ctx) {
  const n = b.node;
  const k = n.kind;
  const R = ctx.look.radius.control;
  const ops = [];
  ops.push(...textBlock(b.lines, { x: b.x, y: b.y, w: b.w, size: FONT.small, lh: S.fieldLabel, weight: 500, tone: 'strong' }));
  const fy = b.fieldY ?? b.y;
  const fh = k === 'textarea' ? Math.max(S.field, num(n.attrs.rows, 3) * S.textareaRow + 22) : S.field;
  const err = typeof n.attrs.error === 'string' && n.attrs.error !== '';
  const disabled = n.flags.includes('disabled');
  ops.push({
    op: 'rect', ...inset({ x: b.x, y: fy, w: b.w, h: fh }, err ? 1.5 : 1), r: R,
    fill: disabled ? 'faint' : 'none', stroke: err ? 'bad' : 'line', sw: err ? 1.5 : 1,
  });
  let tx = b.x + 12;
  let room = b.w - 24;
  if (n.attrs.type === 'search') {
    ops.push({ op: 'icon', name: 'search', x: b.x + 12, y: fy + fh / 2 - 8, size: 16, tone: 'muted' });
    tx += 24; room -= 24;
  }
  if (k === 'select') {
    ops.push({ op: 'icon', name: 'chevron-down', x: b.x + b.w - 28, y: fy + 14, size: 16, tone: 'muted' });
    room -= 24;
  }
  const ph = typeof n.attrs.placeholder === 'string' ? n.attrs.placeholder : '';
  const first = k === 'select' && typeof n.attrs.options === 'string' ? (n.attrs.options.split(',').map((s) => s.trim()).filter(Boolean)[0] || '') : '';
  const top = k === 'textarea' ? fy + 11 : fy + (fh - LINE.text) / 2;
  if (ph) {
    const rows = k === 'textarea' ? Math.max(1, Math.min(50, Math.floor((fh - 22) / LINE.text))) : 1;
    const lines = [fit(ph, FONT.text, room)].slice(0, rows);
    ops.push(...textBlock(lines, { x: tx, y: top, w: room, size: FONT.text, lh: LINE.text, tone: 'hint' }));
  } else if (first) {
    ops.push(...textBlock([fit(first, FONT.text, room)], { x: tx, y: top, w: room, size: FONT.text, lh: LINE.text, tone: 'strong' }));
  } else if (n.attrs.type === 'password') {
    const count = Math.max(0, Math.min(10, Math.floor(room / 12)));
    for (let i = 0; i < count; i++) ops.push({ op: 'circle', cx: tx + 4 + i * 12, cy: fy + fh / 2, r: 3.5, fill: 'strong' });
  }
  if (err) {
    ops.push({ op: 'icon', name: 'x', x: b.x, y: fy + fh + 3, size: 12, tone: 'bad' });
    ops.push(...textBlock([fit(n.attrs.error, FONT.small, b.w - 18)], { x: b.x + 17, y: fy + fh, w: b.w - 18, size: FONT.small, lh: S.fieldError, weight: 500, tone: 'bad' }));
  }
  return ops;
}

function choiceLabel(b, x0) {
  const lines = b.lines || [];
  const top = b.y + Math.max(0, (b.h - lines.length * LINE.text) / 2);
  return textBlock(lines, { x: b.x + x0, y: top, w: b.w - x0, size: FONT.text, lh: LINE.text, tone: 'strong' });
}

function checkbox(b, ctx) {
  const n = b.node;
  const on = n.flags.includes('checked');
  const cy = b.y + Math.min(b.h, S.check) / 2;
  const box = { x: b.x + 3, y: cy - 9, w: 18, h: 18 };
  const r = clean(ctx) ? 5 : 4;
  const ops = [];
  if (on && clean(ctx)) ops.push({ op: 'rect', ...box, r, fill: 'accent' });
  else ops.push({ op: 'rect', ...inset(box, 1.5), r, fill: on ? 'soft' : 'none', stroke: on ? 'ink' : 'strong', sw: 1.5 });
  if (on) ops.push({ op: 'icon', name: 'check', x: box.x + 2, y: box.y + 2, size: 14, tone: clean(ctx) ? 'onAccent' : 'ink' });
  return ops.concat(choiceLabel(b, 32));
}

function radio(b, ctx) {
  const n = b.node;
  const on = n.flags.includes('checked') || n.flags.includes('selected');
  const cy = b.y + Math.min(b.h, S.check) / 2;
  const cx = b.x + 12;
  const ops = [{ op: 'circle', cx, cy, r: 8.5, stroke: on ? (clean(ctx) ? 'accent' : 'ink') : 'strong', sw: 1.5 }];
  if (on) ops.push({ op: 'circle', cx, cy, r: 4.5, fill: clean(ctx) ? 'accent' : 'solid' });
  return ops.concat(choiceLabel(b, 32));
}

function toggle(b, ctx) {
  const n = b.node;
  const on = n.flags.includes('on');
  const cy = b.y + Math.min(b.h, S.check) / 2;
  const track = { x: b.x, y: cy - 12, w: S.toggleW, h: 24 };
  const kx = on ? track.x + track.w - 12 : track.x + 12;
  const ops = [];
  if (clean(ctx)) {
    ops.push({ op: 'rect', ...track, r: 12, fill: on ? 'accent' : 'mid' });
    ops.push({ op: 'circle', cx: kx, cy, r: 9, fill: 'onAccent' });
  } else {
    ops.push({ op: 'rect', ...inset(track, 1.5), r: 11.5, fill: on ? 'soft' : 'none', stroke: on ? 'ink' : 'strong', sw: 1.5 });
    ops.push({ op: 'circle', cx: kx, cy, r: 7, fill: on ? 'solid' : 'mid' });
  }
  return ops.concat(choiceLabel(b, S.toggleW + 10));
}

export const CONTROL_PAINT = { button, input: field, textarea: field, select: field, checkbox, radio, toggle };
