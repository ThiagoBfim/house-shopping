import { describe, expect, it } from 'vitest'
import { parseCsv, parsePrice, toCsv } from '../scripts/lib/csv.ts'
import { exportRows, importRows, LINK_COLUMNS } from '../scripts/lib/ml-links.ts'
import { earnsCommission, syncOffers, type Quote } from '../scripts/lib/ml-sync.ts'
import type { Products } from '../src/data/schema.ts'

const products = (): Products => ({
  liquidificador: {
    label: 'Liquidificador',
    utensil: false,
    options: [
      {
        id: 'liq-barato',
        tier: 1,
        name: 'Liquidificador Barato',
        price: 129,
        priceUpdatedAt: '2026-10-22',
        store: 'mercadolivre',
        url: 'https://lista.mercadolivre.com.br/liq-barato',
        bullets: ['Bullet um', 'Bullet dois', 'Bullet três'],
      },
      {
        id: 'liq-medio',
        tier: 2,
        name: 'Liquidificador "Médio"; 3 L',
        price: 299,
        priceUpdatedAt: '2026-10-22',
        store: 'mercadolivre',
        url: 'https://lista.mercadolivre.com.br/liq-medio',
        bullets: ['Bullet um', 'Bullet dois', 'Bullet três'],
      },
    ],
  },
})

describe('csv', () => {
  it('ida e volta, inclusive com ; e aspas', () => {
    const rows = exportRows(products())
    const parsed = parseCsv(toCsv([...LINK_COLUMNS], rows))
    expect(parsed).toHaveLength(2)
    expect(parsed[1]).toMatchObject({
      id: 'liq-medio',
      nome: 'Liquidificador "Médio"; 3 L',
      tier: '2',
    })
  })

  it('aceita BOM, CRLF e linhas vazias (arquivo salvo pelo Excel)', () => {
    const text = '﻿id;link_afiliado\r\nliq-barato;https://mercadolivre.com/sec/abc\r\n;\r\n'
    expect(parseCsv(text)).toEqual([
      { id: 'liq-barato', link_afiliado: 'https://mercadolivre.com/sec/abc' },
    ])
  })

  it.each([
    ['2.799,90', 2799.9],
    ['2799.90', 2799.9],
    ['R$ 2.799', 2799],
    ['129', 129],
    ['', undefined],
    ['abc', undefined],
  ])('parsePrice(%s) = %s', (text, expected) => {
    expect(parsePrice(text)).toBe(expected)
  })
})

describe('importRows', () => {
  it('cria a oferta do Mercado Livre e atualiza o que é exibido', () => {
    const { products: next, report } = importRows(
      products(),
      [
        {
          id: 'liq-barato',
          link_produto: 'https://www.mercadolivre.com.br/liquidificador/p/MLB123456',
          link_afiliado: 'https://mercadolivre.com/sec/abc123',
          preco: '119,90',
        },
        { id: 'liq-medio', link_afiliado: '' },
      ],
      '2026-10-23',
    )
    const option = next.liquidificador.options[0]
    expect(option.offers).toEqual([
      {
        store: 'mercadolivre',
        url: 'https://mercadolivre.com/sec/abc123',
        price: 119.9,
        updatedAt: '2026-10-23',
        available: true,
        externalId: 'MLB123456',
      },
    ])
    expect(option).toMatchObject({
      price: 119.9,
      url: 'https://mercadolivre.com/sec/abc123',
      priceUpdatedAt: '2026-10-23',
    })
    expect(next.liquidificador.options[1].offers).toBeUndefined()
    expect(report).toMatchObject({ applied: ['liq-barato'], withoutId: [], notAffiliate: [] })
    expect([...report.changedCategories]).toEqual(['liquidificador'])
  })

  it('mantém ofertas de outras lojas e mostra a mais barata', () => {
    const base = products()
    base.liquidificador.options[0].offers = [
      {
        store: 'amazon',
        url: 'https://amzn.to/x',
        price: 99,
        updatedAt: '2026-10-22',
        available: true,
      },
    ]
    const { products: next } = importRows(
      base,
      [{ id: 'liq-barato', link_afiliado: 'https://mercadolivre.com/sec/abc', preco: '119' }],
      '2026-10-23',
    )
    const option = next.liquidificador.options[0]
    expect(option.offers?.map((o) => o.store)).toEqual(['mercadolivre', 'amazon'])
    expect(option).toMatchObject({ store: 'amazon', price: 99, url: 'https://amzn.to/x' })
  })

  it('avisa sobre link sem id, link que não é de afiliado e id desconhecido', () => {
    const { report } = importRows(
      products(),
      [
        { id: 'liq-barato', link_afiliado: 'https://mercadolivre.com/sec/abc' },
        { id: 'liq-medio', link_afiliado: 'https://produto.mercadolivre.com.br/MLB-1234567-x' },
        { id: 'nao-existe', link_afiliado: 'https://mercadolivre.com/sec/zzz' },
      ],
      '2026-10-23',
    )
    expect(report).toMatchObject({
      applied: ['liq-barato', 'liq-medio'],
      withoutId: ['liq-barato'],
      notAffiliate: ['liq-medio'],
      unknownIds: ['nao-existe'],
    })
  })

  it('sem preço na planilha, usa o preço de referência', () => {
    const { products: next } = importRows(
      products(),
      [{ id: 'liq-medio', link_afiliado: 'https://mercadolivre.com/sec/abc' }],
      '2026-10-23',
    )
    expect(next.liquidificador.options[1].offers?.[0].price).toBe(299)
  })

  it('não altera o catálogo recebido', () => {
    const base = products()
    importRows(base, [{ id: 'liq-barato', link_afiliado: 'https://mercadolivre.com/sec/a' }], 'x')
    expect(base).toEqual(products())
  })
})

