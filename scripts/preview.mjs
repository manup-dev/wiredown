// Developer preview (not a test): renders fixtures to .preview/<fixture>-<screen>-<look>.svg and
// one .preview/index.html showing them all in light and dark, plus full figures (renderMockBlock)
// in .preview/figures-css.html (with WIREMARK_CSS) and .preview/figures-nocss.html (no stylesheet
// for .wm at all), each in light and dark, stack and prototype view. Usage: node scripts/preview.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, basename } from 'node:path';
import { parseMock, renderScreenSvg, renderMockBlock, WIREMARK_CSS } from '../src/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, '.preview');
mkdirSync(out, { recursive: true });
const fixtures = join(root, 'test', 'fixtures');
const cells = [];
for (const file of readdirSync(fixtures).filter((f) => f.endsWith('.wiremark')).sort()) {
  const name = basename(file, '.wiremark');
  const r = parseMock(readFileSync(join(fixtures, file), 'utf8'));
  if (!r.ok) { console.error(name, r.errors); continue; }
  for (const look of ['wire', 'clean']) {
    r.mock.look = look;
    r.mock.screens.forEach((s, i) => {
      const svg = renderScreenSvg(r.mock, i, 0);
      const path = join(out, `${name}-${s.id}-${look}.svg`);
      writeFileSync(path, svg);
      cells.push({ title: `${name} · ${s.id} · ${look}`, svg });
      console.log(path, svg.length);
    });
  }
}
const panel = (theme) => `<section class="${theme}">${cells.map((c) => `<figure><figcaption>${c.title.replace(/</g, '&lt;')}</figcaption>${c.svg}</figure>`).join('')}</section>`;
writeFileSync(join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>wiremark preview</title>
<style>body{margin:0;font:13px system-ui}section{display:flex;flex-wrap:wrap;gap:24px;padding:24px;align-items:flex-start}
.light{background:#f6f7f9;color:#1d2330;--wm-bg:#f6f7f9}.dark{background:#16181d;color:#e6e8ec;--wm-bg:#16181d}figure{margin:0}figcaption{opacity:.6;margin-bottom:6px}
svg{display:block;max-width:440px;height:auto}</style>${panel('light')}${panel('dark')}`);
console.log(join(out, 'index.html'));

// Full figures. Each copy gets its own block index, so ids never collide on one page.
const FIGS = [
  ['login', 'wiremark'], ['login', 'wiremark look=clean'], ['login', 'wiremark view=prototype'],
  ['login', 'wiremark look=clean view=prototype'], ['kinds', 'wiremark'],
];
const sources = Object.fromEntries(readdirSync(fixtures).filter((f) => f.endsWith('.wiremark'))
  .map((f) => [basename(f, '.wiremark'), readFileSync(join(fixtures, f), 'utf8')]));
let block = 0;
const figPanel = (theme) => `<section class="${theme}"><h2>${theme}</h2>` + FIGS.map(([name, info]) =>
  `<article><h3>${name} · <code>${info}</code></h3>${renderMockBlock(sources[name], info, { blockIndex: block++ })}</article>`).join('') +
  `<article><h3>error card</h3>${renderMockBlock('screen a\n  text "unclosed\n  button "b" w=wide\n   text "c"', 'wiremark', { blockIndex: block++ })}</article></section>`;
const page = (withCss) => `<!doctype html><meta charset="utf-8"><title>wiremark figures${withCss ? '' : ' (no stylesheet)'}</title>
<style>body{margin:0;font:15px/1.5 system-ui}section{padding:24px}article{margin:0 0 40px}h3{font-size:13px;opacity:.6}
.light{background:#fff;color:#1d2330;--wm-bg:#fff}.dark{background:#16181d;color:#e6e8ec;--wm-bg:#16181d}
${withCss ? WIREMARK_CSS : ''}</style>${figPanel('light')}${figPanel('dark')}`;
for (const [file, withCss] of [['figures-css.html', true], ['figures-nocss.html', false]]) {
  block = 0;
  writeFileSync(join(out, file), page(withCss));
  console.log(join(out, file));
}
