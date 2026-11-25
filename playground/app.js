// The wiremark playground: type on the left, see the drawing on the right.
// Everything runs in the page: no server, no request. Share links carry the text in the URL hash.
import { renderMockBlock, parseMock, renderScreenSvg, lintMock, slug, AI_CONTRACT, WIREMARK_CSS } from '../src/index.js';
import { toOpenUI, toHTML } from '../src/export/index.js';
import { encodeShare, decodeShare } from './share.js';
import { EXAMPLES } from './examples.js';
import { initSelect } from './select.js';
import { initLayout } from './layout.js';

const $ = (id) => document.getElementById(id);
const source = $('source'), gutter = $('gutter'), preview = $('preview'), problems = $('problems');
const examples = $('examples'), look = $('look'), view = $('view'), toastEl = $('toast');
const tabs = [$('tab-openui'), $('tab-html')], exportBox = $('export'), exportOut = $('export-output');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: nothing to keep */ } },
};

let toastTimer = 0;
function toast(message) {
  toastEl.hidden = false;
  toastEl.classList.remove('show');
  requestAnimationFrame(() => { toastEl.textContent = message; toastEl.classList.add('show'); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

const info = () => 'wiremark' + (look.value ? ' look=' + look.value : '') + (view.value ? ' view=' + view.value : '');

// ── Drawing, problems and the gutter ──
let parsed = null;
function render() {
  const text = source.value, inf = info();
  const tpl = document.createElement('template');
  // The library's output is trusted: escaped text, allowlisted SVG, no script.
  tpl.innerHTML = renderMockBlock(text, inf);
  preview.replaceChildren(tpl.content);
  parsed = parseMock(text, inf);
  for (const id of ['svg', 'copysvg', 'html']) $(id).disabled = !parsed.ok;
  const found = lintMock(text, inf);
  // Replace the live list only when what it says changed, so a screen reader is not re-read it after every pause.
  const said = JSON.stringify(found.map((p) => [p.line, p.code, p.message, p.severity]));
  if (said !== problems.dataset.said) {
    problems.dataset.said = said;
    problems.replaceChildren(...(found.length ? found.map(problemItem) : [okItem()]));
    paintProblemsMore(found.length);
  }
  paintGutter(text, new Set(found.map((p) => p.line)));
  syncExamples(text);
  if (selectedTab()) fillExport();
  store.set('wiremark.draft', text);
  layout.decorate();
  select.refresh();
}

function problemItem(p) {
  const li = document.createElement('li'), b = document.createElement('button');
  b.type = 'button'; b.dataset.line = String(p.line); b.className = 'problem ' + p.severity;
  const where = document.createElement('span'); where.className = 'where';
  where.textContent = p.line > 0 ? `Line ${p.line}` : 'Info string';
  const what = document.createElement('span'); what.className = 'what';
  what.textContent = `: ${p.message} `;
  const code = document.createElement('code'); code.textContent = `(${p.code})`;
  b.append(where, what, code);
  li.append(b);
  return li;
}
// A long problems list folds to its first two, so it never pushes the editor off the page.
let problemsOpen = false;
const more = $('problems-more');
function paintProblemsMore(n) {
  more.hidden = n < 3;
  problems.classList.toggle('folded', n >= 3 && !problemsOpen);
  more.setAttribute('aria-expanded', String(problemsOpen));
  more.textContent = problemsOpen ? 'Show fewer' : `Show ${n - 2} more`;
}
more.addEventListener('click', () => { problemsOpen = !problemsOpen; paintProblemsMore(problems.children.length); });
function okItem() { const li = document.createElement('li'); li.className = 'ok'; li.textContent = 'No problems'; return li; }

problems.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-line]');
  if (!b) return;
  const line = Number(b.dataset.line), lines = source.value.split('\n');
  let at = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) at += lines[i].length + 1;
  source.focus();
  source.setSelectionRange(at, at);
  const lh = parseFloat(getComputedStyle(source).lineHeight) || 20;
  source.scrollTop = Math.max(0, (line - 3) * lh);
});

function paintGutter(text, marked) {
  const n = text.split('\n').length, out = [];
  for (let i = 1; i <= n; i++) out.push(marked.has(i) ? `<b>${i}</b>` : String(i));
  gutter.innerHTML = out.join('\n'); // numbers only
  gutter.scrollTop = source.scrollTop;
}
source.addEventListener('scroll', () => { gutter.scrollTop = source.scrollTop; });

let timer = 0;
const schedule = () => { clearTimeout(timer); timer = setTimeout(render, 150); };
source.addEventListener('input', schedule);
look.addEventListener('change', render);
view.addEventListener('change', render);

