import { parseFloorPlan, type PlacedRoom } from '../engine/floor-plan.ts'

/** Planta lida, guardada só neste navegador (não vai no link compartilhado: é grande). */
export interface SavedPlan {
  fileName: string
  aspect: number
  /** Cômodos com o `instanceId` do cômodo da casa a que cada um foi ligado. */
  rooms: PlacedRoom[]
}

const KEY = 'house-shopping:floor-plan'

export function readSavedPlan(): SavedPlan | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (typeof value !== 'object' || value === null) return undefined
    const { fileName } = value as Record<string, unknown>
    const plan = parseFloorPlan({ ...value, notes: '' })
    if (!plan || typeof fileName !== 'string') return undefined
    return { fileName, aspect: plan.aspect, rooms: plan.rooms }
  } catch {
    return undefined
  }
}

export function savePlan(plan: SavedPlan | undefined): void {
  try {
    if (plan) localStorage.setItem(KEY, JSON.stringify(plan))
    else localStorage.removeItem(KEY)
  } catch {
    // sem localStorage: o desenho vale até recarregar a página
  }
}
