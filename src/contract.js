// AI_CONTRACT: what an agent needs to write a wiredown block. Generated from KINDS at import; deterministic.
import { KINDS } from './kinds.js';
import { WM_LIMITS } from './limits.js';

export const CONTRACT_EXAMPLE = `@device phone
@title "Sign in"
screen login "Sign in"
  stack pad=24 gap=16
    h1 "Welcome back" align=center
    input "Email" placeholder="you@company.com" #email
    input "Password" type=password #password
    row justify=between
      checkbox "Remember me" checked
      link "Forgot password?" -> reset
    button "Sign in" primary w=fill #submit note="Disabled until both fields are filled"

variant login-error of login "Wrong password"
  #password error="That password is not right"

screen reset "Reset password"
  navbar "Reset password" back -> login
  stack pad=24 gap=16
    input "Email" #reset-email
    button "Send link" primary w=fill`;

const names = Object.keys(KINDS);
// Attributes every kind takes (the box attributes), listed once.
const common = Object.keys(KINDS[names[0]].attrs).filter((k) => names.every((n) => k in KINDS[n].attrs));

function kindRow(k) {
  const own = Object.keys(k.attrs).filter((a) => !common.includes(a));
  const kids = k.children === 'none' ? 'no children' : k.children === 'any' ? 'children ok' : `children: ${k.children.join(', ')}`;
  const bits = [`${k.labels} label${k.labels === 1 ? '' : 's'}`, kids];
  if (own.length) bits.push(`attrs ${own.join(' ')}`);
  if (k.flags.length) bits.push(`flags ${k.flags.join(' ')}`);
  return `${k.name} (${bits.join('; ')})`;
}

function groups() {
  const by = new Map();
  for (const k of Object.values(KINDS)) {
    if (!by.has(k.group)) by.set(k.group, []);
    by.get(k.group).push(k);
  }
  return [...by].map(([g, ks]) => `${g}:\n${ks.map((k) => `  ${kindRow(k)}`).join('\n')}`).join('\n');
}

const L = WM_LIMITS;
export const AI_CONTRACT = `wiredown: UI screens and flows as markdown. Write one fenced block with the language \`wiredown\` (\`screens\` also works). One block is one flow. It is drawn as static wireframes, so describe structure, not pixels.

GRAMMAR
Headers first (optional): @device phone|tablet|laptop|desktop|WxH (each side 100..${L.deviceMax}), add fit after it (@device phone fit) to end each screen at its content instead of the full device height (not with a modal, sheet or toast), @look wire|clean, @title "Text", @flow a b c (screen ids in order), @requires.
screen <id> "Label"    a screen; indent its elements by 2 or 4 spaces (one step per level, spaces only).
variant <id> of <screen> "Label"    a copy of a screen; indented lines are patches: #id attr=value flag hide (no labels, no children).
define <name> <param or param=default>...    a reusable element, declared above its first use; labels and values in its indented body may write $param. Use it like a kind: name "first" "second" param=value.
Without any screen line the top-level elements form one screen called main.
An element line: kind "label"... flag... key=value... #id -> target // comment
Labels use double quotes; escape \\" and \\\\. // starts a comment outside labels. Blank lines are ignored.

COMMON ATTRIBUTES (every kind): ${common.join(' ')}
w and h take a number, fill or hug. pad, gap, grow and span are numbers. align is start|center|end|stretch. justify is start|center|end|between. note="text" attaches a numbered note to any element.

KINDS (labels, children, own attributes, flags)
${groups()}
Other attribute values: type is text|password|email|number|search|tel|url; tone is good|bad|warn|info; options="a, b" for a select; cols="A, B" for a table, or a number 1-12 for a grid; icon=name; placeholder="text"; error="text"; rows=number. Colours are never set by you; the look decides.

EXAMPLE
\`\`\`wiredown
${CONTRACT_EXAMPLE}
\`\`\`

RULES
1. Give every element you will reference, patch, comment on or vary an explicit #id (lowercase letters, digits, hyphens, starting with a letter, at most 64). Unnamed elements get an id from their kind and label, which changes when the label changes.
2. Navigate with -> screenId (or -> back). The target must be a screen id in the same block; otherwise it is a dangling_link error.
3. Screen and variant ids are explicit and unique in the block. Explicit element ids are unique across the whole block.
4. Show states (error, loading, empty, success) as variants of the screen, not as copies.
5. Use only the kinds, attributes and flags listed above. Unknown ones are errors.
6. Keep labels short and real (what a person would read), at most ${L.label} characters.
7. Put notes where a designer would ask a question; at most ${L.notes} per block.

LIMITS
Body ${L.body} characters, ${L.lines} lines, ${L.lineLength} characters per line, ${L.tokensPerLine} tokens per line, ${L.screens} screens, ${L.variants} variants, ${L.nodes} elements after defines expand, ${L.depth} levels of nesting, ${L.defines} defines.

CHECK YOUR WORK
Run lint_doc on the document. It reports each problem with a line number and a code; fix every error before you finish. To change one element later, edit only its line.`;
