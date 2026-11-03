import type { AppliedFind, PriceFind, PriceItem } from './cheaper.ts'

// Só tipos de cheaper.ts: este módulo vai no site sem carregar a exportação (Excel).

/** Situação de cada item na busca, para a lista do painel. */
export type SearchStatus =
  | 'queued'
  | 'searching'
  | 'cheaper'
  | 'no-better'
  | 'not-found'
  /** Oferta melhor que não entrou (limite de itens, ou o item mudou durante a busca). */
  | 'not-applied'
  /** A busca terminou antes de chegar nele (orçamento ou tempo do Claude Code). */
  | 'skipped'

export interface SearchRow {
  item: PriceItem
  status: SearchStatus
  find?: PriceFind
  applied?: AppliedFind
}

/**
 * Cada item pesquisado com a situação dele. A skill pesquisa na ordem enviada (do maior total
 * para o menor): enquanto roda, o 1º sem resultado está "procurando" e os outros "na fila".
 * `applied` só existe no fim (depois de aplicar).
 */
export function searchRows(
  items: PriceItem[],
  finds: PriceFind[],
  options: { running: boolean; applied?: AppliedFind[] },
): SearchRow[] {
  const findOf = new Map(finds.map((find) => [find.row, find]))
  const appliedOf = new Map((options.applied ?? []).map((a) => [a.row, a]))
  let searchingShown = false
  return items.map((item) => {
    const find = findOf.get(item.row)
    if (!find) {
      if (!options.running) return { item, status: 'skipped' }
      const status = searchingShown ? 'queued' : 'searching'
      searchingShown = true
      return { item, status }
    }
    const applied = appliedOf.get(item.row)
    if (applied) return { item, status: 'cheaper', find, applied }
    if (find.status === 'melhor') {
      // Durante a busca, a oferta ainda não foi aplicada: mostra como achada.
      return { item, status: options.running ? 'cheaper' : 'not-applied', find }
    }
    return { item, status: find.status === 'não encontrado' ? 'not-found' : 'no-better', find }
  })
}
