# wiremark for Obsidian

Draws UI wireframes written as text. A `wiremark` or `screens` code block in a note is shown as a static SVG screen instead of raw text. The drawing is made by the wiremark core library. The output has no script, no URLs and no colours chosen by the author.

````markdown
```wiremark
@device phone
screen login "Sign in"
  stack pad=24 gap=16
    h1 "Welcome back"
    input "Email" #email
    input "Password" type=password #password
    button "Sign in" primary w=fill #submit
```
````

Both fence names work: `wiremark` and `screens`. The language is described in the core README (`wiremark/README.md`).

## Settings

**Default look** chooses the Wireframe look (the default) or the Clean look. The look names match the core's `look=wire` and `look=clean`. It applies to every block that does not name a look of its own.

Obsidian passes only the fence language to the plugin, not the rest of the fence line. So a `look=clean` written after `wiremark` on the fence line is not seen. To pick a look for one block, write `@look clean` as the first line inside the block, or change the default in the settings.

## Install

Until the plugin is listed in the community plugins directory, install it by hand:

1. Build it with `npm install` and `npm run build` in this folder, or take `main.js`, `manifest.json` and `styles.css` from a release.
2. Copy those three files into `<your vault>/.obsidian/plugins/wiremark/`.
3. In Obsidian, open Settings, then Community plugins, and turn on wiremark.

## Development

`npm test` runs the unit tests in jsdom. `npm run build` writes `main.js` and `styles.css`, which are git-ignored. The core is linked as `file:../..`, so the plugin always draws with the core in this repository.
