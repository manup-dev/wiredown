#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { lint, formatProblem, render, exportFiles, contract, UsageError } from './cli-lib.js';

const HELP = `wiredown <command>

  lint <files...> [--json]                       check .wiredown files and wiredown fences in .md files
  render <file> [--out dir] [--format svg|html]  draw each screen as SVG, or one HTML page
  export <file> --to openui|html [--out dir]     starter code per screen
  contract                                       print the language reference for an AI model
  --help, --version`;

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); if (i < 0) return undefined; const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) throw new UsageError(`${name} needs a value`); argv.splice(i, 2); return v; };
const bool = (name) => { const i = argv.indexOf(name); if (i < 0) return false; argv.splice(i, 1); return true; };

try {
  const version = bool('--version');
  const help = bool('--help');
  const json = bool('--json');
  const out = flag('--out');
  const format = flag('--format') ?? 'svg';
  if (format !== 'svg' && format !== 'html') throw new UsageError('--format must be svg or html');
  const to = flag('--to');
  if (version) { console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version); process.exit(0); }
  if (help || argv.length === 0) { console.log(HELP); process.exit(help ? 0 : 2); }
  const [cmd, ...files] = argv;
  if (cmd === 'lint') {
    if (!files.length) throw new UsageError('lint needs at least one file');
    const problems = lint(files);
    if (json) console.log(JSON.stringify(problems, null, 2));
    else if (problems.length) console.log(problems.map(formatProblem).join('\n'));
    process.exit(problems.some((p) => p.severity === 'error') ? 1 : 0);
  }
  if (cmd === 'render') {
    if (!files[0]) throw new UsageError('render needs a file');
    for (const f of render(files[0], { out, format })) console.log(f);
    process.exit(0);
  }
  if (cmd === 'export') {
    if (!files[0]) throw new UsageError('export needs a file');
    for (const f of exportFiles(files[0], { to, out })) console.log(f);
    process.exit(0);
  }
  if (cmd === 'contract') { process.stdout.write(contract() + '\n'); process.exit(0); }
  throw new UsageError(`unknown command ${cmd}`);
} catch (err) {
  console.error(err instanceof UsageError ? `wiredown: ${err.message}\n\n${HELP}` : err.stack);
  process.exit(2);
}
