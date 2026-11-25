# Changelog

## 0.1.0 (unreleased)

The first public version.

- The wiremark language: headers, screens, variants, defines, links, notes, 33 element kinds and two looks (`wire`, `clean`). See [docs/language.md](docs/language.md).
- `parseMock`, `lintMock` and the renderers: one static SVG per screen, variants beside their base screen, numbered notes and a text outline; deterministic, linear time, never throws.
- `wiremarkPlugin` for markdown-it (`wiremark` and `screens` fences, at most 50 blocks per document) and `wiremark.css` for the figure layout and the CSS-only prototype view.
- `AI_CONTRACT`: the language as one text for a model.
- The editing API: `mockPatch`, `mockTree`, `canHold`, `kindForm`, `PALETTE`, `locateElement`, `elementAtLine`, `bodyLineSpan`.
- `wiremark/export`: `toOpenUI` (OpenUI Lang for `@openuidev/react-ui`) and `toHTML` (plain HTML per screen).
- `wiremark/fences`: `findFences`, the wiremark fences of a markdown file with their line numbers.
- The `wiremark` command: `lint`, `render`, `export`, `contract`.
- `wiremark/browser`: one script tag draws every wiremark code block on a page.
- `rehype-wiremark` for Astro, Docusaurus, MDX and unified.
- A VS Code extension (Markdown preview, lint, highlighting) and an Obsidian plugin.
- A playground page and a benchmark harness (`bench/`).
