// Deterministic flex layout of one screen: Box tree with absolute, 0.5-rounded coordinates.
// Overlays (modal, sheet, toast) float over the screen and do not count toward height or the fold.
// `@device … fit` ends a screen at its content (at least FIT_MIN, at most the device height; a
// taller screen keeps its fold line). A screen with an overlay ignores fit: overlays are placed
// against the device height, so the frame keeps it.
import { leafSize } from './leaf.js';
import { isContainer, plan, newCtx, hugW, naturalH } from './plan.js';
import { OVERLAYS, S } from './sizes.js';

const r2 = (v) => Math.max(0, Math.round(v * 2) / 2);

function box(node, x, y, w, h, ctx) {
  const b = { node, x: r2(x), y: r2(y), w: r2(w), h: r2(h), children: [] };
  if (isContainer(node)) {
    const p = plan(node, w, h, ctx);
    if (p.lines) b.lines = p.lines;
    for (const k of p.kids) b.children.push(box(k.c, x + k.x, y + k.y, k.w, k.h, ctx));
  } else {
    const s = leafSize(node, w);
    if (s.lines) b.lines = s.lines;
    if (s.fieldY !== undefined) b.fieldY = r2(y + s.fieldY);
  }
  return b;
}

function overlay(node, W, viewH, ctx) {
  const wn = node.attrs.w !== undefined && Number.isFinite(Number(node.attrs.w)) ? Number(node.attrs.w) : null;
  let w;
  if (node.kind === 'sheet') w = W;
  else if (node.kind === 'modal') w = Math.min(wn ?? S.modalMax, W - 2 * S.overlayPad);
  else w = Math.min(wn ?? hugW(node, ctx), W - 2 * S.overlayPad);
  const h = naturalH(node, w, ctx);
  const x = (W - w) / 2;
  let y = (viewH - h) / 2;
  if (node.kind === 'sheet') y = viewH - h;
  else if (node.kind === 'toast') y = viewH - h - S.toastMargin;
  return box(node, x, Math.max(0, y), w, h, ctx);
}

export const FIT_MIN = 240;

/** screen: parsed Screen; device: { w, h, fit? }. */
export function layoutScreen(screen, device) {
  const ctx = newCtx();
  const root = screen.root;
  const content = naturalH(root, device.w, ctx);
  const fit = device.fit === true && !root.children.some((c) => OVERLAYS.has(c.kind));
  const height = content > device.h ? content : fit ? Math.min(device.h, Math.max(FIT_MIN, content)) : device.h;
  const top = box(root, 0, 0, device.w, height, ctx);
  for (const c of root.children) if (OVERLAYS.has(c.kind)) top.children.push(overlay(c, device.w, device.h, ctx));
  return { root: top, width: device.w, height, fold: device.h < content ? device.h : null };
}
