// The wiredown CLI's commands as functions (bin/wiredown.js only parses argv and exits).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { basename, extname, join, relative, resolve } from 'node:path';
import { lintMock, parseMock, isIconPack, renderScreenSvg, renderMockBlock, escapeXml, AI_CONTRACT, WIREDOWN_CSS } from '../src/index.js';
import { findFences } from '../src/fences.js';
import { toHTML, toOpenUI, flowPath, renderFlowAnimation } from '../src/export/index.js';
import { isFlowError } from '../src/export/animate.js';
import { playgroundLink } from './link.js';
import { marked } from './marker.js';

export class UsageError extends Error {}

/** Icon packs from module specifiers (a path, or a package resolved from the current folder). */
export async function loadPacks(specs) {
  const out = [];
  for (const spec of specs) {
    let mod;
    try {
      const file = /^(\.{0,2}[\\/]|[a-zA-Z]:[\\/])/.test(spec) ? pathToFileURL(resolve(process.cwd(), spec)).href : pathToFileURL(createRequire(join(process.cwd(), 'x.js')).resolve(spec)).href;
      mod = await import(file);
    } catch { throw new UsageError(`cannot load the icon pack ${spec}`); }
    const list = [].concat(mod.default);
    if (!list.length || !list.every(isIconPack)) throw new UsageError(`${spec} does not export an icon pack made by this wiredown (install one copy of wiredown, or pass a pack built with it)`);
    out.push(...list);
  }
  return out;
}

/** Blocks of a file: a .wiredown file is one block; markdown is its fences. */
export function blocksOf(path) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { throw new UsageError(`cannot read ${path}`); }
  if (/\.(md|markdown|mdx)$/i.test(path)) return findFences(text).map((f) => ({ body: f.body, info: f.info, bodyLine: f.bodyLine, openLine: f.openLine }));
  return [{ body: text, info: 'wiredown', bodyLine: 1, openLine: 1 }];
}

export function lint(paths, { icons } = {}) {
  const out = [];
  for (const path of paths) for (const b of blocksOf(path)) for (const p of lintMock(b.body, b.info, { icons })) {
    out.push({ file: path, line: p.line > 0 ? b.bodyLine + p.line - 1 : b.openLine, column: p.column || 1, severity: p.severity, code: p.code, message: p.message });
  }
  return out;
}

export const formatProblem = (p) => `${relative(process.cwd(), p.file) || p.file}:${p.line}:${p.column} ${p.severity} ${p.code} ${p.message}`;

export function render(path, { out = '.', format = 'svg', icons } = {}) {
  mkdirSync(out, { recursive: true });
  const stem = basename(path, extname(path));
  const blocks = blocksOf(path);
  const written = [];
  if (format === 'html') {
    const figs = blocks.map((b, i) => renderMockBlock(b.body, b.info, { blockIndex: i, icons })).join('\n');
    const file = join(out, `${stem}.html`);
    writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${escapeXml(stem)}</title><style>${WIREDOWN_CSS}</style>\n${figs}\n`);
    return [file];
  }
  blocks.forEach((b, i) => {
    const r = parseMock(b.body, b.info);
    if (!r.ok) throw new UsageError(`${path}: block ${i + 1} does not parse (run wiredown lint)`);
    r.mock.screens.forEach((s, j) => {
      const file = join(out, `${stem}${blocks.length > 1 ? `-${i + 1}` : ''}-${s.id}.svg`);
      writeFileSync(file, marked(renderScreenSvg(r.mock, j, i, icons)));
      written.push(file);
    });
  });
  return written;
}

export function exportFiles(path, { to, out = '.' }) {
  const fn = to === 'openui' ? toOpenUI : to === 'html' ? toHTML : null;
  if (!fn) throw new UsageError('--to must be openui or html');
  mkdirSync(out, { recursive: true });
  const written = [];
  const used = new Set();
  for (const b of blocksOf(path)) {
    const r = fn(b.body, b.info);
    if (!r.ok) throw new UsageError(`${path}: fix the lint errors first (run wiredown lint)`);
    for (const f of r.files) { const ext = to === 'openui' ? 'openui' : 'html';
      let name = f.name; let n = 2;
      while (used.has(name)) name = `${f.name}-${n++}`;
      used.add(name);
      const file = join(out, `${name}.${ext}`); writeFileSync(file, f.text); written.push(file); }
  }
  return written;
}

/** One block's flow as a standalone animated SVG file. `block` is 1-based (default the first fence). */
export function animate(path, { out = 'flow.svg', block = '1', step, credit = true, icons } = {}) {
  const blocks = blocksOf(path);
  const n = Number(block);
  if (!blocks.length) throw new UsageError(`${path} has no wiredown block`);
  if (!Number.isInteger(n) || n < 1 || n > blocks.length) throw new UsageError(`--block must be 1 to ${blocks.length}`);
  const s = step === undefined ? undefined : Number(step);
  if (s !== undefined && !(s >= 0.5 && s <= 30)) throw new UsageError('--step must be seconds from 0.5 to 30');
  const b = blocks[n - 1];
  if (!flowPath(b.body, b.info).ok) throw new UsageError(`${path}: block ${n} does not parse (run wiredown lint)`);
  const svg = renderFlowAnimation(b.body, b.info, { step: s, credit, icons });
  if (isFlowError(svg)) throw new UsageError(`${path}: block ${n} ${svg.includes('too large') ? 'is too large to animate (over 2 MB)' : 'could not be drawn'}`);
  writeFileSync(out, marked(svg));
  return out;
}

/** The playground link for one block of a file. `block` is 1-based (default the first fence). */
export function link(path, { block = '1' } = {}) {
  const blocks = blocksOf(path);
  const n = Number(block);
  if (!blocks.length) throw new UsageError(`${path} has no wiredown block`);
  if (!Number.isInteger(n) || n < 1 || n > blocks.length) throw new UsageError(`--block must be 1 to ${blocks.length}`);
  const b = blocks[n - 1];
  const url = playgroundLink(b.body, b.info);
  if (!url) throw new UsageError(`${path}: block ${n} is over the one-block limit`);
  return url;
}

export const contract = () => AI_CONTRACT;
