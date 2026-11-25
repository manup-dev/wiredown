// lintMock: parseMock's errors and warnings as one list with a severity. Never throws.
import { wmError } from './limits.js';
import { parseMock } from './parse.js';

export const AS_ERROR = new Set(['unknown_kind', 'unknown_attr', 'dangling_link']);
const MAX = 50;

// Info words the renderer reads: the fence language, v1, look=, view=. Anything else is a typo.
function infoProblems(info) {
  const out = [];
  const words = String(info || '').split(/\s+/).filter(Boolean);
  words.forEach((w, i) => {
    const known = (i === 0 && (w === 'wiremark' || w === 'screens')) || /^v\d+$/.test(w) || w.startsWith('look=') || w.startsWith('view=');
    if (!known) out.push({ ...wmError(0, 0, 'unknown_info', `The info word ${w.slice(0, 40)} is not known; use v1, look=wire|clean or view=prototype.`), severity: 'warning' });
  });
  return out;
}

export function lintMock(body, info) {
  const r = parseMock(body, info);
  const found = r.ok
    ? r.warnings.map((w) => ({ ...w, severity: AS_ERROR.has(w.code) ? 'error' : 'warning' }))
    : r.errors.map((e) => ({ ...e, severity: 'error' }));
  return [...infoProblems(info), ...found].slice(0, MAX);
}
