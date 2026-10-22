import type { Page } from '@playwright/test'

/** Escolhe cômodos na tela inicial (ex.: { Cozinha: 1, Quarto: 2 }) e continua. */
export async function pickRooms(page: Page, rooms: Record<string, number>) {
  for (const [name, count] of Object.entries(rooms)) {
    await page.getByRole('button', { name: new RegExp(`^${name} \\d+ itens$`) }).click()
    for (let i = 1; i < count; i++) {
      await page.getByRole('button', { name: `Adicionar um ${name}`, exact: true }).click()
    }
  }
  await page.getByRole('button', { name: /^Continuar com/ }).click()
}
