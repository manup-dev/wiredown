// A fence body (+ info string) → figure HTML or an error card. Never throws.
import { parseMock } from './parse.js';
import { renderMockHtml } from './html.js';
import { mockDigest } from './digest.js';
import { packsFrom } from './packs.js';
import { renderErrorCard, messageCard, MSG } from './card.js';

export { renderErrorCard };

/** opts: { blockIndex (the fence's number in the document, 0-based), icons (icon packs) }. */
export function renderMockBlock(body, info, opts) {
  try {
    const text = typeof info === 'string' ? info : '';
    const r = parseMock(body, text);
    if (!r.ok) return renderErrorCard(r.errors);
    return renderMockHtml(r.mock, { blockIndex: opts && opts.blockIndex, digest: mockDigest(body, text), icons: packsFrom(opts) });
  } catch {
    return messageCard(MSG.failed);
  }
}
