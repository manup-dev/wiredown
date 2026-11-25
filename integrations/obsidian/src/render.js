// Draws one wiredown or screens fence into a host element as static SVG.
// The core returns trusted figure HTML (escaped text, no script); it is parsed
// and imported as nodes, never assigned to innerHTML.
import { renderMockBlock } from 'wiredown';

// The fence line's look= is not visible to Obsidian (it passes only the language),
// so the plugin setting decides unless the block already names a look.
export const lookInfo = (info, look) => (/\blook=/.test(info) || look === 'wire' ? info : `${info} look=${look}`);

export function drawInto(el, source, info, look, blockIndex) {
  const html = renderMockBlock(source, lookInfo(info, look), { blockIndex });
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  for (const node of [...doc.body.childNodes]) el.appendChild(el.ownerDocument.importNode(node, true));
}
