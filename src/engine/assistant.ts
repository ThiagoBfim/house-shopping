import type { Answer, Assistant, Effect, PresetId, Question, Rooms } from '../data/schema.ts'
import { emptyChoices, type Choices } from './budget.ts'
import { houseItemKeys, normalizeSpec, splitItemKey, type HouseSpec } from './house.ts'

/** Respostas por pergunta (ids das respostas). Pergunta pulada não aparece aqui. */
export type Answers = Record<string, string[]>

export interface SummaryLine {
  question: string
  icon: string
  title: string
  answer: string
}

export interface AssistantResult {
  /** Vazio quando a pessoa pulou as perguntas sobre a casa. */
  house: HouseSpec
  preset?: PresetId
  choices: Choices
  summary: SummaryLine[]
}

const chosen = (question: Question, answers: Answers): Answer[] =>
  question.answers.filter((answer) => answers[question.id]?.includes(answer.id))

/**
 * Percorre as perguntas em ordem, montando a casa com as respostas que valem. Uma pergunta
 * só vale se aparecer para a pessoa: `when.rooms` olha a casa montada até ali (enquanto
 * nenhuma resposta definiu a casa, toda pergunta aparece).
 */
function walk(questions: Question[], answers: Answers) {
  const house: HouseSpec = {}
  let houseKnown = false
  const visible: Question[] = []
  const effects: Effect[] = []

  for (const question of questions) {
    const rooms = question.when?.rooms
    if (houseKnown && rooms && !rooms.some((roomId) => (house[roomId] ?? 0) > 0)) continue
    visible.push(question)
    for (const answer of chosen(question, answers)) {
      for (const effect of answer.effects) {
        if ('rooms' in effect) {
          houseKnown = true
          for (const [roomId, count] of Object.entries(effect.rooms)) {
            house[roomId] = Math.max(house[roomId] ?? 0, count)
          }
        } else if ('roomVariant' in effect) {
          const { from, to } = effect.roomVariant
          house[to] = Math.max(1, house[from] ?? 0, house[to] ?? 0)
          delete house[from]
        } else {
          effects.push(effect)
        }
      }
    }
  }
  return { house, visible, effects }
}

/** Perguntas que aparecem, dadas as respostas até agora. */
export const visibleQuestions = (assistant: Assistant, answers: Answers): Question[] =>
  walk(assistant.questions, answers).visible

/**
 * Transforma as respostas em casa, orçamento sugerido e escolhas (o estado normal da lista).
 * `target`: casa sobre a qual os efeitos valem (padrão: a casa das respostas).
 */
export function applyAnswers(
  assistant: Assistant,
  answers: Answers,
  rooms: Rooms,
  target?: HouseSpec,
): AssistantResult {
  const { house: rawHouse, visible, effects } = walk(assistant.questions, answers)
  const house = normalizeSpec(rawHouse, rooms)
  const keys = [...houseItemKeys(rooms, target ?? house)]
  const keysOf = (category: string) => keys.filter((key) => splitItemKey(key).category === category)

  const choices = emptyChoices()
  let preset: PresetId | undefined
  for (const effect of effects) {
    if ('preset' in effect) preset = effect.preset
    else if ('filters' in effect) Object.assign(choices, effect.filters)
    else if ('owned' in effect || 'skip' in effect) {
      const [categories, reason] =
        'owned' in effect ? [effect.owned, 'owned' as const] : [effect.skip, 'refused' as const]
      for (const key of categories.flatMap(keysOf)) choices.excluded[key] = reason
    } else if ('variant' in effect) {
      for (const key of keysOf(effect.variant.category)) {
        choices.variants[key] = effect.variant.variant
      }
    } else if ('need' in effect) {
      for (const key of keysOf(effect.need.category)) choices.needs[key] = effect.need.need
    }
  }

  const summary = visible
    .map((question) => ({ question, picked: chosen(question, answers) }))
    .filter(({ picked }) => picked.length)
    .map(({ question, picked }) => ({
      question: question.id,
      icon: question.icon,
      title: question.short,
      answer: picked.map((answer) => answer.label).join(', '),
    }))

  return { house, preset, choices, summary }
}

export interface Reapplied {
  house: HouseSpec
  choices: Choices
  /** Orçamento sugerido novo, quando a resposta de "estilo" mudou. */
  preset?: PresetId
}

/**
 * Troca respostas numa lista que já existe (painel "Suas respostas"): aplica só a diferença
 * entre as respostas antigas e as novas, mantendo o que a pessoa ajustou à mão (travas,
 * recusas, variantes e necessidades que não vieram do assistente, itens adicionados).
 */
export function reapplyAnswers(
  assistant: Assistant,
  rooms: Rooms,
  before: Answers,
  after: Answers,
  current: { house: HouseSpec; choices: Choices },
): Reapplied {
  const oldHouse = applyAnswers(assistant, before, rooms).house
  const newHouse = applyAnswers(assistant, after, rooms).house
  const merged: HouseSpec = { ...current.house }
  for (const roomId of new Set([...Object.keys(oldHouse), ...Object.keys(newHouse)])) {
    if (oldHouse[roomId] === newHouse[roomId]) continue
    if (newHouse[roomId]) merged[roomId] = newHouse[roomId]
    else delete merged[roomId]
  }
  // Sem nenhum cômodo, fica a casa atual (ex.: tirou a resposta de "Quem vai morar").
  const house = normalizeSpec(merged, rooms)
  const finalHouse = Object.keys(house).length ? house : current.house

  const old = applyAnswers(assistant, before, rooms, finalHouse)
  const next = applyAnswers(assistant, after, rooms, finalHouse)
  const swap = <T>(mine: Record<string, T>, from: Record<string, T>, to: Record<string, T>) => {
    const result = { ...mine }
    for (const [key, value] of Object.entries(from)) if (result[key] === value) delete result[key]
    return Object.assign(result, to)
  }
  const { choices } = current
  const variants = swap(choices.variants, old.choices.variants, next.choices.variants)
  const locked = { ...choices.locked }
  for (const key of Object.keys(locked)) {
    if (variants[key] !== choices.variants[key]) delete locked[key]
  }
  const pick = <K extends 'utensils' | 'helpers'>(field: K) =>
    old.choices[field] !== next.choices[field] ? next.choices[field] : choices[field]

  return {
    house: finalHouse,
    choices: {
      ...choices,
      locked,
      excluded: swap(choices.excluded, old.choices.excluded, next.choices.excluded),
      variants,
      needs: swap(choices.needs, old.choices.needs, next.choices.needs),
      utensils: pick('utensils'),
      helpers: pick('helpers'),
    },
    preset: next.preset !== old.preset ? next.preset : undefined,
  }
}
