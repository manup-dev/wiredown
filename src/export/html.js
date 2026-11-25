// Semantic HTML starter per screen: code for a developer to start from, not a drawing. No script, no framework.
import { escapeXml as e } from '../escape.js';
import { screenFiles, notesOf } from './files.js';

const style = (w) => `<style>
.wm-screen{font:16px/1.4 system-ui,sans-serif;max-width:${w}px;margin:auto}
.stack{display:flex;flex-direction:column;gap:var(--gap,8px);padding:var(--pad,0)}
.row{display:flex;flex-direction:row;gap:var(--gap,8px);padding:var(--pad,0);align-items:center}
.grid{display:grid;grid-template-columns:repeat(var(--cols,2),1fr);gap:var(--gap,8px)}
.card{border:1px solid #ccc;border-radius:8px;padding:var(--pad,12px)}
.spacer{flex:1}.error{color:#b00}.primary{font-weight:600}
.image{background:#eee;min-height:120px;display:grid;place-items:center}
</style>`;

const num = (v) => (/^\d{1,4}$/.test(String(v ?? '')) ? String(v) : null);
function vars(n) {
  const out = [];
  for (const [k, v] of [['gap', n.attrs.gap], ['pad', n.attrs.pad], ['cols', n.attrs.cols]]) {
    const x = num(v); if (x) out.push(`--${k}:${x}${k === 'cols' ? '' : 'px'}`);
  }
  return out.length ? ` style="${out.join(';')}"` : '';
}
const has = (n, f) => n.flags.includes(f);
const label = (n, i = 0) => e(n.labels[i] ?? '');
const href = (n) => (n.link === 'back' ? '#back' : n.link ? `#${e(n.link)}` : null);
const kids = (n, d) => n.children.map((c) => el(c, d + 1)).join('');
const pad = (d) => '\n' + '  '.repeat(d);
const err = (n) => (n.attrs.error ? `<small class="error">${e(n.attrs.error)}</small>` : '');
const dis = (n) => (has(n, 'disabled') ? ' disabled' : '');

function field(n, inner) {
  return `<label>${label(n)} ${inner}</label>${err(n)}`;
}

