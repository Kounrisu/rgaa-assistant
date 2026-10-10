import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'RGAA Assistant',
  version: pkg.version,
  description:
    'RGAA 4.1 audit assistant in the DevTools: finds and numbers the elements on a page, runs automatic and manual checks, keeps your audits, and exports an Excel grid and a report. Results are an aid: the auditor confirms every verdict.',
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
