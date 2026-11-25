// OpenUI Lang literals and component calls, read against the generated table (openui-schema.js).
// Values the map builds: plain JSON values, { $ref, component } (another statement), { $call, props }
// (an inline component call) and { $action } (an @ToAssistant action). Nothing else is ever written.
import { OPENUI_SCHEMA } from './openui-schema.js';

const S = OPENUI_SCHEMA.components;

/** A double-quoted string: lang-core reads it with JSON.parse, so JSON escaping is exact. */
export const str = (s) => JSON.stringify(String(s)).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Text for a `//` comment, which runs to the end of its line: no line break or control character. */
export const commentText = (s) => String(s).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]/g, ' ').trim();

// The neutral value of a required argument the map could not fill (never null: the parser refuses it).
function neutral(spec, arg) {
  const en = spec.enums?.[arg];
  if (en) return en[0];
  switch (spec.types[arg]) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'array': return [];
    case 'object': return {};
    default: return null;
  }
}

function argValue(spec, arg, props) {
  let v = Object.prototype.hasOwnProperty.call(props, arg) ? props[arg] : null;
  const en = spec.enums?.[arg];
  if (v !== null && v !== undefined && en && !en.includes(v)) v = null; // never send a value the enum lacks
  if ((v === null || v === undefined) && spec.required.includes(arg)) return neutral(spec, arg);
  return v ?? null;
}

export function literal(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return str(v);
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return '[' + v.map(literal).join(', ') + ']';
  if (v.$ref) return v.$ref;
  if (v.$call) return call(v.$call, v.props);
  if (typeof v.$action === 'string') return `@ToAssistant(${str(v.$action)})`;
  return '{' + Object.entries(v).map(([k, x]) => `${/^[A-Za-z_]\w*$/.test(k) ? k : str(k)}: ${literal(x)}`).join(', ') + '}';
}

/** The argument literals: positional in the schema's order, props the schema lacks left out, and trailing
 *  nulls dropped only after the last required argument (a required one never silently disappears). */
export function renderArgs(spec, props) {
  const args = spec.args.map((a) => argValue(spec, a, props));
  const floor = Math.max(0, ...spec.required.map((r) => spec.args.indexOf(r) + 1));
  let n = args.length;
  while (n > floor && args[n - 1] === null) n--;
  return args.slice(0, n).map(literal);
}

export function call(component, props) {
  return `${component}(${renderArgs(S[component], props).join(', ')})`;
}

export const hasComponent = (c) => Object.prototype.hasOwnProperty.call(S, c);
/** The component names an array argument accepts, or null when it takes anything. */
export const slotOf = (c, arg) => (hasComponent(c) && S[c].slots && Object.hasOwn(S[c].slots, arg) ? S[c].slots[arg] : null);
export const inline = (component, props) => ({ $call: component, props, component });
