// Paint tokens per look. Ops name a token; only the serializer turns it into attributes.
// wire: currentColor at opacities, nothing else, so it prints black and white and follows dark mode.
// Both looks share one opaque `surface`: host sets --wm-bg to its page background; the fallback is the
// system colour Canvas, so a reader in a dark colour scheme gets a dark plate.
// clean: the same structure plus a few presentation colours; the accent alone also carries a
// CSS variable fallback so a host page can retheme it (never class-only paint: EPUB has no stylesheet).
export const ACCENT = '#3b5bdb';
const TONE_HEX = { good: '#2f9e44', bad: '#e03131', warn: '#e8590c', info: '#1c7ed6' };

const cc = (op) => (op === undefined ? 'fill="currentColor"' : `fill="currentColor" fill-opacity="${op}"`);
const sc = (op) => (op === undefined ? 'stroke="currentColor"' : `stroke="currentColor" stroke-opacity="${op}"`);
const t = (attrs, style) => (style ? { attrs, style } : { attrs });

const BASE_FILL = {
  none: t('fill="none"'),
  clear: t(cc('0')),
  wash: t(cc('.03')),
  faint: t(cc('.06')),
  soft: t(cc('.12')),
  mid: t(cc('.25')),
  solid: t(cc('.9')),
  ink: t(cc()),
  strong: t(cc('.85')),
  muted: t(cc('.6')),
  hint: t(cc('.42')),
  // the one opaque paint, in both looks: overlays and note badges never show what is under them
  surface: t('fill="#fff"', 'fill:var(--wm-bg,Canvas)'),
};
const BASE_STROKE = {
  none: t('stroke="none"'),
  hair: t(sc('.18')),
  line: t(sc('.35')),
  hint: t(sc('.42')),
  muted: t(sc('.6')),
  strong: t(sc('.6')),
  ink: t(sc('.9')),
};

const WIRE = {
  name: 'wire',
  fill: {
    ...BASE_FILL,
    accent: BASE_FILL.ink, accentSoft: BASE_FILL.soft, onAccent: BASE_FILL.ink,
    good: BASE_FILL.ink, bad: BASE_FILL.ink, warn: BASE_FILL.ink, info: BASE_FILL.ink,
    goodSoft: BASE_FILL.soft, badSoft: BASE_FILL.soft, warnSoft: BASE_FILL.soft, infoSoft: BASE_FILL.soft,
  },
  stroke: {
    ...BASE_STROKE,
    accent: BASE_STROKE.ink, onAccent: BASE_STROKE.ink,
    good: BASE_STROKE.ink, bad: BASE_STROKE.ink, warn: BASE_STROKE.ink, info: BASE_STROKE.ink,
  },
  radius: { control: 6, card: 8, frameSmall: 24, frameLarge: 10 },
};

const accentFill = (op) => t(op ? `fill="${ACCENT}" fill-opacity="${op}"` : `fill="${ACCENT}"`, `fill:var(--wm-accent,${ACCENT})`);
const hexFill = (hex, op) => t(op ? `fill="${hex}" fill-opacity="${op}"` : `fill="${hex}"`);

const CLEAN = {
  name: 'clean',
  fill: {
    ...BASE_FILL,
    accent: accentFill(), accentSoft: accentFill('.12'), onAccent: t('fill="#fff"'),
    good: hexFill(TONE_HEX.good), bad: hexFill(TONE_HEX.bad), warn: hexFill(TONE_HEX.warn), info: hexFill(TONE_HEX.info),
    goodSoft: hexFill(TONE_HEX.good, '.14'), badSoft: hexFill(TONE_HEX.bad, '.12'),
    warnSoft: hexFill(TONE_HEX.warn, '.14'), infoSoft: hexFill(TONE_HEX.info, '.12'),
  },
  stroke: {
    ...BASE_STROKE,
    accent: t(`stroke="${ACCENT}"`, `stroke:var(--wm-accent,${ACCENT})`), onAccent: t('stroke="#fff"'),
    good: t(`stroke="${TONE_HEX.good}"`), bad: t(`stroke="${TONE_HEX.bad}"`),
    warn: t(`stroke="${TONE_HEX.warn}"`), info: t(`stroke="${TONE_HEX.info}"`),
  },
  radius: { control: 8, card: 12, frameSmall: 28, frameLarge: 12 },
};

export const LOOKS = Object.freeze({ wire: WIRE, clean: CLEAN });
export const TONES = Object.freeze(['good', 'bad', 'warn', 'info']);

const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
export const lookOf = (name) => (name === 'clean' ? CLEAN : WIRE);
export const fillToken = (look, k) => (own(look.fill, k) ? look.fill[k] : null);
export const strokeToken = (look, k) => (own(look.stroke, k) ? look.stroke[k] : null);
/** A tone attr from author text becomes a token only when it is one of the four. */
export const toneOf = (v) => (TONES.includes(v) ? v : null);
