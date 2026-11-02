import { isWebUrl } from '../engine/manual.ts'

/**
 * Encurtador do link compartilhado: is.gd (grátis, sem chave e sem cadastro). Nos testes E2E,
 * `VITE_SHORTENER` aponta para um endereço falso (nada sai para a internet).
 */
export const SHORTENER_ENDPOINT: string =
  import.meta.env.VITE_SHORTENER ?? 'https://is.gd/create.php?format=json&url='

/** Maior link que o is.gd aceita (testado: 4.948 caracteres passa, 5.148 não). */
export const MAX_SHORTEN_LENGTH = 5000

/** Link pequeno o bastante para o encurtador; maior que isso nem tenta. */
export const canShorten = (url: string) => url.length <= MAX_SHORTEN_LENGTH

/** Mais que isso e o encurtador é tratado como fora do ar. */
export const SHORTEN_TIMEOUT_MS = 3000

interface Options {
  endpoint?: string
  timeoutMs?: number
  fetchFn?: typeof fetch
}

/** Link completo → resultado (curto, ou o próprio link se o encurtador falhou). */
const results = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

/** Resultado já pronto, para usar no mesmo clique (compartilhar exige o gesto do usuário). */
export const cachedShort = (url: string): string | undefined => results.get(url)

/**
 * Encurta o link. Nunca falha: fora do ar, lento, sem CORS ou resposta estranha devolvem o
 * link completo (que funciona igual, só é maior). O resultado fica guardado por link.
 */
export function shortenUrl(url: string, options: Options = {}): Promise<string> {
  const ready = results.get(url)
  if (ready) return Promise.resolve(ready)
  if (!canShorten(url)) return Promise.resolve(url)
  let request = pending.get(url)
  if (!request) {
    request = requestShort(url, options).then((short) => {
      const result = short ?? url
      results.set(url, result)
      pending.delete(url)
      return result
    })
    pending.set(url, request)
  }
  return request
}

async function requestShort(
  url: string,
  { endpoint = SHORTENER_ENDPOINT, timeoutMs = SHORTEN_TIMEOUT_MS, fetchFn = fetch }: Options,
): Promise<string | undefined> {
  try {
    const response = await fetchFn(endpoint + encodeURIComponent(url), {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return undefined
    return parseShortUrl(await response.json(), url)
  } catch {
    return undefined
  }
}

/** Resposta do is.gd: `{ shorturl }` (ou `{ errorcode, errormessage }`). Só vale https e menor. */
export function parseShortUrl(body: unknown, url: string): string | undefined {
  if (typeof body !== 'object' || body === null || !('shorturl' in body)) return undefined
  const { shorturl } = body
  if (typeof shorturl !== 'string' || !shorturl.startsWith('https://')) return undefined
  return isWebUrl(shorturl) && shorturl.length < url.length ? shorturl : undefined
}

/** Só para os testes: esquece os links já encurtados. */
export function clearShortCache(): void {
  results.clear()
  pending.clear()
}
