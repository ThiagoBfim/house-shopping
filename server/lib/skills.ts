/** Tipos de cômodo que a skill /floor-plan pode devolver (ids do data/rooms.json + "outro"). */
export const PLAN_ROOM_TYPES = [
  'cozinha',
  'quarto',
  'sala',
  'quarto-bebe',
  'banheiro',
  'area-externa',
  'lavanderia',
  'escritorio',
  'outro',
] as const

const position = (description: string) => ({
  type: 'number',
  minimum: 0,
  maximum: 1,
  description,
})

/** Resposta da skill /floor-plan (`--json-schema`): o Claude Code garante este formato. */
export const FLOOR_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['aspect', 'rooms', 'notes'],
  properties: {
    aspect: {
      type: 'number',
      minimum: 0.2,
      maximum: 5,
      description: 'Largura ÷ altura do desenho da planta (para desenhar na proporção certa)',
    },
    rooms: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'label', 'areaM2', 'openings', 'x', 'y', 'width', 'height'],
        properties: {
          type: { type: 'string', enum: PLAN_ROOM_TYPES },
          label: {
            type: 'string',
            description: 'Nome escrito na planta (ex.: "Suíte", "Dorm. 2")',
          },
          areaM2: {
            type: ['number', 'null'],
            description: 'Área em m² (null se não der para saber)',
          },
          openings: {
            type: 'array',
            maxItems: 8,
            description: 'Portas e janelas do cômodo ([] se não der para ver)',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'wall', 'position', 'widthCm'],
              properties: {
                kind: { type: 'string', enum: ['door', 'window'] },
                wall: {
                  type: 'string',
                  enum: ['top', 'right', 'bottom', 'left'],
                  description: 'Parede do retângulo do cômodo (top = a de cima na planta)',
                },
                position: position(
                  'Centro da abertura ao longo da parede: 0 = início (esquerda/topo), 1 = fim',
                ),
                widthCm: { type: 'number', minimum: 40, maximum: 400 },
              },
            },
          },
          x: position('Esquerda do cômodo, de 0 (borda esquerda da planta) a 1'),
          y: position('Topo do cômodo, de 0 (borda de cima da planta) a 1'),
          width: position('Largura, em fração da largura da planta'),
          height: position('Altura, em fração da altura da planta'),
        },
      },
    },
    notes: { type: 'string', description: 'Avisos para a pessoa conferir (pt-BR), ou ""' },
  },
}

/**
 * Item para a skill /search-better-prices, no formato do `itens.json` do passo 0 dela (a
 * leitura da planilha). O backend grava esse arquivo pronto: a skill pula a leitura e não
 * precisa de Bash.
 */
export interface PriceItem {
  /** Linha da planilha da lista (a 1ª linha de itens é a 2). */
  row: number
  produto: string
  qtd: number
  preco: number
  loja: string
  link: string
}

export const MAX_PRICE_ITEMS = 200

/** Confere os itens enviados pelo site. Inválido = undefined; item ruim é descartado. */
export function parsePriceItems(body: unknown): PriceItem[] | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const { items } = body as Record<string, unknown>
  if (!Array.isArray(items)) return undefined
  const valid: PriceItem[] = []
  for (const item of items.slice(0, MAX_PRICE_ITEMS)) {
    if (typeof item !== 'object' || item === null) continue
    const { row, produto, qtd, preco, loja, link } = item as Record<string, unknown>
    if (typeof row !== 'number' || !Number.isInteger(row) || row < 2) continue
    if (typeof produto !== 'string' || !produto.trim()) continue
    if (typeof preco !== 'number' || !(preco > 0)) continue
    valid.push({
      row,
      produto: produto.trim().slice(0, 200),
      qtd: typeof qtd === 'number' && qtd > 0 ? qtd : 1,
      preco,
      loja: typeof loja === 'string' ? loja.slice(0, 60) : '',
      link: typeof link === 'string' ? link.slice(0, 2000) : '',
    })
  }
  return valid.length ? valid : undefined
}

/** Uma linha do `resultados.jsonl` da skill /search-better-prices. */
export interface PriceFind {
  /** Linha da planilha (a 1ª linha de itens é a 2). */
  row: number
  status: 'melhor' | 'sem preço melhor' | 'não encontrado'
  preco?: number
  loja?: string
  link?: string
  obs?: string
}

const STATUSES = new Set(['melhor', 'sem preço melhor', 'não encontrado'])

/**
 * Lê o `resultados.jsonl` (uma linha JSON por item; o arquivo cresce enquanto a skill
 * trabalha). Linha incompleta ou inválida é ignorada; vale a última linha de cada item.
 */
