// A parsed mock → one <figure>: the screens strip (variants beside their screen), the notes
// legend, the text outline. Trusted output (hosts splice it after their sanitizer): tags,
// attribute names and classes are constants, every value is escaped, ids are core-built, and
// no style attribute is written outside the SVG's own approved forms.
import { escapeXml as esc } from './escape.js';
import { WM_LIMITS } from './limits.js';
import { renderScreenSvg } from './screen.js';
import { numberNotes } from './paint.js';
import { storyboard } from './flow.js';
import { outlineHtml } from './outline.js';
import { MSG, messageCard } from './card.js';

const SCREEN_ID = /^[a-z][a-z0-9-]{0,63}$/;
const DIGEST = /^[0-9a-f]{16}$/;

/** The block index exactly as the SVG serializer reads it, so wrapper ids match hotspots. */
export function blockIndexOf(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : 0;
}

const nameOf = (s) => String((s && (s.label || s.id)) || 'Screen');

export function captions(mock) {
  const byId = new Map();
  for (const s of mock.screens) if (s && typeof s.id === 'string' && !byId.has(s.id)) byId.set(s.id, s);
  const cap = (s) => {
    const base = s.variantOf ? byId.get(s.variantOf) : null;
    return base && base !== s ? `${nameOf(base)} · ${nameOf(s)}` : nameOf(s);
  };
  const labelOf = (id) => (byId.has(id) ? nameOf(byId.get(id)) : String(id));
  return { cap, labelOf };
}

function notesHtml(mock) {
  const first = new Map();
  for (const [node, n] of numberNotes(mock)) if (!first.has(n)) first.set(n, node);
  if (!first.size) return '';
  const nums = [...first.keys()].sort((a, b) => a - b);
  let out = '<ol class="wm-notes">';
  for (const n of nums) {
    const node = first.get(n);
    const label = Array.isArray(node.labels) && node.labels[0] ? node.labels[0] : (node.kind === 'unknown' ? node.typed : node.kind);
    out += `<li data-wm-el="${esc(node.id)}"><strong>${esc(label || 'Element')}</strong>: ${esc(node.note)}</li>`;
  }
  return out + '</ol>';
}

/** opts: { blockIndex, digest, icons }. Returns the figure, or an error card (too large, not drawable). */
export function renderMockHtml(mock, opts = {}) {
  try {
    if (!mock || !Array.isArray(mock.screens) || !mock.screens.length) return messageCard(MSG.empty);
    const b = blockIndexOf(opts && opts.blockIndex);
    const look = mock.look === 'clean' ? 'clean' : 'wire';
    const proto = mock.view === 'prototype';
    const { groups, start } = storyboard(mock);
    const { cap, labelOf } = captions(mock);
    const digest = opts && typeof opts.digest === 'string' && DIGEST.test(opts.digest) ? ` data-wm-digest="${opts.digest}"` : '';
    let out = `<figure class="wm wm-look-${look}${proto ? ' wm-proto' : ''}" data-wm-block="${b}"${digest}>`;
    const lone = mock.screens.length === 1 && mock.screens[0] && mock.screens[0].label === mock.title;
    if (typeof mock.title === 'string' && mock.title && !lone) out += `<figcaption class="wm-title">${esc(mock.title)}</figcaption>`;
    out += '<div class="wm-strip">';
    const listed = [];
    for (const g of groups) {
      if (g.length > 1) out += '<div class="wm-variants">';
      for (const i of g) {
        const s = mock.screens[i];
        const svg = renderScreenSvg(mock, i, b, opts && opts.icons);
        if (!svg) return messageCard(MSG.failed);
        const id = typeof s.id === 'string' && SCREEN_ID.test(s.id) ? ` id="wm-${b}-${s.id}"` : '';
        const mo = proto ? (s.root && s.root.attrs && s.root.attrs.motion) || mock.motion : null;
        const cls = (proto && i === start ? 'wm-screen wm-start' : 'wm-screen') + (mo && mo !== 'none' ? ` wm-in-${mo}` : '');
        out += `<div class="${cls}"${id} data-wm-screen="${esc(s.id)}"><div class="wm-cap">${esc(cap(s))}</div>${svg}</div>`;
        listed.push({ screen: s, cap: cap(s) });
        if (out.length > WM_LIMITS.output) return messageCard(MSG.tooLarge);
      }
      if (g.length > 1) out += '</div>';
    }
    out += '</div>' + notesHtml(mock) + outlineHtml(listed, labelOf, numberNotes(mock)) + '</figure>';
    return out.length > WM_LIMITS.output ? messageCard(MSG.tooLarge) : out;
  } catch {
    return messageCard(MSG.failed);
  }
}
