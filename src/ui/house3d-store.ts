import { parseHouseModel, type HouseModel, type HouseQuality } from '../engine/house3d.ts'

/** Casa gerada em 3D, guardada só neste navegador. */
export interface SavedHouse {
  model: HouseModel
  generatedAt: string
  photos: number
  costUsd?: number
  /** Gerada pelo botão realista (abre já no modo realista). */
  quality?: HouseQuality
  /** A casa antes de unir cômodos (para "Desfazer uniões"). */
  unmerged?: HouseModel
}

const KEY = 'house-shopping:house-3d'

export function readSavedHouse(): SavedHouse | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SavedHouse> | null
    const model = value && parseHouseModel(value.model)
    if (!value || !model || typeof value.generatedAt !== 'string') return undefined
    return {
      model,
      generatedAt: value.generatedAt,
      photos: typeof value.photos === 'number' ? value.photos : 0,
      ...(typeof value.costUsd === 'number' && { costUsd: value.costUsd }),
      ...(value.quality === 'realista' && { quality: 'realista' as const }),
      ...(parseHouseModel(value.unmerged) && { unmerged: parseHouseModel(value.unmerged)! }),
    }
  } catch {
    return undefined
  }
}

export function saveHouse(house: SavedHouse | undefined): void {
  try {
    if (house) localStorage.setItem(KEY, JSON.stringify(house))
    else localStorage.removeItem(KEY)
  } catch {
    // sem localStorage: a casa vale até recarregar a página
  }
}
