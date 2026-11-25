# Changelog

## 0.2.0 (2026-11-26)

- Icons: 43 built-in icons (12 new, among them `shopping-cart`, `log-in`, `log-out`, `message-circle` and `check-circle`) and 14 aliases such as `gear`, `cart` and `close`. An unknown name lints as `unknown_icon` (a warning) and suggests the nearest name.
- Icon packs: `defineIconPack` and `iconPacksKey` from the new `wiredown/icons` subpath, the `icons` option on the renderers, lint and the browser `render`, the `@icons` header and `pack:name` names. Three packs as their own packages: `wiredown-icons-lucide`, `wiredown-icons-tabler` and `wiredown-icons-heroicons`.
- Typed images: `image type=photo|chart|map|video|illustration|logo|avatar` and `ratio=16:9|4:3|3:2|1:1|9:16|21:9`.
- Motion in the prototype view: the `@motion` header and `motion=` on a screen (`slide`, `fade`, `push`, `sheet`, `zoom`, `none`), CSS only, off under reduced motion.
- Animated flows: `renderFlowAnimation`, `renderFlowFrame`, `flowDuration` and `flowPath` in `wiredown/export`, and `wiredown animate`. `@flow` plays exactly the screens it names. The file follows dark mode.
- `wiredown mcp`: an MCP server on stdio with five tools (`get_wiredown_grammar`, `lint_wiredown`, `wiredown_link`, `render_wiredown`, `animate_wiredown`). It writes `.svg` files only inside `--root` (default the current folder) and never replaces a file it did not make. The SVG files from `wiredown render` and `wiredown animate` start with the same `<!-- made by wiredown -->` line, so it may write them again.
- `wiredown link`: a playground link that draws a block.
- `--icons <module>` on `lint`, `render`, `animate` and `mcp`.
- Files for AI coding tools in `integrations/agents`: a Claude skill, a Cursor rule and an `AGENTS.md` section.
- `AI_CONTRACT` lists the icon names, image types, motion and `@flow`, and says to check a block with any wiredown lint tool.
- Playground: Play with Download SVG and Download GIF, links ending in `!play` that open Play, and six example flows.

## 0.1.0 (unreleased)

The first public version.

- The wiredown language: headers, screens, variants, defines, links, notes, 33 element kinds and two looks (`wire`, `clean`). See [docs/language.md](docs/language.md).
- `parseMock`, `lintMock` and the renderers: one static SVG per screen, variants beside their base screen, numbered notes and a text outline; deterministic, linear time, never throws.
- `wiredownPlugin` for markdown-it (`wiredown` and `screens` fences, at most 50 blocks per document) and `wiredown.css` for the figure layout and the CSS-only prototype view.
- `AI_CONTRACT`: the language as one text for a model.
- The editing API: `mockPatch`, `mockTree`, `canHold`, `kindForm`, `PALETTE`, `locateElement`, `elementAtLine`, `bodyLineSpan`.
- `wiredown/export`: `toOpenUI` (OpenUI Lang for `@openuidev/react-ui`) and `toHTML` (plain HTML per screen).
- `wiredown/fences`: `findFences`, the wiredown fences of a markdown file with their line numbers.
- The `wiredown` command: `lint`, `render`, `export`, `contract`.
- `wiredown/browser`: one script tag draws every wiredown code block on a page.
- `rehype-wiredown` for Astro, Docusaurus, MDX and unified.
- A VS Code extension (Markdown preview, lint, highlighting) and an Obsidian plugin.
- A playground page and a benchmark harness (`bench/`).
