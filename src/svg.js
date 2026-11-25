// Ops → one <svg> string. The ONLY place markup is written: every attribute value and every
// text is escaped here, tags and attribute names are constants, colours come only from look tokens.
import { escapeXml as esc, px } from './escape.js';
import { lookOf, fillToken, strokeToken } from './looks.js';
import { resolveIcon } from './packs.js';

export const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SCREEN_ID = /^[a-z][a-z0-9-]{0,63}$/;
const PATH_D = /^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]*$/;
// The only style parts ever written: the accent (fill or stroke) and the surface fill.
const STYLE_FILL = /^fill:var\(--wm-(accent,#[0-9a-f]{6}|bg,Canvas)\)$/;
const STYLE_STROKE = /^stroke:var\(--wm-accent,#[0-9a-f]{6}\)$/;

/** ' style="…"' from at most one fill part and one stroke part, each an approved form; else ''. */
export function styleAttr(fill, stroke) {
  const parts = [];
  if (typeof fill === 'string' && STYLE_FILL.test(fill)) parts.push(fill);
  if (typeof stroke === 'string' && STYLE_STROKE.test(stroke)) parts.push(stroke);
  return parts.length ? ` style="${esc(parts.join(';'))}"` : '';
}

// The one style on the root <svg>, a constant: shrink to the column with no host stylesheet.
export const ROOT_STYLE = 'max-width:100%;height:auto';
const TOP = 22; // band above the frame for the "Mock" label
const OPACITY = { '.3': '.3', '.35': '.35', '.45': '.45', '.5': '.5', '.6': '.6' };

function paintAttrs(look, fill, stroke, sw, dash, cap) {
  const f = fillToken(look, fill) || fillToken(look, 'none');
  const s = strokeToken(look, stroke);
  let out = ' ' + f.attrs;
  if (s && stroke !== 'none') {
    out += ' ' + s.attrs;
    const w = Number(sw);
    if (Number.isFinite(w) && w > 0 && w !== 1) out += ` stroke-width="${px(Math.min(w, 8))}"`;
    if (dash) out += ' stroke-dasharray="4 3"';
    if (cap) out += ' stroke-linecap="round" stroke-linejoin="round"';
  }
  out += styleAttr(f.style, s && stroke !== 'none' ? s.style : undefined);
  return out;
}

const weightOf = (w) => {
  const n = Math.round(Number(w) / 100) * 100;
  return Number.isFinite(n) && n >= 500 && n <= 800 ? ` font-weight="${n}"` : '';
};
const sizeOf = (s) => px(Math.max(6, Math.min(96, Number(s) || 15)));

function textEl(o, look) {
  const anchor = o.anchor === 'middle' || o.anchor === 'end' ? ` text-anchor="${o.anchor}"` : '';
  const head = `<text x="${px(o.x)}" y="${px(o.y)}" font-size="${sizeOf(o.size)}"${weightOf(o.weight)}${anchor}` +
    `${paintAttrs(look, o.tone || 'ink', null)}>`;
  if (Array.isArray(o.lines)) {
    if (o.lines.length === 1) return head + esc(o.lines[0]) + '</text>';
    const lh = px(o.lh || 20);
    return head + o.lines.map((l, i) => `<tspan x="${px(o.x)}"${i ? ` dy="${lh}"` : ''}>${esc(l)}</tspan>`).join('') + '</text>';
  }
  return head + esc(o.text) + '</text>';
}

function iconEl(o, look, ctx) {
  const size = Math.max(8, Math.min(96, Number(o.size) || 24));
  const hit = resolveIcon(o.name, Number(o.x) || 0, Number(o.y) || 0, size, ctx.icons);
  const d = hit && hit.d;
  const sw = Math.max(1, Math.round((size / 12) * (hit ? hit.w : 2)) / 2);
  if (!hit) {
    const r = size / 2 - 1;
    return `<circle cx="${px(o.x + size / 2)}" cy="${px(o.y + size / 2)}" r="${px(r)}"${paintAttrs(look, 'none', o.tone || 'strong', 1.5, true)}/>`;
  }
  return `<path d="${esc(d)}"${paintAttrs(look, 'none', o.tone || 'ink', sw, false, true)}/>`;
}

const NUMERIC = ['x', 'y', 'w', 'h', 'r', 'cx', 'cy', 'x1', 'y1', 'x2', 'y2', 'size', 'sw', 'lh'];

// One copy with every numeric field coerced, so a string coordinate never concatenates.
function coerce(src) {
  const o = { ...src };
  for (const k of NUMERIC) if (k in o) { const v = Number(o[k]); o[k] = Number.isFinite(v) ? v : 0; }
  return o;
}

function opEl(raw, look, ctx, depth) {
  if (!raw || typeof raw !== 'object' || depth > 64) return '';
  const o = coerce(raw);
  switch (o.op) {
    case 'rect': {
      const rx = Number(o.r) > 0 ? ` rx="${px(o.r)}"` : '';
      return `<rect x="${px(o.x)}" y="${px(o.y)}" width="${px(Math.max(0, o.w))}" height="${px(Math.max(0, o.h))}"${rx}` +
        `${paintAttrs(look, o.fill || 'none', o.stroke, o.sw, o.dash)}/>`;
    }
    case 'circle':
      return `<circle cx="${px(o.cx)}" cy="${px(o.cy)}" r="${px(Math.max(0, o.r))}"${paintAttrs(look, o.fill || 'none', o.stroke, o.sw, o.dash)}/>`;
    case 'line':
      return `<line x1="${px(o.x1)}" y1="${px(o.y1)}" x2="${px(o.x2)}" y2="${px(o.y2)}"${paintAttrs(look, 'none', o.stroke || 'line', o.sw, o.dash, o.cap)}/>`;
    case 'path':
      if (typeof o.d !== 'string' || !PATH_D.test(o.d)) return '';
      return `<path d="${esc(o.d)}"${paintAttrs(look, o.fill || 'none', o.stroke, o.sw, o.dash, o.cap)}/>`;
    case 'cross': {
      const x2 = o.x + o.w;
      const y2 = o.y + o.h;
      const a = paintAttrs(look, 'none', o.stroke || 'hair');
      return `<line x1="${px(o.x)}" y1="${px(o.y)}" x2="${px(x2)}" y2="${px(y2)}"${a}/>` +
        `<line x1="${px(o.x)}" y1="${px(y2)}" x2="${px(x2)}" y2="${px(o.y)}"${a}/>`;
    }
    case 'text': return textEl(o, look);
    case 'icon': return iconEl(o, look, ctx);
    case 'group': {
      const el = typeof o.el === 'string' && o.el ? ` data-wm-el="${esc(o.el)}"` : '';
      const op = Object.prototype.hasOwnProperty.call(OPACITY, o.opacity) ? ` opacity="${OPACITY[o.opacity]}"` : '';
      return `<g${el}${op}>${opsEl(o.ops, look, ctx, depth + 1)}</g>`;
    }
    case 'link': {
      const inner = opsEl(o.ops, look, ctx, depth + 1);
      if (typeof o.target !== 'string' || !SCREEN_ID.test(o.target)) return inner;
      return `<a href="#wm-${ctx.block}-${o.target}">${inner}</a>`;
    }
    default: return '';
  }
}

function opsEl(ops, look, ctx, depth) {
  if (!Array.isArray(ops)) return '';
  let out = '';
  for (const o of ops) out += opEl(o, look, ctx, depth);
  return out;
}

/** opts: { width, height, title, blockIndex, screenId, look, icons } (icons: an iconContext). */
export function serializeScreen(ops, opts = {}) {
  const look = lookOf(opts.look);
  const W = Math.max(1, Math.min(100000, Number(opts.width) || 390));
  const H = Math.max(1, Math.min(1000000, Number(opts.height) || 844));
  const bi = Number(opts.blockIndex);
  const block = Number.isInteger(bi) && bi >= 0 && bi <= 9999 ? bi : 0;
  const title = String(opts.title || opts.screenId || 'Screen');
  const r = W < 600 ? look.radius.frameSmall : look.radius.frameLarge;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${px(-1)} ${px(-TOP)} ${px(W + 2)} ${px(H + TOP + 1)}"` +
    ` width="${px(W + 2)}" style="${ROOT_STYLE}" role="img" aria-label="${esc(title)}" font-family="${esc(FONT_FAMILY)}">`;
  const frame = `<rect x=".5" y=".5" width="${px(W - 1)}" height="${px(H - 1)}" rx="${px(r)}"` +
    `${paintAttrs(look, look.name === 'clean' ? 'wash' : 'none', 'line', 1, true)}/>` +
    `<text x="${px(W - 4)}" y="${px(-8)}" font-size="11" font-weight="600" text-anchor="end" letter-spacing=".6"` +
    `${paintAttrs(look, 'muted', null)}>Mock</text>`;
  return head + `<title>${esc(title)}</title>` + frame + opsEl(ops, look, { block, icons: opts.icons }, 0) + '</svg>';
}
