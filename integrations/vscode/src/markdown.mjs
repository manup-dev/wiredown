// markdown.mjs: vscode-free pieces of the extension (unit-tested in node).
import { wiredownPlugin, renderMockBlock, WIREDOWN_CSS } from 'wiredown';
import { findFences } from 'wiredown/fences';

export function extendMarkdownIt(md) { wiredownPlugin(md); return md; }

// Full HTML page for the preview panel. Markdown files draw each wiredown fence; .wiredown files draw the whole text.
export function previewHtml(text, languageId) {
  const blocks = languageId === 'wiredown'
    ? [renderMockBlock(text, 'wiredown', { blockIndex: 0 })]
    : findFences(text).map((f, i) => renderMockBlock(f.body, f.info, { blockIndex: i }));
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">` +
    `<style>${WIREDOWN_CSS} body{color:var(--vscode-editor-foreground);--wm-bg:var(--vscode-editor-background)}</style>${blocks.join('\n')}`;
}
