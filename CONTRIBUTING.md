# Contributing

Thanks for helping. Issues and pull requests are welcome here.

## Tests

The core has no dependencies, so its tests need no install:

```sh
npm test
```

One test drives the real markdown-it and is skipped when markdown-it is not installed. CI installs it without touching `package.json`: `npm install --no-save --no-package-lock --ignore-scripts markdown-it@14.3.0 && npm test`.

Each integration, the playground and the benchmark have their own `package.json` and lockfile:

```sh
cd integrations/openui-check && npm ci && npm test
cd integrations/browser-test && npm ci && npm test
cd integrations/rehype && npm ci && npm test
cd integrations/vscode && npm ci && npm run build && npm test
cd integrations/obsidian && npm ci && npm run build && npm test
cd bench && npm ci && npm test
cd playground && npm ci && npm test && npx playwright install chromium && npm run e2e
```

Every folder has an `.npmrc` with `ignore-scripts=true`, so no install script runs. Keep it: one dependency of `integrations/openui-check` sends a telemetry ping from its install script.

## Rules

Checked by tests:

- **Imports.** `test/purity.test.js` reads every import in `src/` and `scripts/`: `src/` may import only `./` or `../` paths, `scripts/` also `node:` modules.
- **300 code lines at most per file in `src/` and `scripts/`** (blank lines and comments do not count), also `test/purity.test.js`. When a file gets close, split it by responsibility.
- **`src/index.js` is the public API.** `test/package.test.js` checks that the index re-exports nothing from the subpaths (`wiredown/export`, `wiredown/fences`) and that every `exports` path exists.
- **Safety.** The output rules in the README's "Safety guarantees" are checked by `test/security.test.js` (hostile input, seeded fuzz, the element allowlist). A change that loosens one needs a very good reason.

Kept in review (no test checks them):

- **Zero dependencies in the core.** The core `package.json` has no `dependencies`; `bin/` and `browser/` import only this package's own files (and, in `bin/`, Node's built-in modules).
- **`src/` is pure.** No DOM, no `Date`, no `Math.random`, no `Intl`. The output must be the same in Node and every browser.
- **New modules go behind a subpath** in `package.json` `exports` (like the exporters), never into `src/index.js`.

## Golden fixtures

Some tests compare output byte for byte with a file in `test/fixtures/`. When a change is meant to change the drawing, change the fixture in the same commit as the code and say why in the commit message. `test/render.test.js` can rewrite its golden file: `UPDATE_GOLDEN=1 npm test`, then check the diff by eye. `docs/example.svg` (the README picture) is pinned by `test/readme.test.js`: regenerate it with `node bin/wiredown.js render` on the contract example.

## Style

Plain English in comments and docs, short sentences. Match the code around you.
