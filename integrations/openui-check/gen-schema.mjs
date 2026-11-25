// Captures @openuidev/react-ui's component argument order into the wiremark core as a plain table.
// Run after any version bump of the pinned OpenUI packages: `npm run gen`. It imports the library from
// `@openuidev/react-ui/genui-lib` in plain Node (no DOM needed) and reads `openuiLibrary.toJSONSchema()`.
// `.npmrc` sets ignore-scripts: @openuidev/lang-core's postinstall would otherwise send install telemetry
// (its runtime telemetry is opt-in and stays off).
import { writeFileSync } from 'node:fs'
import { loadLibrary, buildTable, tableModule, versionOf } from './table.mjs'

const { root, schema } = await loadLibrary()
const table = buildTable(schema, root, versionOf('@openuidev/react-ui'), versionOf('@openuidev/lang-core'))
writeFileSync(new URL('./schema.json', import.meta.url), JSON.stringify({ root, schema }, null, 2) + '\n')
writeFileSync(new URL('../../src/export/openui-schema.js', import.meta.url), tableModule(table))
console.log(`react-ui ${table.version}, lang-core ${table.langCore}: ${Object.keys(table.components).length} components, root ${root}`)
