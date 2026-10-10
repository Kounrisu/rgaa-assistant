// Two static servers on loopback, nothing else: the built extension (dist/) for the panel page and the fixture site
// (e2e/site/) for the page under test. Two origins, like the real extension and the site it inspects.
// CORS is open on both: it stands in for the extension's host permissions (<all_urls>), which let the panel fetch the page's images.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PANEL_PORT = 4173
const SITE_PORT = 4174
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }

function serve(dir, port) {
  const server = createServer(async (req, res) => {
    try {
      let path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname))
      if (path.endsWith(sep)) path += 'index.html'
      const file = join(dir, path)
      if (!file.startsWith(dir + sep) || !(await stat(file)).isFile()) throw new Error('not found')
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store', 'access-control-allow-origin': '*' })
      res.end(await readFile(file))
    } catch {
      res.writeHead(404).end('not found')
    }
  })
  return new Promise((ok) => server.listen(port, '127.0.0.1', ok))
}

await serve(join(root, 'e2e', 'site'), SITE_PORT)
await serve(join(root, 'dist'), PANEL_PORT)
console.log(`panel http://127.0.0.1:${PANEL_PORT}  site http://127.0.0.1:${SITE_PORT}`)
