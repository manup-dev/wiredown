// Wiremark fences in a markdown file, for tools that lint or render a file outside a markdown parser.
// Top-level fences only (CommonMark rules for opening and closing); container fences are not scanned.
import { fenceLang, isWiremarkLang } from './markdownit.js';

export function findFences(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const out = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!open) {
      const m = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
      if (!m || (m[2][0] === '`' && m[3].includes('`'))) continue;
      open = { indent: m[1].length, ch: m[2][0], len: m[2].length, info: m[3].trim(), openLine: i + 1, body: [] };
      continue;
    }
    const c = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
    if (c && c[1][0] === open.ch && c[1].length >= open.len) { push(out, open); open = null; continue; }
    let k = 0;
    while (k < open.indent && line[k] === ' ') k++;
    open.body.push(line.slice(k));
  }
  // An unclosed fence runs to the end of the text; the empty string after a final newline is not a body line.
  if (open) {
    if (open.body.length && open.body[open.body.length - 1] === '') open.body.pop();
    push(out, open);
  }
  return out;
}

function push(out, f) {
  const lang = fenceLang(f.info);
  if (!isWiremarkLang(lang)) return;
  out.push({
    info: f.info,
    lang,
    body: f.body.length ? f.body.join('\n') + '\n' : '',
    openLine: f.openLine,
    bodyLine: f.openLine + 1,
  });
}
