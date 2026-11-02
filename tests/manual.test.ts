import { describe, expect, it } from 'vitest'
import { emptyChoices } from '../src/engine/budget.ts'
import {
  addManual,
  cleanProductUrl,
  isValidManual,
  isWebUrl,
  keepManualIn,
  newManualId,
  parseManualInput,
  parsePrice,
  removeManual,
  replacedKeys,
  replaceWith,
  storeFromUrl,
  updateManual,
  type ManualItem,
} from '../src/engine/manual.ts'

const item = (partial: Partial<ManualItem> = {}): ManualItem => ({
  id: 'a1',
  instanceId: 'cozinha',
  name: 'Cadeira',
  price: 399.9,
  qty: 4,
  url: 'https://www.amazon.com.br/dp/B0TESTE',
  ...partial,
})

describe('parsePrice', () => {
  it.each([
    ['399,90', 399.9],
    ['399,9', 399.9],
    ['1.599,90', 1599.9],
    ['R$ 1.599', 1599],
    ['r$1599', 1599],
    ['399.90', 399.9],
    ['12.000', 12000],
    ['1.234.567', 1234567],
    ['0,005', 0.01],
    [' 25 ', 25],
  ])('%s → %s', (text, value) => {
    expect(parsePrice(text)).toBe(value)
  })

  it.each(['', 'abc', '12a', '1,2,3', '-5'])('inválido: "%s"', (text) => {
    expect(parsePrice(text)).toBeUndefined()
  })
})

describe('isWebUrl', () => {
  it('aceita http(s) com domínio', () => {
    expect(isWebUrl('https://loja.com/p')).toBe(true)
    expect(isWebUrl('http://loja.com.br')).toBe(true)
  })

  it('recusa outros protocolos, sem domínio e texto solto', () => {
    expect(isWebUrl('javascript:alert(1)')).toBe(false)
    expect(isWebUrl('ftp://loja.com')).toBe(false)
    expect(isWebUrl('https://localhost')).toBe(false)
    expect(isWebUrl('loja.com')).toBe(false)
  })
})

describe('parseManualInput', () => {
  const input = {
    name: '  Cadeira   Tok&Stok ',
    price: '399,90',
    qty: '4',
    url: ' https://a.com/p ',
  }

  it('normaliza nome, preço, quantidade e link', () => {
    expect(parseManualInput(input)).toEqual({
      ok: true,
      value: { name: 'Cadeira Tok&Stok', price: 399.9, qty: 4, url: 'https://a.com/p' },
    })
  })

  it('quantidade vazia = 1', () => {
    const parsed = parseManualInput({ ...input, qty: ' ' })
    expect(parsed.ok && parsed.value.qty).toBe(1)
  })

  it('campos vazios: uma mensagem por campo', () => {
    expect(parseManualInput({ name: '', price: '', qty: '1', url: '' })).toEqual({
      ok: false,
      errors: {
        name: 'Informe o nome do produto.',
        price: 'Informe o preço (ex.: 399,90).',
        url: 'Cole o link do produto.',
      },
    })
  })

  it('valores fora dos limites', () => {
    const parsed = parseManualInput({
      name: 'x'.repeat(81),
      price: '2.000.000',
      qty: '100',
      url: 'javascript:alert(1)',
    })
    expect(parsed.ok).toBe(false)
    expect(!parsed.ok && Object.keys(parsed.errors)).toEqual(['name', 'price', 'qty', 'url'])
  })

  it.each(['0', '1,5', '-1', 'dois'])('quantidade inválida: %s', (qty) => {
    const parsed = parseManualInput({ ...input, qty })
    expect(!parsed.ok && parsed.errors.qty).toBe('Quantidade de 1 a 99.')
  })

  it('preço zero é recusado', () => {
    const parsed = parseManualInput({ ...input, price: '0,00' })
    expect(!parsed.ok && parsed.errors.price).toBeTruthy()
  })
})

describe('isValidManual', () => {
  it('confere os mesmos limites do formulário', () => {
    expect(isValidManual(item())).toBe(true)
    expect(isValidManual(item({ qty: 0 }))).toBe(false)
    expect(isValidManual(item({ price: -1 }))).toBe(false)
    expect(isValidManual(item({ name: '' }))).toBe(false)
    expect(isValidManual(item({ url: 'data:text/html,oi' }))).toBe(false)
  })
})

describe('storeFromUrl', () => {
  it.each([
    ['https://produto.mercadolivre.com.br/MLB-123', 'mercadolivre'],
    ['https://www.mercadolivre.com.br/p/MLB123', 'mercadolivre'],
    ['https://meli.la/abc', 'mercadolivre'],
    ['https://www.amazon.com.br/dp/B0', 'amazon'],
    ['https://amzn.to/xyz', 'amazon'],
    ['https://www.tokstok.com.br/cadeira', 'other'],
    ['https://notamazon.com.br/x', 'other'],
    ['não é link', 'other'],
  ])('%s → %s', (url, store) => {
    expect(storeFromUrl(url)).toBe(store)
  })
})

