import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cachedShort,
  canShorten,
  clearShortCache,
  MAX_SHORTEN_LENGTH,
  parseShortUrl,
  shortenUrl,
} from '../src/ui/shortener.ts'

const LONG = `https://thiagobfim.github.io/house-shopping/#l=0${'a'.repeat(400)}&s=1`
const json = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)

describe('parseShortUrl', () => {
  it('aceita só https e menor que o original', () => {
    expect(parseShortUrl({ shorturl: 'https://is.gd/abc' }, LONG)).toBe('https://is.gd/abc')
    expect(parseShortUrl({ shorturl: 'http://is.gd/abc' }, LONG)).toBeUndefined()
    expect(parseShortUrl({ shorturl: 'javascript:alert(1)' }, LONG)).toBeUndefined()
    expect(parseShortUrl({ shorturl: LONG + 'x' }, LONG)).toBeUndefined()
    expect(parseShortUrl({ shorturl: 42 }, LONG)).toBeUndefined()
    expect(parseShortUrl({ errorcode: 1, errormessage: 'x' }, LONG)).toBeUndefined()
    expect(parseShortUrl(null, LONG)).toBeUndefined()
  })
})

describe('shortenUrl', () => {
  beforeEach(clearShortCache)

  it('encurta e guarda: o segundo pedido não chama o encurtador', async () => {
    const fetchFn = vi.fn(() => json({ shorturl: 'https://is.gd/abc' }))
    const endpoint = 'https://encurtador.test/?url='
    expect(cachedShort(LONG)).toBeUndefined()
    const [a, b] = [shortenUrl(LONG, { fetchFn, endpoint }), shortenUrl(LONG, { fetchFn })]
    expect(await a).toBe('https://is.gd/abc')
    expect(await b).toBe('https://is.gd/abc')
    expect(await shortenUrl(LONG, { fetchFn })).toBe('https://is.gd/abc')
    expect(cachedShort(LONG)).toBe('https://is.gd/abc')
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn.mock.calls[0]).toEqual([
      endpoint + encodeURIComponent(LONG),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ])
  })

  it('fora do ar, erro HTTP, lento ou resposta estranha: devolve o link completo', async () => {
    const cases: (typeof fetch)[] = [
      () => Promise.reject(new TypeError('Failed to fetch')),
      () => json({}, false),
      () => json({ errorcode: 2, errormessage: 'rate limit' }),
      (_, init) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
        ),
    ]
    for (const fetchFn of cases) {
      clearShortCache()
      expect(await shortenUrl(LONG, { fetchFn, timeoutMs: 10 })).toBe(LONG)
      expect(cachedShort(LONG)).toBe(LONG)
    }
  })

  it('link maior que o limite do is.gd: nem chama o encurtador', async () => {
    const huge = `https://thiagobfim.github.io/house-shopping/#l=0${'a'.repeat(MAX_SHORTEN_LENGTH)}`
    const fetchFn = vi.fn(() => json({ shorturl: 'https://is.gd/abc' }))
    expect(canShorten(huge)).toBe(false)
    expect(canShorten(LONG)).toBe(true)
    expect(await shortenUrl(huge, { fetchFn })).toBe(huge)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
