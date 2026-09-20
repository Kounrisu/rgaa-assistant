import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'RGAA Assistant — Images (Theme 1)',
  version: pkg.version,
  description:
    "AI-assisted RGAA 4.1 auditor, Theme 1 (Images) only. Numbers the images on a page, builds the element list, and prepares the AI prompt to paste into a chat UI.",
  action: {
    default_popup: 'src/popup/popup.html',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/inject.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['activeTab', 'scripting'],
  host_permissions: ['<all_urls>'],
})
