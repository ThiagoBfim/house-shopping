import type { Assistant, Need, Products, Rooms, Tier } from '../data/schema.ts'

export interface Catalog {
  rooms: Rooms
  products: Products
  assistant: Assistant
}

/** Carrega o catálogo em um chunk separado (validado por `npm run validate`). */
export async function loadCatalog(): Promise<Catalog> {
  const { rooms, products, assistant } = await import('../data/catalog-data.ts')
  return { rooms, products, assistant }
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

export interface RoomCard {
  id: string
  name: string
  icon: string
  /** Versão alternativa do cômodo (outro id em rooms.json), escolhida por uma chave na linha. */
  variant?: { id: string; label: string; icon: string }
}

/** Cômodos exibidos na tela inicial; os que ainda não estão no catálogo aparecem como "em breve". */
export const ROOM_CARDS: RoomCard[] = [
  { id: 'cozinha', name: 'Cozinha', icon: '🍳' },
  { id: 'quarto', name: 'Quarto', icon: '🛏️' },
  { id: 'sala', name: 'Sala', icon: '🛋️' },
  { id: 'quarto-bebe', name: 'Quarto do bebê', icon: '🍼' },
  { id: 'banheiro', name: 'Banheiro', icon: '🛁' },
  { id: 'area-externa', name: 'Área externa', icon: '🌿' },
  { id: 'lavanderia', name: 'Lavanderia', icon: '🧺' },
  { id: 'utilidades', name: 'Utilidades', icon: '🧰' },
  {
    id: 'escritorio',
    name: 'Escritório',
    icon: '💻',
    variant: { id: 'escritorio-gamer', label: 'Gamer', icon: '🎮' },
  },
]

/** Ícone do cômodo (ou da versão alternativa dele). */
export function roomIcon(roomId: string): string | undefined {
  for (const card of ROOM_CARDS) {
    if (card.id === roomId) return card.icon
    if (card.variant?.id === roomId) return card.variant.icon
  }
  return undefined
}

/** Ícone do card quando o produto ainda não tem foto (categoria sem ícone usa o do cômodo). */
const CATEGORY_ICONS: Record<string, string> = {
  'acessorios-de-cozinha': '🧄',
  'air-fryer': '🍟',
  'ar-condicionado': '❄️',
  aspirador: '🧹',
  assadeiras: '🥧',
  'assistente-virtual': '🔊',
  'baba-eletronica': '📟',
  'banheira-bebe': '🛁',
  batedeira: '🎂',
  berco: '🛏️',
  cabides: '👔',
  'cadeira-escritorio': '🪑',
  'cadeira-gamer': '🪑',
  cafeteira: '☕',
  'cama-box': '🛏️',
  'caneca-termica': '☕',
  'cesto-de-roupa': '🧺',
  'chaleira-eletrica': '🫖',
  churrasqueira: '🔥',
  chuveiro: '🚿',
  colchao: '🛏️',
  'colchao-berco': '🛏️',
  'colmeia-organizadora': '🧦',
  cooler: '🧊',
  copos: '🥛',
  cortina: '🪟',
  desentupidor: '🪠',
  'dispenser-detergente': '🧴',
  'ducha-higienica': '🚿',
  edredom: '🛌',
  escada: '🪜',
  'escorredor-de-louca': '🍽️',
  'escova-sanitaria': '🚽',
  'espelho-corpo-inteiro': '🪞',
  espreguicadeira: '🏖️',
  extensao: '🔌',
  facas: '🔪',
  'fechadura-digital': '🔐',
  'ferro-de-passar': '👕',
  'filtro-de-linha': '🔌',
  'fita-led': '🌈',
  fogao: '🍳',
  forno: '🍞',
  freezer: '🧊',
  furadeira: '🔩',
  'garrafa-termica': '☕',
  gaveteiro: '🗄️',
  geladeira: '🧊',
  headset: '🎧',
  'headset-gamer': '🎧',
  'jogo-de-cama': '🛌',
  'kit-churrasco': '🍖',
  'kit-ferramentas': '🧰',
  'kit-limpeza': '🧽',
  'kit-primeiros-socorros': '🩹',
  'lampadas-led': '💡',
  lanterna: '🔦',
  'lava-loucas': '🍽️',
  'lava-roupas': '🫧',
  'lavadora-alta-pressao': '💦',
  liquidificador: '🥤',
  'lixeira-banheiro': '🗑️',
  'lixeira-cozinha': '🗑️',
  'luminaria-de-cabeceira': '💡',
  'luminaria-de-chao': '💡',
  'luminaria-de-mesa': '💡',
  'mesa-de-centro': '☕',
  'mesa-de-jantar': '🍽️',
  'mesa-escritorio': '🖥️',
  'mesa-regulavel': '↕️',
  'micro-ondas': '♨️',
  monitor: '🖥️',
  'monitor-gamer': '🖥️',
  'mousepad-gamer': '🖱️',
  ombrelone: '⛱️',
  'organizador-de-armario': '🗄️',
  'organizador-de-box': '🧴',
  'organizador-de-cabos': '🔌',
  'organizador-de-gaveta': '🍴',
  'organizadores-geladeira': '🧊',
  panelas: '🍲',
  'panos-de-prato': '🧻',
  poltrona: '🪑',
  'poltrona-amamentacao': '🪑',
  'porta-temperos': '🧂',
  'potes-hermeticos': '🥡',
  'potes-silicone-congelar': '❄️',
  pratos: '🍽️',
  prendedores: '📎',
  'protetor-de-colchao': '🛏️',
  purificador: '💧',
  rack: '📺',
  'roteador-wifi': '📶',
  'sacos-a-vacuo': '🛍️',
  sapateira: '👟',
  'secador-de-cabelo': '💨',
  'seladora-a-vacuo': '🥩',
  sofa: '🛋️',
  soundbar: '🔊',
  'suporte-monitor': '🦾',
  'suporte-notebook': '💻',
  'tabua-de-corte': '🔪',
  talheres: '🍴',
  'teclado-mouse': '⌨️',
  'teclado-mouse-gamer': '⌨️',
  toalhas: '🛁',
  travesseiro: '😴',
  tv: '📺',
  umidificador: '💧',
  'utensilios-de-cozinha': '🥄',
  varal: '👚',
  videogame: '🎮',
}

export const categoryIcon = (category: string, roomId: string) =>
  CATEGORY_ICONS[category] ?? roomIcon(roomId) ?? '📦'
