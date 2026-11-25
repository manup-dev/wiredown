## wiredown screens

UI screens and flows in this repository are written as wiredown: a markdown fence tagged `wiredown`, drawn as static wireframes.

- Get the language before writing a block: `npx wiredown contract` (or the `get_wiredown_grammar` MCP tool). Use only what it lists.
- Check every block you write or change: `npx wiredown lint <file>` (or the `lint_wiredown` MCP tool). Fix every error before you finish.
- `-> id` targets must be screens in the same block. Give an explicit `#id` to any element you link to or patch.
- Show states (error, loading, empty) as `variant` blocks, not copies of a screen.
- To see a block drawn: `npx wiredown link <file>` prints a playground link; `npx wiredown render <file> --out screens/` writes one SVG per screen.
