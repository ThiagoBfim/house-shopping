import assistantJson from '../../data/assistant.json'
import roomsJson from '../../data/rooms.json'
import type { Assistant, Products, Rooms } from './schema.ts'

// Um arquivo por categoria: data/products/<categoria>.json. O nome do arquivo é o id da categoria.
const files = import.meta.glob('../../data/products/*.json', { eager: true, import: 'default' })

export const products = Object.fromEntries(
  Object.entries(files).map(([path, data]) => [path.slice(path.lastIndexOf('/') + 1, -5), data]),
) as Products

export const rooms = roomsJson as Rooms

export const assistant = assistantJson as Assistant
