import type { Dimensions, Placement, ProductCategory, ProductOption } from './schema.ts'

/** Medidas de um item da lista; `estimated` = medida típica da categoria, não a do modelo. */
export interface ItemSize extends Dimensions {
  estimated: boolean
  /** Onde fica no cômodo (chão, parede, tapete). */
  placement: Exclude<Placement, 'none'>
}

/** Onde fica e tamanho típico, já com o que a variante muda (cama king, cooktop…). */
export function layoutFor(
  category: ProductCategory,
  variant?: string,
): { placement: Placement; size: Dimensions } | undefined {
  const { layout } = category
  if (!layout) return undefined
  const own = variant ? layout.variants?.[variant] : undefined
  return { placement: own?.placement ?? layout.placement, size: own?.size ?? layout.size }
}

/** Medidas do item: as reais da opção ou, sem elas, a típica (estimada). Sem layout = undefined. */
/** Mesa de N lugares sem medida no anúncio: tamanho comum de tampo para esse número de cadeiras. */
const TABLE_BY_SEATS: [number, { width: number; depth: number }][] = [
  [2, { width: 80, depth: 70 }],
  [4, { width: 120, depth: 80 }],
  [6, { width: 160, depth: 90 }],
  [8, { width: 200, depth: 100 }],
  [10, { width: 240, depth: 100 }],
  [12, { width: 280, depth: 110 }],
]

/** "Conjunto Mesa de Jantar 6 Cadeiras", "Mesa 8 Lugares" → 6, 8. */
export function seatsOf(name: string | undefined): number | undefined {
  const match = /(\d{1,2})\s*(lugares|cadeiras)/i.exec(name ?? '')
  return match ? Number(match[1]) : undefined
}

export function sizeOf(
  option: Pick<ProductOption, 'dimensions'> & { name?: string },
  category: ProductCategory,
  variant?: string,
): ItemSize | undefined {
  const layout = layoutFor(category, variant)
  if (!layout || layout.placement === 'none') return undefined
  const { placement } = layout
  if (option.dimensions) return { ...option.dimensions, estimated: false, placement }
  // Mesa sem medida: pelo número de lugares do nome (a de 8 lugares não é do tamanho da de 4).
  const seats = seatsOf(option.name)
  if (seats && /mesa/i.test(category.label)) {
    const size = TABLE_BY_SEATS.find(([n]) => n >= seats)?.[1] ?? TABLE_BY_SEATS.at(-1)![1]
    return { ...layout.size, ...size, estimated: true, placement }
  }
  return { ...layout.size, estimated: true, placement }
}

const cm = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** "70,5 × 74 × 194,3 cm" (largura × profundidade × altura). */
export const formatSize = ({ width, depth, height }: Dimensions) =>
  `${cm(width)} × ${cm(depth)} × ${cm(height)} cm`
