# wiremark

UI wireframes as markdown. A wireframe format made for AI to write.

![The "Sign in" screen of the block below, drawn by wiremark](docs/example.svg)

```wiremark
@device phone
@title "Sign in"
screen login "Sign in"
  stack pad=24 gap=16
    h1 "Welcome back" align=center
    input "Email" placeholder="you@company.com" #email
    input "Password" type=password #password
    row justify=between
      checkbox "Remember me" checked
      link "Forgot password?" -> reset
    button "Sign in" primary w=fill #submit note="Disabled until both fields are filled"

variant login-error of login "Wrong password"
  #password error="That password is not right"

screen reset "Reset password"
  navbar "Reset password" back -> login
  stack pad=24 gap=16
    input "Email" #reset-email
    button "Send link" primary w=fill
```

One block is one flow: screens, variants of a screen, the links between them and numbered notes. The picture above is the `login` screen, made by `wiremark render`. The same block also draws the `login-error` variant beside it and the `reset` screen. Headers pick the device (`@device phone`, or `@device phone fit` to end each screen at its content) and the look (`@look wire` or `@look clean`). The whole language is in [docs/language.md](docs/language.md).

Status: version 0.1.0, not yet published to npm. Until it is, clone this repository and run `node bin/wiremark.js` where this page says `npx wiremark`.

## Try it