// ── Editor keys: Tab indents, Shift+Tab outdents, Escape then Tab leaves ──
let escaped = false;
function replaceRange(from, to, text, selFrom, selTo) {
  source.setSelectionRange(from, to);
  // execCommand keeps the browser's undo history; setRangeText is the fallback.
  if (!document.execCommand('insertText', false, text)) { source.setRangeText(text, from, to, 'end'); source.dispatchEvent(new Event('input')); }
  source.setSelectionRange(selFrom, selTo);
}
source.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { escaped = true; return; }
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return; // a modifier on its way to Tab
  if (e.key !== 'Tab' || escaped || e.ctrlKey || e.metaKey || e.altKey) { escaped = false; return; }
  e.preventDefault();
  const v = source.value, s = source.selectionStart, end = source.selectionEnd;
  const start = v.lastIndexOf('\n', s - 1) + 1;
  const multi = v.slice(s, end).includes('\n');
  if (!e.shiftKey && !multi) { replaceRange(s, end, '  ', s + 2, s + 2); return; }
  const last = end > s && v[end - 1] === '\n' ? end - 1 : end;
  const nl = v.indexOf('\n', last), stop = nl < 0 ? v.length : nl;
  const lines = v.slice(start, stop).split('\n');
  const changed = lines.map((l) => (e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l));
  const firstDelta = changed[0].length - lines[0].length;
  const total = changed.join('\n').length - lines.join('\n').length;
  if (total === 0) return;
  const a = Math.max(start, s + firstDelta), b = multi ? end + total : Math.max(start, end + firstDelta);
  replaceRange(start, stop, changed.join('\n'), a, b);
});
source.addEventListener('blur', () => { escaped = false; });

// The screens rise in, one after another, when a block first appears (load, or an example).
function intro() {
  preview.classList.remove('intro'); void preview.offsetWidth; preview.classList.add('intro');
  setTimeout(() => preview.classList.remove('intro'), 900);
}

// ── Examples ──
function fillExamples() {
  const draft = new Option('Your draft', ''); draft.hidden = true;
  const groups = new Map();
  for (const ex of EXAMPLES) {
    if (!groups.has(ex.group)) { const g = document.createElement('optgroup'); g.label = ex.group; groups.set(ex.group, g); }
    groups.get(ex.group).append(new Option(ex.label, ex.id));
  }
  examples.append(draft, ...groups.values());
}
function syncExamples(text) {
  const match = EXAMPLES.find((ex) => ex.body === text);
  examples.value = match ? match.id : '';
}
examples.addEventListener('change', () => {
  const ex = EXAMPLES.find((x) => x.id === examples.value);
  if (!ex) return;
  const had = source.value.trim() && !EXAMPLES.some((x) => x.body === source.value);
  const back = document.activeElement;
  source.focus();
  replaceRange(0, source.value.length, ex.body, 0, 0);
  source.scrollTop = 0;
  if (source.value !== ex.body) source.value = ex.body;
  if (back && back !== document.body) back.focus(); else source.blur();
  render(); intro();
  if (had) toast(`Opened ${ex.label}. Undo in the editor brings your text back.`);
});

// ── Clipboard, downloads ──
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  const back = document.activeElement, box = document.createElement('textarea');
  box.readOnly = true; box.value = text; box.className = 'offscreen';
  document.body.append(box); box.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  box.remove(); back?.focus({ preventScroll: true });
  return ok;
}
function download(name, type, text) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const nameBase = () => (parsed?.ok && parsed.mock.title ? slug(parsed.mock.title) : '') || 'wiremark';

// The link is encoded as the text changes, so Share copies at once (inside the click, as browsers like).
let shareFor = { text: null, hash: null };
function prepareShare() {
  const text = source.value;
  encodeShare(text).then((hash) => { if (source.value === text) shareFor = { text, hash }; }, () => {});
}
source.addEventListener('input', prepareShare);
$('share').addEventListener('click', async () => {
  let hash = shareFor.text === source.value ? shareFor.hash : null;
  if (!hash) {
    try { hash = await encodeShare(source.value); } catch { toast('Could not make the link in this browser.'); return; }
  }
  const url = location.origin + location.pathname + '#' + hash;
  if (await copyText(url)) { toast('Link copied'); return; }
  history.replaceState(null, '', url);
  toast('Could not copy the link. Copy it from the address bar.');
});
$('ai').addEventListener('click', async () => {
  const ok = await copyText(AI_CONTRACT + '\n\nDescribe your screens:\n');
  toast(ok ? 'Prompt copied. Paste it into any AI, then describe your screens.' : 'Could not copy the prompt.');
});

