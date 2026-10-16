import { describe, expect, it } from 'vitest'
import { loadServiceWorker, response } from './helpers/swHarness'

describe('service worker', () => {
  it('never replaces the cached app shell with an error or redirected page', async () => {
    let online = true
    const sw = loadServiceWorker(async url => {
      if (!online) {
        throw new TypeError('offline')
      }
      if (url.endsWith('/missing')) {
        return response('not found', 404)
      }
      if (url.endsWith('/portal')) {
        return response('hotel wifi login', 200, true)
      }
      return response('app shell')
    })

    await sw.navigate('/')
    await sw.navigate('/missing')
    await sw.navigate('/portal')
    online = false
    expect((await sw.navigate('/'))?.body).toBe('app shell')
  })

  it('caches the build files the page already loaded, so the first visit is enough to launch offline', async () => {
    const sw = loadServiceWorker(async url => response(`file ${url}`))
    await sw.message({ type: 'cache-urls', urls: ['/_nuxt/entry.abc123.js', '/_nuxt/entry.abc123.css', 'https://elsewhere.test/x.js'] })
    expect(sw.store.has(sw.key('/_nuxt/entry.abc123.js'))).toBe(true)
    expect(sw.store.has(sw.key('/_nuxt/entry.abc123.css'))).toBe(true)
    expect(sw.store.has('https://elsewhere.test/x.js')).toBe(false)
  })
})
