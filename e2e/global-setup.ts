import { build } from 'esbuild'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The test runs the BUILT extension: stop early and clearly when it is missing. Also bundles the real write queue for the browser. */
export default async function globalSetup(): Promise<void> {
  if (!existsSync(join(root, 'dist', 'manifest.json'))) throw new Error('dist/ is missing: run `npm run build` before `npm run test:e2e`')
  await build({
    entryPoints: [join(root, 'src', 'lib', 'persistence.ts')],
    outfile: join(root, 'e2e', '.build', 'persistence.js'),
    bundle: true,
    format: 'iife',
    globalName: 'RgaaPersistence',
    platform: 'browser',
    target: 'es2022',
    footer: { js: 'window.RgaaPersistence = RgaaPersistence' },
    logLevel: 'warning',
  })
}
