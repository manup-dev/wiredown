# The wiredown language

The full reference: the language, lint and patch, and what an editor built on wiredown needs. The [README](../README.md) has the short version.

## The language

One block is one flow. Headers first, then `define`, `screen` and `variant` blocks, or bare elements (one implicit screen `main`). Indent by 2 or 4 spaces. An element line is `kind "label" flag key=value #id -> screenId // comment`.

| Part | Form |
| --- | --- |
| Headers | `@device phone\|tablet\|laptop\|desktop\|WxH [fit]`, `@look wire\|clean`, `@title "…"`, `@flow a b c`, `@requires` |
| Screen | `screen <id> "Label"` |
| Variant | `variant <id> of <screen> "Label"`, then indented `#id attr=value flag hide` patches |
| Define | `define <name> <param>…`, body uses `$param`; use it like a kind |
| Link | `-> screenId` or `-> back` |
| Note | `note="…"` on any element, numbered in source order |
| Box attributes | `w h` (number, `fill`, `hug`), `pad gap grow span`, `align`, `justify`, `note` |
| Frames | `screen modal sheet toast` |
| Layout | `stack row grid card spacer divider` |
| Text | `h1 h2 h3 text link` |
| Controls | `button input textarea select checkbox radio toggle` |
| Media | `image icon avatar badge` |
| Data and navigation | `list item table tabs tab navbar tabbar` |
| Flags | `primary disabled loading selected checked on muted back` (per kind, see `KINDS`) |
| Kind attributes | `placeholder type options error tone icon rows cols` |
| Devices | `phone 390x844`, `tablet 820x1180`, `laptop 1280x800`, `desktop 1440x900`, or `WxH` (100 to 4000 each). Add `fit` (`@device phone fit`) to end each screen at its content (at least 240 px; a taller screen keeps the fold line at the device height). A screen with a `modal`, `sheet` or `toast` ignores `fit`, because overlays are placed against the device height |
| Info string | `wiredown v1 look=clean view=prototype` (`screens` is an alias for `wiredown`) |

Layout is a deterministic flex model with a fixed text model (widths by character class, no fonts). Labels wrap at spaces; a row too narrow for its children's natural widths shrinks them toward their min-content width first (the widest word of each label plus its padding and icon), so no label breaks inside a word while the row has room for every word. Only a word wider than the room left for it breaks, per character.

Ids are `#lowercase-id` and unique in a block; elements without one get `kind-slug(label)`. Limits are in `WM_LIMITS` (64 KB body, 1,500 lines, 500 characters a line, 24 screens, 48 variants, 2,000 elements after expansion, 16 levels deep).

## Lint and patch

`lintMock` reports everything `parseMock` finds, with `unknown_kind`, `unknown_attr` and `dangling_link` as errors, at most 50; `unknown_info` entries (unknown words in the fence info string, severity warning, line 0) come first.

`mockPatch(body, ops)` takes one op or a list of up to 100, applied in turn, each to a fresh parse of the body so far. Untouched lines stay byte-identical; the indent unit and CRLF line endings are kept. Elements that come from a `define` are refused (`in_define`), and a change that would leave the block with more errors is refused (`would_break`). A refusal is `{ ok: false, error, message }` with a plain sentence; success is `{ ok: true, body, id, screen, ids }`, where `id` and `screen` name the element (or screen) the last op added, moved, duplicated or changed, after the change (null when nothing is left to select), so a host can keep its selection.

