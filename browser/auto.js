// Draws every wiremark/screens code block on a page.
//   <script type="module" src=".../browser/auto.js"></script>
// Add data-wiremark-manual to the script tag to call render() yourself.
// blockIndex keeps drawn ids unique across blocks on one page.
// Imports only ../src/index.js (relative) so it works unbuilt from a CDN.
import { renderMockBlock } from '../src/index.js';

const SELECTOR = ['pre > code.language-wiremark', 'pre > code.language-screens', 'pre > code.lang-wiremark', 'pre > code.lang-screens',
  'pre.language-wiremark', 'pre.language-screens', 'pre.lang-wiremark', 'pre.lang-screens',
  'div.language-wiremark pre', 'div.language-screens pre'].join(',');
const CONTAINER = 'div.language-wiremark, div.language-screens';
let count = 0;

function addStyles(doc) {
  if (doc.querySelector('link[data-wiremark]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet'; link.href = new URL('../wiremark.css', import.meta.url).href; link.setAttribute('data-wiremark', '');
  doc.head.appendChild(link);
}

export function render(root = document) {
  const doc = root.ownerDocument ?? root;
  let n = 0;
  for (const el of root.querySelectorAll(SELECTOR)) {
    const pre = el.tagName === 'PRE' ? el : el.parentElement;
    if (!pre || !pre.isConnected) continue; // already replaced (a pre can match twice)
    // Line-number tables (Chroma) have two pre in one container: the code is in the last.
    const box = pre.closest(CONTAINER);
    if (box) { const all = box.querySelectorAll('pre'); if (all[all.length - 1] !== pre) continue; }
    const code = el.tagName === 'CODE' ? el : el.querySelector('code') ?? el;
    const info = (code.getAttribute('data-meta') || pre.getAttribute('data-meta') || 'wiremark').trim();
    const tpl = doc.createElement('template');
    // The library's output is trusted: escaped text, allowlisted SVG, no script.
    tpl.innerHTML = renderMockBlock(code.textContent ?? '', info, { blockIndex: count++ });
    pre.replaceWith(tpl.content);
    n++;
  }
  if (n) addStyles(doc);
  return n;
}

const clean = (u) => String(u).split('#')[0].split('?')[0];

// Finds the <script type="module"> that loaded this file. Exact match first (query and
// fragment ignored); else, because CDNs redirect (wiremark@0.1 -> wiremark@0.1.3), the one
// module tag whose path ends in /browser/auto.js. Two such tags: none claims it.
export function findOwnScript(doc, moduleUrl) {
  // A malformed src on some other script tag must never stop this one from drawing: skip it.
  const resolved = [];
  for (const s of doc.querySelectorAll('script[type="module"]')) {
    const src = s.getAttribute('src');
    if (!src) continue;
    try { resolved.push({ s, url: new URL(src, doc.baseURI) }); } catch { /* skip this tag */ }
  }
  const exact = resolved.find((t) => clean(t.url.href) === clean(moduleUrl));
  if (exact) return exact.s;
  const like = resolved.filter((t) => t.url.pathname.endsWith('/browser/auto.js'));
  return like.length === 1 ? like[0].s : null;
}

const script = typeof document !== 'undefined' ? findOwnScript(document, import.meta.url) : null;
if (script && !script.hasAttribute('data-wiremark-manual')) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => render(document), { once: true });
  else render(document);
}
