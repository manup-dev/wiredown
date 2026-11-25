// The animated flow: one standalone SVG file that plays a block's flow (flowPath) screen by screen,
// for a README or a slide (it plays as <img src>). Not spliced into a page, so it may hold ONE
// <style> of generated CSS and nested <svg>; still no script, foreignObject, image, on*, href,
// url( or @import. Each step is the screen's own drawing (renderScreenSvg) with its links made
// plain groups; author text reaches the file only through that renderer and escapeXml.
// renderFlowFrame draws the same geometry at one moment, with no <style>, for GIF encoders.
import { parseMock } from '../parse.js';
import { renderScreenSvg } from '../screen.js';
import { layoutScreen } from '../layout.js';
import { escapeXml as esc } from '../escape.js';
import { textWidth } from '../measure.js';
import { ACCENT } from '../looks.js';
import { FONT_FAMILY } from '../svg.js';
import { MSG, SHOWN_ERRORS } from '../card.js';
import { pathOf } from './flowpath.js';
import { timeline, stateAt, keyframesCss, frameAttrs, fmt } from './timeline.js';

export const MAX_ANIMATION_BYTES = 2 * 1024 * 1024;
const PAD = 16;
const BAND = 40;
const TOP = 22; // the screen drawing's band above its frame (the "Mock" label)
// Paper and ink. The animation is light, with one constant dark-mode block in its <style> (the
// classes wm-p and wm-i mark paper and ink); a frame takes theme: 'dark' and swaps the constants.
const LIGHT = { paper: '#fff', ink: '#1f2328', root: '' };
const DARK = { paper: '#0d1117', ink: '#e6edf3', root: ' color="#e6edf3" style="--wm-bg:#0d1117"' };
const DARK_CSS = `@media (prefers-color-scheme:dark){svg{color-scheme:dark;color:${DARK.ink};--wm-bg:${DARK.paper}}` +
  `.wm-p{fill:${DARK.paper}}.wm-i{fill:${DARK.ink}}}`;
const TOO_LARGE = 'This flow is too large to animate (over 2 MB). Animate a smaller block.';
// Part kinds: screens (s), their caption and dot (l), the tap's finger dot (f) and released ring
// (r): track list and keyframe letter.
const TRACKS = { s: 'screens', l: 'labels', f: 'dots', r: 'rings' };
const KEYFRAMES = { s: 'a', l: 'b', f: 'd', r: 'c' };

/** frame: options for renderFlowFrame (no <style>, `theme` read); else for the animation. */
function options(o, frame) {
  const v = o && typeof o === 'object' ? o : {};
  const step = Number.isFinite(v.step) && v.step >= 0.5 && v.step <= 30 ? v.step : 2.6;
  const tr = Number.isFinite(v.transition) && v.transition >= 0 ? v.transition : 0.45;
  const pal = frame && v.theme === 'dark' ? DARK : LIGHT;
  return { step, transition: Math.min(tr, step * 0.4), credit: v.credit !== false, icons: v.icons, pal, frame: !!frame };
}

// UTF-8 bytes of a string, counted without building it.
function utf8Len(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c <= 0xdbff ? (i++, 4) : 3;
  }
  return n;
}

function head(w, h, title, o, cls = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg"${cls} viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"` +
    ` aria-label="${esc(title)}" font-family="${esc(FONT_FAMILY)}"${o.frame ? o.pal.root : ''}><title>${esc(title)}</title>`;
}

/** True for the refusal SVG (does not parse, cannot be drawn, too large): its root says so. */
export const isFlowError = (svg) => typeof svg === 'string' && svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" class="wm-error"');

/** A parse failure (or a flow that cannot be drawn) as a small SVG, the error card's words. */
export function errorSvg(errors, o = options()) {
  const list = Array.isArray(errors) ? errors.filter((e) => e && typeof e === 'object') : [];
  const lines = list.length > 1 ? [list.length > SHOWN_ERRORS ? `${list.length} problems; the first ${SHOWN_ERRORS}:` : `${list.length} problems:`] : [];
  for (const e of list.slice(0, SHOWN_ERRORS)) {
    const n = Number(e.line);
    const msg = String(typeof e.message === 'string' ? e.message : '').slice(0, 120);
    lines.push(Number.isInteger(n) && n >= 1 ? `line ${n}: ${msg}` : msg);
  }
  if (!lines.length) lines.push(MSG.failed);
  const h = 44 + lines.length * 20;
  const { paper, ink } = o.pal;
  let out = head(560, h, 'Screens: error', o, ' class="wm-error"') + (o.frame ? '' : `<style>${DARK_CSS}</style>`) +
    `<rect x=".5" y=".5" width="559" height="${h - 1}" rx="8" class="wm-p" fill="${paper}" stroke="${ink}" stroke-opacity=".35"/>` +
    `<text x="16" y="28" font-size="14" font-weight="700" class="wm-i" fill="${ink}">Screens</text>`;
  lines.forEach((l, i) => { out += `<text x="16" y="${52 + i * 20}" font-size="13" class="wm-i" fill="${ink}">${esc(l)}</text>`; });
  return out + '</svg>';
}

// The box of node `node` in a layout tree, or null.
function boxOf(b, node, depth = 0) {
  if (!b || depth > 64) return null;
  if (b.node === node) return b;
  for (const c of b.children) { const hit = boxOf(c, node, depth + 1); if (hit) return hit; }
  return null;
}

function nodeById(n, id, depth = 0) {
  if (!n || depth > 64) return null;
  if (n.id === id) return n;
  for (const c of n.children || []) { const hit = nodeById(c, id, depth + 1); if (hit) return hit; }
  return null;
}

// The screen drawing as a nested <svg> placed at (x, y): the root tag rebuilt from constants and
// numbers, every <a href> turned into a plain <g> (a file has nowhere to go).
function placed(svg, x, y, w, h) {
  const open = svg.indexOf('>');
  const inner = svg.slice(open + 1).replace(/<a href="#wm-[^"]*">/g, '<g>').replace(/<\/a>/g, '</g>');
  return `<svg x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" viewBox="-1 -${TOP} ${fmt(w)} ${fmt(h)}">` + inner;
}

