// @device @look @title @flow @icons @motion @requires.
import { WM_LIMITS } from './limits.js';
import { resolveDevice } from './devices.js';
import { err } from './validate.js';
import { PACK_ID } from './packs.js';

export const MOTIONS = ['none', 'slide', 'fade', 'push', 'sheet', 'zoom'];

function digits(s) {
  if (!s || s.length > 5) return NaN;
  for (let i = 0; i < s.length; i++) if (s[i] < '0' || s[i] > '9') return NaN;
  return Number(s);
}

export function readHeader(raw, mock, flowAt, ctx) {
  const at = raw.tokens[0];
  const rest = raw.tokens.slice(1);
  const one = rest.length === 1 ? rest[0] : null;
  const fail = (m) => err(ctx, raw.line, at.col, 'bad_header', m);
  if (at.v === 'device') {
    // `fit` after the device: a screen ends at its content (layout.js), opt-in.
    const fit = rest.length === 2 && rest[1].t === 'word' && rest[1].v === 'fit';
    const dev = rest.length === 1 || fit ? rest[0] : null;
    const d = resolveDevice(dev && dev.t === 'word' ? dev.v : '');
    if (d) mock.device = fit ? { ...d, fit: true } : d;
    else fail('@device is phone, tablet, laptop, desktop or WxH with sides from 100 to 4000, optionally followed by fit.');
  } else if (at.v === 'look') {
    if (one && one.t === 'word' && (one.v === 'wire' || one.v === 'clean')) mock.look = one.v;
    else fail('@look is wire or clean.');
  } else if (at.v === 'title') {
    if (one && one.v.length > WM_LIMITS.label && (one.t === 'label' || one.t === 'word')) err(ctx, raw.line, one.col, 'limit_label', `A title may have at most ${WM_LIMITS.label} characters.`);
    else if (one && (one.t === 'label' || one.t === 'word')) mock.title = one.v;
    else fail('@title takes one label.');
  } else if (at.v === 'flow') {
    const ids = rest.filter((t) => t.t === 'word' || t.t === 'link').map((t) => t.v).filter((v) => v !== '');
    if (!ids.length || ids.length !== rest.length) fail('@flow lists screen ids.');
    else { mock.flow = ids; flowAt.line = raw.line; flowAt.col = at.col; }
  } else if (at.v === 'icons') {
    const ids = rest.every((t) => t.t === 'word') ? rest.map((t) => t.v).join(' ').split(/[\s,]+/).filter(Boolean) : [];
    if (ids.length && ids.length <= 8 && ids.every((v) => PACK_ID.test(v))) { mock.icons = ids; mock.iconsAt = { line: raw.line, col: at.col }; }
    else fail('@icons lists up to 8 icon pack ids.');
  } else if (at.v === 'motion') {
    if (one && one.t === 'word' && MOTIONS.includes(one.v)) mock.motion = one.v;
    else fail('@motion is none, slide, fade, push, sheet or zoom.');
  } else if (at.v === 'requires') {
    const major = one && one.t === 'word' ? digits(one.v.split('.')[0]) : NaN;
    if (!(major >= 1 && major <= 1)) fail('This block needs a newer wiredown (@requires 1).');
  } else fail(`Unknown header @${at.v}.`);
}
