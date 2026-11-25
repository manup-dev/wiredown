// wiremark kind -> @openuidev/react-ui component. Every component and argument name comes from the generated
// table (openui-schema.js); a component the table lacks falls back to the next candidate, the last being the
// library root (containers) or TextContent with the label. Choices as built against react-ui 0.19.0:
//   screen                -> the library root (Stack)
//   stack, row, grid      -> Stack (row: direction "row"; grid: "row" + wrap); all-button runs -> Buttons
//   card, sheet           -> Card, the label as a CardHeader first child
//   modal                 -> Modal(label, true, …) when its children fit Modal's slot, else Card
//   toast                 -> Callout(tone, label, "")
//   spacer                -> dropped (flex spacing has no OpenUI counterpart); divider -> Separator
//   h1 h2 h3 text         -> TextContent with size large-heavy | large | small-heavy | default (small if muted)
//   link                  -> Button(label, @ToAssistant("Go to <screen>"), "tertiary")
//   button                -> Button(label, action, "primary" when primary); icon only -> IconButton
//   input textarea select -> FormControl(label, Input | TextArea | Select(SelectItem…), error as hint)
//   checkbox radio toggle -> one CheckBoxGroup | RadioGroup | SwitchGroup per run of siblings of that kind
//   image                 -> Image(label) with no src; icon -> Icon (lucide name); avatar, badge -> Tag
//   list, tabbar          -> ListBlock of ListItem(title, subtitle, …, action)
//   table                 -> Table of Col(name, []) (no rows); tabs -> Tabs of TabItem(id, label, [])
//   navbar                -> CardHeader(label); with back or children, a row Stack with a Back Button
// Lost on the way (no counterpart in the library): pad, w/h, grow, span, disabled, loading, selected, muted
// on controls, item children, table children. A child a parent's slot refuses is wrapped in Buttons (all
// buttons) or a root Stack. Gap px -> the nearest react-ui space token (dist/styles: 0 6 8 12 18 24 36 px).
import { OPENUI_SCHEMA } from './openui-schema.js';
import { hasComponent as has, slotOf, inline } from './openui-lit.js';

const ROOT = OPENUI_SCHEMA.root;
const GAPS = [['none', 0], ['xs', 6], ['s', 8], ['m', 12], ['l', 18], ['xl', 24], ['2xl', 36]];
// Lookup tables have no prototype and are read only through own(): author text such as icon=constructor
// must look up nothing, never an Object.prototype member.
const table = (o) => Object.freeze(Object.assign(Object.create(null), o));
const own = (t, key) => (typeof key === 'string' && Object.hasOwn(t, key) ? t[key] : undefined);
const ICONS = table({ card: 'credit-card', more: 'ellipsis' }); // wiremark icon names lucide spells differently
const BRANDS = new Set(['google']); // no lucide icon: the "brands" category draws its fallback
const CALLOUT_TONES = table({ good: 'success', bad: 'error', warn: 'warning', info: 'info' });
const TAG_TONES = table({ good: 'success', bad: 'danger', warn: 'warning', info: 'info' });
const SIZES = table({ h1: 'large-heavy', h2: 'large', h3: 'small-heavy' });
const CHOICES = table({ checkbox: ['CheckBoxGroup', 'CheckBoxItem'], radio: ['RadioGroup', 'RadioItem'], toggle: ['SwitchGroup', 'SwitchItem'] });

const flag = (n, f) => n.flags.includes(f);
const label = (n, i = 0) => n.labels[i] ?? '';
const kindOf = (r) => r.component;

function gap(v) {
  if (!/^\d{1,4}$/.test(String(v ?? ''))) return null;
  let best = GAPS[0];
  for (const g of GAPS) if (Math.abs(g[1] - v) < Math.abs(best[1] - v)) best = g;
  return best[0];
}

function action(n, labels) {
  if (!n.link) return flag(n, 'back') ? { $action: 'Go back' } : null;
  if (n.link === 'back') return { $action: 'Go back' };
  return { $action: `${flag(n, 'back') ? 'Go back to' : 'Go to'} ${labels.get(n.link) ?? n.link}` };
}

