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
        catalogId: 'MLB123456',
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

  it('sem afiliado: grava o link direto do produto (e a foto), sem criar oferta', () => {
    const { products: next, report } = importRows(
      products(),
      [
        {
          id: 'liq-barato',
          link_afiliado: '',
          link_produto: 'https://www.mercadolivre.com.br/liq/p/MLB123',
          imagem: 'https://img/l.jpg',
        },
        { id: 'liq-medio', link_afiliado: '', link_produto: 'https://lista.mercadolivre.com.br/x' },
      ],
      '2026-10-23',
    )
    expect(next.liquidificador.options[0]).toMatchObject({
      url: 'https://www.mercadolivre.com.br/liq/p/MLB123',
      image: 'https://img/l.jpg',
      price: 129,
    })
    expect(next.liquidificador.options[0].offers).toBeUndefined()
    expect(next.liquidificador.options[1].url).toBe('https://lista.mercadolivre.com.br/liq-medio')
    expect(report.direct).toEqual(['liq-barato'])
    expect(exportRows(next)[0][LINK_COLUMNS.indexOf('link_produto')]).toBe(
      'https://www.mercadolivre.com.br/liq/p/MLB123',
    )
  })

  it('coluna generico liga e desliga a flag; exporta "sim" ou "não"', () => {
    const { products: next } = importRows(
      products(),
      [
        { id: 'liq-barato', generico: 'sim' },
        { id: 'liq-medio', generico: 'não' },
      ],
      '2026-10-23',
    )
    expect(next.liquidificador.options[0].generic).toBe(true)
    expect('generic' in next.liquidificador.options[1]).toBe(false)
    const col = LINK_COLUMNS.indexOf('generico')
    expect(exportRows(next).map((row) => row[col])).toEqual(['sim', 'não'])
    // Vazio não mexe na flag.
    const { products: same } = importRows(next, [{ id: 'liq-barato', generico: '' }], '2026-10-23')
    expect(same.liquidificador.options[0].generic).toBe(true)
    const { products: back } = importRows(
      next,
      [{ id: 'liq-barato', generico: 'nao' }],
      '2026-10-23',
    )
    expect('generic' in back.liquidificador.options[0]).toBe(false)
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
          catalogId: 'MLB900',
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
      async ({ itemId }) => quotes[itemId],
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

  it('consulta pelo anúncio e pelo produto de catálogo', async () => {
    const calls: unknown[] = []
    await syncOffers(withOffer(), async (ids) => (calls.push(ids), undefined), '2026-10-23')
    expect(calls).toEqual([{ itemId: 'MLB1', catalogId: 'MLB900' }])
  })

  it('anúncio sumiu das ofertas: indisponível, mantém o último preço', async () => {
    const { products: next, report } = await syncOffers(
      withOffer(),
      async () => ({ available: false }),
      '2026-10-23',
    )
    expect(next.liquidificador.options[0].offers?.[0]).toMatchObject({
      price: 119,
      updatedAt: '2026-10-01',
      available: false,
    })
    expect(report).toMatchObject({ unavailable: ['liq-barato'], updated: [], noCommission: [] })
  })

  it('sem produto de catálogo: pula e avisa', async () => {
    const base = withOffer()
    delete base.liquidificador.options[0].offers![0].catalogId
    let calls = 0
    const { report } = await syncOffers(base, async () => (calls++, undefined), '2026-10-23')
    expect(calls).toBe(0)
    expect(report.noCatalog).toEqual(['liq-barato'])
  })

  it('rebase: recomeça o histórico no preço da API, sem registrar mudança', async () => {
    const { products: next, report } = await syncOffers(
      withOffer(),
      async () => ({ price: 125, available: true }),
      '2026-10-23',
      { rebase: true },
    )
    expect(next.liquidificador.options[0].offers?.[0]).toMatchObject({
      price: 125,
      updatedAt: '2026-10-23',
      history: [{ date: '2026-10-23', price: 125 }],
    })
    expect(next.liquidificador.options[0].price).toBe(125)
    expect(report.updated).toEqual([])
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
    [
      { price: 1, available: true, condition: 'new', sellerLevel: '5_green', sellerSales: 300 },
      true,
    ],
    [{ price: 1, available: true, condition: 'new', sellerLevel: '4_light_green' }, true],
    [{ price: 1, available: true }, true],
    [{ price: 1, available: true, condition: 'used', sellerLevel: '5_green' }, false],
    [{ price: 1, available: true, condition: 'new', sellerLevel: '3_yellow' }, false],
    // loja oficial vale mesmo "amarela" (ex.: Electrolux)
    [
      { price: 1, available: true, condition: 'new', sellerLevel: '3_yellow', official: true },
      true,
    ],
    // sem reputação e sem vendas: arriscado
    [{ price: 1, available: true, condition: 'new', sellerLevel: 'none', sellerSales: 0 }, false],
    // verde, mas quase sem vendas
    [
      { price: 1, available: true, condition: 'new', sellerLevel: '5_green', sellerSales: 3 },
      false,
    ],
  ])('earnsCommission(%o) = %s', (quote, expected) => {
    expect(earnsCommission(quote)).toBe(expected)
  })
})

