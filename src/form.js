// kindForm: a kind's properties as a host's form draws them, built from KINDS. Its own attributes
// come first, then the box attributes (w h pad gap grow align justify span note).
import { KINDS, hasKind } from './kinds.js';

const BOX = ['w', 'h', 'pad', 'gap', 'grow', 'align', 'justify', 'span', 'note'];
const LABEL_NAMES = ['label', 'detail'];

function attr(name, type) {
  if (name === 'icon') return { name, type: 'icon' };
  if (type === 'size' || type === 'string' || type === 'number') return { name, type };
  if (type.startsWith('enum:')) return { name, type: 'enum', options: type.slice(5).split('|') };
  if (type.startsWith('number:')) {
    const [min, max] = type.slice(7).split('-').map(Number);
    return { name, type: 'number', min, max };
  }
  return { name, type: 'string' }; // color and anything newer read as text
}

// Returns { kind, group, labels: [{ name, type }], flags, attrs: [{ name, type, options?, min?, max? }],
// container, accepts }, or null for a word that is not a kind.
export function kindForm(kind) {
  if (!hasKind(kind)) return null;
  const k = KINDS[kind];
  const names = Object.keys(k.attrs);
  const own = names.filter((n) => !BOX.includes(n));
  const box = BOX.filter((n) => names.includes(n));
  const labels = [];
  for (let i = 0; i < k.labels; i++) labels.push({ name: LABEL_NAMES[i], type: kind === 'icon' && i === 0 ? 'icon' : 'string' });
  return {
    kind, group: k.group, labels, flags: [...k.flags],
    attrs: [...own, ...box].map((n) => attr(n, k.attrs[n])),
    container: k.children !== 'none', accepts: Array.isArray(k.children) ? [...k.children] : k.children,
  };
}
