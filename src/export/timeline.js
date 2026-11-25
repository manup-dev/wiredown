// The animated flow's timeline: per element, a list of [seconds, state] keyframes. The same list
// is written as CSS @keyframes (renderFlowAnimation) and evaluated at one time (renderFlowFrame),
// so a frame is the animation at that moment. A state is { o, x, y, s } (opacity, translate, scale).
// Every segment eases out, as CSS `ease-out` = cubic-bezier(0, 0, .58, 1).

const SHOWN = { o: 1, x: 0, y: 0, s: 1 };
const HIDDEN = { o: 0, x: 0, y: 0, s: 1 };
const CUT = 0.02; // seconds a `none` motion takes: a cut, still two keyframes apart

// How a screen is entered (from-state), per motion: the library's prototype keyframes
// (WIREDOWN_CSS); unknown = fade. As in the prototype, the screen before it is gone at once.
const IN = {
  slide: { o: 0, x: 32 }, fade: { o: 0 }, push: { o: 0.4, x: 64 }, sheet: { y: 48 }, zoom: { o: 0, s: 0.96 }, none: {},
};
const enterOf = (m) => ({ ...SHOWN, ...(IN[m] || IN.fade) });

const num = (st, k, d) => (typeof st[k] === 'number' ? st[k] : d);
const same = (a, b) => ['o', 'x', 'y', 's'].every((k) => num(a, k, k === 'o' || k === 's' ? 1 : 0) === num(b, k, k === 'o' || k === 's' ? 1 : 0));
// Drops a keyframe that equals both neighbours (lossless: the value holds either way).
const squeeze = (pts) => pts.filter((p, i) => i === 0 || i === pts.length - 1 || !(same(pts[i - 1][1], p[1]) && same(p[1], pts[i + 1][1])));

// The tap before a switch at `sw` (seconds), `f` = 1 at full speed: a finger dot fades in,
// presses (scale .85), and the screen change starts; a ring released by the press grows to 2.2x.
function tap(sw, f, T) {
  const at = (d) => sw + d * f;
  const dot = [[0, { o: 0 }], [at(-0.6), { o: 0 }], [at(-0.4), { o: 1 }], [at(-0.12), { o: 1, s: 0.85 }], [at(0.1), { o: 0, s: 0.85 }], [T, { o: 0 }]];
  const ring = [[0, { o: 0, s: 0.85 }], [at(-0.12), { o: 0, s: 0.85 }], [at(-0.02), { o: 1, s: 1.1 }], [at(0.4), { o: 0, s: 2.2 }], [T, { o: 0, s: 0.85 }]];
  return { dot, ring };
}

/** motions[k]: how step k is entered; tapFor(k): step k ends with a tap. Tracks per step. */
export function timeline(motions, step, transition, tapFor) {
  const n = motions.length;
  const T = Math.round(n * step * 1000) / 1000;
  const dur = motions.map((m) => (m === 'none' ? Math.min(CUT, transition || CUT) : transition));
  const nudge = T * 0.00002; // a hold right before a jump, so the jump is not a slow fade
  const out = { total: T, screens: [], labels: [], dots: [], rings: [] };
  if (n < 2) return { ...out, screens: [null], labels: [null], dots: [null], rings: [null] };
  for (let k = 0; k < n; k++) {
    const next = (k + 1) % n;
    const inAt = (k === 0 ? T : k * step) - dur[k];
    const sw = (k + 1) * step - dur[next]; // the next screen starts entering: this one is gone
    const enter = enterOf(motions[k]);
    const pts = k === 0
      ? [[0, SHOWN], [sw - nudge, SHOWN], [sw, HIDDEN], [inAt - nudge, HIDDEN], [inAt, enter], [T, SHOWN]]
      : [[0, HIDDEN], [inAt - nudge, HIDDEN], [inAt, enter], [k * step, SHOWN], [sw - nudge, SHOWN], [sw, HIDDEN], [T, HIDDEN]];
    out.screens.push(squeeze(pts));
    out.labels.push(squeeze(pts.map(([t, st]) => [t, { o: st === SHOWN ? 1 : 0 }])));
    const t = k < n - 1 && tapFor(k) ? tap(sw, Math.min(1, (step - dur[next]) / 0.75), T) : null;
    out.dots.push(t && t.dot);
    out.rings.push(t && t.ring);
  }
  return out;
}

// x and y of cubic-bezier(0, 0, .58, 1) at parameter u.
const bx = (u) => 1.74 * (1 - u) * u * u + u * u * u;
const by = (u) => 3 * (1 - u) * u * u + u * u * u;
function easeOut(p) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bx(m) < p) lo = m; else hi = m; }
  return by((lo + hi) / 2);
}


/** The state of a track at `at` seconds (0 <= at <= total). */
export function stateAt(pts, at) {
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1][0] <= at) i++;
  const [t0, a] = pts[i];
  const [t1, b] = pts[i + 1];
  const p = t1 > t0 ? easeOut(Math.max(0, Math.min(1, (at - t0) / (t1 - t0)))) : 1;
  const mix = (k, d) => num(a, k, d) + (num(b, k, d) - num(a, k, d)) * p;
  return { o: mix('o', 1), x: mix('x', 0), y: mix('y', 0), s: mix('s', 1) };
}

/** A number for CSS or an attribute: at most 3 decimals, no trailing zeros, never "-0". */
export function fmt(v) {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? '0' : String(r);
}

function cssState(st, withTransform) {
  let out = `opacity:${fmt(num(st, 'o', 1))}`;
  if (!withTransform) return out;
  const x = num(st, 'x', 0);
  const y = num(st, 'y', 0);
  const s = num(st, 's', 1);
  const parts = [];
  if (x || y) parts.push(`translate(${fmt(x)}px,${fmt(y)}px)`);
  if (s !== 1) parts.push(`scale(${fmt(s)})`);
  return out + `;transform:${parts.length ? parts.join(' ') : 'none'}`;
}

/** `@keyframes name{…}` from a track; percentages from times over `total`. */
export function keyframesCss(name, pts, total, withTransform) {
  let out = `@keyframes ${name}{`;
  for (const [t, st] of pts) out += `${fmt((t / total) * 100)}%{${cssState(st, withTransform)}}`;
  return out + '}';
}

/** ` opacity="…" transform="…"` for a frame, scaling about (cx, cy); null when invisible. */
export function frameAttrs(st, cx, cy) {
  if (st.o <= 0.001) return null;
  let out = st.o >= 0.999 ? '' : ` opacity="${fmt(st.o)}"`;
  if (st.x || st.y || st.s !== 1) {
    const tx = st.x + cx * (1 - st.s);
    const ty = st.y + cy * (1 - st.s);
    out += ` transform="translate(${fmt(tx)} ${fmt(ty)})${st.s !== 1 ? ` scale(${fmt(st.s)})` : ''}"`;
  }
  return out;
}