function icon(name) {
  const props = { name: own(ICONS, name) ?? String(name) };
  if (BRANDS.has(name)) props.category = 'brands';
  return has('Icon') ? inline('Icon', props) : null;
}

const text = (s, size) => ({ component: 'TextContent', props: { text: s, size } });

/** Emits a node's children, a run of same-kind choice controls as one group node. */
function kids(n, ctx) {
  const out = [];
  const list = n.children;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    let node = c;
    if (own(CHOICES, c.kind)) {
      const run = [c];
      while (i + 1 < list.length && list[i + 1].kind === c.kind) run.push(list[++i]);
      node = { kind: '$choices', of: c.kind, id: c.id, items: run, children: [], note: run.map((r) => r.note).filter(Boolean).join('; ') || null };
    }
    const ref = ctx.emit(node);
    if (ref) out.push(ref);
  }
  return out;
}

/** Fits refs into a slot: refused runs go in Buttons (all buttons) or a root Stack. null when nothing fits. */
function fit(component, arg, refs) {
  const ok = slotOf(component, arg);
  if (!ok) return refs;
  const out = [];
  let run = [];
  const flush = () => {
    if (!run.length) return true;
    if (run.every((r) => kindOf(r) === 'Button') && ok.includes('Buttons')) out.push(inline('Buttons', { buttons: run }));
    else if (ok.includes(ROOT) && !slotOf(ROOT, 'children')) out.push(inline(ROOT, { children: run }));
    else return false;
    run = [];
    return true;
  };
  for (const r of refs) {
    if (!ok.includes(kindOf(r))) { run.push(r); continue; }
    if (!flush()) return null;
    out.push(r);
  }
  return flush() ? out : null;
}

const column = (children, extra = {}) => ({ component: ROOT, props: { children, ...extra } });

function layout(n, ctx) {
  const refs = kids(n, ctx);
  const dir = n.kind === 'stack' ? null : 'row';
  if (n.kind !== 'grid' && refs.length && refs.every((r) => kindOf(r) === 'Button') && has('Buttons'))
    return { component: 'Buttons', props: { buttons: refs, direction: dir ?? 'column' } };
  const a = n.attrs;
  return column(refs, { direction: dir, gap: gap(a.gap), align: a.align, justify: a.justify, wrap: n.kind === 'grid' || null });
}

function card(n, ctx, refs = kids(n, ctx)) {
  const head = label(n) && has('CardHeader') ? [inline('CardHeader', { title: label(n) })] : [];
  const children = has('Card') ? fit('Card', 'children', [...head, ...refs]) : null;
  if (children) return { component: 'Card', props: { children, gap: gap(n.attrs.gap) } };
  return column([...head, ...refs]);
}

function modal(n, ctx) {
  const refs = kids(n, ctx);
  const children = has('Modal') ? fit('Modal', 'children', refs) : null;
  if (children) return { component: 'Modal', props: { title: label(n), open: true, children } };
  return card(n, ctx, refs);
}

