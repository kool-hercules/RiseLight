import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// e2e/serve.mjs is the static host the Playwright specs run against. Driven as
// a real process, as Playwright's webServer runs it.

const freePort = () => new Promise<number>((resolve, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address() as { port: number }
    probe.close(() => resolve(port))
  })
})

let base = ''
let server: ChildProcess
let dir = ''

const get = async (path: string): Promise<{ status: number; body: string }> => {
  // Raw request line: fetch() would normalise dot segments and escapes away.
  const { request } = await import('node:http')
  return new Promise((resolve, reject) => {
    const req = request(`${base}${path}`, { method: 'GET' }, res => {
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.path = path
    req.end()
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'riselight-serve-'))
  // A sibling whose name extends the root's: a bare startsWith(root) check
  // would treat it as inside.
  mkdirSync(join(dir, 'public'))
  mkdirSync(join(dir, 'public-secret'))
  writeFileSync(join(dir, 'public', 'index.html'), '<title>shell</title>')
  writeFileSync(join(dir, 'public-secret', 'key.txt'), 'secret')
  writeFileSync(join(dir, 'outside.txt'), 'secret')

  const port = await freePort()
  base = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, ['e2e/serve.mjs', join(dir, 'public')], {
    env: { ...process.env, E2E_PORT: String(port) },
    stdio: 'ignore'
  })
  for (let i = 0; i < 100; i++) {
    try {
      await get('/')
      return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  throw new Error('e2e server did not start')
})

afterAll(() => {
  server?.kill()
  rmSync(dir, { recursive: true, force: true })
})

describe('e2e static server', () => {
  it('serves index.html for a directory and a real 404 otherwise', async () => {
    expect(await get('/')).toMatchObject({ status: 200, body: '<title>shell</title>' })
    expect((await get('/nope')).status).toBe(404)
  })

  it('never serves a file outside the root', async () => {
    for (const path of [
      '/../outside.txt',
      '/..%2Foutside.txt',
      '/%2e%2e/outside.txt',
      '/..%2F..%2Foutside.txt',
      '/..%2Fpublic-secret%2Fkey.txt'
    ]) {
      expect((await get(path)).body, path).not.toContain('secret')
    }
  })

  it('answers a malformed escape with 400 and keeps serving', async () => {
    expect((await get('/%E0%A4%A')).status).toBe(400)
    expect((await get('/')).status).toBe(200)
  })
})