| Op | Does |
| --- | --- |
| `{ set: id, attrs?, flags?, label?, labelIndex?, link?, kind?, pin? }` | Rewrites the element's line in the order `kind labels flags k=v #id -> link note=`, keeping its indent and comment. `label: null` removes the last label; `labelIndex: 1` is an `item`'s second label; `link` is a screen id, `back` or null; `kind` changes between kinds that take a label and no children, dropping attributes and flags the new kind does not take. A derived id needs `pin: true` (write it first) or `pin: false` (let it follow the change) |
| `{ remove: id }` | Removes the line and every deeper line under it |
| `{ move: id, before \| after \| into: target, at?: 'start' \| 'end' }` | Moves the subtree (and the comments directly above it), re-indented for its new depth, across screens too. Refused when the target is inside it (`bad_move`) or cannot hold it (`cannot_hold`) |
| `{ duplicate: id }` | Copies the subtree right after itself, without its explicit ids |
| `{ add: { before \| after \| into, at? }, line \| lines }` | Adds one line, or up to 40 whose relative indentation is kept |
| `{ addScreen: { label, id?, after?, lines? } }` | A new screen (id from the label when none is given, `id_taken` when taken), after `after` and its variants, else last; the body defaults to `stack pad=16 gap=12`. A block of bare elements gets its `screen main` line first |
| `{ renameScreen: id, label }` | Sets, replaces or (null) removes a screen's or variant's label |
| `{ removeScreen: id, unlink? }` | Removes a screen with its variants, or one variant; refused for the last screen (`last_screen`) and while links point to it (`dangling_link`) unless `unlink: true` removes them |
| `{ moveScreen: id, before \| after: screenId }` | Moves a screen with its variants, or a variant |
| `{ header: 'device' \| 'look' \| 'title', value }` | Sets, adds in header order, or (null) removes the header line |
| `{ variant, set: id, attrs?, flags?, hide?, pin? }` | Writes or updates the element's patch line in that variant; an emptied patch line is removed |

Attribute and flag names must be lowercase words and values one line; anything the element's kind does not take is refused. Ids derived from labels repeat across screens, so element ops take an optional `screen` (and `toScreen` on `move`, `screen` inside an `add` position) to say which screen is meant; without it the first match wins, and a move's target is looked for in the moved element's own screen first.

`locateElement(body, info, id, screenId?)` says where an element is written, for a host that anchors a comment or any other reference to it: its body line (an element a `define` expanded is its use line, a variant's element the base screen's line, a screen frame its `screen` line), the id and screen to name it by, a label such as `button "Sign in"`, and how its id could be made explicit (`pin`). `elementAtLine(body, info, line)` is the reverse, and `bodyLineSpan(text, fenceFrom, body, line)` maps a body line back to the document text, through a list indent or quote prefix.

## Building an editor

A host that edits the drawing directly (select, drag, drop, type) needs structure from the library and geometry from its own DOM (every element is a `g[data-wm-el="<id>"]`, inside the screen's `<svg>`):

- `mockTree(body, info)` describes the block: per screen (`id`, `label`, `line`, `variantOf`, `implicit`) its elements in source order, the screen frame first, each with `id`, `kind`, `line`, `parent`, `index`, `depth`, `labels`, `flags`, `attrs`, `link`, `note`, `explicitId`, `fromDefine`, `container`, `axis` (`column`, `row` or `grid`: draw the drop line across it), `accepts`, `editable` (false with a `reason`: `frame`, `define` or `variant`) and `referenced` (a variant patch line names the element by its id: relabel a derived id with `pin: true`, or the patch is orphaned and `mockPatch` refuses with `would_break`). Results are frozen and memoised.
- `canHold(parentKind, childKind)` is the rule `move` and `add` apply; use it for drop targets, and skip containers that are not `editable`.
- `kindForm(kind)` lists a kind's labels, flags and typed attributes (`number`, `size`, `enum`, `string`, `icon`) for a properties form, the box attributes last.
- `PALETTE` is the insert menu: groups of `{ id, label, kind, lines }` with sensible defaults, ready for `mockPatch({ add, lines })`. To show an item as a picture, draw its `lines` yourself (`parseMock` of a one-screen body with `@device <w>x480 fit`, then `renderScreenSvg`), keep only the content `<g>` children, and crop the viewBox to the union of `layoutScreen(…).root.children` boxes; strip ids before putting several on one page.
- A derived id is a position among twins (`button-go-2`): a `move`, `duplicate`, `add` or `remove` can renumber it. An editor that keeps something keyed by a derived id (a comment) should pin that id first, in the same op batch: run the ops once with `{ set, screen, pin: true }` before them and once without, and keep the pins whose element's line carries a different id in the second result.
- `ICON_NAMES` lists the icon set for a picker; `iconPath(name, x, y, size)` draws one.

Every edit is one `mockPatch` call; diff the old and new body by lines to write only what changed, and select the returned `id` in the returned `screen`.
