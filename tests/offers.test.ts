import { describe, expect, it } from 'vitest'
import {
  applyBestOffer,
  bestOffer,
  isAffiliateUrl,
  otherOffers,
  parseMercadoLivreId,
} from '../src/data/offers.ts'
import type { Offer, ProductOption } from '../src/data/schema.ts'
import { validateCatalog } from '../src/data/validate.ts'

const offer = (store: Offer['store'], price: number, extra: Partial<Offer> = {}): Offer => ({
  store,
  url: `https://example.com/${store}/${price}`,
  price,
  updatedAt: '2026-10-22',
  available: true,
  ...extra,
})

const option = (offers?: Offer[]): ProductOption => ({
  id: 'geladeira-x',
  tier: 1,
  name: 'Geladeira X',
  price: 799,
  priceUpdatedAt: '2026-10-01',
  store: 'mercadolivre',
  url: 'https://lista.mercadolivre.com.br/geladeira-x',
  bullets: ['Bullet um', 'Bullet dois', 'Bullet três'],
  ...(offers && { offers }),
})

describe('bestOffer', () => {
  it('escolhe a mais barata entre as disponíveis', () => {
    const offers = [
      offer('mercadolivre', 2900),
      offer('amazon', 2700),
      offer('other', 2500, { available: false }),
    ]
    expect(bestOffer(offers)?.store).toBe('amazon')
  })

  it('sem nenhuma disponível, não há melhor oferta', () => {
    expect(bestOffer([offer('amazon', 1, { available: false })])).toBeUndefined()
  })
})

describe('applyBestOffer', () => {
  it('copia preço, data, loja e link da melhor oferta', () => {
    const shown = applyBestOffer(option([offer('mercadolivre', 2650, { updatedAt: '2026-10-22' })]))
    expect(shown).toMatchObject({
      price: 2650,
      priceUpdatedAt: '2026-10-22',
      store: 'mercadolivre',
      url: 'https://example.com/mercadolivre/2650',
    })
  })

  it('sem offers (ou sem nenhuma disponível) mantém os campos', () => {
    expect(applyBestOffer(option())).toEqual(option())
    const unavailable = option([offer('amazon', 10, { available: false })])
    expect(applyBestOffer(unavailable)).toEqual(unavailable)
  })
})

describe('isAffiliateUrl', () => {
  it.each([
    ['https://mercadolivre.com/sec/2b4M3eb', true],
    ['https://www.mercadolivre.com.br/social/meucanal?matt_word=x', true],
    ['https://produto.mercadolivre.com.br/MLB-123?matt_tool=123&matt_word=abc', true],
    ['https://amzn.to/3abcdef', true],
    ['https://www.amazon.com.br/dp/B0ABC?tag=meusite-20', true],
    ['https://lista.mercadolivre.com.br/geladeira-consul', false],
    ['https://www.amazon.com.br/dp/B0ABC', false],
    ['não é url', false],
  ])('%s → %s', (url, expected) => {
    expect(isAffiliateUrl(url)).toBe(expected)
  })
})

describe('parseMercadoLivreId', () => {
  it('produto de catálogo (/p/MLB…)', () => {
    expect(
      parseMercadoLivreId(
        'https://www.mercadolivre.com.br/geladeira-consul-crm39ab/p/MLB19615251?pdp_filters=x',
      ),
    ).toEqual({ kind: 'product', id: 'MLB19615251' })
  })

  it('anúncio (MLB-123…)', () => {
    expect(
      parseMercadoLivreId(
        'https://produto.mercadolivre.com.br/MLB-3456789012-geladeira-consul-_JM',
      ),
    ).toEqual({ kind: 'item', id: 'MLB3456789012' })
    expect(parseMercadoLivreId('MLB3456789012')).toEqual({ kind: 'item', id: 'MLB3456789012' })
  })

  it('link sem id', () => {
    expect(parseMercadoLivreId('https://mercadolivre.com/sec/2b4M3eb')).toBeUndefined()
  })
})

describe('validador com offers', () => {
  const rooms = { cozinha: { name: 'Cozinha', items: [{ category: 'geladeira', need: 5 }] } }
  const catalog = (opt: ProductOption) => ({
    geladeira: { label: 'Geladeira', utensil: false, options: [opt] },
  })

  it('aceita opção alinhada com a melhor oferta', () => {
    const aligned = applyBestOffer(option([offer('mercadolivre', 650)]))
    expect(validateCatalog(rooms, catalog(aligned)).ok).toBe(true)
  })

  it('acusa preço/link exibido diferente da melhor oferta', () => {
    const result = validateCatalog(rooms, catalog(option([offer('mercadolivre', 650)])))
    expect(result.ok ? [] : result.errors).toEqual([
      'products/geladeira.json: "geladeira-x" mostra price, priceUpdatedAt, url diferente da melhor oferta em offers (rode npm run ml:links import ou corrija à mão)',
    ])
  })
})

describe('otherOffers', () => {
  it('lista ofertas disponíveis de outras lojas', () => {
    const shown = applyBestOffer(
      option([
        offer('mercadolivre', 650),
        offer('amazon', 700),
        offer('other', 600, { available: false }),
      ]),
    )
    expect(otherOffers(shown).map((o) => o.store)).toEqual(['amazon'])
  })
})
