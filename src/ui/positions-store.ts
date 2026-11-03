import type { ManualPositions, PositionHint } from '../engine/layout.ts'

/** Posições que a pessoa escolheu para os móveis (arrastando), só neste navegador. */
const KEY = 'house-shopping:furniture-positions'
const ROTATIONS = new Set(['down', 'up', 'left', 'right'])

const isHint = (h: unknown): h is PositionHint => {
  if (typeof h !== 'object' || h === null) return false
  const p = h as Record<string, unknown>
  return (
    typeof p.key === 'string' &&
    Number.isInteger(p.unit) &&
    typeof p.xCm === 'number' &&
    typeof p.yCm === 'number' &&
    typeof p.rotation === 'string' &&
    ROTATIONS.has(p.rotation)
  )
}

export function readPositions(): ManualPositions {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (typeof value !== 'object' || value === null) return {}
    const out: ManualPositions = {}
    for (const [room, hints] of Object.entries(value)) {
      if (Array.isArray(hints)) out[room] = hints.filter(isHint)
    }
    return out
  } catch {
    return {}
  }
}

export function savePositions(positions: ManualPositions): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(positions))
  } catch {
    // sem localStorage: vale até recarregar a página
  }
}
