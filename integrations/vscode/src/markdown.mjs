// markdown.mjs: vscode-free pieces of the extension (unit-tested in node).
import { wiremarkPlugin, renderMockBlock, WIREMARK_CSS } from 'wiremark';
import { findFences } from 'wiremark/fences';

export function extendMarkdownIt(md) { wiremarkPlugin(md); return md; }

// Full HTML page for the preview panel. Markdown files draw each wiremark fence; .wiremark files draw the whole text.
export function previewHtml(text, languageId) {
  const blocks = languageId === 'wiremark'
    ? [renderMockBlock(text, 'wiremark', { blockIndex: 0 })]
    : findFences(text).map((f, i) => renderMockBlock(f.body, f.info, { blockIndex: i }));
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">` +
    `<style>${WIREMARK_CSS} body{color:var(--vscode-editor-foreground);--wm-bg:var(--vscode-editor-background)}</style>${blocks.join('\n')}`;
}
