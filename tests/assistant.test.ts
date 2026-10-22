import { describe, expect, it } from 'vitest'
import { assistant, products, rooms } from '../src/data/catalog-data.ts'
import type { Assistant } from '../src/data/schema.ts'
import { applyAnswers, visibleQuestions, type Answers } from '../src/engine/assistant.ts'
import { buildList } from '../src/engine/budget.ts'
import { expandHouse } from '../src/engine/house.ts'
import { applyPreferences } from '../src/engine/preferences.ts'
import { validateCatalog } from '../src/data/validate.ts'

const ids = (answers: Answers) => visibleQuestions(assistant, answers).map((q) => q.id)

describe('assistente: perguntas que aparecem', () => {
  it('sem respostas, todas aparecem (a casa ainda é desconhecida)', () => {
    expect(ids({})).toEqual(assistant.questions.map((q) => q.id))
  })

  it('sem quarto na casa, não pergunta o tamanho da cama', () => {
    // casa só com cozinha: nenhuma resposta real faz isso, então usamos um assistente de teste
    const mini: Assistant = {
      questions: [
        {
          id: 'casa',
          icon: '🏠',
          text: 'Qual cômodo?',
          short: 'Casa',
          kind: 'single',
          answers: [
            { id: 'cozinha', icon: '🍳', label: 'Cozinha', effects: [{ rooms: { cozinha: 1 } }] },
            { id: 'quarto', icon: '🛏️', label: 'Quarto', effects: [{ rooms: { quarto: 1 } }] },
          ],
        },
        {
          id: 'cama',
          icon: '🛏️',
          text: 'Tamanho da cama?',
          short: 'Cama',
          kind: 'single',
          when: { rooms: ['quarto'] },
          answers: [
            { id: 'a', icon: '1', label: 'Aa', effects: [] },
            { id: 'b', icon: '2', label: 'Bb', effects: [] },
          ],
        },
      ],
    }
    const visible = (answers: Answers) => visibleQuestions(mini, answers).map((q) => q.id)
    expect(visible({})).toEqual(['casa', 'cama'])
    expect(visible({ casa: ['cozinha'] })).toEqual(['casa'])
    expect(visible({ casa: ['quarto'] })).toEqual(['casa', 'cama'])
    // resposta de pergunta escondida não vale
    expect(applyAnswers(mini, { casa: ['cozinha'], cama: ['a'] }, rooms).summary).toHaveLength(1)
  })
})

describe('assistente: respostas viram lista', () => {
  const answers: Answers = {
    moradores: ['filhos'],
    'home-office': ['nao'],
    videogame: ['playstation'],
    estilo: ['equilibrado'],
    fogao: ['cooktop-inducao'],
    cama: ['queen'],
    'ja-tenho': ['geladeira', 'tv'],
    facilitadores: ['sim'],
  }
  const result = applyAnswers(assistant, answers, rooms)

  it('monta a casa: 2 quartos e escritório gamer (sem escritório comum)', () => {
    expect(result.house).toMatchObject({ cozinha: 1, quarto: 2, 'escritorio-gamer': 1 })
    expect(result.house).not.toHaveProperty('escritorio')
    expect(result.preset).toBe('equilibrado')
  })

  it('preferências chegam a cada item da casa', () => {
    const { choices } = result
    expect(choices.variants).toMatchObject({
      'cozinha:fogao': 'cooktop-inducao',
      'cozinha:forno': 'embutir',
      'cozinha:panelas': 'inducao',
      'quarto-1:colchao': 'queen',
      'quarto-2:cama-box': 'queen',
      'escritorio-gamer:videogame': 'playstation',
    })
    expect(choices.needs['cozinha:forno']).toBe(4)
    expect(choices.excluded).toMatchObject({
      'cozinha:geladeira': 'owned',
      'sala:tv': 'owned',
      'quarto-1:tv': 'owned',
    })
    expect(choices.helpers).toBe(true)
  })

  it('a lista final usa cooktop de indução, forno de embutir e panelas de indução', () => {
    const house = expandHouse(rooms, products, result.house)
    const custom = applyPreferences(house.room, house.products, result.choices)
    const view = buildList(custom.room, custom.products, 200_000, result.choices)
    const entry = (key: string) => view.entries.find((e) => e.item.category === key)!
    expect(entry('cozinha:fogao').option.variants).toContain('cooktop-inducao')
    expect(entry('cozinha:forno').option.variants).toContain('embutir')
    expect(entry('cozinha:panelas').option.variants).toContain('inducao')
    expect(entry('escritorio-gamer:videogame').option.name).toMatch(/PlayStation/)
    expect(view.entries.some((e) => e.item.category === 'cozinha:geladeira')).toBe(false)
  })

  it('resumo mostra só o que foi respondido, na ordem das perguntas', () => {
    expect(result.summary.map((line) => line.title)).toEqual([
      'Casa',
      'Home office',
      'Videogame',
      'Orçamento',
      'Fogão',
      'Cama',
      'Já tem',
      'Facilitadores',
    ])
    expect(result.summary.find((l) => l.question === 'ja-tenho')?.answer).toBe('Geladeira, TV')
  })

  it('pular tudo não muda nada', () => {
    const skipped = applyAnswers(assistant, {}, rooms)
    expect(skipped).toMatchObject({ house: {}, preset: undefined, summary: [] })
    expect(skipped.choices.variants).toEqual({})
  })

  it('PC: escritório gamer sem console; não toma café: sem cafeteira', () => {
    const r = applyAnswers(
      assistant,
      { moradores: ['sozinho'], videogame: ['pc'], cafe: ['nao'], calor: ['ventilador'] },
      rooms,
    )
    expect(r.choices.excluded).toMatchObject({
      'escritorio-gamer:videogame': 'refused',
      'cozinha:cafeteira': 'refused',
    })
    expect(r.choices.variants['quarto:ar-condicionado']).toBe('ventilador')
    expect(r.choices.variants['sala:ar-condicionado']).toBe('ventilador')
  })
})

describe('assistente: validação contra o catálogo', () => {
  const broken = {
    questions: [
      {
        id: 'x',
        icon: '❓',
        text: 'Pergunta quebrada?',
        short: 'Xis',
        kind: 'single',
        when: { rooms: ['garagem'] },
        answers: [
          {
            id: 'a',
            icon: '1',
            label: 'Aa',
            effects: [{ variant: { category: 'fogao', variant: 'lenha' } }],
          },
          { id: 'a', icon: '2', label: 'Bb', effects: [{ owned: ['helicoptero'] }] },
        ],
      },
    ],
  }

  it('aponta cômodo, categoria e variante inexistentes', () => {
    const result = validateCatalog(rooms, products, broken)
    expect(result.ok ? [] : result.errors).toEqual([
      'assistant.json › x: cômodo "garagem" não existe',
      'assistant.json › x: resposta "a" repetida',
      'assistant.json › x › a: "fogao" não tem a variante "lenha"',
      'assistant.json › x › a: categoria "helicoptero" não está em nenhum cômodo',
    ])
  })

  it('aponta erro de formato', () => {
    const result = validateCatalog(rooms, products, { questions: [{ id: 'X' }] })
    expect(result.ok).toBe(false)
  })
})
