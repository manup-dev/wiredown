// The Play panel: the flow as a looping animation (the standalone SVG a README can show), with
// downloads of that SVG and of a GIF, a README snippet and a link that opens this panel.
import { renderFlowAnimation, renderFlowFrame, flowDuration, flowPath } from '../src/export/index.js';
import { createGifEncoder } from './gif.js';

export const GIF_FPS = 12;
export const GIF_MAX_WIDTH = 720;

/** Frame times and delays (1/100 s) for `total` seconds at `fps`; delays add up to the loop. */
export function framePlan(total, fps = GIF_FPS) {
  const n = Math.max(1, Math.round(total * fps));
  const cs = (i) => Math.round((i * 100 * total) / n);
  return Array.from({ length: n }, (_, i) => ({ at: (i * total) / n, delay: cs(i + 1) - cs(i) }));
}

/** The markdown line that shows `file` in a README. */
export function readmeSnippet(title, file) {
  const alt = String(title || 'Flow').replace(/[[\]\\]/g, (c) => '\\' + c).replace(/\s+/g, ' ').trim();
  return `![${alt}](./${file})`;
}

/** The size of a standalone SVG from its root tag. */
export function svgSize(svg) {
  const m = /^<svg\b[^>]*?\bwidth="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/.exec(svg);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}

const isError = (svg) => /^<svg[^>]*class="wm-error"/.test(svg);
const kb = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const seconds = (s) => `${Math.round(s * 10) / 10} s`;
const svgUrl = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg);

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = url;
  });
}

/**
 * deps: { $, source, info(), icons(), title(), nameBase(), copyText(text), download(name, type, data),
 * toast(message), shareUrl() → Promise<string> (the plain share link) }.
 */
export function initPlay(deps) {
  const { $, source, info, icons, title, nameBase, copyText, download, toast, shareUrl } = deps;
  const dialog = $('play'), img = $('play-img'), steps = $('play-steps'), note = $('play-note');
  const gifBtn = $('play-gif'), progress = $('play-progress'), bar = $('play-bar'), status = $('play-status');
  let back = null, svg = '', run = null;

  function paint() {
    const text = source.value, inf = info(), ic = icons();
    svg = renderFlowAnimation(text, inf, { icons: ic });
    const bad = isError(svg);
    const n = bad ? 0 : flowPath(text, inf).steps.length;
    img.src = svgUrl(svg);
    img.alt = bad ? 'This flow cannot be played' : `${title()}: an animation of ${n} screens, one after another`;
    steps.textContent = bad ? 'Fix the problems in the source to play this flow.'
      : `${n} ${n === 1 ? 'screen' : 'screens'}, loops every ${seconds(flowDuration(text, inf))}`;
    for (const id of ['play-svg', 'play-gif', 'play-readme', 'play-link']) $(id).disabled = bad;
    note.hidden = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function open() {
    if (dialog.open) return;
    back = document.activeElement;
    paint();
    dialog.showModal();
    $('play-close').focus();
  }
  function close() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close', () => {
    cancelGif();
    img.removeAttribute('src');
    const to = back && back.isConnected && back !== document.body ? back : $('play-open');
    to?.focus();
  });
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  // Keep Tab inside the panel (a modal dialog would let it reach the browser's own controls).
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  $('play-close').addEventListener('click', close);

  const svgName = () => `${nameBase()}.svg`;
  $('play-svg').addEventListener('click', () => download(svgName(), 'image/svg+xml', svg));
  $('play-readme').addEventListener('click', async () => {
    const ok = await copyText(readmeSnippet(title(), svgName()));
    toast(ok ? `Snippet copied. Download ${svgName()} and commit it next to your README.` : 'Could not copy the snippet.');
  });
  $('play-link').addEventListener('click', async () => {
    let url;
    try { url = (await shareUrl()) + '!play'; } catch { toast('Could not make the link in this browser.'); return; }
    toast((await copyText(url)) ? 'Link copied. It opens this animation.' : 'Could not copy the link.');
  });

  // ── GIF: one frame at a time through a canvas, so the page stays responsive ──
  // A cancel frees the button at once; the cancelled run stops at its next step and touches nothing.
  function cancelGif() {
    if (!run) return;
    run.cancelled = true;
    run = null;
    gifBtn.disabled = isError(svg);
    if (progress.contains(document.activeElement)) gifBtn.focus();
    progress.hidden = true;
    toast('GIF cancelled');
  }
  $('play-cancel').addEventListener('click', cancelGif);
  gifBtn.addEventListener('click', async () => {
    if (run) return;
    const me = (run = { cancelled: false });
    const text = source.value, inf = info(), ic = icons(), name = `${nameBase()}.gif`;
    const plan = framePlan(flowDuration(text, inf));
    const frame = (at) => renderFlowFrame(text, inf, { at, icons: ic, theme: 'light' });
    gifBtn.disabled = true; progress.hidden = false; bar.value = 0; status.textContent = 'Making the GIF';
    try {
      const size = svgSize(frame(0));
      if (!size) throw new Error('size');
      const scale = Math.min(1, GIF_MAX_WIDTH / size.w);
      const W = Math.max(1, Math.round(size.w * scale)), H = Math.max(1, Math.round(size.h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const enc = createGifEncoder(W, H);
      let last = null;
      for (let i = 0; i < plan.length; i++) {
        if (me.cancelled) return;
        const s = frame(plan[i].at);
        if (s === last) enc.repeat(plan[i].delay);
        else {
          const pic = await loadImage(svgUrl(s));
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
          ctx.drawImage(pic, 0, 0, W, H);
          enc.addFrame(ctx.getImageData(0, 0, W, H).data, plan[i].delay);
          last = s;
        }
        if (me.cancelled) return;
        bar.value = (i + 1) / plan.length;
        status.textContent = `Making the GIF: frame ${i + 1} of ${plan.length}`;
        await new Promise((r) => setTimeout(r, 0));
      }
      if (me.cancelled) return;
      const bytes = enc.finish();
      download(name, 'image/gif', bytes);
      toast(`GIF saved (${kb(bytes.length)}, ${W} by ${H} pixels)`);
    } catch {
      if (!me.cancelled) toast('Could not make the GIF in this browser.');
    } finally {
      if (run === me) {
        run = null;
        gifBtn.disabled = isError(svg);
        progress.hidden = true;
      }
    }
  });

  return { open, close, repaint: () => { if (dialog.open && !run) paint(); }, get isOpen() { return dialog.open; } };
}
