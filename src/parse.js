// parseMock: indent tree, headers, screens, variants, defines, then ids and link checks.
import { WM_LIMITS, wmError } from './limits.js';
import { lexLine, splitLines } from './lex.js';
import { isId, deriveIds, findDuplicateIds } from './ids.js';
import { makeCtx, err, warn } from './validate.js';
import { declareDefine } from './define.js';
import { newNode, buildNodes, buildChildren, fillNode } from './build.js';
import { makeVariant } from './variants.js';
import { readHeader } from './headers.js';

const bad = (code, msg) => ({ ok: false, errors: [wmError(1, 1, code, msg)] });

const isSp = (c) => c === ' ' || c === '\t';
function skipQuoted(text, i) {
  i++;
  while (i < text.length && text[i] !== '"') i += text[i] === '\\' && i + 1 < text.length ? 2 : 1;
  return Math.min(i + 1, text.length);
}
function bare(text, i) {
  while (i < text.length && !isSp(text[i])) i++;
  return i;
}
// 1-based column just past the last token (a trailing // comment and spaces excluded).
function endColOf(text, tokens) {
  const t = tokens[tokens.length - 1];
  let i = t.col - 1;
  if (t.t === 'label') i = skipQuoted(text, i);
  else if (t.t === 'kv') {
    const eq = text.indexOf('=', i);
    i = text[eq + 1] === '"' ? skipQuoted(text, eq + 1) : bare(text, eq + 1);
  } else if (t.t === 'link') {
    i += 2;
    while (i < text.length && isSp(text[i])) i++;
    i = bare(text, i);
  } else i = bare(text, i);
  return i + 1;
}

// Indent tree with an explicit parent stack.
function buildRaw(lines, ctx) {
  const top = [];
  const stack = [];
  let unit = 0;
  for (const { lineNo, text } of lines) {
    const lx = lexLine(text, lineNo);
    if (lx.error) { ctx.errors.push(lx.error); continue; }
    if (!lx.tokens.length) continue;
    let level = 0;
    if (lx.indent > 0) {
      if (!unit) {
        if (lx.indent === 2 || lx.indent === 4) unit = lx.indent;
        else { err(ctx, lineNo, 1, 'bad_indent', 'Indent with 2 or 4 spaces.'); continue; }
      }
      if (lx.indent % unit) { err(ctx, lineNo, 1, 'bad_indent', `Indent in steps of ${unit} spaces.`); continue; }
      level = lx.indent / unit;
    }
    if (level > stack.length) { err(ctx, lineNo, 1, 'bad_indent', 'Indent one step at a time.'); continue; }
    if (level > WM_LIMITS.depth + 2) {
      err(ctx, lineNo, 1, 'limit_depth', `Elements may nest at most ${WM_LIMITS.depth} levels deep.`);
      break;
    }
    stack.length = level;
    const raw = { line: lineNo, level, tokens: lx.tokens, comment: lx.comment, col: lx.tokens[0].col, endCol: endColOf(text, lx.tokens), children: [] };
    stack[level] = raw;
    if (level === 0) top.push(raw); else stack[level - 1].children.push(raw);
  }
  return top;
}

function buildScreen(raw, ctx) {
  const t = raw.tokens;
  const idTok = t[1];
  if (!idTok || (idTok.t !== 'word' && idTok.t !== 'id') || !isId(idTok.v)) {
    err(ctx, raw.line, raw.col, 'bad_value', 'screen needs an id such as login.');
    return null;
  }
  const root = newNode('screen', raw, ctx);
  if (!root) return null;
  root.id = idTok.v;
  root.explicitId = true;
  fillNode(root, t.slice(2), raw, ctx);
  root.id = idTok.v;
  buildChildren(raw, 0, null, ctx, root);
  return { id: idTok.v, label: root.labels[0] || '', root, variantOf: null, line: raw.line };
}

function variantHead(raw, ctx) {
  const t = raw.tokens;
  const ok = t[1] && t[1].t === 'word' && isId(t[1].v) && t[2] && t[2].t === 'word' && t[2].v === 'of' && t[3] && t[3].t === 'word' && isId(t[3].v) && (!t[4] || t[4].t === 'label') && t.length <= 5;
  if (ok && t[4] && t[4].v.length > WM_LIMITS.label) err(ctx, raw.line, t[4].col, 'limit_label', `A label may have at most ${WM_LIMITS.label} characters.`);
  if (!ok) err(ctx, raw.line, raw.col, 'bad_value', 'Write: variant name of screen "Label".');
  return ok;
}

