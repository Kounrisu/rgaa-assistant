import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'RGAA Assistant — Images (Theme 1)',
  version: pkg.version,
  description:
    "AI-assisted RGAA 4.1 auditor, Theme 1 (Images) only. Numbers the images on a page, builds the element list, and prepares the AI prompt to paste into a chat UI.",
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  options_ui: { page: 'src/rgaa/rgaa.html', open_in_tab: true },
  devtools_page: 'src/panel/devtools.html',
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/inject.ts'],
      run_at: 'document_idle',
    },
  ],
  browser_specific_settings: {
    gecko: { id: 'rgaa-assistant@kounrisu', strict_min_version: '121.0' },
  },
  permissions: ['activeTab', 'scripting', 'storage', 'unlimitedStorage'],
  host_permissions: ['<all_urls>'],
})
