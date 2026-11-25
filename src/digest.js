// Block digests. fnv1a64 is 64-bit FNV-1a in two 32-bit lanes, so the
// package stays dependency-free.
//
// The digest covers the body and the drawing-relevant info keys, NOT the block index. The figure
// HTML embeds the block index in its ids and hotspot hrefs (wm-<n>-<screen>), so a host must not
// cache figure HTML across block positions by digest alone (key on digest + index, or re-render).
// A host that concatenates separately rendered pages into one document (a book's print edition)
// must offset block indexes so ids stay unique across the whole document.

/** Bump when the figure or SVG output changes in a way a cached render must not survive. */
export const WM_RENDER_VERSION = 1;

/** 64-bit FNV-1a as two independent 32-bit lanes over UTF-16 code units; 16 hex characters. */
export function fnv1a64(s) {
  const str = String(s);
  let a = 0x811c9dc5;
  let b = 0xcbf29ce4;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/** The recognised info keys in a fixed order (look, then view; the last occurrence wins, as in
 *  the parser), single-spaced; unknown words, the version word and word order never count.
 *  view=stack is the default and is left out. */
export function infoAttrs(info) {
  let look = null;
  let view = null;
  for (const w of String(info ?? '').split(/\s+/)) {
    if (w.startsWith('look=')) look = w;
    else if (w.startsWith('view=')) view = w === 'view=stack' ? null : w;
  }
  return [look, view].filter(Boolean).join(' ');
}

/** fnv1a64(WM_RENDER_VERSION + '\0' + body), plus '\0' + infoAttrs(info) when that is not empty. */
export function mockDigest(body, info) {
  const attrs = infoAttrs(info);
  return fnv1a64(String(WM_RENDER_VERSION) + '\0' + String(body ?? '') + (attrs ? '\0' + attrs : ''));
}
