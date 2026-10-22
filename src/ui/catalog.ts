import type { Need, Products, Rooms, Tier } from '../data/schema.ts'

export interface Catalog {
  rooms: Rooms
  products: Products
}

/** Carrega o catálogo em um chunk separado (validado por `npm run validate`). */
export async function loadCatalog(): Promise<Catalog> {
  const { rooms, products } = await import('../data/catalog-data.ts')
  return { rooms, products }
}

export const TIER_LABELS: Record<Tier, string> = {
  1: 'Barato',
  2: 'Médio',
  3: 'Caro',
  4: 'Muito caro',
}

export const NEEDS: Need[] = [1, 2, 3, 4, 5]

export const NEED_LABELS: Record<Need, string> = {
  1: 'Supérfluo',
  2: 'Útil',
  3: 'Importante',
  4: 'Necessário',
  5: 'Essencial',
}

/** Cômodos exibidos na tela inicial; os que ainda não estão no catálogo aparecem como "em breve". */
export const ROOM_CARDS = [
  { id: 'cozinha', name: 'Cozinha', icon: '🍳' },
  { id: 'quarto', name: 'Quarto', icon: '🛏️' },
  { id: 'sala', name: 'Sala', icon: '🛋️' },
  { id: 'quarto-bebe', name: 'Quarto do bebê', icon: '🍼' },
  { id: 'area-externa', name: 'Área externa', icon: '🌿' },
]

export const BUDGET_SUGGESTIONS = [10_000, 20_000, 30_000, 50_000]
