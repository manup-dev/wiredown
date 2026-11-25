// Prints the markdown tables for a results file and the encodings table.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodingsTable } from './encodings.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: node report.mjs <results.json>'); process.exit(1); }
const res = JSON.parse(readFileSync(resolve(file), 'utf8'));
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a');

console.log(`Results of ${res.date}${res.fake ? ' (FAKE RUN: proves the harness works; these are not measurements of any model)' : ''}. Contract: ${res.contractChars} characters.`);
console.log('Rows that ended in a provider error are left out of the pass rates and counted in the errors column. Mean output tokens per screen is over rows whose answer parsed.\n');
console.log('| Model | Prompts scored | Errors | First try pass | After one repair turn (includes format recovery) | Mean output tokens per screen |');
console.log('|---|---:|---:|---:|---:|---:|');
for (const m of res.models) {
  const all = res.rows.filter((r) => r.model === m);
  const rows = all.filter((r) => !r.error);
  const first = rows.filter((r) => r.first.pass).length;
  const after = rows.filter((r) => r.first.pass || r.repaired?.pass).length;
  const parsed = rows.filter((r) => r.first.parsed);
  const screens = parsed.reduce((n, r) => n + (r.screens ?? 0), 0);
  const tokens = parsed.reduce((n, r) => n + r.outTokens, 0);
  console.log(`| ${m} | ${rows.length} | ${all.length - rows.length} | ${pct(first, rows.length)} | ${pct(after, rows.length)} | ${screens ? (tokens / screens).toFixed(1) : 'n/a'} |`);
}
const enc = new URL('./results/encodings.json', import.meta.url);
if (existsSync(enc)) console.log('\n' + encodingsTable(JSON.parse(readFileSync(enc, 'utf8'))));
