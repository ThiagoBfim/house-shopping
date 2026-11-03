import { describe, expect, it } from 'vitest'
import { dimensionsFromAttributes, parseLength } from '../scripts/lib/dimensions.ts'
import { formatSize, layoutFor, sizeOf } from '../src/data/layout.ts'
import { products } from '../src/data/catalog-data.ts'

const attrs = (width: string, depth: string, height: string, depthId = 'DEPTH') => [
  { id: 'WIDTH', value_name: width },
  { id: depthId, value_name: depth },
  { id: 'HEIGHT', value_name: height },
  { id: 'BRAND', value_name: 'Brastemp' },
]

describe('parseLength', () => {
  it.each([
    ['70.5 cm', 70.5],
    ['1.943 m', 194.3],
    ['705 mm', 70.5],
    ['55 pol', 139.7],
    ['86,5 cm', 86.5],
  ])('%s → %s', (text, cm) => expect(parseLength(text)).toBe(cm))

  it('sem número ou unidade = undefined', () => {
    for (const text of ['', 'grande', '70', '0 cm', null, undefined]) {
      expect(parseLength(text)).toBeUndefined()
    }
  })
})

describe('dimensionsFromAttributes', () => {
  const fridge = { width: 70, depth: 75, height: 185 }
  const bed = { width: 138, depth: 188, height: 42 }
  const freezer = { width: 60, depth: 65, height: 165 }

  it('geladeira real (API de 03/11): WIDTH, DEPTH e HEIGHT em cm e m', () => {
    expect(dimensionsFromAttributes(attrs('70.5 cm', '74 cm', '1.943 m'), fridge)).toEqual({
      width: 70.5,
      depth: 74,
      height: 194.3,
    })
  })

  it('colchão/cama com WIDTH e LENGTH trocados: a frente segue a típica (alongada)', () => {
    expect(dimensionsFromAttributes(attrs('188 cm', '138 cm', '27 cm', 'LENGTH'), bed)).toEqual({
      width: 138,
      depth: 188,
      height: 27,
    })
  })

  it('freezer horizontal mais largo que fundo: típica quase quadrada não vira', () => {
    expect(dimensionsFromAttributes(attrs('160 cm', '78 cm', '97 cm'), freezer)).toEqual({
      width: 160,
      depth: 78,
      height: 97,
    })
  })

  it('sem alguma medida ou medida implausível (embalagem, erro): undefined', () => {
    expect(dimensionsFromAttributes(attrs('70 cm', '74 cm', 'alto'), fridge)).toBeUndefined()
    expect(dimensionsFromAttributes(attrs('7 m', '74 cm', '185 cm'), fridge)).toBeUndefined()
    expect(dimensionsFromAttributes(attrs('7 cm', '74 cm', '185 cm'), fridge)).toBeUndefined()
    expect(dimensionsFromAttributes([], fridge)).toBeUndefined()
  })
})

describe('layout do catálogo', () => {
  it('variante muda o tamanho e onde fica (cama king; cooktop não ocupa chão)', () => {
    expect(layoutFor(products['cama-box'], 'king')?.size).toMatchObject({ width: 193, depth: 203 })
    expect(layoutFor(products['cama-box'])?.size).toMatchObject({ width: 138, depth: 188 })
    expect(layoutFor(products.fogao, 'cooktop-inducao')?.placement).toBe('none')
    expect(layoutFor(products.fogao, 'piso')?.placement).toBe('floor')
    expect(layoutFor(products.liquidificador)).toBeUndefined()
  })

  it('sizeOf: medida real da opção ou a típica estimada', () => {
    const geladeira = products.geladeira
    const real = geladeira.options.find((o) => o.dimensions)!
    expect(sizeOf(real, geladeira)).toEqual({ ...real.dimensions, estimated: false })
    expect(sizeOf({}, geladeira)).toEqual({ width: 70, depth: 75, height: 185, estimated: true })
    expect(sizeOf({}, products.colchao)).toBeUndefined() // colchão fica sobre a cama
    expect(sizeOf({}, products.liquidificador)).toBeUndefined()
  })

  it('formatSize', () => {
    expect(formatSize({ width: 70.5, depth: 74, height: 194.3 })).toBe('70,5 × 74 × 194,3 cm')
  })
})

describe('medidas na lista', () => {
  it('cada item com layout traz a medida da variante escolhida; cooktop não', async () => {
    const { buildList, emptyChoices } = await import('../src/engine/budget.ts')
    const { expandHouse } = await import('../src/engine/house.ts')
    const { applyPreferences } = await import('../src/engine/preferences.ts')
    const { rooms } = await import('../src/data/catalog-data.ts')
    const house = expandHouse(rooms, products, { quarto: 1, cozinha: 1 })
    const choices = {
      ...emptyChoices(),
      variants: { 'quarto:cama-box': 'king', 'cozinha:fogao': 'cooktop-inducao' },
    }
    const custom = applyPreferences(house.room, house.products, choices)
    const view = buildList(custom.room, custom.products, 1_000_000, choices)
    const entry = (key: string) => view.entries.find((e) => e.item.category === key)
    expect(entry('quarto:cama-box')?.size).toMatchObject({ width: 193, depth: 203 })
    expect(entry('cozinha:geladeira')?.size?.width).toBeGreaterThan(50)
    expect(entry('cozinha:fogao')?.size).toBeUndefined()
    expect(entry('cozinha:liquidificador')?.size).toBeUndefined()
  })
})
