import { describe, expect, it } from 'vitest'
import { assistant, products, rooms } from '../src/data/catalog-data.ts'
import type { Assistant } from '../src/data/schema.ts'
import {
  applyAnswers,
  reapplyAnswers,
  visibleQuestions,
  type Answers,
} from '../src/engine/assistant.ts'
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

  it('limpeza com robô e reparos com alguém: robô sobe, ferramentas saem', () => {
    const r = applyAnswers(
      assistant,
      { moradores: ['sozinho'], limpeza: ['robo'], reparos: ['chamo-alguem'] },
      rooms,
    )
    expect(r.choices.needs).toMatchObject({
      'utilidades:robo-aspirador': 4,
      'utilidades:aspirador': 2,
    })
    expect(r.choices.excluded).toMatchObject({
      'utilidades:kit-ferramentas': 'refused',
      'utilidades:furadeira': 'refused',
      'utilidades:alicates': 'refused',
    })
  })

  it('aspirador vertical tira o robô; quem faz de tudo ganha furadeira', () => {
    const r = applyAnswers(
      assistant,
      { moradores: ['casal'], limpeza: ['vertical'], reparos: ['faco-tudo'] },
      rooms,
    )
    expect(r.choices.excluded['utilidades:robo-aspirador']).toBe('refused')
    expect(r.choices.needs).toMatchObject({
      'utilidades:aspirador': 4,
      'utilidades:furadeira': 4,
      'utilidades:kit-ferramentas': 5,
    })
  })
})

describe('assistente: trocar uma resposta na lista (reapplyAnswers)', () => {
  const before: Answers = { moradores: ['casal'], limpeza: ['vertical'], reparos: ['basico'] }
  const start = applyAnswers(assistant, before, rooms)
  // ajustes à mão depois do assistente
  const mine = {
    ...start.choices,
    excluded: { ...start.choices.excluded, 'cozinha:freezer': 'refused' as const },
    locked: { 'sala:sofa': 3 as const },
  }
  const current = { house: start.house, choices: mine }

  it('troca só o efeito da pergunta e mantém os ajustes à mão', () => {
    const after = { ...before, limpeza: ['robo'] }
    const r = reapplyAnswers(assistant, rooms, before, after, current)
    expect(r.house).toEqual(start.house)
    expect(r.choices.excluded).toMatchObject({
      'cozinha:freezer': 'refused',
      'utilidades:furadeira': 'refused',
    })
    // o robô deixou de ser recusado e subiu
    expect(r.choices.excluded['utilidades:robo-aspirador']).toBeUndefined()
    expect(r.choices.needs['utilidades:robo-aspirador']).toBe(4)
    expect(r.choices.needs['utilidades:aspirador']).toBe(2)
    expect(r.choices.locked).toEqual({ 'sala:sofa': 3 })
    expect(r.preset).toBeUndefined()
  })

  it('tirar uma resposta desfaz o efeito dela', () => {
    const after = { ...before }
    delete after.reparos
    const r = reapplyAnswers(assistant, rooms, before, after, current)
    expect(r.choices.excluded['utilidades:furadeira']).toBeUndefined()
    expect(r.choices.excluded['cozinha:freezer']).toBe('refused')
  })

  it('casa: home office acrescenta o escritório sem apagar os cômodos escolhidos à mão', () => {
    const picked = { house: { cozinha: 1, sala: 1, utilidades: 1 }, choices: mine }
    const r = reapplyAnswers(assistant, rooms, {}, { 'home-office': ['sim'] }, picked)
    expect(r.house).toEqual({ cozinha: 1, sala: 1, utilidades: 1, escritorio: 1 })
  })

  it('efeito vale na casa atual mesmo sem a pergunta da casa respondida', () => {
    const picked = { house: { utilidades: 1 }, choices: mine }
    const r = reapplyAnswers(assistant, rooms, {}, { reparos: ['chamo-alguem'] }, picked)
    expect(r.choices.excluded['utilidades:kit-ferramentas']).toBe('refused')
  })

  it('estilo novo devolve o orçamento sugerido; variante trocada solta a trava', () => {
    const locked = { ...mine, locked: { 'cozinha:fogao': 2 as const } }
    const r = reapplyAnswers(
      assistant,
      rooms,
      before,
      { ...before, estilo: ['premium'], fogao: ['cooktop-gas'] },
      { house: start.house, choices: locked },
    )
    expect(r.preset).toBe('premium')
    expect(r.choices.variants['cozinha:fogao']).toBe('cooktop-gas')
    expect(r.choices.locked['cozinha:fogao']).toBeUndefined()
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
