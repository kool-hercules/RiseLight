// Serves the `nuxt generate` output the way a plain static host would: files
// as-is, and a real 404 for anything else (no SPA fallback), so the offline
// specs can see what the service worker does with an error navigation.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const root = resolve(process.argv[2] ?? '.output/public')
const port = Number(process.env.E2E_PORT ?? 4310)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
}

createServer(async (request, response) => {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  } catch {
    // A malformed escape (`/%E0%A4%A`) would otherwise throw out of this
    // handler and take the whole server down mid-run.
    response.writeHead(400).end()
    return
  }
  const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`)

  // Inside the root only: compare with a trailing separator so a sibling such
  // as `public-secret` doesn't pass as a prefix of `public`.
  if (!file.startsWith(root + sep)) {
    response.writeHead(403).end()
    return
  }

  try {
    const body = await readFile(file)
    response.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      // Revalidate so a rebuilt app is never masked by the HTTP cache.
      'cache-control': 'no-cache'
    }).end(body)
  } catch {
    response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end('<h1>Not found (e2e server)</h1>')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`e2e static server on http://127.0.0.1:${port} serving ${root}`)
})
