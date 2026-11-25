// markdown-it plugin. The host passes its markdown-it instance and a `defer(env, html)` that
// stores trusted HTML and returns a placeholder (for example a store the host fills before its sanitizer and swaps back after), so the figure is
// spliced in after the host's sanitizer. The library never imports markdown-it.
import { renderMockBlock } from './render.js';
import { messageCard, MSG } from './card.js';
import { mockDigest } from './digest.js';

export const MAX_BLOCKS_PER_DOC = 50;

/** The fence language as markdown-it consumers read it: info.trim().split(/\s+/)[0]
 *  (any JS white space separates, NBSP included), case-sensitive. */
export function fenceLang(info) {
  return String(info ?? '').trim().split(/\s+/)[0];
}

// `wiremark` was the format's first name; blocks written with it keep drawing.
export const isWiredownLang = (lang) => lang === 'wiredown' || lang === 'screens' || lang === 'wiremark';

const MAX_INDEX = 9999;
/** A host's `env.wmBase`: a non-negative integer (at most 9999), else 0. */
const baseOf = (v) => (Number.isInteger(v) && v >= 0 ? Math.min(v, MAX_INDEX) : 0);

export function wiredownPlugin(md, opts = {}) {
  const defer = opts && typeof opts.defer === 'function' ? opts.defer : (_env, html) => html;
  // A fresh count per render, even when a host reuses its env (a reused env would otherwise keep the last count).
  if (md.core && md.core.ruler && typeof md.core.ruler.push === 'function') {
    md.core.ruler.push('wm_count', (state) => { if (state && state.env && typeof state.env === 'object') state.env.wmCount = 0; });
  }
  const rules = md.renderer.rules;
  const prev = rules.fence || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  rules.fence = (tokens, idx, options, env, self) => {
    const t = tokens[idx];
    if (!isWiredownLang(fenceLang(t.info))) return prev(tokens, idx, options, env, self);
    const scope = env && typeof env === 'object' ? env : {};
    const n = Number.isInteger(scope.wmCount) && scope.wmCount >= 0 ? scope.wmCount : 0;
    scope.wmCount = n + 1;
    // A host that joins separately rendered pages into one document sets
    // env.wmBase per page so ids never repeat; the cap still counts this parse.
    const blockIndex = Math.min(baseOf(scope.wmBase) + n, MAX_INDEX);
    // env.wmMode === 'digest': a host that only needs what a render depends on (never serves the
    // HTML) gets an empty figure carrying the block digest, at the cost of one hash.
    if (scope.wmMode === 'digest') return defer(scope, `<figure class="wm" data-wm-digest="${mockDigest(t.content, t.info)}"></figure>`);
    const html = n >= MAX_BLOCKS_PER_DOC ? messageCard(MSG.tooMany) : renderMockBlock(t.content, t.info, { blockIndex });
    return defer(scope, html);
  };
}
