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
        history: [{ date: '2026-10-23', price: 119.9 }],
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

  it('usa a coluna data e grava o histórico quando o preço muda', () => {
    const link = 'https://meli.la/abc'
    const first = importRows(
      products(),
      [{ id: 'liq-barato', link_afiliado: link, preco: '129', data: '2026-10-01' }],
      '2026-10-23',
    ).products
    const second = importRows(
      first,
      [{ id: 'liq-barato', link_afiliado: link, preco: '109,90', data: '2026-10-20' }],
      '2026-10-23',
    ).products
    const offer = second.liquidificador.options[0].offers?.[0]
    expect(offer).toMatchObject({ price: 109.9, updatedAt: '2026-10-20' })
    expect(offer?.history).toEqual([
      { date: '2026-10-01', price: 129 },
      { date: '2026-10-20', price: 109.9 },
    ])
    expect(second.liquidificador.options[0].priceUpdatedAt).toBe('2026-10-20')
  })

  it('data inválida usa hoje e avisa; imagem https é gravada, outra é ignorada', () => {
    const { products: next, report } = importRows(
      products(),
      [
        {
          id: 'liq-barato',
          link_afiliado: 'https://meli.la/a',
          data: '22/10/2026',
          imagem: 'https://http2.mlstatic.com/D_NQ_NP_123.webp',
        },
        { id: 'liq-medio', link_afiliado: 'https://meli.la/b', imagem: 'http://inseguro.jpg' },
      ],
      '2026-10-23',
    )
    expect(next.liquidificador.options[0]).toMatchObject({
      priceUpdatedAt: '2026-10-23',
      image: 'https://http2.mlstatic.com/D_NQ_NP_123.webp',
    })
    expect(next.liquidificador.options[1].image).toBeUndefined()
    expect(report).toMatchObject({ badDates: ['liq-barato'], badImages: ['liq-medio'] })
  })

  it('exporta data e imagem já preenchidas', () => {
    const { products: next } = importRows(
      products(),
      [
        {
          id: 'liq-barato',
          link_afiliado: 'https://meli.la/a',
          preco: '120',
          data: '2026-10-21',
          imagem: 'https://img/x.jpg',
        },
      ],
      '2026-10-23',
    )
    const row = exportRows(next)[0]
    expect(row.slice(-2)).toEqual(['2026-10-21', 'https://img/x.jpg'])
  })

  it('não altera o catálogo recebido', () => {
    const base = products()
    importRows(
      base,
      [{ id: 'liq-barato', link_afiliado: 'https://mercadolivre.com/sec/a' }],
      '2026-10-23',
    )
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
    expect(next.liquidificador.options[0].offers?.[0].history).toEqual([
      { date: '2026-10-01', price: 119 },
      { date: '2026-10-23', price: 109.9 },
    ])
    expect(report.updated).toEqual([{ id: 'liq-barato', from: 119, to: 109.9 }])
    expect(report.noCommission).toEqual([])
  })

  it('traz a imagem só se o produto ainda não tiver', async () => {
    const quote = { price: 119, available: true, image: 'https://img/nova.jpg' }
    const { products: next } = await syncOffers(withOffer(), async () => quote, '2026-10-23')
    expect(next.liquidificador.options[0].image).toBe('https://img/nova.jpg')

    const withImage = withOffer()
    withImage.liquidificador.options[0].image = 'https://img/escolhida.jpg'
    const { products: kept } = await syncOffers(withImage, async () => quote, '2026-10-23')
    expect(kept.liquidificador.options[0].image).toBe('https://img/escolhida.jpg')
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
