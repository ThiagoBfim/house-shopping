import type { Store } from '../data/schema.ts'
import type { ListView } from './budget.ts'
import { splitItemKey, type RoomInstance } from './house.ts'
import type { Cell, Sheet } from './xlsx.ts'

export interface ExportRow {
  room: string
  /** Categoria ("Geladeira"). */
  item: string
  /** Modelo escolhido. */
  product: string
  qty: number
  /** Preço de uma unidade. */
  price: number
  total: number
  store: string
  url: string
}

const STORE_NAMES: Record<Store, string> = {
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
  other: 'Outra loja',
}

/** Coluna "Item" dos itens adicionados pelo usuário. */
export const MANUAL_ITEM_LABEL = 'Adicionado por você'
/** Coluna "Item" de uma troca: "Box (trocado por você)". */
export const REPLACED_ITEM_SUFFIX = 'trocado por você'

/**
 * Itens da lista exibida, agrupados por cômodo na ordem da casa; em cada cômodo, os
 * adicionados pelo usuário vêm depois dos do catálogo.
 */
export function listRows(view: ListView, instances: RoomInstance[]): ExportRow[] {
  const order = (instanceId: string) =>
    instances.findIndex((instance) => instance.id === instanceId)
  const catalogRows = view.entries.map(({ item, label, option, subtotal }) => ({
    instanceId: splitItemKey(item.category).instanceId,
    row: {
      item: label,
      product: option.name,
      qty: item.qty,
      price: option.price,
      total: subtotal,
      store: STORE_NAMES[option.store],
      url: option.url,
    },
  }))
  const manualRows = view.manual.map(({ item, store, subtotal, replaced }) => ({
    instanceId: item.instanceId,
    row: {
      item: replaced ? `${replaced.label} (${REPLACED_ITEM_SUFFIX})` : MANUAL_ITEM_LABEL,
      product: item.name,
      qty: item.qty,
      price: item.price,
      total: subtotal,
      store: STORE_NAMES[store],
      url: item.url,
    },
  }))
  return [...catalogRows, ...manualRows]
    .sort((a, b) => order(a.instanceId) - order(b.instanceId))
    .map(({ instanceId, row }) => ({ room: instances[order(instanceId)]?.title ?? '', ...row }))
}

const HEADER = [
  'Cômodo',
  'Item',
  'Produto',
  'Qtd',
  'Preço unitário',
  'Total',
  'Loja',
  'Link do anúncio',
]
const TOTAL_COLUMN = 'F'

/** Planilha da lista: uma linha por item e, no fim, total (fórmula), orçamento e saldo. */
export function listSheet(view: ListView, instances: RoomInstance[]): Sheet {
  const rows = listRows(view, instances)
  const money = (number: number, bold = false): Cell => ({ number, format: 'money', bold })
  const summary = (label: string, value: Cell): Cell[] => [
    null,
    null,
    null,
    null,
    { text: label, bold: true },
    value,
  ]
  const lastItemRow = rows.length + 1
  return {
    name: 'Lista',
    widths: [18, 22, 48, 6, 15, 15, 14, 60],
    rows: [
      HEADER.map((text) => ({ text, bold: true })),
      ...rows.map((row): Cell[] => [
        { text: row.room },
        { text: row.item },
        { text: row.product },
        { number: row.qty, format: 'int' },
        money(row.price),
        money(row.total),
        { text: row.store },
        { link: row.url },
      ]),
      [],
      summary('Total da lista', {
        formula: rows.length ? `SUM(${TOTAL_COLUMN}2:${TOTAL_COLUMN}${lastItemRow})` : '0',
        value: view.total,
        format: 'money',
        bold: true,
      }),
      summary('Orçamento', money(view.budget)),
      summary(view.remaining < 0 ? 'Faltam' : 'Saldo', money(Math.abs(view.remaining))),
    ],
  }
}

/** "lista-house-shopping-2026-10-22.xlsx" */
export const exportFileName = (date: string) => `lista-house-shopping-${date}.xlsx`
