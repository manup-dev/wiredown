// The drawing and the text point at each other. Click any drawn element (an icon, a button, a note
// badge) and its line is selected in the editor; move the caret and the element it describes lights up.
// The boxes are plain divs laid over the drawing, so the SVG stays exactly the library's output.
import { locateElement, elementAtLine } from '../src/index.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = () => matchMedia('(pointer: fine)').matches;

export function initSelect({ preview, source, info, isOk, onReveal }) {
  const box = (cls) => { const d = document.createElement('div'); d.className = 'wm-box ' + cls; d.hidden = true; d.setAttribute('aria-hidden', 'true'); return d; };
  const hoverBox = box('wm-hover'), selBox = box('wm-sel');
  const chip = document.createElement('div'); chip.className = 'wm-chip'; chip.hidden = true;
  let sel = null; // { screen, el, frame }
  let lastLine = 0;
  const labels = new Map();

  // ── Finding things ──
  const q = (s) => CSS.escape(s);
  const screenEl = (id) => preview.querySelector(`.wm-screen[data-wm-screen="${q(id)}"]`);
  function nodeFor(s) {
    const scr = s && screenEl(s.screen);
    if (!scr) return null;
    return s.frame ? scr.querySelector('svg') : scr.querySelector(`svg [data-wm-el="${q(s.el)}"]`);
  }
  function pick(t) {
    const scr = t.closest?.('.wm-screen');
    if (!scr || !preview.contains(scr) || t.closest('.wm-cap')) return null;
    const link = t.closest('a[href^="#wm-"]');
    const g = t.closest('[data-wm-el]') ?? link?.querySelector('[data-wm-el]');
    const screen = scr.dataset.wmScreen;
    if (g && scr.contains(g)) return { screen, el: g.dataset.wmEl, frame: false, link };
    if (t.closest('svg')) return { screen, el: screen, frame: true, link: null };
    return null;
  }
  function locate(s) {
    const text = source.value, inf = info();
    const loc = locateElement(text, inf, s.el, s.screen) ?? locateElement(text, inf, s.el);
    if (loc) return loc;
    if (!s.frame) return null;
    // A variant's frame: its own `variant <id>` line.
    const lines = text.split('\n'), re = new RegExp(`^\\s*(screen|variant)\\s+${s.screen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    const i = lines.findIndex((l) => re.test(l));
    return i < 0 ? null : { line: i + 1, label: lines[i].trim().split(/\s+/).slice(0, 3).join(' ') };
  }
  function labelFor(s) {
    const key = s.screen + '\u0000' + s.el;
    if (!labels.has(key)) labels.set(key, locate(s)?.label ?? '');
    return labels.get(key);
  }

  // ── Painting the boxes ──
  function place(b, node) {
    if (!node || !node.getClientRects().length) { b.hidden = true; return null; }
    const r = node.getBoundingClientRect(), p = preview.getBoundingClientRect();
    if (!r.width && !r.height) { b.hidden = true; return null; }
    const left = r.left - p.left + preview.scrollLeft - 3, top = r.top - p.top + preview.scrollTop - 3;
    Object.assign(b.style, { left: left + 'px', top: top + 'px', width: r.width + 6 + 'px', height: r.height + 6 + 'px' });
    b.hidden = false;
    return { left, top, bottom: top + r.height + 6 };
  }
  function placeChip(at) {
    if (!at || chip.hidden) return;
    const above = at.top - chip.offsetHeight - 6;
    chip.style.left = Math.max(preview.scrollLeft + 4, at.left) + 'px';
    chip.style.top = (above > preview.scrollTop ? above : at.bottom + 6) + 'px';
  }
  function fillChip(s, line, link) {
    const what = document.createElement('span'); what.className = 'what'; what.textContent = labelFor(s) || s.el;
    const parts = [what];
    const note = !s.frame && preview.querySelector(`.wm-notes li[data-wm-el="${q(s.el)}"]`);
    if (note) { const n = document.createElement('span'); n.className = 'note'; n.textContent = note.textContent.replace(/^[^:]*:\s*/, ''); parts.push(n); }
    if (line) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.line = String(line);
      b.textContent = `Line ${line}`; b.title = 'Select this line in the editor'; parts.push(b);
    }
    const to = link?.getAttribute('href')?.slice(1);
    const target = to && preview.querySelector(`[id="${q(to)}"]`);
    if (target) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.go = to; b.className = 'go';
      b.textContent = `Open ${target.querySelector('.wm-cap')?.textContent ?? 'screen'} →`; parts.push(b);
    }
    chip.replaceChildren(...parts);
  }
  function show(s, { chipFor = null, reveal = false } = {}) {
    sel = s;
    const node = nodeFor(s), at = place(selBox, node);
    chip.hidden = !chipFor || !at;
    if (chipFor && at) { fillChip(s, chipFor.line, chipFor.link); placeChip(at); }
    if (reveal && node) revealNode(node);
  }
  function clear() { sel = null; selBox.hidden = true; chip.hidden = true; }

  // Scroll the drawing pane (never the page) just enough to bring a node into view.
  function revealNode(node) {
    const r = node.getBoundingClientRect(), p = preview.getBoundingClientRect();
    const dy = r.top < p.top + 12 ? r.top - p.top - 40 : r.bottom > p.bottom - 12 ? r.bottom - p.bottom + 40 : 0;
    const dx = r.left < p.left + 12 ? r.left - p.left - 24 : r.right > p.right - 12 ? r.right - p.right + 24 : 0;
    if (dx || dy) preview.scrollTo({ top: preview.scrollTop + dy, left: preview.scrollLeft + dx, behavior: reduced() ? 'auto' : 'smooth' });
  }

  // ── The editor side ──
  function showLine(line, focus) {
    const v = source.value;
    let from = 0;
    for (let i = 1; i < line; i++) { const n = v.indexOf('\n', from); if (n < 0) return; from = n + 1; }
    let to = v.indexOf('\n', from); if (to < 0) to = v.length;
    const at = from + (to - from) - v.slice(from, to).trimStart().length;
    lastLine = line;
    if (focus && source.offsetParent) source.focus({ preventScroll: true });
    source.setSelectionRange(at, to);
    const lh = parseFloat(getComputedStyle(source).lineHeight) || 20, top = (line - 1) * lh;
    if (top < source.scrollTop || top > source.scrollTop + source.clientHeight - lh * 2) source.scrollTop = Math.max(0, top - source.clientHeight / 3);
  }
  function syncFromCaret() {
    if (document.activeElement !== source || !isOk()) return;
    const v = source.value, line = v.slice(0, source.selectionStart).split('\n').length;
    if (line === lastLine) return;
    lastLine = line;
    const loc = elementAtLine(v, info(), line);
    if (!loc) { clear(); return; }
    show({ screen: loc.screenId, el: loc.elementId, frame: loc.frame }, { reveal: true });
  }
  let caretTimer = 0;
  document.addEventListener('selectionchange', () => {
    if (document.activeElement !== source) return;
    clearTimeout(caretTimer); caretTimer = setTimeout(syncFromCaret, 90);
  });

  // ── Pointer: hover, click ──
  let raf = 0, lastMove = null;
  preview.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    lastMove = e.target;
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      const s = lastMove && pick(lastMove);
      const same = s && sel && !selBox.hidden && s.screen === sel.screen && s.el === sel.el;
      if (!s || same) { hoverBox.hidden = true; return; }
      if (place(hoverBox, nodeFor(s))) hoverBox.dataset.label = labelFor(s);
    });
  });
  preview.addEventListener('pointerleave', () => { hoverBox.hidden = true; });

  preview.addEventListener('click', (e) => {
    const btn = e.target.closest('.wm-chip button');
    if (btn) {
      if (btn.dataset.line) showLine(Number(btn.dataset.line), true);
      if (btn.dataset.go) { clear(); goTo(btn.dataset.go); }
      return;
    }
    if (e.target.closest('.wm-chip')) return;
    const note = e.target.closest('.wm-notes li[data-wm-el]');
    if (note) {
      const g = preview.querySelector(`.wm-screen svg [data-wm-el="${q(note.dataset.wmEl)}"]`);
      const scr = g?.closest('.wm-screen');
      if (!g || !scr) return;
      onReveal(scr.dataset.wmScreen);
      const s = { screen: scr.dataset.wmScreen, el: note.dataset.wmEl, frame: false };
      const loc = locate(s);
      show(s, { chipFor: { line: loc?.line }, reveal: true });
      return;
    }
    const s = pick(e.target);
    const fig = e.target.closest('figure.wm');
    if (s?.link) e.preventDefault();
    // A prototype is for clicking through: its links follow at once.
    if (s?.link && fig?.classList.contains('wm-proto')) { clear(); goTo(s.link.getAttribute('href').slice(1)); return; }
    if (!s) { if (!e.target.closest('.wm-cap')) clear(); return; }
    hoverBox.hidden = true;
    const loc = locate(s);
    show(s, { chipFor: { line: loc?.line, link: s.link } });
    // With a mouse the editor follows at once; on touch the chip's Line button does it, so no keyboard pops up.
    if (loc && fine()) showLine(loc.line, true);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.activeElement !== source && sel) clear();
  });

  // ── Prototype and stack navigation ──
  function goTo(id) {
    const target = preview.querySelector(`[id="${q(id)}"]`);
    const fig = target?.closest('figure.wm');
    if (!target || !fig) return;
    onReveal(target.dataset.wmScreen);
    if (fig.classList.contains('wm-proto')) {
      fig.querySelectorAll('.wm-screen.wm-current').forEach((s) => s.classList.remove('wm-current'));
      target.classList.add('wm-current');
      fig.dataset.wmCurrent = target.dataset.wmScreen;
    }
    target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
  }

  // After every render the drawing is new: put the boxes back and find the selection again.
  function refresh() {
    labels.clear();
    preview.append(hoverBox, selBox, chip);
    hoverBox.hidden = true;
    if (document.activeElement === source) { lastLine = 0; chip.hidden = true; syncFromCaret(); return; }
    reposition();
  }
  function reposition() {
    hoverBox.hidden = true;
    if (!sel) return;
    const at = place(selBox, nodeFor(sel));
    if (!at) chip.hidden = true; else placeChip(at);
  }
  return { refresh, reposition, goTo, clear };
}
