// Benchmark runner. --fake and --estimate never load providers.mjs and never touch the network.
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_CONTRACT, lintMock } from '../src/index.js';
import { extractFence, scoreAnswer } from './score.mjs';

const here = (p) => new URL(p, import.meta.url);
const benchDir = fileURLToPath(new URL('.', import.meta.url));
const prompts = JSON.parse(readFileSync(here('./prompts.json'), 'utf8'));
const FENCE = '```';
const KEYS = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' };

function parseArgs(argv) {
  const a = { models: [], price: {}, fake: false, estimate: false, out: null, max: 4000, pause: 1000 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--fake') a.fake = true;
    else if (k === '--estimate') a.estimate = true;
    else if (k === '--models') a.models = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--max') a.max = Number(argv[++i]);
    else if (k === '--pause') a.pause = Number(argv[++i]);
    else if (k === '--price') {
      const [model, p] = (argv[++i] ?? '').split('=');
      const [pi, po] = (p ?? '').split('/').map(Number);
      if (model && pi >= 0 && po >= 0) a.price[model] = [pi, po];
    } else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

function estimate(a) {
  const calls = prompts.length * a.models.length * 2;
  // First call: contract + request. Repair call: the same, plus the re-sent answer (about 1,500 tokens) and a little lint text.
  const first = prompts.reduce((n, p) => n + (AI_CONTRACT.length + p.request.length) / 4, 0);
  const perModelIn = first + first + prompts.length * (1500 + 100);
  const perModelOut = prompts.length * 2 * 1500;
  console.log(`${calls} calls (${prompts.length} prompts x ${a.models.length} models x 2 for a repair turn), about ${Math.round(perModelIn * a.models.length)} input and ${perModelOut * a.models.length} output tokens at most.`);
  const priced = a.models.filter((m) => a.price[m]);
  if (!priced.length) console.log('No prices given, so no cost is shown. Pass --price provider:model=<in>/<out> in dollars per million tokens.');
  let total = 0;
  for (const m of priced) {
    const [pi, po] = a.price[m];
    const cost = (perModelIn * pi + perModelOut * po) / 1e6;
    total += cost;
    console.log(`  ${m}: about $${cost.toFixed(2)}`);
  }
  if (priced.length) console.log(`Total about $${total.toFixed(2)} for the models you priced.`);
}

function repairText(p, body, score) {
  let lines;
  if (body == null) lines = ['no wiremark block found'];
  else {
    lines = lintMock(body).filter((x) => x.severity === 'error').map((x) => `line ${x.line}: ${x.code} ${x.message}`);
    if (!score.checks.minScreens) lines.push(`needs at least ${p.minScreens} screens (not counting variants)`);
    if (score.missingKinds?.length) lines.push(`missing kinds: ${score.missingKinds.join(', ')}`);
    for (const [x, y] of score.missingLinks ?? []) lines.push(`missing link from '${x}' to '${y}'`);
  }
  return `wiremark lint found:\n${lines.join('\n')}\nReturn the corrected block in one ${FENCE}wiremark fence.`;
}

function fakeProvider() {
  const fx = JSON.parse(readFileSync(here('./fixtures/fake-answers.json'), 'utf8'));
  return async (model, system, messages) => {
    const id = prompts.find((p) => messages[0].content.startsWith(p.request))?.id;
    const text = fx[id]?.[messages.length > 1 ? 'repaired' : 'first'] ?? '';
    return { text, outTokens: Math.ceil(text.length / 4), ms: 0 };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Write to a temp file in the same folder, then move it over: a crash keeps the last complete file.
function save(out, doc) {
  mkdirSync(dirname(out), { recursive: true });
  const tmp = out.replace(/\.json$/, '') + '.tmp.json';
  writeFileSync(tmp, JSON.stringify(doc, null, 1) + '\n');
  renameSync(tmp, out);
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.estimate) return estimate(a);
  const models = a.fake && !a.models.length ? ['anthropic:fake-model'] : a.models;
  if (!models.length) throw new Error('pass --models provider:model,...');
  if (!a.fake) {
    const missing = [...new Set(models.map((m) => m.split(':')[0]))].filter((pr) => !KEYS[pr] || !process.env[KEYS[pr]]);
    if (missing.length) {
      console.error(`Missing API key for: ${missing.map((pr) => (KEYS[pr] ? `${pr} (${KEYS[pr]})` : `${pr} (unknown provider)`)).join(', ')}. Nothing was called.`);
      process.exit(2);
    }
  }
  let providers;
  if (a.fake) { const f = fakeProvider(); providers = new Proxy({}, { get: () => f }); }
  else providers = (await import('./providers.mjs')).PROVIDERS;
  const date = new Date().toISOString().slice(0, 10);
  const out = resolve(benchDir, a.out ?? `results/${date}.json`);
  const doc = { date, contractChars: AI_CONTRACT.length, models, fake: a.fake, rows: [] };
  let calls = 0;
  // Every provider call goes through here: one pause before each call except the very first.
  const call = async (provider, model, messages) => {
    if (!a.fake && calls++ > 0) await sleep(a.pause);
    return providers[provider](model, AI_CONTRACT, messages, a.max);
  };
  for (const spec of models) {
    const [provider, ...rest] = spec.split(':');
    const model = rest.join(':');
    for (const p of prompts) {
      const user = { role: 'user', content: `${p.request}\n\nAnswer with one ${FENCE}wiremark fence.` };
      const row = { prompt: p.id, model: spec, first: null, repaired: null, outTokens: 0, screens: 0, ms: 0 };
      try {
        const r1 = await call(provider, model, [user]);
        const body = extractFence(r1.text);
        row.first = scoreAnswer(p, body); row.outTokens = r1.outTokens; row.ms = r1.ms; row.screens = row.first.screens;
        if (!row.first.pass) {
          const r2 = await call(provider, model, [user, { role: 'assistant', content: r1.text }, { role: 'user', content: repairText(p, body, row.first) }]);
          row.repaired = scoreAnswer(p, extractFence(r2.text)); row.ms += r2.ms;
        }
      } catch (e) {
        // Keep only the status the call ended with, never the provider's message text.
        row.error = /(\d{3})$/.exec(String(e?.message))?.[1] ?? 'failed';
        row.first ??= scoreAnswer(p, null);
      }
      doc.rows.push(row);
      save(out, doc);
    }
  }
  const errs = doc.rows.filter((r) => r.error).length;
  console.log(`${doc.rows.length} rows written to ${out}${a.fake ? ' (fake run: proves the harness works, not a result)' : ''}`);
  if (errs) console.log(`${errs} rows ended in a provider error; they are left out of the pass rates.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
