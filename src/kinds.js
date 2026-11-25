// Kind registry: one row per kind. Attr types: number | number:lo-hi | size | enum:a|b | string | color.
const BOX = {
  w: 'size', h: 'size', pad: 'number', gap: 'number', grow: 'number',
  align: 'enum:start|center|end|stretch', justify: 'enum:start|center|end|between',
  span: 'number', note: 'string',
};
const TYPES = 'enum:text|password|email|number|search|tel|url';
const TONES = 'enum:good|bad|warn|info';

const row = (name, group, children, attrs = {}, flags = [], labels = 0) =>
  ({ name, group, children, attrs: Object.freeze({ ...BOX, ...attrs }), flags: Object.freeze(flags), labels });

const rows = [
  row('screen', 'frame', 'any', {}, [], 1),
  row('modal', 'frame', 'any', {}, [], 1),
  row('sheet', 'frame', 'any', {}, [], 1),
  row('toast', 'frame', 'any', { tone: TONES }, [], 1),
  row('stack', 'layout', 'any'),
  row('row', 'layout', 'any'),
  row('grid', 'layout', 'any', { cols: 'number:1-12' }),
  row('card', 'layout', 'any', {}, [], 1),
  row('spacer', 'layout', 'none'),
  row('divider', 'layout', 'none'),
  row('h1', 'text', 'none', {}, ['muted'], 1),
  row('h2', 'text', 'none', {}, ['muted'], 1),
  row('h3', 'text', 'none', {}, ['muted'], 1),
  row('text', 'text', 'none', {}, ['muted'], 1),
  row('link', 'text', 'none', { icon: 'string' }, ['muted', 'back'], 1),
  row('button', 'control', 'none', { icon: 'string' }, ['primary', 'disabled', 'loading', 'selected', 'back'], 1),
  row('input', 'control', 'none', { placeholder: 'string', type: TYPES, error: 'string' }, ['disabled'], 1),
  row('textarea', 'control', 'none', { placeholder: 'string', rows: 'number', error: 'string' }, ['disabled'], 1),
  row('select', 'control', 'none', { placeholder: 'string', options: 'string', error: 'string' }, ['disabled'], 1),
  row('checkbox', 'control', 'none', {}, ['checked', 'disabled'], 1),
  row('radio', 'control', 'none', {}, ['checked', 'selected', 'disabled'], 1),
  row('toggle', 'control', 'none', {}, ['on', 'disabled'], 1),
  row('image', 'media', 'none', {}, [], 1),
  row('icon', 'media', 'none', { icon: 'string' }, [], 1),
  row('avatar', 'media', 'none', {}, [], 1),
  row('badge', 'media', 'none', { tone: TONES, icon: 'string' }, ['muted'], 1),
  row('list', 'data', ['item']),
  row('item', 'data', 'any', { icon: 'string' }, ['selected', 'muted'], 2),
  row('table', 'data', 'any', { cols: 'string', rows: 'number' }),
  row('tabs', 'data', ['tab']),
  row('tab', 'data', 'none', { icon: 'string' }, ['selected'], 1),
  row('navbar', 'data', 'any', {}, ['back'], 1),
  row('tabbar', 'data', ['item']),
];

export const KINDS = Object.freeze(Object.fromEntries(rows.map((r) => [r.name, Object.freeze(r)])));
export const hasKind = (name) => Object.prototype.hasOwnProperty.call(KINDS, name);
