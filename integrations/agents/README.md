# wiredown for AI tools

Files that teach an AI coding tool to write wiredown, and the setup for the wiredown MCP server.

| File | What it is | Where it goes |
|------|------------|---------------|
| `SKILL.md` | A Claude skill | `~/.claude/skills/wiredown/SKILL.md` (all projects) or `.claude/skills/wiredown/SKILL.md` (one project) |
| `cursor/wiredown.mdc` | A Cursor rule | `.cursor/rules/wiredown.mdc` |
| `AGENTS.md` | A section for an `AGENTS.md` file | Paste it into your repository's `AGENTS.md` |

## The MCP server

`wiredown mcp` runs a Model Context Protocol server on stdio. It has five tools:

| Tool | What it does |
|------|--------------|
| `get_wiredown_grammar` | Returns the whole language as one text (the same text as `wiredown contract`). |
| `lint_wiredown` | Checks a block and lists its problems, as text and as JSON. |
| `wiredown_link` | Returns a playground link that draws the block. The text travels in the link; the playground sends it to no server. |
| `render_wiredown` | Returns the drawing as HTML text, or with `outDir` writes one `<screen-id>.svg` per screen. |
| `animate_wiredown` | Writes the flow as one animated SVG file (`out`). |

The first three only read. `render_wiredown` with `outDir` and `animate_wiredown` write files, and only `.svg` files inside the folder the server runs in (or the folder given with `--root`). A path with `..`, an absolute path outside that folder, or a link that points outside it is refused. They never replace a file they did not make: each file they write starts with the comment `<!-- made by wiredown -->`, and an existing file without it (your own `logo.svg`, say) is kept and the call writes nothing. If the server runs in the filesystem root, your home folder or a folder above it, it writes nothing; pass `--root <folder>` to choose a project folder. To use an icon pack, add `--icons <package>`, for example `--icons wiredown-icons-lucide` (the package must be installed where the server runs).

### Claude Code

```sh
claude mcp add wiredown -- npx -y wiredown mcp
```

### Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wiredown": {
      "command": "npx",
      "args": ["-y", "wiredown", "mcp", "--root", "/path/to/your/project"]
    }
  }
}
```

The server writes only inside the folder it starts in, and Claude Desktop has no setting for that folder, so give `--root` if you want `render_wiredown` and `animate_wiredown` to write files.

On Windows, Claude Desktop usually cannot start `npx` directly. Use `"command": "cmd"` and put `"/c", "npx"` at the start of `args`:

```json
"args": ["/c", "npx", "-y", "wiredown", "mcp", "--root", "C:\\path\\to\\your\\project"]
```

### Cursor

In `.cursor/mcp.json` (one project) or `~/.cursor/mcp.json` (all projects):

```json
{
  "mcpServers": {
    "wiredown": {
      "command": "npx",
      "args": ["-y", "wiredown", "mcp", "--root", "${workspaceFolder}"]
    }
  }
}
```

### VS Code

In `.vscode/mcp.json`:

```json
{
  "servers": {
    "wiredown": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "wiredown", "mcp", "--root", "${workspaceFolder}"]
    }
  }
}
```

### From a clone

Replace `npx -y wiredown` with `node /path/to/wiredown/bin/wiredown.js` in any of the lines above.

## Without MCP

The same steps work from the command line:

```sh
npx wiredown contract          # the language, to paste into a prompt
npx wiredown lint spec.md      # problems as file:line:column severity code message
npx wiredown link spec.md      # a playground link that draws the first block (--block N for another)
npx wiredown render spec.md --out screens/
```
