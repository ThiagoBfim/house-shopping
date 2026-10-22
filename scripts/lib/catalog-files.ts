// Leitura e escrita do catálogo em disco (formatado com o Prettier do projeto).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as prettier from 'prettier'
import type { Products } from '../../src/data/schema.ts'

export const dataDir = new URL('../../data/', import.meta.url)
const productsDir = new URL('products/', dataDir)

export const readJson = (url: URL): unknown => JSON.parse(readFileSync(url, 'utf8'))

export function readProducts(): Products {
  return Object.fromEntries(
    readdirSync(productsDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => [file.slice(0, -5), readJson(new URL(file, productsDir))]),
  ) as Products
}

export async function writeCategories(products: Products, categories: Iterable<string>) {
  for (const category of categories) {
    const url = new URL(`${category}.json`, productsDir)
    const config = (await prettier.resolveConfig(url.pathname)) ?? {}
    const text = await prettier.format(JSON.stringify(products[category]), {
      ...config,
      parser: 'json',
    })
    writeFileSync(url, text)
  }
}

export const today = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD, fuso local

/** Carrega .env.local (se existir) para process.env. */
export function loadEnvLocal() {
  const env = new URL('../../.env.local', import.meta.url)
  if (existsSync(env)) process.loadEnvFile(env.pathname)
}
