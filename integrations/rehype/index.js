// rehype-wiredown: wiredown/screens code fences become the core's static SVG figure (hast).
import { visit, SKIP } from 'unist-util-visit';
import { fromHtml } from 'hast-util-from-html';
import { toString } from 'hast-util-to-string';
import { renderMockBlock, isWiredownLang, messageCard, MSG, MAX_BLOCKS_PER_DOC } from 'wiredown';

const langOf = (code) => {
  const cls = code.properties?.className ?? [];
  for (const c of cls) { const m = /^language-(.+)$/.exec(String(c)); if (m && isWiredownLang(m[1])) return m[1]; }
  return null;
};

export default function rehypeWiredown(options = {}) {
  return (tree) => {
    let index = 0;
    visit(tree, 'element', (node, i, parent) => {
      if (node.tagName !== 'pre' || !parent || i === undefined) return;
      const kids = node.children.filter((c) => c.type !== 'text' || c.value.trim() !== '');
      const code = kids.length === 1 && kids[0].type === 'element' && kids[0].tagName === 'code' ? kids[0] : null;
      const lang = code && langOf(code);
      if (!lang) return;
      const meta = String(code.data?.meta ?? code.properties?.metastring ?? '').trim();
      const info = [lang, options.info ?? '', meta].filter(Boolean).join(' ');
      const n = index++;
      const html = n >= MAX_BLOCKS_PER_DOC ? messageCard(MSG.tooMany) : renderMockBlock(toString(code), info, { blockIndex: n });
      const frag = fromHtml(html, { fragment: true, space: 'html' });
      parent.children.splice(i, 1, ...frag.children);
      return [SKIP, i + frag.children.length];
    });
  };
}