describe('adicionar, editar e remover', () => {
  it('não altera as escolhas originais', () => {
    const base = emptyChoices()
    const added = addManual(base, item())
    expect(base.manual).toEqual([])
    expect(added.manual).toEqual([item()])

    const updated = updateManual(added, 'a1', {
      name: 'Banco',
      price: 100,
      qty: 2,
      url: 'https://b.com',
    })
    expect(added.manual[0].name).toBe('Cadeira')
    expect(updated.manual).toEqual([
      item({ name: 'Banco', price: 100, qty: 2, url: 'https://b.com' }),
    ])

    expect(removeManual(updated, 'a1').manual).toEqual([])
    expect(removeManual(updated, 'zz').manual).toHaveLength(1)
  })

  it('keepManualIn: só os de cômodos que continuam na casa', () => {
    const choices = addManual(
      addManual(emptyChoices(), item()),
      item({ id: 'b2', instanceId: 'quarto-2' }),
    )
    expect(keepManualIn(choices, ['cozinha', 'quarto-1']).manual.map((m) => m.id)).toEqual(['a1'])
  })

  it('newManualId: 8 caracteres, diferentes a cada chamada', () => {
    const a = newManualId()
    expect(a).toHaveLength(8)
    expect(newManualId()).not.toBe(a)
  })

  it('replaceWith: troca o item do catálogo, tira trava/exclusão e substitui troca anterior', () => {
    const start = {
      ...emptyChoices(),
      locked: { 'cozinha:geladeira': 2 as const, 'cozinha:fogao': 1 as const },
      excluded: { 'cozinha:geladeira': 'owned' as const },
      manual: [item({ id: 'x0' })],
    }
    const first = replaceWith(start, { ...item({ id: 'r1' }), replaces: 'cozinha:geladeira' })
    expect(first.locked).toEqual({ 'cozinha:fogao': 1 })
    expect(first.excluded).toEqual({})
    expect(first.manual.map((m) => m.id)).toEqual(['x0', 'r1'])
    expect(start.manual).toHaveLength(1)

    const second = replaceWith(first, { ...item({ id: 'r2' }), replaces: 'cozinha:geladeira' })
    expect(second.manual.map((m) => m.id)).toEqual(['x0', 'r2'])
    expect([...replacedKeys(second.manual)]).toEqual(['cozinha:geladeira'])
    // desfazer a troca = remover o item
    expect(replacedKeys(removeManual(second, 'r2').manual).size).toBe(0)
  })
})

describe('cleanProductUrl', () => {
  it('Mercado Livre: tira o rastreamento depois do # e os matt_*, mantém o anúncio escolhido', () => {
    expect(
      cleanProductUrl(
        'https://www.mercadolivre.com.br/fritadeira-airfryer-digital-philips-walita-na23000/p/MLB62495301?matt_event_ts=1793468531731&matt_d2id=6d49&matt_tracing_id=28e9#polycard_client=recommendations&tracking_id=dabb&wid=MLB6091025890&sid=recos',
      ),
    ).toBe(
      'https://www.mercadolivre.com.br/fritadeira-airfryer-digital-philips-walita-na23000/p/MLB62495301',
    )
    expect(
      cleanProductUrl(
        'https://www.mercadolivre.com.br/seladora/up/MLBU5320476728?pdp_filters=item_id:MLB5297548599#is_advertising=true&tracking_id=d9dc&ad_click_id=YzUx',
      ),
    ).toBe(
      'https://www.mercadolivre.com.br/seladora/up/MLBU5320476728?pdp_filters=item_id:MLB5297548599',
    )
  })

  it('Amazon vira /dp/<código>', () => {
    expect(
      cleanProductUrl(
        'https://www.amazon.com.br/Fritadeira-Philips/dp/B0CXYZ1234/ref=sr_1_3?crid=ABC&keywords=air+fryer#customerReviews',
      ),
    ).toBe('https://www.amazon.com.br/dp/B0CXYZ1234')
    expect(cleanProductUrl('https://www.amazon.com.br/gp/product/B0CXYZ1234?th=1')).toBe(
      'https://www.amazon.com.br/dp/B0CXYZ1234',
    )
    // sem código do produto: só tira o # (ex.: link encurtado da Amazon)
    expect(cleanProductUrl('https://amzn.to/3abcd#x')).toBe('https://amzn.to/3abcd')
  })

  it('outras lojas: só os parâmetros de rastreamento conhecidos; o # fica', () => {
    expect(
      cleanProductUrl(
        'https://www.tokstok.com.br/cadeira?cor=preta&utm_source=google&utm_medium=cpc&gclid=abc&fbclid=x#avaliacoes',
      ),
    ).toBe('https://www.tokstok.com.br/cadeira?cor=preta#avaliacoes')
    const clean = 'https://www.tokstok.com.br/cadeira?cor=preta|azul'
    expect(cleanProductUrl(clean)).toBe(clean) // nada a tirar: o link não muda
    expect(cleanProductUrl('não é link')).toBe('não é link')
  })

  it('o formulário já salva o link limpo', () => {
    const parsed = parseManualInput({
      name: 'Air fryer',
      price: '399',
      qty: '1',
      url: ' https://www.mercadolivre.com.br/x/p/MLB1#tracking_id=abc ',
    })
    expect(parsed).toMatchObject({
      ok: true,
      value: { url: 'https://www.mercadolivre.com.br/x/p/MLB1' },
    })
  })
})
