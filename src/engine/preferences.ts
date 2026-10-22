import type { Products, Room, Variant } from '../data/schema.ts'
import type { Choices } from './budget.ts'

/** Variante em uso: a escolhida, se existir na categoria; senão a primeira (padrão). */
export function chosenVariant(variants: Variant[], choice: string | undefined): string {
  return variants.some((v) => v.id === choice) ? choice! : variants[0].id
}

/**
 * Aplica as preferências do usuário antes do motor: cada item com variantes passa a ter
 * só as opções da variante escolhida (uma escada de tiers, como uma categoria comum) e
 * cada item com necessidade ajustada usa a nova necessidade. O resto do motor não muda.
 * Sempre rode isto antes de planList/describeList quando o catálogo tiver variantes.
 */
export function applyPreferences(
  room: Room,
  products: Products,
  choices: Pick<Choices, 'variants' | 'needs'>,
): { room: Room; products: Products } {
  const customized: Products = {}
  for (const [key, category] of Object.entries(products)) {
    if (!category?.variants) {
      customized[key] = category
      continue
    }
    const variant = chosenVariant(category.variants, choices.variants[key])
    const options = category.options.filter((o) => o.variants?.includes(variant))
    customized[key] = { ...category, options: options.length ? options : category.options }
  }
  const items = room.items.map((item) =>
    choices.needs[item.category] ? { ...item, need: choices.needs[item.category] } : item,
  )
  return { room: { ...room, items }, products: customized }
}