function shownScreen() {
  const fig = preview.querySelector('figure.wm');
  const el = fig?.querySelector('.wm-screen.is-current') ?? (fig?.classList.contains('wm-proto') ? fig.querySelector('.wm-screen.wm-start') : null) ?? fig?.querySelector('.wm-screen');
  const i = parsed.mock.screens.findIndex((s) => s.id === el?.dataset.wmScreen);
  return Math.max(0, i);
}
function screenSvg() {
  const i = shownScreen();
  return { name: `${nameBase()}-${parsed.mock.screens[i].id}.svg`, text: renderScreenSvg(parsed.mock, i) };
}
$('svg').addEventListener('click', () => { if (!parsed?.ok) return; const s = screenSvg(); download(s.name, 'image/svg+xml', s.text); });
$('copysvg').addEventListener('click', async () => {
  if (!parsed?.ok) return;
  toast((await copyText(screenSvg().text)) ? 'SVG copied' : 'Could not copy the SVG.');
});
$('html').addEventListener('click', () => {
  if (!parsed?.ok) return;
  const title = (parsed.mock.title || 'wiremark screens').replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const page = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n<style>\nbody{margin:24px;font:15px/1.45 system-ui,sans-serif;color:#1b1d21;background:#fff}\n.wm{--wm-bg:#fff}\n${WIREMARK_CSS}\n</style>\n</head>\n<body>\n${renderMockBlock(source.value, info())}\n</body>\n</html>\n`;
  download(`${nameBase()}.html`, 'text/html', page);
});

// ── Export tabs (WAI-ARIA tabs: arrows move, Home and End jump) ──
const selectedTab = () => tabs.find((t) => t.getAttribute('aria-selected') === 'true');
function selectTab(tab, focus) {
  for (const t of tabs) { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; }
  $('export-close').hidden = false;
  exportOut.setAttribute('aria-labelledby', tab.id);
  exportBox.hidden = false;
  if (focus) tab.focus();
  store.set('wiremark.tab', tab.id);
  fillExport();
}
function fillExport() {
  const isOpenUI = selectedTab() === tabs[0];
  const result = (isOpenUI ? toOpenUI : toHTML)(source.value, info());
  exportOut.dataset.state = result.ok ? 'ok' : 'error';
  $('copyexport').disabled = !result.ok;
  exportOut.textContent = !result.ok ? 'Fix the problems first.'
    : result.files.map((f) => (isOpenUI ? `// ── ${f.name} ──\n` : `<!-- ── ${f.name} ── -->\n`) + f.text).join('\n');
}
for (const t of tabs) {
  t.addEventListener('click', () => (t === selectedTab() ? closeExport() : selectTab(t, false)));
  t.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(t), n = tabs.length;
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault(); selectTab(tabs[to], true);
  });
}
// Clicking the open tab again, or Hide, folds the code away.
function closeExport() {
  const back = selectedTab();
  for (const t of tabs) { t.setAttribute('aria-selected', 'false'); t.tabIndex = t === tabs[0] ? 0 : -1; }
  exportBox.hidden = true; $('export-close').hidden = true;
  store.set('wiremark.tab', '');
  if (document.activeElement === $('export-close')) (back ?? tabs[0]).focus();
}
$('export-close').addEventListener('click', closeExport);
$('copyexport').addEventListener('click', async () => {
  toast((await copyText(exportOut.textContent)) ? 'Code copied' : 'Could not copy the code.');
});

// ── Drawing ↔ text, and the layout controls ──
let layout = null;
const select = initSelect({ preview, source, info, isOk: () => !!parsed?.ok, onReveal: (id) => layout?.reveal(id) });
layout = initLayout({ $, store, preview, onChange: () => select.reposition(), goTo: (id) => select.goTo(id) });

// ⌘S or Ctrl+S copies a share link instead of saving the page.
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
$('keys-hint').textContent += ` ${mac ? '⌘S' : 'Ctrl+S'} copies a link.`;
document.addEventListener('keydown', (e) => {
  if ((mac ? e.metaKey : e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); $('share').click(); }
});

// ── Theme ──
const themeBtn = $('theme');
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
}
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next); store.set('wiremark.theme', next);
});

// ── Start ──
async function start() {
  const saved = store.get('wiremark.theme');
  setTheme(saved === 'dark' || saved === 'light' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  fillExamples();
  let text = null;
  if (location.hash.length > 1) {
    const shared = await decodeShare(location.hash);
    history.replaceState(null, '', location.pathname + location.search);
    if (shared.ok) text = shared.text;
    else toast(`That link could not be opened (${shared.reason})`);
  }
  source.value = text ?? store.get('wiremark.draft') ?? EXAMPLES[0].body;
  render(); intro(); prepareShare();
  const tab = tabs.find((t) => t.id === store.get('wiremark.tab'));
  if (tab) selectTab(tab, false);
}
start();
