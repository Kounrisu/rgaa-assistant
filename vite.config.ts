import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'

// crxjs emits the Chrome-only `use_dynamic_url`, which makes Firefox warn.
const stripChromeOnlyManifestKeys = () => ({
  name: 'strip-chrome-only-manifest-keys',
  closeBundle() {
    const path = 'dist/manifest.json'
    const json = JSON.parse(readFileSync(path, 'utf8'))
    // Firefox has no service workers: give it the same loader as an event page.
    json.background.scripts = [json.background.service_worker]
    for (const entry of json.web_accessible_resources ?? []) delete entry.use_dynamic_url
    writeFileSync(path, JSON.stringify(json, null, 2))
    // the axe engine (MPL-2.0) is injected into the page on demand, not bundled in every page
    copyFileSync('node_modules/axe-core/axe.min.js', 'dist/axe.min.js')
    copyFileSync('node_modules/axe-core/LICENSE', 'dist/axe.LICENSE')
  },
})

export default defineConfig({
  plugins: [crx({ manifest }), stripChromeOnlyManifestKeys()],
  build: {
    rollupOptions: {
      // The panel page is only referenced from JS (chrome.devtools.panels.create),
      // so it must be listed as an extra entry to be emitted.
      input: { panel: 'src/panel/panel.html', rgaa: 'src/rgaa/rgaa.html' },
    },
  },
})
