import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'cjs',
  target: 'es2020',
  external: ['obsidian'],
  outfile: 'main.js',
  minify: true,
});

// The core stylesheet, with the host's page background as the opaque surface.
writeFileSync('styles.css', readFileSync('../../wiremark.css', 'utf8') + '.wm{--wm-bg:var(--background-primary)}\n');