// A caption cut to `max` px with …, by code point (never half a surrogate pair).
const clip = (text, max) => {
  const t = Array.from(String(text));
  if (textWidth(t.join(''), 13, 600) <= max) return t.join('');
  while (t.length > 1 && textWidth(t.join('') + '…', 13, 600) > max) t.pop();
  return t.join('') + '…';
};

/** The geometry and tracks of a flow, or { error } (an SVG). */
function build(body, info, o) {
  const r = parseMock(body, typeof info === 'string' ? info : '');
  if (!r.ok) return { error: errorSvg(r.errors, o) };
  const mock = r.mock;
  const steps = mock.screens.length ? pathOf(mock) : [];
  if (!steps.length) return { error: errorSvg([{ line: 0, message: MSG.empty }], o) };
  const drawn = [];
  let bytes = 0;
  for (const st of steps) {
    const screen = mock.screens[st.index];
    const svg = renderScreenSvg(mock, st.index, 0, o.icons);
    if (!svg) return { error: errorSvg([{ line: 0, message: MSG.failed }], o) };
    bytes += utf8Len(svg);
    if (bytes > MAX_ANIMATION_BYTES) return { error: errorSvg([{ line: 0, message: TOO_LARGE }], o) };
    const lay = layoutScreen(screen, mock.device);
    const motion = (screen.root && screen.root.attrs && screen.root.attrs.motion) || mock.motion || 'fade';
    drawn.push({ st, screen, svg, lay, motion, w: lay.width + 2, h: lay.height + TOP + 1 });
  }
  const aw = Math.max(...drawn.map((d) => d.w));
  const ah = Math.max(...drawn.map((d) => d.h));
  const cw = Math.max(280, aw + 2 * PAD);
  const wh = ah + PAD;
  const ch = wh + BAND;
  for (const d of drawn) { d.x = Math.round((cw - d.w) / 2); d.y = PAD; }
  const taps = drawn.map((d, k) => {
    const next = drawn[k + 1];
    if (!next || !next.st.via) return null;
    const b = boxOf(d.lay.root, nodeById(d.screen.root, next.st.via));
    return b ? { cx: d.x + 1 + b.x + b.w / 2, cy: d.y + TOP + b.y + b.h / 2 } : null;
  });
  const tl = timeline(drawn.map((d) => d.motion), o.step, o.transition, (k) => !!taps[k]);
  const title = typeof mock.title === 'string' && mock.title ? mock.title : steps[0].label;
  return { drawn, taps, tl, cw, wh, ch, title, n: drawn.length };
}

// Every part of the picture, in paint order: { track, cx, cy, draw(at) }, { fixed } or the end
// of the screens window. `at(cls)` writes the part's class (its own plus the animation's) and the
// frame's computed opacity/transform.
function parts(m, o) {
  const out = [];
  const { paper, ink } = o.pal;
  const add = (cls, k, cx, cy, draw) => out.push({ cls, k, track: m.tl[TRACKS[cls]][k], cx, cy, draw });
  m.drawn.forEach((d, k) => {
    add('s', k, d.x + d.w / 2, d.y + d.h / 2, (at) => `<g${at('')}>` +
      `<rect x="${fmt(d.x + 1)}" y="${fmt(d.y + TOP)}" width="${fmt(d.w - 2)}" height="${fmt(d.h - TOP - 1)}" class="wm-p" fill="${paper}"/>` +
      placed(d.svg, d.x, d.y, d.w, d.h) + '</g>');
  });
  m.taps.forEach((g, k) => {
    if (!g) return;
    const c = `cx="${fmt(g.cx)}" cy="${fmt(g.cy)}" r="16"`;
    add('f', k, g.cx, g.cy, (at) => `<circle ${c} fill="${ACCENT}" fill-opacity=".5"${at('')}/>`);
    add('r', k, g.cx, g.cy, (at) => `<circle ${c} fill="none" stroke="${ACCENT}" stroke-width="3" stroke-opacity=".75"${at('')}/>`);
  });
  out.push({ window: true });
  const by = m.wh + 17;
  m.drawn.forEach((d, k) => {
    add('l', k, 0, 0, (at) => `<text x="${fmt(m.cw / 2)}" y="${by}" font-size="13" font-weight="600" text-anchor="middle"` +
      ` fill="${ink}"${at('wm-i')}>${esc(clip(d.st.label, m.cw - 150))}</text>`);
  });
  if (m.n > 1) {
    const x0 = m.cw / 2 - ((m.n - 1) * 12) / 2;
    const dot = (k) => `<circle cx="${fmt(x0 + k * 12)}" cy="${m.wh + 30}" r="3" fill="${ink}"`;
    let dots = '';
    for (let k = 0; k < m.n; k++) dots += `${dot(k)} fill-opacity=".2" class="wm-i"/>`;
    out.push({ fixed: dots });
    m.drawn.forEach((d, k) => add('l', k, 0, 0, (at) => `${dot(k)}${at('wm-i')}/>`));
  }
  if (o.credit) out.push({ fixed: `<text x="${fmt(m.cw - 8)}" y="${m.ch - 6}" font-size="10" text-anchor="end" class="wm-i" fill="${ink}" opacity=".45">wiredown</text>` });
  return out;
}