function run(body, info) {
  const ctx = makeCtx();
  const mock = { version: 1, device: { name: 'phone', w: 390, h: 844 }, look: 'wire', title: null, flow: null, screens: [], view: 'stack' };
  const flowAt = { line: 1, col: 1 };
  let infoLook = null;
  // Info-string problems have no source line: line 0 (cards print the message alone).
  for (const w of String(info || '').split(/\s+/)) {
    if (w === 'v1') continue;
    if (w.startsWith('look=')) {
      const v = w.slice(5);
      if (v === 'wire' || v === 'clean') infoLook = v;
      else err(ctx, 0, 0, 'bad_header', 'look is wire or clean.');
      continue;
    }
    if (/^v\d+$/.test(w)) err(ctx, 0, 0, 'bad_header', `This version (${w}) is not supported; use v1.`);
    else if (w.startsWith('view=')) {
      const v = w.slice(5);
      if (v === 'prototype' || v === 'stack') mock.view = v;
      else err(ctx, 0, 0, 'bad_header', 'view is stack or prototype.');
    }
  }
  const lines = splitLines(body);
  if (lines.error) return { ok: false, errors: [lines.error] };
  const top = buildRaw(lines, ctx);
  for (const r of top) if (r.tokens[0].t === 'word' && r.tokens[0].v === 'define' && r.tokens[1]) ctx.names.add(r.tokens[1].v);
  const items = [];
  const loose = [];
  let headers = true;
  let nVariants = 0;
  for (const raw of top) {
    if (ctx.stopped) break;
    const first = raw.tokens[0];
    if (first.t === 'at') {
      if (!headers) err(ctx, raw.line, raw.col, 'bad_header', 'Headers go before the first screen or element.');
      else readHeader(raw, mock, flowAt, ctx);
      continue;
    }
    headers = false;
    const w = first.t === 'word' ? first.v : '';
    if (w === 'define') declareDefine(raw, ctx);
    else if (w === 'screen') {
      if (items.filter((i) => i.screen).length >= WM_LIMITS.screens) { err(ctx, raw.line, raw.col, 'limit_screens', `A block may have at most ${WM_LIMITS.screens} screens.`); ctx.stopped = true; continue; }
      const s = buildScreen(raw, ctx);
      if (s) items.push({ screen: s });
    } else if (w === 'variant') {
      if (++nVariants > WM_LIMITS.variants) { err(ctx, raw.line, raw.col, 'limit_variants', `A block may have at most ${WM_LIMITS.variants} variants.`); ctx.stopped = true; continue; }
      if (variantHead(raw, ctx)) items.push({ variant: raw });
    } else loose.push(...buildNodes(raw, 1, null, ctx).map((n) => ({ n, raw })));
  }
  if (infoLook) mock.look = infoLook; // the fence's look= wins over @look
  const bases = items.filter((i) => i.screen).map((i) => i.screen);
  if (loose.length) {
    if (bases.length) for (const { raw } of loose) err(ctx, raw.line, raw.col, 'bad_indent', 'Put this inside a screen.');
    else {
      const root = { kind: 'screen', id: 'main', explicitId: true, labels: [], attrs: {}, flags: [], link: null, note: null, children: loose.map((l) => l.n), line: loose[0].raw.line, col: 1, endCol: 1 };
      const s = { id: 'main', label: '', root, variantOf: null, line: root.line };
      items.unshift({ screen: s });
      bases.push(s);
    }
  }
  for (const d of findDuplicateIds(bases)) err(ctx, d.line, d.col, 'duplicate_id', `The id #${d.id} is used twice; ids must be unique.`);
  for (const s of bases) deriveIds(s);
  const byId = new Map();
  const all = new Set();
  for (const s of bases) {
    if (all.has(s.id)) { err(ctx, s.line, 1, 'duplicate_id', `The screen id ${s.id} is used twice.`); continue; }
    byId.set(s.id, s);
    all.add(s.id);
  }
  const variantIds = new Set(items.filter((i) => i.variant).map((i) => i.variant.tokens[1].v));
  for (const it of items) {
    if (it.screen) { if (byId.get(it.screen.id) === it.screen) mock.screens.push(it.screen); continue; }
    const r = it.variant;
    const id = r.tokens[1].v;
    const target = byId.get(r.tokens[3].v);
    if (all.has(id)) { err(ctx, r.line, r.tokens[1].col, 'duplicate_id', `The screen id ${id} is used twice.`); continue; }
    if (!target && variantIds.has(r.tokens[3].v)) { err(ctx, r.line, r.tokens[3].col, 'variant_target', 'A variant can only vary a screen, not another variant.'); continue; }
    if (!target) { err(ctx, r.line, r.tokens[3].col, 'variant_target', `No screen ${r.tokens[3].v} to vary.`); continue; }
    all.add(id);
    mock.screens.push(makeVariant(r, target, ctx));
  }
  for (const s of bases) {
    const stack = [s.root];
    while (stack.length) {
      const n = stack.pop();
      if (n.link && n.link !== 'back' && !all.has(n.link)) warn(ctx, n.line, n.col, 'dangling_link', `There is no screen ${n.link}.`);
      for (const c of n.children) stack.push(c);
    }
  }
  for (const l of ctx.patchLinks) if (l.link !== 'back' && !all.has(l.link)) warn(ctx, l.line, l.col, 'dangling_link', `There is no screen ${l.link}.`);
  if (mock.flow) for (const f of mock.flow) if (!all.has(f)) err(ctx, flowAt.line, flowAt.col, 'bad_header', `@flow names a missing screen: ${f}.`);
  const byLine = (a, b) => a.line - b.line || a.column - b.column;
  const errors = ctx.errors.sort(byLine).slice(0, 50);
  if (errors.length) return { ok: false, errors };
  return { ok: true, mock, warnings: ctx.warnings.sort(byLine).slice(0, 50) };
}

export function parseMock(body, info) {
  if (typeof body !== 'string') return bad('bad_value', 'A wiremark block is text.');
  try {
    return run(body, typeof info === 'string' ? info : '');
  } catch {
    return bad('bad_value', 'This block could not be read.');
  }
}