Playground: [manup-dev.github.io/wiremark](https://manup-dev.github.io/wiremark/). Type on the left and the screens draw on the right. Click any drawn element to find its line, fold screens, zoom, try the example flows, and share a link (the text travels in the link; nothing is sent to a server).

## Why

- **The text is the source of truth.** A mock is a few lines in your markdown, so it diffs, reviews, merges and keeps its history like the rest of the document, in git or anywhere else.
- **Flows, not single screens.** Screens, variants (a screen with a few things changed), links between screens, notes on any element, and a prototype view (`view=prototype`) that shows one screen at a time and follows the links, with CSS only.
- **Safe anywhere.** The output is static SVG: no script, no URLs, no images or fonts from the author's text. Nothing in it can run or load, so it is safe to put in email, in EPUB and behind an HTML sanitizer.
- **Made for AI.** `AI_CONTRACT` is the whole language as one text for a model; `wiremark lint` gives line-numbered problems a model can fix; the same text always draws the same picture.

## Use with AI

1. Give the model the language: `npx wiremark contract` prints it (about 5,300 characters). Paste it into the system prompt or the start of the chat.
2. Ask for a fenced `wiremark` block, for example:

   > Using the wiremark language above, write one fenced `wiremark` block for a two-step sign-up on a phone: an email and password screen, then a "check your email" screen with a resend link. Link the screens with `->`. Reply with the block only.

3. Save the answer in a markdown file and check it: `npx wiremark lint spec.md`. Each problem is one line, `file:line:column severity code message`, and the command exits 1 when there is an error.
4. If there are problems, paste the lint output back to the model and ask it to fix the block. Then draw it: `npx wiremark render spec.md --out screens/` (one SVG per screen, or `--format html` for one page).

## Integrations

| Where | How |
| --- | --- |
| markdown-it | `md.use(wiremarkPlugin)` from the core package |
| Any web page | one script tag, `<script type="module" src="https://cdn.jsdelivr.net/npm/wiremark@0.1/browser/auto.js"></script>`, draws every `wiremark` code block on the page (add `data-wiremark-manual` to the tag to call `render()` yourself) |
| Astro, Docusaurus, MDX, unified | [`rehype-wiremark`](integrations/rehype/README.md) |
| VitePress | VitePress uses markdown-it: `markdown: { config: (md) => md.use(wiremarkPlugin) }` (not covered by this repository's tests yet) |
| VS Code | [extension](integrations/vscode/README.md): drawn in the Markdown preview, lint, highlighting, a preview command for `.wiremark` files |
| Obsidian | [plugin](integrations/obsidian/README.md): `wiremark` code blocks in notes are drawn |
| Command line | `wiremark lint`, `render`, `export` and `contract` (`npx wiremark --help`) |
| [reph](https://reph.dev/?ref=wiremark) | the hosted markdown editor wiremark comes from, where these blocks (called Screens there) are edited on the drawing and commented on |

## Hand off to code

`wiremark export <file> --to openui` writes one [OpenUI Lang](https://www.openui.com) file per screen for `@openuidev/react-ui`; `--to html` writes one plain HTML file per screen. Both are a starting point for a developer, not a design. Links become actions (OpenUI) or `#screen` anchors (HTML), and in OpenUI notes become comments.

The `login` screen above as OpenUI Lang:

```
// Sign in: generated by wiremark from a wireframe for @openuidev/react-ui 0.19.0. A starting point, not a design.
root = Stack([stack])
stack = Stack([h1_welcome_back, email, password, row, submit], null, "l")
h1_welcome_back = TextContent("Welcome back", "large-heavy")
email = FormControl("Email", Input("email", "you@company.com"))
password = FormControl("Password", Input("password", null, "password"))
row = Stack([checkbox_remember_me, link_forgot_password], "row", null, null, "between")
checkbox_remember_me = CheckBoxGroup("checkbox-remember-me", [CheckBoxItem("Remember me", "", "checkbox-remember-me", true)])
link_forgot_password = Button("Forgot password?", @ToAssistant("Go to Reset password"), "tertiary")
submit = Button("Sign in", null, "primary") // Disabled until both fields are filled
```

And as HTML (the file also has a header comment and a short `<style>` block of layout rules):

```html
<main class="wm-screen" id="login" aria-label="Sign in">
  <div class="stack" style="--gap:16px;--pad:24px">
    <h1>Welcome back</h1>
    <label>Email <input type="text" placeholder="you@company.com"></label>
    <label>Password <input type="password"></label>
    <div class="row">
      <label><input type="checkbox" checked> Remember me</label>
      <a href="#reset">Forgot password?</a>
    </div>
    <button type="button" class="primary">Sign in</button>
  </div>
</main>
```

The OpenUI export of every valid test fixture is checked against OpenUI's own parser in `integrations/openui-check`.

## Benchmarks

Model pass rates: coming with the first benchmark run.

The same screens in three encodings, counted with the o200k tokenizer, over the 20 reference answers in [`bench/`](bench/README.md) and two test fixtures. The OpenUI and HTML columns are wiremark's own exports of the same screens, not what a model would write; about half of the HTML column is the per-file CSS.

| Encoding | Tokens (22 files) |
|---|---:|
| wiremark | 4,741 |
| OpenUI Lang (wiremark's export) | 12,546 |
| HTML (wiremark's export) | 23,170 |

<details>
<summary>Per file (from <code>bench/results/encodings.json</code>)</summary>

| File | wiremark | OpenUI | HTML |
|---|---:|---:|---:|
| reference/admin-users.wiremark | 176 | 383 | 862 |
| reference/calendar-booking.wiremark | 229 | 587 | 1058 |
| reference/cancel-subscription.wiremark | 229 | 691 | 1307 |
| reference/chat-thread.wiremark | 140 | 341 | 658 |
| reference/checkout.wiremark | 397 | 962 | 1574 |
| reference/dashboard-kpi.wiremark | 164 | 446 | 838 |
| reference/file-upload.wiremark | 158 | 525 | 1118 |
| reference/invite-sheet.wiremark | 169 | 372 | 732 |
| reference/mobile-tabs.wiremark | 196 | 470 | 1013 |
| reference/notifications.wiremark | 138 | 361 | 858 |
| reference/onboarding-carousel.wiremark | 232 | 588 | 1239 |
| reference/order-history.wiremark | 199 | 446 | 785 |
| reference/pricing.wiremark | 193 | 528 | 800 |
| reference/profile-edit.wiremark | 143 | 526 | 1022 |
| reference/search-results.wiremark | 140 | 477 | 982 |
| reference/settings-tabs.wiremark | 157 | 411 | 799 |
| reference/sign-in-reset.wiremark | 180 | 595 | 1020 |
| reference/signup-two-step.wiremark | 206 | 505 | 980 |
| reference/support-ticket.wiremark | 158 | 395 | 701 |
| reference/two-factor.wiremark | 249 | 648 | 1299 |
| test/fixtures/all-kinds.wiremark | 719 | 1730 | 2523 |
| test/fixtures/login.wiremark | 169 | 559 | 1002 |
| **Total (22 files)** | **4741** | **12546** | **23170** |

</details>

Rebuild the table with `node bench/encodings.mjs` (free, offline). The benchmark's method is in [bench/README.md](bench/README.md).

## Prior art

- [PlantUML Salt](https://plantuml.com/salt) draws a text wireframe, one screen per diagram, through the PlantUML renderer (Java, or a PlantUML server).
- [Balsamiq](https://balsamiq.com) wireframes are drawn in its own editor; BMML is the XML format of Balsamiq's older Mockups files.
- [Mermaid](https://mermaid.js.org) draws diagrams from text in markdown; it has no diagram type for UI screens.
- [OpenUI](https://www.openui.com), from Thesys, calls itself "the open standard for generative UI": a language and runtime for UI that a model generates in a running product. wiremark exports to it.

## Install

```sh
npm i wiremark
```

Zero dependencies, plain ES modules, no DOM and no build step. Node 20 or later.

```js
import { parseMock, lintMock, renderMockBlock, mockPatch, AI_CONTRACT } from 'wiremark';

const html = renderMockBlock(body, 'wiremark v1');   // figure HTML, or an error card; never throws
const problems = lintMock(body, 'wiremark v1');       // [{ line, column, code, message, severity }]
const next = mockPatch(body, { set: 'submit', flags: { disabled: true } }); // { ok, body, id, screen } | { ok: false, error, message }
```

`wiremarkPlugin(md, { defer })` registers the fence for markdown-it (`wiremark` and `screens`, at most 50 blocks per document). Blocks are numbered per render (ids `wm-<block>-<screen>`); a host that joins separately rendered pages into one HTML document sets `env.wmBase` (0 to 9999) per page so no id repeats; `env.wmMode = 'digest'` renders each block as an empty figure carrying only its `mockDigest`, for a host that computes from a render but never shows it. `AI_CONTRACT` is the text to give an agent so it can write the language.

```js
import { toOpenUI, toHTML } from 'wiremark/export';
import { findFences } from 'wiremark/fences';

const result = toOpenUI(body);         // { ok: true, files: [{ screen, variant, name, text, notes }] } or { ok: false, problems }
const fences = findFences(markdown);   // the wiremark fences of a markdown file, with their line numbers
```

Add the stylesheet once where figures are shown: `wiremark/wiremark.css` (the same text as the `WIREMARK_CSS` export).

The full language, lint and patch, and the API for building an editor on the drawing: [docs/language.md](docs/language.md).

## Safety guarantees

- `parseMock` and every renderer accept any string and never throw; hard limits bound input and the 512 KB output.
- Parsing and rendering are linear time; a 64 KB adversarial body takes under 100 ms.
- SVG elements are only `svg g rect circle ellipse line path polyline text tspan title a`; never `foreignObject`, `script`, `style`, `use`, `image` or `iframe`, no `on*` attributes, no `xlink:href`.
- `<a>` carries only `href="#wm-…"` built by the library; `id` attributes are library-made `wm-` ids; author ids appear only as escaped `data-wm-el`.
- Author text is escaped with exactly `& < > " '`; it never becomes a URL, image, font or CSS.
- Colours come from fixed tokens or a validated `#rgb`/`#rrggbb`; paint is `currentColor` plus one surface variable, never class-only.
- Output is deterministic and identical in Node and browsers: no `Intl`, `Math.random` or `Date`.

To report a security problem, see [SECURITY.md](SECURITY.md).

## Licence

MIT, see [LICENSE](LICENSE). To contribute, see [CONTRIBUTING.md](CONTRIBUTING.md).
