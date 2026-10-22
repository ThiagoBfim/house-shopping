import { useEffect, useRef, useState } from 'preact/hooks'
import type { Assistant as AssistantData, Question, Rooms } from '../data/schema.ts'
import { applyAnswers, visibleQuestions, type Answers } from '../engine/assistant.ts'

export type AssistantNext = 'list' | 'budget'

interface Props {
  assistant: AssistantData
  rooms: Rooms
  /** Respostas da última vez (vêm marcadas). */
  initial: Answers
  onFinish: (answers: Answers, next: AssistantNext) => void
  /** "Pular tudo": segue com o que já foi respondido. */
  onSkipAll: (answers: Answers) => void
}

/** "Monte pra mim": uma pergunta por tela, de tocar, sempre com "Pular". */
export function Assistant({ assistant, rooms, initial, onFinish, onSkipAll }: Props) {
  const [answers, setAnswers] = useState<Answers>(initial)
  const [position, setPosition] = useState(0)
  const visible = visibleQuestions(assistant, answers)
  const question = visible[position] as Question | undefined

  const answer = (ids: string[]) => {
    const next = { ...answers }
    if (ids.length) next[question!.id] = ids
    else delete next[question!.id]
    setAnswers(next)
    setPosition(position + 1)
  }

  return (
    <section class="assistant" aria-label="Monte pra mim">
      <header class="assistant-top">
        {position > 0 ? (
          <button
            type="button"
            class="link-button"
            aria-label="Pergunta anterior"
            onClick={() => setPosition(position - 1)}
          >
            ←
          </button>
        ) : (
          <span />
        )}
        <ol class="assistant-progress" aria-label={progressLabel(position, visible.length)}>
          {visible.map((q, i) => (
            <li key={q.id} class={i < position ? 'is-done' : i === position ? 'is-current' : ''} />
          ))}
        </ol>
        {question ? (
          <button type="button" class="link-button" onClick={() => onSkipAll(answers)}>
            Pular tudo
          </button>
        ) : (
          <span />
        )}
      </header>

      {question ? (
        <QuestionStep
          key={question.id}
          question={question}
          selected={answers[question.id] ?? []}
          onAnswer={answer}
        />
      ) : (
        <Summary
          lines={applyAnswers(assistant, answers, rooms).summary}
          onEdit={(id) => setPosition(visible.findIndex((q) => q.id === id))}
          onFinish={(next) => onFinish(answers, next)}
        />
      )}
    </section>
  )
}

const progressLabel = (position: number, total: number) =>
  position < total ? `Pergunta ${position + 1} de ${total}` : 'Resumo'

function QuestionStep({
  question,
  selected,
  onAnswer,
}: {
  question: Question
  selected: string[]
  onAnswer: (ids: string[]) => void
}) {
  const [marked, setMarked] = useState(selected)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => title.current?.focus(), [])
  const multiple = question.kind === 'multiple'

  return (
    <div class="assistant-step">
      <span class="assistant-icon" aria-hidden="true">
        {question.icon}
      </span>
      <h2 class="assistant-question" tabIndex={-1} ref={title}>
        {question.text}
      </h2>
      {question.why && <p class="assistant-why">{question.why}</p>}
      {multiple && <p class="assistant-hint">Marque quantos quiser.</p>}

      <div
        class={`assistant-answers ${multiple ? 'is-multiple' : ''}`}
        role="group"
        aria-label={question.text}
      >
        {question.answers.map((answer) => {
          const on = (multiple ? marked : selected).includes(answer.id)
          return (
            <button
              key={answer.id}
              type="button"
              class={`assistant-answer ${on ? 'is-selected' : ''}`}
              aria-pressed={on}
              onClick={() =>
                multiple
                  ? setMarked(on ? marked.filter((id) => id !== answer.id) : [...marked, answer.id])
                  : onAnswer([answer.id])
              }
            >
              <span class="assistant-answer-icon" aria-hidden="true">
                {answer.icon}
              </span>
              {answer.label}
            </button>
          )
        })}
      </div>

      {multiple && (
        <button type="button" class="primary-button" onClick={() => onAnswer(marked)}>
          {marked.length ? 'Continuar' : 'Não tenho nada disso'}
        </button>
      )}
      <button type="button" class="link-button assistant-skip" onClick={() => onAnswer([])}>
        Pular esta pergunta
      </button>
    </div>
  )
}

function Summary({
  lines,
  onEdit,
  onFinish,
}: {
  lines: ReturnType<typeof applyAnswers>['summary']
  onEdit: (question: string) => void
  onFinish: (next: AssistantNext) => void
}) {
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => title.current?.focus(), [])

  return (
    <div class="assistant-step">
      <span class="assistant-icon" aria-hidden="true">
        ✅
      </span>
      <h2 class="assistant-question" tabIndex={-1} ref={title}>
        {lines.length ? 'Pronto! Sua lista vai ser montada assim:' : 'Você pulou as perguntas.'}
      </h2>
      {lines.length > 0 ? (
        <ul class="assistant-summary">
          {lines.map((line) => (
            <li key={line.question}>
              <button
                type="button"
                onClick={() => onEdit(line.question)}
                aria-label={`${line.title}: ${line.answer}. Mudar`}
              >
                <span aria-hidden="true">{line.icon}</span>
                <span>
                  <strong>{line.title}:</strong> {line.answer}
                </span>
                <span class="assistant-summary-edit" aria-hidden="true">
                  Mudar
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="assistant-why">Sem problema: você escolhe tudo nas próximas telas.</p>
      )}
      <button type="button" class="primary-button" onClick={() => onFinish('list')}>
        Ver minha lista →
      </button>
      <button type="button" class="link-button assistant-skip" onClick={() => onFinish('budget')}>
        Ajustar orçamento antes
      </button>
    </div>
  )
}
