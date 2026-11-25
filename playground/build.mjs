// Builds playground/dist: the page, its modules, wiremark.css and a copy of ../src with imports rewritten.
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url)), dist = join(here, 'dist');
// Anything that still reaches outside dist: static, side-effect and dynamic imports, HTML attributes, CSS url().
const OUTSIDE = [/from\s*['"]\.\.\//, /import\s*['"]\.\.\//, /import\s*\(\s*['"]\.\.\//, /"\.\.\//, /url\(\s*['"]?\.\.\//];
rmSync(dist, { recursive: true, force: true }); mkdirSync(dist);
cpSync(join(here, '../src'), join(dist, 'src'), { recursive: true });
cpSync(join(here, '../wiremark.css'), join(dist, 'wiremark.css'));
const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));
const repo = String(pkg.repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, '');
for (const f of ['index.html', 'app.js', 'app.css', 'share.js', 'examples.js']) {
  let text = readFileSync(join(here, f), 'utf8').replaceAll("'../src/", "'./src/").replaceAll('"../wiremark.css"', '"wiremark.css"');
  if (f === 'index.html') text = repo ? text.replace('https://github.com/REPO', repo) : text.replace(/ · <a href="https:\/\/github.com\/REPO">GitHub<\/a>/, '');
  if (OUTSIDE.some((re) => re.test(text))) throw new Error(`${f} still imports outside dist`);
  writeFileSync(join(dist, f), text);
}
console.log('playground/dist ready');
