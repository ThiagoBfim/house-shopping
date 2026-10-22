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

/** Transforma as respostas em casa, orçamento sugerido e escolhas (o estado normal da lista). */
export function applyAnswers(
  assistant: Assistant,
  answers: Answers,
  rooms: Rooms,
): AssistantResult {
  const { house: rawHouse, visible, effects } = walk(assistant.questions, answers)
  const house = normalizeSpec(rawHouse, rooms)
  const keys = [...houseItemKeys(rooms, house)]
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
