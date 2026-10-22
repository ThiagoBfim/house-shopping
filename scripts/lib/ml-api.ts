// Cliente mínimo da API do Mercado Livre. Desde 2025 todos os endpoints exigem token
// (sem token: 403 "PolicyAgent"). Ver docs/project/MercadoLivre.md.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { Lookup, Quote } from './ml-sync.ts'

const API = 'https://api.mercadolibre.com'
const TOKEN_FILE = new URL('../../.ml-token.json', import.meta.url)

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
      'Sem credenciais do Mercado Livre. Defina ML_ACCESS_TOKEN, ou ML_CLIENT_ID + ML_CLIENT_SECRET + ML_REFRESH_TOKEN em .env.local (passo a passo em docs/project/MercadoLivre.md).',
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
  writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: token.refresh_token }, null, 2))
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

  const sellerLevels = new Map<number, string | undefined>()
  const sellerLevel = async (sellerId: number | undefined) => {
    if (sellerId === undefined) return undefined
    if (!sellerLevels.has(sellerId)) {
      const user = await get<{ seller_reputation?: { level_id?: string } }>(`/users/${sellerId}`)
      sellerLevels.set(sellerId, user?.seller_reputation?.level_id)
    }
    return sellerLevels.get(sellerId)
  }

  interface Item {
    price: number
    status: string
    condition?: string
    seller_id?: number
    pictures?: { secure_url?: string }[]
    thumbnail?: string
  }

  const fromItem = async (item: Item): Promise<Quote> => ({
    price: item.price,
    available: item.status === 'active',
    condition: item.condition,
    sellerLevel: await sellerLevel(item.seller_id),
    image: item.pictures?.[0]?.secure_url ?? item.thumbnail?.replace(/^http:/, 'https:'),
  })

  return async (externalId) => {
    // Produto de catálogo (/p/MLB…): o preço é o do anúncio que ganha a "buy box".
    const product = await get<{ buy_box_winner?: { item_id: string } | null }>(
      `/products/${externalId}`,
    )
    if (product) {
      const winner = product.buy_box_winner
      if (!winner) return undefined
      const item = await get<Item>(`/items/${winner.item_id}`)
      return item && fromItem(item)
    }
    const item = await get<Item>(`/items/${externalId}`)
    return item && fromItem(item)
  }
}
