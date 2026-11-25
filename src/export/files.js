// One exported file per drawn screen (variants included, in the block's order). Shared by every exporter.
import { parseMock } from '../parse.js';
import { lintMock } from '../lint.js';
import { slug } from '../ids.js';

export function screenFiles(body, info) {
  const problems = lintMock(String(body ?? ''), info).filter((p) => p.severity === 'error');
  const parsed = parseMock(String(body ?? ''), info);
  if (problems.length || !parsed.ok) return { ok: false, problems: problems.length ? problems : parsed.errors.map((e) => ({ ...e, severity: 'error' })) };
  const base = slug(parsed.mock.title || 'mock') || 'mock';
  return { ok: true, mock: parsed.mock, screens: parsed.mock.screens.map((screen) => ({ screen, name: `${base}-${screen.id}` })) };
}

/** Every note in a screen, in source order. */
export function notesOf(node, out = []) {
  if (node.note) out.push(node.note);
  for (const c of node.children) notesOf(c, out);
  return out;
}