function el(n, d) {
  const p = pad(d);
  switch (n.kind) {
    case 'stack': case 'row': case 'grid': return `${p}<div class="${n.kind}"${vars(n)}>${kids(n, d)}${p}</div>`;
    case 'card': return `${p}<section class="card"${vars(n)}>${n.labels[0] ? `${p}  <h3>${label(n)}</h3>` : ''}${kids(n, d)}${p}</section>`;
    case 'spacer': return `${p}<div class="spacer"></div>`;
    case 'divider': return `${p}<hr>`;
    case 'h1': case 'h2': case 'h3': return `${p}<${n.kind}>${label(n)}</${n.kind}>`;
    case 'text': return `${p}<p>${label(n)}</p>`;
    case 'link': return `${p}<a href="${href(n) ?? '#'}">${label(n)}</a>`;
    case 'button': {
      const cls = has(n, 'primary') ? ' class="primary"' : '';
      const b = `<button type="button"${cls}${dis(n)}${has(n, 'loading') ? ' aria-busy="true"' : ''}>${label(n)}</button>`;
      return `${p}${href(n) ? `<a href="${href(n)}">${b}</a>` : b}`;
    }
    case 'input': {
      const type = /^[a-z]{1,12}$/.test(n.attrs.type ?? '') ? n.attrs.type : 'text';
      const ph = n.attrs.placeholder ? ` placeholder="${e(n.attrs.placeholder)}"` : '';
      return `${p}${field(n, `<input type="${type}"${ph}${dis(n)}>`)}`;
    }
    case 'textarea': {
      const rows = num(n.attrs.rows) ? ` rows="${num(n.attrs.rows)}"` : '';
      const ph = n.attrs.placeholder ? ` placeholder="${e(n.attrs.placeholder)}"` : '';
      return `${p}${field(n, `<textarea${rows}${ph}${dis(n)}></textarea>`)}`;
    }
    case 'select': {
      const opts = String(n.attrs.options ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      return `${p}${field(n, `<select${dis(n)}>${opts.map((o) => `<option>${e(o)}</option>`).join('')}</select>`)}`;
    }
    case 'checkbox': case 'radio': case 'toggle': {
      const type = n.kind === 'radio' ? 'radio' : 'checkbox';
      const on = has(n, 'checked') || has(n, 'on') || has(n, 'selected') ? ' checked' : '';
      const role = n.kind === 'toggle' ? ' role="switch"' : '';
      return `${p}<label><input type="${type}"${role}${on}${dis(n)}> ${label(n)}</label>`;
    }
    case 'image': return `${p}<figure class="image" role="img" aria-label="${label(n)}">${label(n)}</figure>`;
    case 'icon': return `${p}<span class="icon" aria-hidden="true">${e(n.attrs.icon ?? n.labels[0] ?? '')}</span>`;
    case 'avatar': return `${p}<span class="avatar" aria-label="${label(n)}">${e((n.labels[0] ?? '').split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2))}</span>`;
    case 'badge': return `${p}<span class="badge">${label(n)}</span>`;
    case 'list': return `${p}<ul>${kids(n, d)}${p}</ul>`;
    case 'item': {
      const text = `${label(n)}${n.labels[1] ? ` <small>${label(n, 1)}</small>` : ''}`;
      return `${p}<li${has(n, 'selected') ? ' aria-current="true"' : ''}>${href(n) ? `<a href="${href(n)}">${text}</a>` : text}${kids(n, d)}</li>`;
    }
    case 'table': {
      const cols = String(n.attrs.cols ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const rows = Math.min(50, Number(num(n.attrs.rows) ?? 3));
      const tr = `<tr>${cols.map(() => '<td></td>').join('')}</tr>`;
      return `${p}<table><thead><tr>${cols.map((c) => `<th>${e(c)}</th>`).join('')}</tr></thead><tbody>${tr.repeat(rows)}</tbody></table>`;
    }
    case 'tabs': return `${p}<div role="tablist">${kids(n, d)}${p}</div>`;
    case 'tab': return `${p}<button type="button" role="tab" aria-selected="${has(n, 'selected')}">${label(n)}</button>`;
    case 'navbar': return `${p}<header>${has(n, 'back') ? `<a href="${href(n) ?? '#back'}">Back</a> ` : ''}<h1>${label(n)}</h1>${kids(n, d)}</header>`;
    case 'tabbar': return `${p}<nav class="tabbar"><ul>${kids(n, d)}${p}</ul></nav>`;
    case 'modal': return `${p}<dialog open aria-label="${label(n)}">${kids(n, d)}${p}</dialog>`;
    case 'sheet': return `${p}<dialog open class="sheet" aria-label="${label(n)}">${kids(n, d)}${p}</dialog>`;
    case 'toast': return `${p}<div role="status">${label(n)}${kids(n, d)}</div>`;
    default: return `${p}<div>${label(n)}${kids(n, d)}</div>`;
  }
}

export function toHTML(body, info) {
  const r = screenFiles(body, info);
  if (!r.ok) return r;
  const w = num(r.mock.device.w) ?? '390';
  return {
    ok: true,
    files: r.screens.map(({ screen, name }) => {
      const head = `<!-- ${e(screen.label || screen.id)}: generated by wiredown from a wireframe. A starting point, not a design. -->`;
      const open = `<main class="wm-screen" id="${e(screen.id)}" aria-label="${e(screen.label || screen.id)}">`;
      const text = `${head}\n${style(w)}\n${open}${kids(screen.root, 0)}\n</main>\n`;
      return { screen: screen.variantOf ?? screen.id, variant: screen.variantOf ? screen.id : null, name, text, notes: notesOf(screen.root) };
    }),
  };
}
