import type { Rooms } from '../data/schema.ts'
import type { Answers } from '../engine/assistant.ts'
import { decodeState, encodeState, type ListState } from '../engine/share.ts'

const STORAGE_KEY = 'house-shopping:list'
const LIST_PARAM = 'l'
/** Marca links criados pelo botão de compartilhar (mostra o aviso de lista compartilhada). */
const SHARED_PARAM = 's'

export interface InitialState {
  state?: ListState
  shared: boolean
}

function hashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.slice(1))
}

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Estado inicial: primeiro a URL (link compartilhado), depois o localStorage. */
export function readInitialState(rooms: Rooms): InitialState {
  const params = hashParams()
  const fromUrl = params.get(LIST_PARAM)
  if (fromUrl) {
    const state = decodeState(fromUrl, rooms)
    if (state) return { state, shared: params.has(SHARED_PARAM) }
  }
  const stored = readStorage()
  return { state: stored ? decodeState(stored, rooms) : undefined, shared: false }
}

/** Mantém URL e localStorage em dia com a lista atual (sem criar entradas no histórico). */
export function persistState(state: ListState | undefined): void {
  const encoded = state && encodeState(state)
  const url = new URL(window.location.href)
  url.hash = encoded ? `${LIST_PARAM}=${encoded}` : ''
  if (url.href !== window.location.href) {
    history.replaceState(null, '', encoded ? url.href : url.pathname + url.search)
  }
  try {
    if (encoded) localStorage.setItem(STORAGE_KEY, encoded)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // modo privado / storage bloqueado: a URL continua funcionando
  }
}

/** Link para enviar a outra pessoa. */
export function shareUrl(state: ListState): string {
  const url = new URL(window.location.href)
  url.hash = `${LIST_PARAM}=${encodeState(state)}&${SHARED_PARAM}=1`
  return url.href
}

const ANSWERS_KEY = 'house-shopping:assistant'

/** Respostas do "Monte pra mim" da última vez (só neste navegador; o link leva o resultado). */
export function readAnswers(): Answers {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ANSWERS_KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, ids]) => Array.isArray(ids) && ids.every((id) => typeof id === 'string'),
      ),
    ) as Answers
  } catch {
    return {}
  }
}

export function saveAnswers(answers: Answers): void {
  try {
    localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers))
  } catch {
    // sem localStorage: as respostas não ficam marcadas da próxima vez
  }
}