export function parsePriceFinds(text: string): PriceFind[] {
  const byRow = new Map<number, PriceFind>()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let data: unknown
    try {
      data = JSON.parse(line)
    } catch {
      continue
    }
    if (typeof data !== 'object' || data === null) continue
    const { row, status, preco, loja, link, obs } = data as Record<string, unknown>
    if (typeof row !== 'number' || !Number.isInteger(row) || row < 2) continue
    if (typeof status !== 'string' || !STATUSES.has(status)) continue
    const find: PriceFind = { row, status: status as PriceFind['status'] }
    if (typeof preco === 'number' && preco > 0) find.preco = preco
    if (typeof loja === 'string') find.loja = loja
    if (typeof link === 'string') find.link = link
    if (typeof obs === 'string') find.obs = obs
    byRow.set(row, find)
  }
  return [...byRow.values()].sort((a, b) => a.row - b.row)
}

const meters = (description: string) => ({ type: 'number', minimum: 0, maximum: 200, description })
const WALL = { type: 'string', enum: ['top', 'right', 'bottom', 'left'] }

/** Resposta da skill /house-3d (`--json-schema`): a casa em metros, para o 3D. */
export const HOUSE_3D_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['widthM', 'depthM', 'rooms', 'notes'],
  properties: {
    widthM: meters('Largura da área construída inteira'),
    depthM: meters('Profundidade da área construída inteira'),
    rooms: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'type',
          'label',
          'xM',
          'yM',
          'widthM',
          'depthM',
          'openings',
          'finishes',
          'furniture',
          'builtIns',
        ],
        properties: {
          type: { type: 'string', enum: PLAN_ROOM_TYPES },
          label: { type: 'string' },
          xM: meters('Esquerda do cômodo a partir da esquerda da planta'),
          yM: meters('Topo do cômodo a partir do topo da planta'),
          widthM: meters('Largura do retângulo do cômodo'),
          depthM: meters('Profundidade do retângulo do cômodo'),
          openings: {
            type: 'array',
            maxItems: 10,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'wall', 'position', 'widthCm'],
              properties: {
                kind: { type: 'string', enum: ['door', 'window'] },
                wall: WALL,
                position: { type: 'number', minimum: 0, maximum: 1 },
                widthCm: { type: 'number', minimum: 40, maximum: 400 },
                hinge: { type: 'string', enum: ['start', 'end'] },
                swing: { type: 'string', enum: ['in', 'out'] },
                sliding: { type: 'boolean' },
                sillCm: { type: 'number', minimum: 0, maximum: 220 },
                heightCm: { type: 'number', minimum: 30, maximum: 260 },
              },
            },
          },
          finishes: {
            type: 'object',
            additionalProperties: false,
            required: ['floor', 'floorColor', 'wallColor', 'fromPhoto'],
            properties: {
              floor: {
                type: 'string',
                enum: ['madeira', 'porcelanato', 'ceramica', 'cimento', 'carpete', 'deck'],
              },
              floorColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              wallColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              fromPhoto: { type: 'boolean' },
              tileCm: { type: 'number', minimum: 10, maximum: 200 },
            },
          },
          partOf: {
            type: 'string',
            description:
              'Parte de um cômodo em L: o label do retângulo principal (mesmo type). Vazio = cômodo inteiro.',
          },
          builtIns: {
            type: 'array',
            maxItems: 20,
            description: 'Armários que já estão no imóvel (vistos nas fotos)',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'kind',
                'wall',
                'startCm',
                'lengthCm',
                'depthCm',
                'heightCm',
                'elevationCm',
                'finish',
                'color',
              ],
              properties: {
                kind: {
                  type: 'string',
                  enum: ['armario', 'bancada', 'aereo', 'gabinete', 'prateleira'],
                },
                wall: WALL,
                startCm: { type: 'number', minimum: 0, maximum: 5000 },
                lengthCm: { type: 'number', minimum: 20, maximum: 5000 },
                depthCm: { type: 'number', minimum: 10, maximum: 120 },
                heightCm: { type: 'number', minimum: 3, maximum: 300 },
                elevationCm: { type: 'number', minimum: 0, maximum: 250 },
                finish: {
                  type: 'string',
                  enum: ['madeira-clara', 'madeira-escura', 'branco', 'laca', 'cinza'],
                },
                color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
                topColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
                sink: { type: 'boolean' },
                cooktop: { type: 'boolean' },
                doors: { type: 'integer', minimum: 1, maximum: 12 },
              },
            },
          },
          furniture: {
            type: 'array',
            maxItems: 40,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['key', 'unit', 'xCm', 'yCm', 'rotation'],
              properties: {
                key: { type: 'string' },
                unit: { type: 'integer', minimum: 0, maximum: 9 },
                xCm: { type: 'number', minimum: 0, maximum: 5000 },
                yCm: { type: 'number', minimum: 0, maximum: 5000 },
                rotation: { type: 'string', enum: ['down', 'up', 'left', 'right'] },
              },
            },
          },
        },
      },
    },
    notes: { type: 'string' },
  },
}
