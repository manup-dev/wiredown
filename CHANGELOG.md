# Changelog

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
