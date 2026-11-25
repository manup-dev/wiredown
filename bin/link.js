// Playground links: the block's text deflate-raw compressed into the URL hash, exactly as
// playground/share.js encodes it (`#v1:` + base64url, no padding). The playground never sends the
// hash to a server. test/link.test.js decodes these links with the playground's own decodeShare.
import { deflateRawSync } from 'node:zlib';
import { mockPatch, parseMock, WM_LIMITS } from '../src/index.js';

export const PLAYGROUND_URL = 'https://manup-dev.github.io/wiredown/';

/** The info string's look= (the last one wins, as in the parser), or null. */
function infoLook(info) {
  let look = null;
  for (const w of String(info ?? '').split(/\s+/)) if (w.startsWith('look=')) look = w.slice(5);
  return look === 'wire' || look === 'clean' ? look : null;
}

/** True when the info string asks for the prototype view, which a link does not carry. */
export const wantsPrototype = (info) => String(info ?? '').split(/\s+/).includes('view=prototype');

/**
 * The text the link carries. The playground reads only the text, so a fence's look= becomes an
 * @look header (the fence's look= wins over @look, so the drawing is the same).
 */
export function linkText(source, info) {
  const look = infoLook(info);
  if (!look || !parseMock(source, info).ok) return source;
  const r = mockPatch(source, { header: 'look', value: look });
  return r.ok ? r.body : source;
}

/** The playground link for one block, or null when the text is over the one-block limit. */
export function playgroundLink(source, info = 'wiredown') {
  const text = linkText(String(source), info);
  if (text.length > WM_LIMITS.body) return null;
  return `${PLAYGROUND_URL}#v1:${deflateRawSync(Buffer.from(text, 'utf8')).toString('base64url')}`;
}
