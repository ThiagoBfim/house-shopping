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
export function sizeOf(
  option: Pick<ProductOption, 'dimensions'>,
  category: ProductCategory,
  variant?: string,
): ItemSize | undefined {
  const layout = layoutFor(category, variant)
  if (!layout || layout.placement === 'none') return undefined
  const { placement } = layout
  return option.dimensions
    ? { ...option.dimensions, estimated: false, placement }
    : { ...layout.size, estimated: true, placement }
}

const cm = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** "70,5 × 74 × 194,3 cm" (largura × profundidade × altura). */
export const formatSize = ({ width, depth, height }: Dimensions) =>
  `${cm(width)} × ${cm(depth)} × ${cm(height)} cm`
