// One line rewritten in canonical order: kind labels flags k=v #id -> link note=. Keeps indent and comment.
import { lexLine } from './lex.js';
import { KINDS } from './kinds.js';

const isSp = (c) => c === ' ' || c === '\t';

// Index of a trailing // comment (a // that starts a token, outside labels), or -1.
export function commentStart(text) {
  let i = 0;
  while (i < text.length) {
    if (isSp(text[i])) { i++; continue; }
    if (text[i] === '/' && text[i + 1] === '/') return i;
    let q = text[i] === '"' ? i : -1;
    if (q < 0) {
      let j = i;
      while (j < text.length && !isSp(text[j]) && text[j] !== '=') j++;
      if (text[j] === '=' && text[j + 1] === '"') q = j + 1;
      else { while (i < text.length && !isSp(text[i])) i++; continue; }
    }
    i = q + 1;
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' && i + 1 < text.length ? 2 : 1;
    i++;
  }
  return -1;
}

const quote = (v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
function needsQuote(v) {
  if (v === '' || v[0] === '"') return true;
  for (let i = 0; i < v.length; i++) if (isSp(v[i])) return true;
  return false;
}
const val = (v, quoted) => (quoted || needsQuote(v) ? quote(v) : v);

// patch: { attrs, flags, label, labelIndex, pin, link, kind }; pin is an id to write, link a screen id,
// 'back' or null (removed), kind a new kind whose attributes, flags and label count the line is cut
// to. Returns the new line or null when it cannot be read.
export function rewriteLine(text, patch) {
  const lx = lexLine(text, 1);
  if (lx.error || !lx.tokens.length || lx.tokens[0].t !== 'word') return null;
  const cut = commentStart(text);
  const comment = cut >= 0 ? text.slice(cut) : '';
  const [head, ...rest] = lx.tokens;
  let labels = rest.filter((t) => t.t === 'label').map((t) => t.v);
  let flags = rest.filter((t) => t.t === 'word').map((t) => t.v);
  let kvs = rest.filter((t) => t.t === 'kv').map((t) => ({ k: t.k, v: t.v, quoted: t.quoted }));
  const idTok = rest.find((t) => t.t === 'id');
  const linkTok = rest.find((t) => t.t === 'link');
  let id = idTok ? idTok.v : null;
  let link = linkTok ? linkTok.v : null;
  let kind = head.v;
  if (patch.pin) id = patch.pin;
  if (patch.link !== undefined) link = patch.link;
  const at = patch.labelIndex === 1 ? 1 : 0;
  if (typeof patch.label === 'string') labels[at] = patch.label;
  else if (patch.label === null) labels.splice(at, 1);
  for (const [k, v] of Object.entries(patch.attrs || {})) {
    const i = kvs.findIndex((x) => x.k === k);
    if (v === null) { if (i >= 0) kvs.splice(i, 1); } else if (i >= 0) kvs[i] = { k, v, quoted: kvs[i].quoted && kvs[i].v === v };
    else kvs.push({ k, v, quoted: false });
  }
  for (const [f, on] of Object.entries(patch.flags || {})) {
    const i = flags.indexOf(f);
    if (on && i < 0) flags.push(f);
    else if (!on && i >= 0) flags.splice(i, 1);
  }
  if (patch.kind) {
    const spec = KINDS[patch.kind];
    kind = patch.kind;
    kvs = kvs.filter((x) => Object.prototype.hasOwnProperty.call(spec.attrs, x.k));
    flags = flags.filter((f) => spec.flags.includes(f));
    labels = labels.slice(0, spec.labels);
  }
  const note = kvs.find((x) => x.k === 'note');
  const parts = [kind, ...labels.map(quote), ...flags];
  for (const x of kvs) if (x.k !== 'note') parts.push(`${x.k}=${val(x.v, x.quoted)}`);
  if (id) parts.push(`#${id}`);
  if (link) parts.push(`-> ${link}`);
  if (note) parts.push(`note=${val(note.v, note.quoted)}`);
  return `${' '.repeat(lx.indent)}${parts.join(' ')}${comment ? ` ${comment}` : ''}`;
}

// A variant patch line `#id flags k=v -> link note=` with attrs/flags merged (null / false
// removes) and `hide` set or cleared. Returns { line, empty } (empty: nothing but the id is
// left) or null when the line cannot be read.
export function rewritePatchLine(text, patch) {
  const lx = lexLine(text, 1);
  if (lx.error || !lx.tokens.length || lx.tokens[0].t !== 'id') return null;
  const cut = commentStart(text);
  const comment = cut >= 0 ? text.slice(cut) : '';
  const [head, ...rest] = lx.tokens;
  const labels = rest.filter((t) => t.t === 'label').map((t) => t.v);
  const flags = rest.filter((t) => t.t === 'word').map((t) => t.v);
  const kvs = rest.filter((t) => t.t === 'kv').map((t) => ({ k: t.k, v: t.v, quoted: t.quoted }));
  const linkTok = rest.find((t) => t.t === 'link');
  for (const [k, v] of Object.entries(patch.attrs || {})) {
    const i = kvs.findIndex((x) => x.k === k);
    if (v === null) { if (i >= 0) kvs.splice(i, 1); } else if (i >= 0) kvs[i] = { k, v, quoted: kvs[i].quoted && kvs[i].v === v };
    else kvs.push({ k, v, quoted: false });
  }
  const want = { ...(patch.flags || {}) };
  if (typeof patch.hide === 'boolean') want.hide = patch.hide;
  for (const [f, on] of Object.entries(want)) {
    const i = flags.indexOf(f);
    if (on && i < 0) flags.push(f);
    else if (!on && i >= 0) flags.splice(i, 1);
  }
  const note = kvs.find((x) => x.k === 'note');
  const parts = [`#${head.v}`, ...labels.map(quote), ...flags.filter((f) => f !== 'hide')];
  for (const x of kvs) if (x.k !== 'note') parts.push(`${x.k}=${val(x.v, x.quoted)}`);
  if (linkTok) parts.push(`-> ${linkTok.v}`);
  if (note) parts.push(`note=${val(note.v, note.quoted)}`);
  if (flags.includes('hide')) parts.push('hide');
  return { line: `${' '.repeat(lx.indent)}${parts.join(' ')}${comment ? ` ${comment}` : ''}`, empty: parts.length === 1 && !comment };
}
