// The page's layout controls: hide or show the source, drag the split, zoom the drawing, fold screens,
// and a row of screen chips that jumps to each one. Pane, split and zoom are kept per browser; folds last
// for the visit (they follow screen ids, so they survive typing).
const ZOOMS = [0.5, 0.67, 0.75, 0.85, 1, 1.25, 1.5, 2];
const SPLIT = { min: 22, max: 70, auto: 40 };

export function initLayout({ $, store, preview, onChange, goTo }) {
  const main = document.querySelector('main.split');
  const wide = matchMedia('(min-width: 900px)');

  // ── Source pane ──
  function setSource(shown, focus) {
    main.toggleAttribute('data-source-hidden', !shown);
    $('show-source').hidden = shown;
    $('hide-source').setAttribute('aria-expanded', String(shown));
    store.set('wiremark.source', shown ? 'shown' : 'hidden');
    if (focus) (shown ? $('source') : $('show-source')).focus();
    requestAnimationFrame(onChange);
  }
  $('hide-source').addEventListener('click', () => setSource(false, true));
  $('show-source').addEventListener('click', () => setSource(true, true));

  // ── Split (a WAI-ARIA window splitter: drag, arrows, Home/End, double-click resets) ──
  const split = $('splitter');
  function setSplit(pct, save) {
    const v = Math.min(SPLIT.max, Math.max(SPLIT.min, pct));
    main.style.setProperty('--src-w', v + '%');
    split.setAttribute('aria-valuenow', String(Math.round(v)));
    if (save) store.set('wiremark.split', String(v));
    onChange();
    return v;
  }
  split.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    split.setPointerCapture(e.pointerId);
    main.classList.add('dragging');
    let last = Number(split.getAttribute('aria-valuenow'));
    const move = (ev) => { const r = main.getBoundingClientRect(); last = setSplit(((ev.clientX - r.left) / r.width) * 100, false); };
    const up = () => {
      split.removeEventListener('pointermove', move); split.removeEventListener('pointerup', up); split.removeEventListener('pointercancel', up);
      main.classList.remove('dragging'); setSplit(last, true);
    };
    split.addEventListener('pointermove', move); split.addEventListener('pointerup', up); split.addEventListener('pointercancel', up);
  });
  split.addEventListener('keydown', (e) => {
    const now = Number(split.getAttribute('aria-valuenow'));
    const to = { ArrowLeft: now - 3, ArrowRight: now + 3, Home: SPLIT.min, End: SPLIT.max }[e.key];
    if (to === undefined) return;
    e.preventDefault(); setSplit(to, true);
  });
  split.addEventListener('dblclick', () => setSplit(SPLIT.auto, true));

  // ── Zoom: 85% on wide screens by default, so two phone screens of a flow sit side by side ──
  let zoom = null; // null = the automatic size
  const autoZoom = () => (wide.matches ? 0.85 : 1);
  // A zoom keeps the same spot of the drawing in the middle of the pane.
  const place = () => ({
    x: (preview.scrollLeft + preview.clientWidth / 2) / Math.max(1, preview.scrollWidth),
    y: (preview.scrollTop + preview.clientHeight / 2) / Math.max(1, preview.scrollHeight),
  });
  const keepPlace = (p) => preview.scrollTo({
    left: p.x * preview.scrollWidth - preview.clientWidth / 2, top: p.y * preview.scrollHeight - preview.clientHeight / 2,
  });
  function setZoom(z, save) {
    const keep = save ? place() : null;
    zoom = z;
    const shown = z ?? autoZoom();
    if (z === null) preview.style.removeProperty('--wm-zoom'); else preview.style.setProperty('--wm-zoom', String(z));
    preview.toggleAttribute('data-zoomed', z !== null && z > autoZoom());
    $('zoom-level').textContent = Math.round(shown * 100) + '%';
    $('zoom-level').title = z === null ? 'Automatic size' : 'Back to the automatic size';
    $('zoom-out').disabled = shown <= ZOOMS[0];
    $('zoom-in').disabled = shown >= ZOOMS[ZOOMS.length - 1];
    if (save) store.set('wiremark.zoom', z === null ? '' : String(z));
    requestAnimationFrame(() => { if (keep) keepPlace(keep); onChange(); });
  }
  const step = (dir) => {
    const now = zoom ?? autoZoom();
    const next = dir > 0 ? ZOOMS.find((z) => z > now + 0.001) : [...ZOOMS].reverse().find((z) => z < now - 0.001);
    if (next !== undefined) setZoom(next, true);
  };
  $('zoom-in').addEventListener('click', () => step(1));
  $('zoom-out').addEventListener('click', () => step(-1));
  $('zoom-level').addEventListener('click', () => setZoom(null, true));
  wide.addEventListener('change', () => setZoom(zoom, false));
  // Ctrl or ⌘ with the wheel, or with + / - / 0, zooms the drawing instead of the whole page.
  preview.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); step(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  preview.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); step(1); }
    else if (e.key === '-') { e.preventDefault(); step(-1); }
    else if (e.key === '0') { e.preventDefault(); setZoom(null, true); }
  });

  // ── Folding screens: each caption is a toggle ──
  const folded = new Set();
  const screens = () => [...preview.querySelectorAll('.wm-screen')];
  function paintFold(scr) {
    const on = folded.has(scr.dataset.wmScreen), cap = scr.querySelector(':scope > .wm-cap');
    scr.classList.toggle('is-folded', on);
    cap?.setAttribute('aria-expanded', String(!on));
  }
  function syncFoldAll() {
    const all = screens(), anyOpen = all.some((s) => !folded.has(s.dataset.wmScreen));
    $('fold-all').hidden = all.length < 2;
    $('fold-all').textContent = anyOpen ? 'Fold all' : 'Unfold all';
  }
  function toggle(scr) {
    const id = scr.dataset.wmScreen;
    if (folded.has(id)) folded.delete(id); else folded.add(id);
    paintFold(scr); syncFoldAll(); onChange();
  }
  function reveal(id) {
    if (!folded.delete(id)) return;
    const scr = preview.querySelector(`.wm-screen[data-wm-screen="${CSS.escape(id)}"]`);
    if (scr) paintFold(scr);
    syncFoldAll();
  }
  preview.addEventListener('click', (e) => {
    const cap = e.target.closest('.wm-screen > .wm-cap');
    if (cap) toggle(cap.parentElement);
  });
  preview.addEventListener('keydown', (e) => {
    const cap = e.target.closest?.('.wm-screen > .wm-cap');
    if (!cap || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault(); toggle(cap.parentElement);
  });
  $('fold-all').addEventListener('click', () => {
    const all = screens(), anyOpen = all.some((s) => !folded.has(s.dataset.wmScreen));
    for (const s of all) { if (anyOpen) folded.add(s.dataset.wmScreen); else folded.delete(s.dataset.wmScreen); paintFold(s); }
    syncFoldAll(); onChange();
  });

  // ── Screen chips: jump to a screen; the one in view is marked ──
  const nav = $('screens-nav');
  let watcher = null;
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-target]');
    if (b) goTo(b.dataset.target);
  });
  function buildNav() {
    const all = screens();
    nav.replaceChildren(...all.map((scr) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.target = scr.id;
      b.textContent = scr.querySelector(':scope > .wm-cap')?.textContent || scr.dataset.wmScreen;
      return b;
    }));
    nav.hidden = all.length < 2;
    requestAnimationFrame(markOverflow);
    watcher?.disconnect();
    if (nav.hidden || !('IntersectionObserver' in window)) return;
    const seen = new Map();
    watcher = new IntersectionObserver((entries) => {
      for (const en of entries) seen.set(en.target.id, en.isIntersecting ? en.intersectionRatio : 0);
      let best = null, ratio = 0;
      for (const [id, r] of seen) if (r > ratio) { best = id; ratio = r; }
      for (const b of nav.children) {
        const on = b.dataset.target === best;
        if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        if (on && b.offsetParent) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }, { root: wide.matches ? preview : null, threshold: [0, 0.25, 0.5, 0.75, 1] });
    all.forEach((s) => watcher.observe(s));
  }

  // A row that scrolls fades at the side it scrolls to.
  function markOverflow() {
    nav.toggleAttribute('data-more-end', nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2);
    nav.toggleAttribute('data-more-start', nav.scrollLeft > 2);
  }
  nav.addEventListener('scroll', markOverflow, { passive: true });
  addEventListener('resize', markOverflow);

  // Called after every render: captions become toggles, folds come back, chips are rebuilt.
  function decorate() {
    for (const scr of screens()) {
      const cap = scr.querySelector(':scope > .wm-cap');
      if (!cap) continue;
      cap.setAttribute('role', 'button');
      cap.tabIndex = 0;
      cap.title = 'Fold or unfold this screen';
      paintFold(scr);
    }
    syncFoldAll();
    buildNav();
  }

  // ── Start: what this browser chose last time ──
  setSource(store.get('wiremark.source') !== 'hidden', false);
  setSplit(Number(store.get('wiremark.split')) || SPLIT.auto, false);
  const z = Number(store.get('wiremark.zoom'));
  setZoom(ZOOMS.includes(z) ? z : null, false);
  return { decorate, reveal };
}
