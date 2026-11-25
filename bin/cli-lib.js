// The wiredown CLI's commands as functions (bin/wiredown.js only parses argv and exits).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { lintMock, parseMock, renderScreenSvg, renderMockBlock, escapeXml, AI_CONTRACT, WIREDOWN_CSS } from '../src/index.js';
import { findFences } from '../src/fences.js';
import { toHTML, toOpenUI } from '../src/export/index.js';

export class UsageError extends Error {}

/** Blocks of a file: a .wiredown file is one block; markdown is its fences. */
export function blocksOf(path) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { throw new UsageError(`cannot read ${path}`); }
  if (/\.(md|markdown|mdx)$/i.test(path)) return findFences(text).map((f) => ({ body: f.body, info: f.info, bodyLine: f.bodyLine, openLine: f.openLine }));
  return [{ body: text, info: 'wiredown', bodyLine: 1, openLine: 1 }];
}

export function lint(paths) {
  const out = [];
  for (const path of paths) for (const b of blocksOf(path)) for (const p of lintMock(b.body, b.info)) {
    out.push({ file: path, line: p.line > 0 ? b.bodyLine + p.line - 1 : b.openLine, column: p.column || 1, severity: p.severity, code: p.code, message: p.message });
  }
  return out;
}

export const formatProblem = (p) => `${relative(process.cwd(), p.file) || p.file}:${p.line}:${p.column} ${p.severity} ${p.code} ${p.message}`;

export function render(path, { out = '.', format = 'svg' } = {}) {
  mkdirSync(out, { recursive: true });
  const stem = basename(path, extname(path));
  const blocks = blocksOf(path);
  const written = [];
  if (format === 'html') {
    const figs = blocks.map((b, i) => renderMockBlock(b.body, b.info, { blockIndex: i })).join('\n');
    const file = join(out, `${stem}.html`);
    writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${escapeXml(stem)}</title><style>${WIREDOWN_CSS}</style>\n${figs}\n`);
    return [file];
  }
  blocks.forEach((b, i) => {
    const r = parseMock(b.body, b.info);
    if (!r.ok) throw new UsageError(`${path}: block ${i + 1} does not parse (run wiredown lint)`);
    r.mock.screens.forEach((s, j) => {
      const file = join(out, `${stem}${blocks.length > 1 ? `-${i + 1}` : ''}-${s.id}.svg`);
      writeFileSync(file, renderScreenSvg(r.mock, j, i));
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

export const contract = () => AI_CONTRACT;
