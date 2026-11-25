# wiredown-icons-heroicons

Every Heroicons 24 outline icon as a wiredown icon pack. Names are the upstream names (`{name}` in `heroicons`), so `icon "heroicons:name"` draws one.

## Install

```sh
npm i wiredown wiredown-icons-heroicons
```

## Use

```js
import { wiredownPlugin, renderMockBlock } from 'wiredown'
import heroicons from 'wiredown-icons-heroicons'

md.use(wiredownPlugin, { icons: [heroicons] })
renderMockBlock(body, info, { icons: [heroicons] })
```

In a block, `icon "heroicons:name"` reads one icon from this pack. The header `@icons heroicons` makes every bare icon name read this pack first, then the built-in icons.
Command line: `wiredown render file.wiredown --icons wiredown-icons-heroicons`.
A host that caches rendered output adds `iconPacksKey([pack])` to its cache key.

The data is generated from `heroicons@2.2.0` by `node build.mjs`. The package version (and the pack's `version`, which `iconPacksKey` reports) is bumped whenever the data is rebuilt.
