/** Recursos em teste (2ª wave), ligados pela pessoa no painel; salvos só neste navegador. */
export interface Features {
  floorPlan: boolean
  cheaperPrices: boolean
}

const KEY = 'house-shopping:features'

export const noFeatures = (): Features => ({ floorPlan: false, cheaperPrices: false })

export function readFeatures(): Features {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const saved = typeof value === 'object' && value !== null ? (value as Partial<Features>) : {}
    return { floorPlan: saved.floorPlan === true, cheaperPrices: saved.cheaperPrices === true }
  } catch {
    return noFeatures()
  }
}

export function saveFeatures(features: Features): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(features))
  } catch {
    // sem localStorage: vale até recarregar a página
  }
}
