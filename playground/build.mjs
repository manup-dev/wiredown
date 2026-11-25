// Builds playground/dist: the page, its modules, wiredown.css and a copy of ../src with imports rewritten.
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url)), dist = join(here, 'dist');
// Anything that still reaches outside dist: static, side-effect and dynamic imports, HTML attributes, CSS url().
const OUTSIDE = [/from\s*['"]\.\.\//, /import\s*['"]\.\.\//, /import\s*\(\s*['"]\.\.\//, /"\.\.\//, /url\(\s*['"]?\.\.\//];
rmSync(dist, { recursive: true, force: true }); mkdirSync(dist);
cpSync(join(here, '../src'), join(dist, 'src'), { recursive: true });
cpSync(join(here, '../wiredown.css'), join(dist, 'wiredown.css'));
const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));
const repo = String(pkg.repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, '');
// Icon packs are copied beside the page and fetched only when a block names one.
for (const id of ['lucide', 'tabler', 'heroicons']) {
  const from = join(here, '../integrations', `icons-${id}`), to = join(dist, 'packs', id);
  mkdirSync(to, { recursive: true });
  writeFileSync(join(to, 'index.js'), readFileSync(join(from, 'index.js'), 'utf8').replace("from 'wiredown/icons'", "from '../../src/packs-define.js'"));
  cpSync(join(from, 'icons.js'), join(to, 'icons.js'));
}
for (const f of ['index.html', 'app.js', 'app.css', 'share.js', 'examples.js', 'examples-product.js', 'examples-journeys.js', 'examples-showcase.js', 'examples-apps.js', 'select.js', 'layout.js', 'packs.js', 'play.js', 'gif.js']) {
  let text = readFileSync(join(here, f), 'utf8').replaceAll("'../src/", "'./src/").replaceAll('"../wiredown.css"', '"wiredown.css"');
  if (f === 'index.html') text = repo ? text.replace('https://github.com/REPO', repo) : text.replace(/ · <a href="https:\/\/github.com\/REPO">GitHub<\/a>/, '');
  if (OUTSIDE.some((re) => re.test(text))) throw new Error(`${f} still imports outside dist`);
  writeFileSync(join(dist, f), text);
}
console.log('playground/dist ready');