// attrsFor(part) → { cls, attrs } (cls: the animation's classes; attrs: the frame's values), or
// null to leave the part out (invisible in a frame).
function assemble(m, o, attrsFor, style) {
  let out = head(m.cw, m.ch, m.title, o) + style + `<rect width="${m.cw}" height="${m.ch}" class="wm-p" fill="${o.pal.paper}"/>` +
    `<svg x="0" y="0" width="${m.cw}" height="${fmt(m.wh)}">`;
  for (const p of parts(m, o)) {
    if (p.window) { out += '</svg>'; continue; }
    if (p.fixed) { out += p.fixed; continue; }
    const a = attrsFor(p);
    if (a === null) continue;
    out += p.draw((own) => {
      const cls = [own, a.cls].filter(Boolean).join(' ');
      return (cls ? ` class="${cls}"` : '') + a.attrs;
    });
  }
  out += '</svg>';
  return utf8Len(out) > MAX_ANIMATION_BYTES ? errorSvg([{ line: 0, message: TOO_LARGE }], o) : out;
}

/** body + info → a standalone animated SVG string (or an error SVG). Never throws. */
export function renderFlowAnimation(body, info, opts) {
  try {
    const o = options(opts);
    const m = build(body, info, o);
    if (m.error) return m.error;
    const T = m.tl.total;
    let css = `.wm-k{animation-duration:${fmt(T)}s;animation-iteration-count:infinite;animation-timing-function:ease-out}`;
    const done = new Set();
    for (const p of parts(m, o)) {
      const name = `${p.cls}${p.k}`;
      if (!p.track || done.has(name)) continue;
      done.add(name);
      // Without the animation (reduced motion) only step 0 and its label show.
      const base = p.cls === 'r' || p.cls === 'f' || p.k > 0 ? ';opacity:0' : '';
      const moves = p.cls !== 'l';
      css += `.wm-${name}{animation-name:wm-${KEYFRAMES[p.cls]}${p.k}${base}${moves ? `;transform-origin:${fmt(p.cx)}px ${fmt(p.cy)}px` : ''}}`;
      css += keyframesCss(`wm-${KEYFRAMES[p.cls]}${p.k}`, p.track, T, moves);
    }
    css += '@media (prefers-reduced-motion:reduce){.wm-k{animation:none!important}}' + DARK_CSS;
    return assemble(m, o, (p) => ({ cls: p.track ? `wm-k wm-${p.cls}${p.k}` : '', attrs: '' }), `<style>${css}</style>`);
  } catch {
    return errorSvg([{ line: 0, message: MSG.failed }]);
  }
}

/** The same picture at `at` seconds (wrapped to the loop), with no <style>. Never throws. */
export function renderFlowFrame(body, info, opts) {
  try {
    const o = options(opts, true);
    const m = build(body, info, o);
    if (m.error) return m.error;
    const T = m.tl.total;
    const at0 = Number(opts && opts.at);
    const at = Number.isFinite(at0) ? ((at0 % T) + T) % T : 0;
    return assemble(m, o, (p) => {
      const attrs = p.track ? frameAttrs(stateAt(p.track, at), p.cx, p.cy) : '';
      return attrs === null ? null : { cls: '', attrs };
    }, '');
  } catch {
    return errorSvg([{ line: 0, message: MSG.failed }], options(opts, true));
  }
}

/** Seconds one loop of the animation lasts: steps x step, nominal (0 when the block does not parse). Never throws. */
export function flowDuration(body, info, opts) {
  try {
    const o = options(opts);
    const r = parseMock(body, typeof info === 'string' ? info : '');
    return r.ok && r.mock.screens.length ? Math.round(pathOf(r.mock).length * o.step * 1000) / 1000 : 0;
  } catch {
    return 0;
  }
}