describe('syncOffers', () => {
  const withOffer = () => {
    const base = products()
    base.liquidificador.options[0] = {
      ...base.liquidificador.options[0],
      price: 119,
      url: 'https://mercadolivre.com/sec/abc',
      offers: [
        {
          store: 'mercadolivre',
          url: 'https://mercadolivre.com/sec/abc',
          price: 119,
          updatedAt: '2026-10-01',
          available: true,
          externalId: 'MLB1',
        },
      ],
    }
    return base
  }

  it('atualiza preço e data e reporta a mudança', async () => {
    const quotes: Record<string, Quote> = {
      MLB1: { price: 109.9, available: true, condition: 'new', sellerLevel: '5_green' },
    }
    const { products: next, report } = await syncOffers(
      withOffer(),
      async (id) => quotes[id],
      '2026-10-23',
    )
    expect(next.liquidificador.options[0]).toMatchObject({
      price: 109.9,
      priceUpdatedAt: '2026-10-23',
    })
    expect(report.updated).toEqual([{ id: 'liq-barato', from: 119, to: 109.9 }])
    expect(report.noCommission).toEqual([])
  })

  it('marca indisponível e sem comissão', async () => {
    const { products: next, report } = await syncOffers(
      withOffer(),
      async () => ({ price: 119, available: false, condition: 'used', sellerLevel: '3_yellow' }),
      '2026-10-23',
    )
    expect(next.liquidificador.options[0].offers?.[0].available).toBe(false)
    expect(report).toMatchObject({
      unavailable: ['liq-barato'],
      noCommission: ['liq-barato'],
      updated: [],
    })
  })

  it('não encontrado na API: não mexe na oferta', async () => {
    const before = withOffer()
    const { products: next, report } = await syncOffers(before, async () => undefined, '2026-10-23')
    expect(report.notFound).toEqual(['liq-barato'])
    expect(next).toEqual(before)
  })

  it('ignora opções sem oferta do Mercado Livre com id', async () => {
    let calls = 0
    await syncOffers(products(), async () => (calls++, undefined), '2026-10-23')
    expect(calls).toBe(0)
  })

  it.each([
    [{ price: 1, available: true, condition: 'new', sellerLevel: '5_green' }, true],
    [{ price: 1, available: true, condition: 'new', sellerLevel: '4_light_green' }, true],
    [{ price: 1, available: true }, true],
    [{ price: 1, available: true, condition: 'used', sellerLevel: '5_green' }, false],
    [{ price: 1, available: true, condition: 'new', sellerLevel: '3_yellow' }, false],
  ])('earnsCommission(%o) = %s', (quote, expected) => {
    expect(earnsCommission(quote)).toBe(expected)
  })
})
