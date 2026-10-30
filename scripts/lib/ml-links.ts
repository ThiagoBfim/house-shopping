// Planilha de links de afiliado do Mercado Livre ↔ catálogo (lógica pura, sem arquivos).
import {
  applyBestOffer,
  isAffiliateUrl,
  isSearchUrl,
  parseMercadoLivreIds,
} from '../../src/data/offers.ts'
import { recordPrice } from '../../src/data/price-history.ts'
import type { Offer, Products } from '../../src/data/schema.ts'
import { parsePrice } from './csv.ts'

export const LINK_COLUMNS = [
  'id',
  'categoria',
  'tier',
  'nome',
  /** "sim" = produto genérico (sem marca/modelo): pode ficar só com o link de busca. */
  'generico',
  'preco_referencia',
  'busca',
  'link_produto',
  'link_afiliado',
  'preco',
  /** Data em que o preço foi visto (AAAA-MM-DD; vazia = hoje). */
  'data',
  /** URL https da foto do produto. */
  'imagem',
] as const

const isIsoDate = (text: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text))
const isHttpsUrl = (text: string) => {
  try {
    return new URL(text).protocol === 'https:'
  } catch {
    return false
  }
}

const mlOffer = (offers: Offer[] | undefined) => offers?.find((o) => o.store === 'mercadolivre')

/** Uma linha por opção do catálogo, já preenchida com o que existir. */
export function exportRows(products: Products): string[][] {
  return Object.entries(products)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([category, { options }]) =>
      [...options]
        .sort((a, b) => a.tier - b.tier)
        .map((option) => {
          const offer = mlOffer(option.offers)
          // Reconstrói o link do produto com os dois ids (catálogo + anúncio escolhido).
          const productLink = offer?.catalogId
            ? `https://www.mercadolivre.com.br/p/${offer.catalogId}` +
              (offer.externalId && offer.externalId !== offer.catalogId
                ? `?pdp_filters=item_id%3A${offer.externalId}`
                : '')
            : (offer?.externalId ?? (isSearchUrl(option.url) ? '' : option.url))
          return [
            option.id,
            category,
            String(option.tier),
            option.name,
            option.generic ? 'sim' : 'não',
            String(option.price),
            `https://lista.mercadolivre.com.br/${option.id}`,
            productLink,
            // Oferta com o link direto do produto (criada pelo sync) ainda não tem afiliado.
            offer && isAffiliateUrl(offer.url) ? offer.url : '',
            offer ? String(offer.price) : '',
            offer?.updatedAt ?? '',
            option.image ?? '',
          ]
        }),
    )
}

export interface ImportReport {
  applied: string[]
  /** Link aplicado mas sem id do produto: o sync de preço não vai funcionar para eles. */
  withoutId: string[]
  /** Link que não parece de afiliado (não gera comissão). */
  notAffiliate: string[]
  /** Sem link de afiliado: gravado só o link direto do produto (sem oferta nem preço da loja). */
  direct: string[]
  unknownIds: string[]
  /** Data inválida na planilha (usou hoje). */
  badDates: string[]
  /** Imagem que não é URL https (ignorada). */
  badImages: string[]
  changedCategories: Set<string>
}

/** Aplica as linhas preenchidas (link_afiliado) no catálogo. Não altera o objeto recebido. */
export function importRows(
  products: Products,
  rows: Record<string, string>[],
  today: string,
): { products: Products; report: ImportReport } {
  const next: Products = structuredClone(products)
  const report: ImportReport = {
    applied: [],
    withoutId: [],
    notAffiliate: [],
    direct: [],
    unknownIds: [],
    badDates: [],
    badImages: [],
    changedCategories: new Set(),
  }
  const index = new Map(
    Object.entries(next).flatMap(([category, { options }]) =>
      options.map((option, i) => [option.id, { category, i }] as const),
    ),
  )

  for (const row of rows) {
    const found = index.get(row.id)
    // generico: "sim" liga a flag, "não" desliga, vazio não mexe.
    if (found && row.generico?.trim()) {
      const option = next[found.category].options[found.i]
      const generic = /^(sim|s|true|1|x)$/i.test(row.generico.trim())
      if (generic !== Boolean(option.generic)) {
        const rest = { ...option }
        delete rest.generic
        next[found.category].options[found.i] = generic ? { ...rest, generic } : rest
        report.changedCategories.add(found.category)
      }
    }
    const link = row.link_afiliado
    if (!link) {
      if (found && row.link_produto) applyDirectLink(next, found, row, report)
      continue
    }
    if (!found) {
      report.unknownIds.push(row.id)
      continue
    }
    const options = next[found.category].options
    const option = options[found.i]
    const ids = parseMercadoLivreIds(row.link_produto ?? '') ?? parseMercadoLivreIds(link)
    const externalId = ids?.itemId ?? ids?.catalogId
    const catalogId = ids?.catalogId
    const existing = mlOffer(option.offers)
    const date = row.data && isIsoDate(row.data) ? row.data : today
    if (row.data && date !== row.data) report.badDates.push(row.id)
    const price = parsePrice(row.preco ?? '') ?? existing?.price ?? option.price

    const base: Offer = existing
      ? { ...existing, url: link, available: true }
      : { store: 'mercadolivre', url: link, price, updatedAt: date, available: true }
    const offer = recordPrice(
      { ...base, ...(externalId && { externalId }), ...(catalogId && { catalogId }) },
      date,
      price,
    )
    const others = (option.offers ?? []).filter((o) => o.store !== 'mercadolivre')

    let image = option.image
    if (row.imagem) {
      if (isHttpsUrl(row.imagem)) image = row.imagem
      else report.badImages.push(row.id)
    }
    options[found.i] = applyBestOffer({
      ...option,
      ...(image && { image }),
      offers: [offer, ...others],
    })

    report.applied.push(row.id)
    report.changedCategories.add(found.category)
    if (!externalId) report.withoutId.push(row.id)
    if (!isAffiliateUrl(link)) report.notAffiliate.push(row.id)
  }
  return { products: next, report }
}

/** Sem afiliado: o produto abre direto na loja (sem oferta, mantém o preço de referência). */
function applyDirectLink(
  products: Products,
  { category, i }: { category: string; i: number },
  row: Record<string, string>,
  report: ImportReport,
) {
  const option = products[category].options[i]
  if (mlOffer(option.offers) || !isHttpsUrl(row.link_produto) || isSearchUrl(row.link_produto)) {
    return
  }
  const image = row.imagem && isHttpsUrl(row.imagem) ? row.imagem : option.image
  if (option.url === row.link_produto && image === option.image) return
  products[category].options[i] = { ...option, url: row.link_produto, ...(image && { image }) }
  report.direct.push(row.id)
  report.changedCategories.add(category)
}
