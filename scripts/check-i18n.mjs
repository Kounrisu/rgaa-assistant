// Lists the texts passed to t('…') that have no French entry yet, and French entries nobody uses.
// Usage: node scripts/check-i18n.mjs [--unused]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]))
const files = walk('src').filter((f) => /\.(ts|html)$/.test(f) && !f.includes('i18n-fr'))
const unescape = (s) => s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n').replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))

const used = new Map()
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    if (m[1] === '`' && m[2].includes('${')) console.log(`INTERPOLATED KEY (use {param}) ${f}: ${m[2].slice(0, 70)}`)
    used.set(unescape(m[2]), f)
  }
  if (f.endsWith('.html')) {
    for (const m of text.matchAll(/data-i18n(?:-attrs="([^"]*)")?[^>]*>([^<]*)</g)) if (m[2].trim()) used.set(m[2].trim(), f)
  }
}

const src = files.length ? '' : ''
const dict = new Set()
for (const f of ['src/lib/i18n-fr-panel.ts', 'src/lib/i18n-fr-lib.ts']) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/^\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|([A-Za-z_][\w]*))\s*:/gm)) dict.add(unescape(m[1] ?? m[2] ?? m[3]))
}
const missing = [...used.keys()].filter((k) => !dict.has(k))
console.log(`${used.size} texts used, ${dict.size} French entries, ${missing.length} missing`)
for (const k of missing) console.log(`MISSING  ${used.get(k)}: ${k}`)
if (process.argv.includes('--unused')) for (const k of dict) if (!used.has(k)) console.log(`UNUSED   ${k}`)
