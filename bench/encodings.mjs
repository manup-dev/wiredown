// Token counts (o200k) of the same screens as wiremark text, as OpenUI and as HTML.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { encode } from 'gpt-tokenizer/encoding/o200k_base';
import { lintMock } from '../src/index.js';
import { toOpenUI, toHTML } from '../src/export/index.js';

export const HEADER = "Same screens in three encodings (o200k tokens). The OpenUI and HTML columns are wiremark's own exports, not what a model would write.";
const dirs = [new URL('./reference/', import.meta.url), new URL('../test/fixtures/', import.meta.url)];
const count = (s) => encode(s).length;
const joined = (r) => (r.ok ? r.files.map((f) => f.text).join('\n') : null);

export function buildRows() {
  const rows = [];
  for (const d of dirs) {
    for (const f of readdirSync(d).filter((x) => x.endsWith('.wiremark')).sort()) {
      const text = readFileSync(new URL(f, d), 'utf8');
      if (lintMock(text).some((p) => p.severity === 'error')) continue;
      const openui = joined(toOpenUI(text)), html = joined(toHTML(text));
      if (openui == null || html == null) continue;
      rows.push({ file: (d.pathname.includes('reference') ? 'reference/' : 'test/fixtures/') + f, wiremark: count(text), openui: count(openui), html: count(html) });
    }
  }
  return rows;
}

export function totals(rows) {
  const t = { files: rows.length, wiremark: 0, openui: 0, html: 0 };
  for (const r of rows) { t.wiremark += r.wiremark; t.openui += r.openui; t.html += r.html; }
  return t;
}

export function encodingsTable(data) {
  const lines = [HEADER, '', '| File | wiremark | OpenUI | HTML |', '|---|---:|---:|---:|'];
  for (const r of data.rows) lines.push(`| ${r.file} | ${r.wiremark} | ${r.openui} | ${r.html} |`);
  const t = data.totals;
  lines.push(`| **Total (${t.files} files)** | **${t.wiremark}** | **${t.openui}** | **${t.html}** |`);
  return lines.join('\n');
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const rows = buildRows();
  const data = { tokenizer: 'o200k_base', rows, totals: totals(rows) };
  mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./results/encodings.json', import.meta.url), JSON.stringify(data, null, 1) + '\n');
  console.log(encodingsTable(data));
}
