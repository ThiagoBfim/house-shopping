// Medidas dos produtos a partir dos atributos da API do Mercado Livre (lógica pura).
import type { Dimensions } from '../../src/data/schema.ts'

export interface Attribute {
  id: string
  value_name?: string | null
}

const UNIT_TO_CM: Record<string, number> = { mm: 0.1, cm: 1, m: 100, pol: 2.54, '"': 2.54 }

/** "70.5 cm" → 70.5; "1.943 m" → 194.3; "705 mm" → 70.5. Sem número ou unidade = undefined. */
export function parseLength(text: string | null | undefined): number | undefined {
  const match = /^\s*([\d.,]+)\s*(mm|cm|m|pol|")\s*$/i.exec(text ?? '')
  if (!match) return undefined
  const value = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return undefined
  return Math.round(value * UNIT_TO_CM[match[2].toLowerCase()] * 10) / 10
}

/**
 * Medida típica alongada (cama 138 × 188, berço, espreguiçadeira): a API às vezes troca largura
 * e comprimento, e aí a frente segue a da típica. Abaixo disso (freezer, lava-louças, ventilador),
 * vale a orientação da API: um freezer horizontal é mais largo que fundo, ao contrário do vertical.
 */
const ELONGATED = 1.2

/** Cada medida pode ter até 3,5× (para cima ou para baixo) a típica: fora disso é erro do anúncio. */
const MAX_RATIO = 3.5

const plausible = (value: number, typical: number) =>
  value >= typical / MAX_RATIO && value <= typical * MAX_RATIO

/**
 * Largura × profundidade × altura (cm) pelos atributos WIDTH, DEPTH (ou LENGTH) e HEIGHT.
 * Em item alongado (ver ELONGATED), a frente segue a da medida típica: colchão vem com WIDTH e
 * LENGTH trocados às vezes. Medida implausível (embalagem, erro de digitação) = undefined, e
 * vale a típica.
 */
export function dimensionsFromAttributes(
  attributes: Attribute[],
  typical: Dimensions,
): Dimensions | undefined {
  const value = (...ids: string[]) =>
    ids
      .map((id) => parseLength(attributes.find((a) => a.id === id)?.value_name))
      .find((v) => v !== undefined)
  let width = value('WIDTH')
  let depth = value('DEPTH', 'LENGTH')
  const height = value('HEIGHT')
  if (width === undefined || depth === undefined || height === undefined) return undefined
  const elongated =
    Math.max(typical.width, typical.depth) / Math.min(typical.width, typical.depth) >= ELONGATED
  if (elongated && width > depth !== typical.width > typical.depth) {
    ;[width, depth] = [depth, width]
  }
  const dimensions = { width, depth, height }
  const ok =
    plausible(width, typical.width) &&
    plausible(depth, typical.depth) &&
    plausible(height, typical.height)
  return ok ? dimensions : undefined
}
