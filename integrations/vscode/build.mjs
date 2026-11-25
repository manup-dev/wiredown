import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('media', { recursive: true });
const css = readFileSync(new URL('../../wiredown.css', import.meta.url), 'utf8');
writeFileSync('media/preview.css', css + '\n.markdown-body .wm, .vscode-body .wm { --wm-bg: var(--vscode-editor-background); }\n');

await build({ entryPoints: ['src/extension.js'], bundle: true, platform: 'node', format: 'cjs', target: 'node18', external: ['vscode'], outfile: 'dist/extension.js', minify: true });
