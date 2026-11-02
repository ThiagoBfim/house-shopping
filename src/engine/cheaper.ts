import type { Choices, ListView } from './budget.ts'
import { listRows, type RowRef } from './export.ts'
import { splitItemKey, type RoomInstance } from './house.ts'
import {
  cleanProductUrl,
  isValidManual,
  MAX_MANUAL_ITEMS,
  newManualId,
  replaceWith,
} from './manual.ts'

/** Item para a skill /search-better-prices (o `itens.json` do passo 0 dela). */
export interface PriceItem {
  /** Linha da planilha da lista (a 1ª linha de itens é a 2): liga o resultado ao item. */
  row: number
  produto: string
  qtd: number
  preco: number
  loja: string
  link: string
}

/** Os `count` itens de maior total da lista, já no formato que a skill lê. */
export function priceItems(view: ListView, instances: RoomInstance[], count: number): PriceItem[] {
  return listRows(view, instances)
    .map((row, i) => ({ row, line: i + 2 }))
    .sort((a, b) => b.row.total - a.row.total || a.line - b.line)
    .slice(0, count)
    .map(({ row, line }) => ({
      row: line,
      produto: row.product,
      qtd: row.qty,
      preco: row.price,
      loja: row.store,
      link: row.url,
    }))
}

/** Resultado da skill /search-better-prices para uma linha da planilha. */
export interface PriceFind {
  /** Linha da planilha (a 1ª linha de itens é a 2). */
  row: number
  status: string
  preco?: number
  loja?: string
  link?: string
}

/** Item que ficou mais barato. */
export interface AppliedFind {
  name: string
  store: string
  /** Preço unitário antes e depois. */
  was: number
  now: number
  /** Economia no total do item (preço × quantidade). */
  saving: number
}

export interface CheaperResult {
  choices: Choices
  applied: AppliedFind[]
  /** Ofertas melhores que não entraram (limite de itens adicionados atingido). */
  skipped: number
}

const cents = (reais: number) => Math.round(reais * 100)

/**
 * Aplica os preços melhores: item do catálogo vira uma troca (mesmo produto, loja e preço
 * novos); item do usuário (adicionado ou trocado antes) tem preço e link atualizados. Só vale
 * oferta menor que o preço atual, com link válido. `refs` = item de cada linha da planilha
 * enviada (`listRowRefs`); `view` = a lista de agora (pode ter mudado durante a busca).
 */
export function applyPriceFinds(
  choices: Choices,
  view: ListView,
  refs: RowRef[],
  finds: PriceFind[],
): CheaperResult {
  let next = choices
  const applied: AppliedFind[] = []
  let skipped = 0

  for (const find of finds) {
    const ref = refs[find.row - 2]
    if (!ref || find.status !== 'melhor' || !find.preco || !find.link) continue
    const price = cents(find.preco) / 100
    const url = cleanProductUrl(find.link)
    const store = find.loja?.trim() || 'outra loja'

    if (ref.kind === 'catalog') {
      const entry = view.entries.find((e) => e.item.category === ref.key)
      if (!entry || price >= entry.option.price) continue
      if (next.manual.length >= MAX_MANUAL_ITEMS) {
        skipped++
        continue
      }
      const fields = { name: entry.option.name, price, qty: entry.item.qty, url }
      if (!isValidManual(fields)) continue
      next = replaceWith(next, {
        id: newManualId(),
        instanceId: splitItemKey(ref.key).instanceId,
        replaces: ref.key,
        ...fields,
        found: { store, was: entry.option.price },
      })
      applied.push({ ...summary(fields, store, entry.option.price) })
    } else {
      const item = next.manual.find((m) => m.id === ref.id)
      if (!item || price >= item.price) continue
      const fields = { name: item.name, price, qty: item.qty, url }
      if (!isValidManual(fields)) continue
      const was = item.price
      next = {
        ...next,
        manual: next.manual.map((m) =>
          m.id === item.id ? { ...m, price, url, found: { store, was: m.found?.was ?? was } } : m,
        ),
      }
      applied.push(summary(fields, store, was))
    }
  }

  applied.sort((a, b) => b.saving - a.saving)
  return { choices: next, applied, skipped }
}

function summary(
  { name, price, qty }: { name: string; price: number; qty: number },
  store: string,
  was: number,
): AppliedFind {
  return { name, store, was, now: price, saving: ((cents(was) - cents(price)) * qty) / 100 }
}
