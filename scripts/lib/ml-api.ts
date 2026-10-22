// Cliente mínimo da API do Mercado Livre. Desde 2025 todos os endpoints exigem token
// (sem token: 403 "PolicyAgent"). Ver docs/project/MercadoLivre.md.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isTrustedSeller, type Lookup } from './ml-sync.ts'

export const API = 'https://api.mercadolibre.com'
const TOKEN_FILE = new URL('../../.ml-token.json', import.meta.url)

/** Guarda o refresh token (muda a cada uso) fora do git. */
export function saveRefreshToken(refreshToken: string) {
  writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: refreshToken }, null, 2))
}

/**
 * Token de acesso: ML_ACCESS_TOKEN, ou renova com ML_CLIENT_ID + ML_CLIENT_SECRET + refresh token
 * (ML_REFRESH_TOKEN ou o salvo em .ml-token.json). O refresh token muda a cada uso, então o novo é salvo.
 */
export async function getAccessToken(): Promise<string> {
  const { ML_ACCESS_TOKEN, ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REFRESH_TOKEN } = process.env
  if (ML_ACCESS_TOKEN) return ML_ACCESS_TOKEN

  const saved = existsSync(TOKEN_FILE)
    ? (JSON.parse(readFileSync(TOKEN_FILE, 'utf8')) as { refresh_token?: string })
    : {}
  const refreshToken = saved.refresh_token ?? ML_REFRESH_TOKEN
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET || !refreshToken) {
    throw new Error(
      !ML_CLIENT_ID || !ML_CLIENT_SECRET
        ? 'Preencha ML_CLIENT_ID e ML_CLIENT_SECRET no .env.local (passo a passo em docs/project/MercadoLivre.md).'
        : 'App ainda não autorizado: rode "npm run ml:auth" e siga as instruções (gera o token em .ml-token.json).',
    )
  }

  const response = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  })
  if (!response.ok) {
    throw new Error(`Falha ao renovar o token (${response.status}): ${await response.text()}`)
  }
  const token = (await response.json()) as { access_token: string; refresh_token: string }
  saveRefreshToken(token.refresh_token)
  return token.access_token
}

export function createLookup(accessToken: string): Lookup {
  const get = async <T>(path: string): Promise<T | undefined> => {
    const response = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`GET ${path} → ${response.status}: ${await response.text()}`)
    return (await response.json()) as T
  }

  interface Seller {
    sellerLevel?: string
    sellerSales?: number
  }
  const sellers = new Map<number, Seller>()
  const seller = async (sellerId: number | undefined): Promise<Seller> => {
    if (sellerId === undefined) return {}
    if (!sellers.has(sellerId)) {
      const user = await get<{
        seller_reputation?: { level_id?: string | null; transactions?: { total?: number } }
      }>(`/users/${sellerId}`)
      const reputation = user?.seller_reputation
      sellers.set(sellerId, {
        sellerLevel: reputation ? (reputation.level_id ?? 'none') : undefined,
        sellerSales: reputation?.transactions?.total,
      })
    }
    return sellers.get(sellerId)!
  }

  interface CatalogItem {
    item_id: string
    price: number
    condition?: string
    seller_id?: number
    official_store_id?: number | null
  }

  // Desde 2025, /items/{id} de outros vendedores dá 403. As ofertas de um produto de
  // catálogo continuam abertas: é por elas que achamos o anúncio escolhido.
  const catalogItems = async (catalogId: string) => {
    const all: CatalogItem[] = []
    for (let offset = 0; offset < 500; offset += 100) {
      const page = await get<{ results: CatalogItem[]; paging: { total: number } }>(
        `/products/${catalogId}/items?limit=100&offset=${offset}`,
      )
      if (!page) return undefined
      all.push(...page.results)
      if (all.length >= page.paging.total) break
    }
    return all
  }

  const quoteOf = async (item: CatalogItem) => ({
    price: item.price,
    available: true,
    condition: item.condition,
    official: item.official_store_id != null,
    ...(await seller(item.seller_id)),
  })

  return async ({ itemId, catalogId }) => {
    const items = await catalogItems(catalogId)
    if (!items) return undefined
    if (itemId !== catalogId) {
      const item = items.find((i) => i.item_id === itemId)
      return item ? quoteOf(item) : { available: false }
    }
    // Link só do catálogo: a oferta nova mais barata de vendedor confiável.
    const candidates = items.filter((i) => i.condition === 'new').sort((a, b) => a.price - b.price)
    for (const item of candidates) {
      const quote = await quoteOf(item)
      if (isTrustedSeller(quote)) return quote
    }
    return { available: false }
  }
}
