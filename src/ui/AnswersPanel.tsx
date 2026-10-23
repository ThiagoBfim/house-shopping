import { useState } from 'preact/hooks'
import type { Assistant, Question } from '../data/schema.ts'
import type { Answers } from '../engine/assistant.ts'
import type { HouseSpec } from '../engine/house.ts'

interface Props {
  assistant: Assistant
  house: HouseSpec
  answers: Answers
  /** Nova resposta de uma pergunta (lista vazia = sem resposta). */
  onChange: (question: Question, ids: string[]) => void
  /** Abre o assistente do começo, com as respostas marcadas. */
  onRedo: () => void
}

/**
 * "Suas respostas": as perguntas do "Monte pra mim" que valem para esta casa, com a resposta
 * atual. Tocar numa pergunta abre as opções ali mesmo; escolher outra já refaz a lista.
 */
export function AnswersPanel({ assistant, house, answers, onChange, onRedo }: Props) {
  const [open, setOpen] = useState<string>()
  // Pergunta que depende de cômodo só aparece se a casa tiver esse cômodo.
  const questions = assistant.questions.filter(
    (q) => !q.when || q.when.rooms.some((roomId) => (house[roomId] ?? 0) > 0),
  )
  const answered = questions.filter((q) => labels(q, answers).length).length

  return (
    <details class="answers-panel">
      <summary>
        <span aria-hidden="true">✨ </span>Suas respostas
        <span class="muted">
          {' '}
          · {answered ? `${answered} de ${questions.length}` : 'nenhuma ainda'}
        </span>
      </summary>
      <p class="answers-hint muted">
        Mude uma resposta e a lista se ajusta na hora. O que você mexeu à mão (travas, recusas,
        itens adicionados) continua.
      </p>
      <ul class="answers-list">
        {questions.map((question) => {
          const current = labels(question, answers)
          const expanded = open === question.id
          return (
            <li key={question.id} class={expanded ? 'is-open' : ''}>
              <button
                type="button"
                class="answers-row"
                aria-expanded={expanded}
                aria-controls={`answers-${question.id}`}
                onClick={() => setOpen(expanded ? undefined : question.id)}
              >
                <span class="answers-icon" aria-hidden="true">
                  {question.icon}
                </span>
                <span class="answers-text">
                  <span class="answers-question">{question.text}</span>
                  <span class={current.length ? 'answers-current' : 'answers-current is-empty'}>
                    {current.length ? current.join(', ') : 'Sem resposta'}
                  </span>
                </span>
                <span class="answers-chevron" aria-hidden="true">
                  {expanded ? '▴' : '▾'}
                </span>
              </button>
              {expanded && (
                <AnswerOptions
                  question={question}
                  selected={answers[question.id] ?? []}
                  onPick={(ids) => {
                    setOpen(undefined)
                    onChange(question, ids)
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>
      <button type="button" class="link-button" onClick={onRedo}>
        Refazer todas as perguntas
      </button>
    </details>
  )
}

const labels = (question: Question, answers: Answers) =>
  question.answers.filter((a) => answers[question.id]?.includes(a.id)).map((a) => a.label)

function AnswerOptions({
  question,
  selected,
  onPick,
}: {
  question: Question
  selected: string[]
  onPick: (ids: string[]) => void
}) {
  const multiple = question.kind === 'multiple'
  const [marked, setMarked] = useState(selected)
  const changed = marked.length !== selected.length || marked.some((id) => !selected.includes(id))

  return (
    <div class="answers-options" id={`answers-${question.id}`}>
      {question.why && <p class="answers-why muted">{question.why}</p>}
      <div
        class="answers-chips"
        role={multiple ? 'group' : 'radiogroup'}
        aria-label={question.text}
      >
        {question.answers.map((answer) => {
          const on = (multiple ? marked : selected).includes(answer.id)
          return (
            <button
              key={answer.id}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              class={`answers-chip ${on ? 'is-active' : ''}`}
              onClick={() => {
                if (!multiple) {
                  if (!on) onPick([answer.id])
                  return
                }
                setMarked(on ? marked.filter((id) => id !== answer.id) : [...marked, answer.id])
              }}
            >
              <span aria-hidden="true">{answer.icon}</span> {answer.label}
            </button>
          )
        })}
      </div>
      <div class="answers-actions">
        {multiple && (
          <button
            type="button"
            class="primary-button answers-apply"
            disabled={!changed}
            onClick={() => onPick(marked)}
          >
            Aplicar
          </button>
        )}
        {selected.length > 0 && (
          <button type="button" class="link-button" onClick={() => onPick([])}>
            Tirar resposta
          </button>
        )}
      </div>
    </div>
  )
}
