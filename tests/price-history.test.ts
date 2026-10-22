import { describe, expect, it } from 'vitest'
import {
  addDays,
  HISTORY_MAX_DAYS,
  isPromo,
  priceTrend,
  recordPrice,
  shownOffer,
} from '../src/data/price-history.ts'
import type { Offer, PricePoint } from '../src/data/schema.ts'
import { validateCatalog } from '../src/data/validate.ts'

const offer = (history?: PricePoint[]): Offer => {
  const last = history?.at(-1) ?? { date: '2026-10-01', price: 1000 }
  return {
    store: 'mercadolivre',
    url: 'https://meli.la/x',
    price: last.price,
    updatedAt: last.date,
    available: true,
    ...(history && { history }),
  }
}

describe('addDays', () => {
  it('soma e subtrai dias atravessando meses e anos', () => {
    expect(addDays('2026-10-22', -90)).toBe('2026-07-24')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('recordPrice', () => {
  it('sem histórico: o preço anterior vira o primeiro ponto', () => {
    expect(recordPrice(offer(), '2026-10-22', 900)).toMatchObject({
      price: 900,
      updatedAt: '2026-10-22',
      history: [
        { date: '2026-10-01', price: 1000 },
        { date: '2026-10-22', price: 900 },
      ],
    })
  })

  it('preço igual em outra data: só atualiza a data de "visto em"', () => {
    const next = recordPrice(offer([{ date: '2026-10-01', price: 1000 }]), '2026-10-22', 1000)
    expect(next.updatedAt).toBe('2026-10-22')
    expect(next.history).toEqual([{ date: '2026-10-01', price: 1000 }])
  })

  it('mesmo dia: o último preço vale', () => {
    const base = offer([
      { date: '2026-10-01', price: 1000 },
      { date: '2026-10-22', price: 900 },
    ])
    expect(recordPrice(base, '2026-10-22', 850).history?.at(-1)).toEqual({
      date: '2026-10-22',
      price: 850,
    })
    // voltou ao preço anterior no mesmo dia: não é mudança
    expect(recordPrice(base, '2026-10-22', 1000).history).toEqual([
      { date: '2026-10-01', price: 1000 },
    ])
  })

  it('ignora observação mais antiga que a última', () => {
    const base = offer([{ date: '2026-10-22', price: 900 }])
    expect(recordPrice(base, '2026-10-01', 1200)).toBe(base)
  })

  it(`descarta pontos com mais de ${HISTORY_MAX_DAYS} dias, mantendo o que estava em vigor`, () => {
    const base = offer([
      { date: '2025-01-01', price: 1300 },
      { date: '2025-06-01', price: 1200 },
      { date: '2026-03-01', price: 1100 },
    ])
    expect(recordPrice(base, '2026-10-22', 1000).history).toEqual([
      { date: '2025-06-01', price: 1200 },
      { date: '2026-03-01', price: 1100 },
      { date: '2026-10-22', price: 1000 },
    ])
  })
})

describe('priceTrend', () => {
  it('caiu', () => {
    const trend = priceTrend(
      offer([
        { date: '2026-10-01', price: 4709 },
        { date: '2026-10-22', price: 4104.78 },
      ]),
    )
    expect(trend).toEqual({
      direction: 'down',
      delta: -604.22,
      percent: -604.22 / 4709,
      since: '2026-10-01',
    })
  })

  it('subiu', () => {
    expect(
      priceTrend(
        offer([
          { date: '2026-10-01', price: 1000 },
          { date: '2026-10-22', price: 1050 },
        ]),
      ),
    ).toMatchObject({ direction: 'up', delta: 50, percent: 0.05 })
  })

  it('sem histórico suficiente', () => {
    expect(priceTrend(offer())).toBeUndefined()
    expect(priceTrend(offer([{ date: '2026-10-01', price: 1000 }]))).toBeUndefined()
  })
})

describe('isPromo', () => {
  const today = '2026-10-22'

  it('menor preço da janela e ≥ 5% abaixo do maior', () => {
    const history = [
      { date: '2026-08-01', price: 1100 },
      { date: '2026-09-15', price: 1050 },
      { date: '2026-10-20', price: 990 },
    ]
    expect(isPromo(offer(history), today)).toBe(true)
  })

  it('queda pequena (< 5%) não é promoção', () => {
    const history = [
      { date: '2026-10-01', price: 1000 },
      { date: '2026-10-20', price: 970 },
    ]
    expect(isPromo(offer(history), today)).toBe(false)
  })

  it('não é o menor preço da janela', () => {
    const history = [
      { date: '2026-08-01', price: 800 },
      { date: '2026-09-01', price: 1000 },
      { date: '2026-10-20', price: 900 },
    ]
    expect(isPromo(offer(history), today)).toBe(false)
  })

  it('considera o preço que estava em vigor no início da janela', () => {
    // 1200 desde maio (antes da janela de 90 dias), caiu para 1000 em outubro
    const history = [
      { date: '2026-05-01', price: 1200 },
      { date: '2026-10-10', price: 1000 },
    ]
    expect(isPromo(offer(history), today)).toBe(true)
  })

  it('preço parado há mais de 90 dias não é promoção', () => {
    const history = [
      { date: '2026-01-01', price: 1200 },
      { date: '2026-05-01', price: 1000 },
    ]
    expect(isPromo(offer(history), today)).toBe(false)
  })

  it('sem histórico não é promoção', () => {
    expect(isPromo(offer(), today)).toBe(false)
  })
})

describe('shownOffer', () => {
  it('acha a oferta exibida pela loja e link', () => {
    const shown = offer()
    const option = {
      id: 'x',
      tier: 1 as const,
      name: 'Produto X',
      price: shown.price,
      priceUpdatedAt: shown.updatedAt,
      store: shown.store,
      url: shown.url,
      bullets: ['Bullet um', 'Bullet dois', 'Bullet três'],
      offers: [{ ...shown, store: 'amazon' as const, url: 'https://amzn.to/x' }, shown],
    }
    expect(shownOffer(option)).toBe(shown)
    expect(shownOffer({ ...option, offers: undefined })).toBeUndefined()
  })
})

describe('validador do histórico', () => {
  const catalog = (history: PricePoint[], price = 900, updatedAt = '2026-10-22') => {
    const shown: Offer = { ...offer(history), price, updatedAt }
    return {
      geladeira: {
        label: 'Geladeira',
        utensil: false,
        options: [
          {
            id: 'g',
            tier: 1,
            name: 'Geladeira G',
            price,
            priceUpdatedAt: updatedAt,
            store: 'mercadolivre',
            url: shown.url,
            bullets: ['Bullet um', 'Bullet dois', 'Bullet três'],
            offers: [shown],
          },
        ],
      },
    }
  }
  const rooms = { cozinha: { name: 'Cozinha', items: [{ category: 'geladeira', need: 5 }] } }
  const errorsOf = (products: unknown) => {
    const result = validateCatalog(rooms, products)
    return result.ok ? [] : result.errors
  }

  it('aceita histórico válido (último ponto pode ser anterior ao "visto em")', () => {
    expect(
      errorsOf(
        catalog([
          { date: '2026-10-01', price: 950 },
          { date: '2026-10-10', price: 900 },
        ]),
      ),
    ).toEqual([])
  })

  it('acusa datas fora de ordem e último ponto diferente do preço atual', () => {
    expect(
      errorsOf(
        catalog([
          { date: '2026-10-10', price: 950 },
          { date: '2026-10-01', price: 800 },
        ]),
      ),
    ).toEqual([
      'products/geladeira.json: "g" (mercadolivre) history: datas fora de ordem ou repetidas',
      'products/geladeira.json: "g" (mercadolivre) history: o último ponto deve ter o preço atual (900) e data até 2026-10-22',
    ])
  })
})
