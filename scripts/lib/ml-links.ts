// Planilha de links de afiliado do Mercado Livre ↔ catálogo (lógica pura, sem arquivos).
import { applyBestOffer, isAffiliateUrl, parseMercadoLivreId } from '../../src/data/offers.ts'
import type { Offer, Products } from '../../src/data/schema.ts'
import { parsePrice } from './csv.ts'

export const LINK_COLUMNS = [
  'id',
  'categoria',
  'tier',
  'nome',
  'preco_referencia',
  'busca',
  'link_produto',
  'link_afiliado',
  'preco',
] as const

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
          return [
            option.id,
            category,
            String(option.tier),
            option.name,
            String(option.price),
            `https://lista.mercadolivre.com.br/${option.id}`,
            offer?.externalId ?? '',
            offer?.url ?? '',
            offer ? String(offer.price) : '',
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
  unknownIds: string[]
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
    unknownIds: [],
    changedCategories: new Set(),
  }
  const index = new Map(
    Object.entries(next).flatMap(([category, { options }]) =>
      options.map((option, i) => [option.id, { category, i }] as const),
    ),
  )

  for (const row of rows) {
    const link = row.link_afiliado
    if (!link) continue
    const found = index.get(row.id)
    if (!found) {
      report.unknownIds.push(row.id)
      continue
    }
    const options = next[found.category].options
    const option = options[found.i]
    const externalId =
      parseMercadoLivreId(row.link_produto ?? '')?.id ?? parseMercadoLivreId(link)?.id
    const offer: Offer = {
      store: 'mercadolivre',
      url: link,
      price: parsePrice(row.preco ?? '') ?? mlOffer(option.offers)?.price ?? option.price,
      updatedAt: today,
      available: true,
      ...(externalId && { externalId }),
    }
    const others = (option.offers ?? []).filter((o) => o.store !== 'mercadolivre')
    options[found.i] = applyBestOffer({ ...option, offers: [offer, ...others] })

    report.applied.push(row.id)
    report.changedCategories.add(found.category)
    if (!externalId) report.withoutId.push(row.id)
    if (!isAffiliateUrl(link)) report.notAffiliate.push(row.id)
  }
  return { products: next, report }
}