describe('syncOffers: produto com link direto (sem afiliado)', () => {
  const direct = (url: string) => {
    const base = products()
    base.liquidificador.options[0] = { ...base.liquidificador.options[0], price: 404, url }
    return base
  }
  const catalogUrl = 'https://www.mercadolivre.com.br/p/MLB900?pdp_filters=item_id%3AMLB1'

  it('atualiza o preço de referência sem criar oferta', async () => {
    const calls: unknown[] = []
    const { products: next, report } = await syncOffers(
      direct(catalogUrl),
      async (ids) => (calls.push(ids), { price: 349.9, available: true, condition: 'new' }),
      '2026-10-30',
    )
    expect(calls).toEqual([{ itemId: 'MLB1', catalogId: 'MLB900' }])
    const option = next.liquidificador.options[0]
    expect(option).toMatchObject({ price: 349.9, priceUpdatedAt: '2026-10-30', url: catalogUrl })
    expect(option.offers).toBeUndefined()
    expect(report.updated).toEqual([{ id: 'liq-barato', from: 404, to: 349.9 }])
    expect(report.changedCategories).toEqual(new Set(['liquidificador']))
  })

  it('anúncio do link saiu do catálogo: usa a oferta atual do produto', async () => {
    const calls: { itemId: string }[] = []
    const { products: next } = await syncOffers(
      direct(catalogUrl),
      async (ids) => (
        calls.push(ids),
        ids.itemId === 'MLB900' ? { price: 380, available: true } : undefined
      ),
      '2026-10-30',
    )
    expect(calls.map((c) => c.itemId)).toEqual(['MLB1', 'MLB900'])
    expect(next.liquidificador.options[0].price).toBe(380)
  })

  it('link /up sem catálogo: avisa e não consulta', async () => {
    const calls: unknown[] = []
    const { products: next, report } = await syncOffers(
      direct('https://www.mercadolivre.com.br/up/MLBU123?pdp_filters=item_id%3AMLB1'),
      async (ids) => (calls.push(ids), undefined),
      '2026-10-30',
    )
    expect(calls).toEqual([])
    expect(report.noCatalog).toEqual(['liq-barato'])
    expect(next.liquidificador.options[0].price).toBe(404)
  })

  it('link de busca (genérico) fica de fora', async () => {
    const calls: unknown[] = []
    const { report } = await syncOffers(
      products(),
      async (ids) => (calls.push(ids), undefined),
      '2026-10-30',
    )
    expect(calls).toEqual([])
    expect(report.changedCategories.size).toBe(0)
  })
})
