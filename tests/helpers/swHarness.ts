import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// Runs public/sw.js in a sandbox with in-memory caches and a scripted fetch.
type FakeResponse = { ok: boolean; status: number; redirected?: boolean; body: string; clone: () => FakeResponse }

export const response = (body: string, status = 200, redirected = false): FakeResponse => {
  const make = (): FakeResponse => ({ ok: status >= 200 && status < 300, status, redirected, body, clone: make })
  return make()
}

export const loadServiceWorker = (network: (url: string) => Promise<FakeResponse>) => {
  const store = new Map<string, FakeResponse>()
  const listeners = new Map<string, (event: unknown) => void>()
  const pending: Promise<unknown>[] = []
  const origin = 'https://riselight.test'
  const key = (request: string | { url: string }) => new URL(typeof request === 'string' ? request : request.url, origin).href

  const cache = {
    put: async (request: string | { url: string }, value: FakeResponse) => { store.set(key(request), value) },
    match: async (request: string | { url: string }) => store.get(key(request)),
    addAll: async (urls: string[]) => {
      // Like the real Cache API: duplicate requests reject the whole batch.
      if (new Set(urls.map(key)).size !== urls.length) {
        throw new Error('InvalidStateError: duplicate requests')
      }
      for (const url of urls) {
        store.set(key(url), await network(key(url)))
      }
    }
  }
  const caches = {
    open: async () => cache,
    match: (request: string | { url: string }) => cache.match(request),
    keys: async () => [],
    delete: async () => true
  }

  const self = {
    location: { origin },
    addEventListener: (type: string, handler: (event: unknown) => void) => listeners.set(type, handler),
    skipWaiting: async () => {},
    clients: { claim: async () => {} }
  }

  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self,
    caches,
    fetch: (request: string | { url: string }) => network(key(request)),
    URL,
    Promise
  })

  const settle = async () => {
    while (pending.length) {
      await pending.shift()
    }
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  const navigate = async (path: string): Promise<FakeResponse | undefined> => {
    let result: Promise<FakeResponse | undefined> | undefined
    listeners.get('fetch')!({
      request: { method: 'GET', mode: 'navigate', url: key(path) },
      respondWith: (value: Promise<FakeResponse | undefined>) => { result = value }
    })
    const value = await result
    await settle()
    return value
  }

  const message = async (data: unknown) => {
    listeners.get('message')?.({ data, waitUntil: (value: Promise<unknown>) => pending.push(value) })
    await settle()
  }

  return { store, navigate, message, key }
}