function control(n) {
  const placeholder = n.attrs.placeholder ?? null;
  if (n.kind === 'input' && has('Input')) return inline('Input', { name: n.id, placeholder, type: n.attrs.type });
  if (n.kind === 'textarea' && has('TextArea')) return inline('TextArea', { name: n.id, placeholder, rows: Number(n.attrs.rows) || null });
  if (n.kind === 'select' && has('Select')) {
    const opts = String(n.attrs.options ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const items = has('SelectItem') ? opts.map((o) => inline('SelectItem', { value: o, label: o })) : [];
    return inline('Select', { name: n.id, items, placeholder });
  }
  return null;
}

function field(n) {
  const c = control(n);
  if (!c) return text(label(n));
  if (label(n) && has('FormControl')) return { component: 'FormControl', props: { label: label(n), input: c, hint: n.attrs.error ?? null } };
  return { component: c.$call, props: c.props };
}

function choices(n) {
  const [group, item] = own(CHOICES, n.of);
  if (!has(group) || !has(item)) return text(n.items.map((c) => label(c)).join(', '));
  const on = (c) => flag(c, 'checked') || flag(c, 'on') || flag(c, 'selected') || null;
  const items = n.items.map((c) => inline(item, { label: label(c), description: '', name: c.id, value: c.id, defaultChecked: on(c) }));
  const picked = n.items.find(on);
  return { component: group, props: { name: n.id, items, defaultValue: n.of === 'radio' && picked ? picked.id : null } };
}

function navbar(n, ctx) {
  const title = has('CardHeader') ? inline('CardHeader', { title: label(n) }) : inline('TextContent', { text: label(n), size: 'large-heavy' });
  const back = flag(n, 'back') && has('Button') ? inline('Button', { label: 'Back', action: action(n, ctx.labels), variant: 'tertiary' }) : null;
  const refs = kids(n, ctx);
  if (!back && !refs.length) return { component: title.$call, props: title.props };
  return column([back, title, ...refs].filter(Boolean), { direction: 'row', align: 'center' });
}

function button(n, ctx) {
  const act = action(n, ctx.labels);
  if (!label(n) && n.attrs.icon && has('IconButton') && has('Icon'))
    return { component: 'IconButton', props: { name: n.id, icon: icon(n.attrs.icon), action: act } };
  if (!has('Button')) return text(label(n));
  return { component: 'Button', props: { label: label(n), action: act, variant: n.kind === 'link' ? 'tertiary' : flag(n, 'primary') ? 'primary' : null } };
}

function list(n, ctx) {
  const refs = kids(n, ctx);
  const items = has('ListBlock') ? fit('ListBlock', 'items', refs) : null;
  return items ? { component: 'ListBlock', props: { items } } : column(refs);
}

const map = table({
  screen: (n, ctx) => column(kids(n, ctx)),
  stack: layout, row: layout, grid: layout,
  card, sheet: card, modal, navbar, list, tabbar: list,
  toast: (n, ctx) => {
    const callout = has('Callout') ? { component: 'Callout', props: { variant: own(CALLOUT_TONES, n.attrs.tone) ?? 'neutral', title: label(n), description: '' } } : text(label(n));
    const refs = kids(n, ctx);
    return refs.length ? column([inline(callout.component, callout.props), ...refs]) : callout;
  },
  spacer: () => null,
  divider: () => (has('Separator') ? { component: 'Separator', props: {} } : null),
  h1: (n) => text(label(n), own(SIZES, 'h1')), h2: (n) => text(label(n), own(SIZES, 'h2')), h3: (n) => text(label(n), own(SIZES, 'h3')),
  text: (n) => text(label(n), flag(n, 'muted') ? 'small' : null),
  link: button, button,
  input: field, textarea: field, select: field,
  $choices: choices,
  image: (n) => (has('Image') ? { component: 'Image', props: { alt: label(n) } } : text(label(n))),
  icon: (n) => { const i = icon(n.attrs.icon ?? label(n)); return i ? { component: 'Icon', props: i.props } : null; },
  avatar: (n) => (has('Tag') ? { component: 'Tag', props: { text: label(n) } } : text(label(n))),
  badge: (n) => (has('Tag')
    ? { component: 'Tag', props: { text: label(n), icon: n.attrs.icon ? icon(n.attrs.icon) : null, variant: flag(n, 'muted') ? 'neutral' : own(TAG_TONES, n.attrs.tone) ?? null } }
    : text(label(n))),
  item: (n, ctx) => (has('ListItem')
    ? { component: 'ListItem', props: { title: label(n), subtitle: n.labels[1] ?? null, action: action(n, ctx.labels) } }
    : text(label(n))),
  table: (n) => {
    const cols = String(n.attrs.cols ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!has('Table') || !has('Col')) return text(cols.join(', '));
    return { component: 'Table', props: { columns: cols.map((c) => inline('Col', { label: c, data: [] })) } };
  },
  tabs: (n) => {
    if (!has('Tabs') || !has('TabItem')) return text(n.children.map((t) => label(t)).join(', '));
    return { component: 'Tabs', props: { items: n.children.map((t) => inline('TabItem', { value: t.id, trigger: label(t), content: [] })) } };
  },
});

/** One node -> { component, props } or null (dropped). ctx = { emit(node) -> ref | null, labels: Map }. */
export function mapNode(node, ctx) {
  const m = (own(map, node.kind) ?? ((n) => text(label(n))))(node, ctx);
  return m && has(m.component) ? m : null;
}
