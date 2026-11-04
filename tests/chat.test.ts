import { describe, expect, it } from 'vitest'
import { products, rooms } from '../src/data/catalog-data.ts'
import { buildList, emptyChoices } from '../src/engine/budget.ts'
import {
  applyMoves,
  chatRequest,
  chatRoom,
  MAX_HISTORY,
  parseChatReply,
} from '../src/engine/chat.ts'
import { expandHouse } from '../src/engine/house.ts'
import { arrangeRoom, layoutItems, otherItems } from '../src/engine/layout.ts'
import { parseChatRequest } from '../server/lib/skills.ts'

describe('parseChatReply', () => {
  it('aceita a resposta e só as ações válidas', () => {
    const reply = parseChatReply({
      reply: ' Dá para virar o sofá para a janela. ',
      actions: [
        {
          type: 'move',
          room: 'sala',
          key: 'sala:sofa',
          unit: 0,
          xCm: 120.4,
          yCm: 45,
          rotation: 'down',
        },
        {
          type: 'move',
          room: 'sala',
          key: 'sala:sofa',
          unit: 0,
          xCm: -5,
          yCm: 45,
          rotation: 'down',
        },
        {
          type: 'move',
          room: 'sala',
          key: 'sala:sofa',
          unit: 0,
          xCm: 10,
          yCm: 45,
          rotation: 'diagonal',
        },
        { type: 'remove', key: 'sala:poltrona' },
        { type: 'reset', room: 'quarto' },
        { type: 'add', key: 'sala:piano' },
      ],
    })
    expect(reply).toEqual({
      reply: 'Dá para virar o sofá para a janela.',
      actions: [
        {
          type: 'move',
          room: 'sala',
          key: 'sala:sofa',
          unit: 0,
          xCm: 120,
          yCm: 45,
          rotation: 'down',
        },
        { type: 'remove', key: 'sala:poltrona' },
        { type: 'reset', room: 'quarto' },
      ],
    })
    expect(parseChatReply({ reply: 'ok' })).toEqual({ reply: 'ok', actions: [] })
    expect(parseChatReply({ reply: '  ', actions: [] })).toBeUndefined()
    expect(parseChatReply(null)).toBeUndefined()
  })
})

describe('o que a IA recebe', () => {
  const house = expandHouse(rooms, products, { sala: 1 })
  const view = buildList(house.room, house.products, 70_000, emptyChoices())
  const layout = arrangeRoom(
    {
      width: 360,
      depth: 360,
      openings: [{ kind: 'door', wall: 'bottom', position: 0.2, widthCm: 80 }],
    },
    layoutItems(view, 'sala'),
  )

  it('cômodo com medidas, portas e cada móvel no lugar (centro e tamanho em cm)', () => {
    const room = chatRoom(
      { id: 'sala', title: 'Sala', estimated: false },
      layout,
      [],
      otherItems(view, 'sala').map((o) => o.label),
      view,
    )
    expect(room).toMatchObject({ id: 'sala', title: 'Sala', widthCm: 360, depthCm: 360 })
    expect(room.openings).toHaveLength(1)
    const sofa = room.furniture.find((f) => f.category === 'sofa')!
    const placed = layout.placed.find((p) => p.category === 'sofa')!
    expect(sofa).toMatchObject({
      key: 'sala:sofa',
      unit: 0,
      xCm: Math.round(placed.x + placed.w / 2),
      yCm: Math.round(placed.y + placed.d / 2),
      facing: placed.facing,
    })
    expect(sofa.name).toMatch(/^Sofá: /)
  })

  it('pedido com a lista e só as últimas mensagens', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
      text: `m${i}${'x'.repeat(i === 19 ? 2000 : 0)}`,
    }))
    const body = chatRequest([], view, messages)
    expect(body.messages).toHaveLength(MAX_HISTORY)
    expect(body.messages.at(-1)!.text).toHaveLength(1000)
    expect(body.list.items.some((i) => i.key === 'sala:sofa')).toBe(true)
    expect(body.list.budget).toBeCloseTo(70_000)
  })
})

describe('parseChatRequest (backend)', () => {
  it('exige conversa terminando com a pergunta da pessoa', () => {
    const ok = { messages: [{ role: 'user', text: 'Cabe uma estante?' }], rooms: [], list: {} }
    expect(parseChatRequest(JSON.stringify(ok))).toBeTruthy()
    expect(parseChatRequest('{x')).toBeUndefined()
    expect(parseChatRequest(JSON.stringify({ ...ok, messages: [] }))).toBeUndefined()
    expect(
      parseChatRequest(JSON.stringify({ ...ok, messages: [{ role: 'assistant', text: 'oi' }] })),
    ).toBeUndefined()
    expect(parseChatRequest(JSON.stringify({ ...ok, rooms: 'x' }))).toBeUndefined()
    expect(parseChatRequest('x'.repeat(400_000))).toBeUndefined()
  })
})

describe('resposta real da skill /house-chat (TV na parede da direita)', () => {
  it('"Aplicar todas" aplica as 6 mudanças fora de ordem; a TV vai junto com o rack', async () => {
    const real = (await import('./fixtures/house-chat-sala.json')).default
    const reply = parseChatReply(real.reply)!
    expect(reply.actions).toHaveLength(6)
    const { parseFloorPlan, planToHouse } = await import('../src/engine/floor-plan.ts')
    const { applySuggestions, roomSizeCm, tryMove } = await import('../src/engine/layout.ts')
    const plan = (await import('./fixtures/floor-plan-apto-portas.json')).default
    const read = planToHouse(parseFloorPlan(plan)!, rooms)
    const house = expandHouse(rooms, products, read.house)
    const view = buildList(house.room, house.products, 60_000, emptyChoices())
    const index = read.rooms.findIndex((r) => r.instanceId === 'sala')
    const size = roomSizeCm({ aspect: read.aspect, rooms: read.rooms }, index)
    const base = arrangeRoom(
      { width: size.width, depth: size.depth, openings: read.rooms[index].openings },
      layoutItems(view, 'sala'),
    )
    const layoutWith = (positions: Record<string, never[]> | object) =>
      applySuggestions(base, (positions as Record<string, []>).sala ?? []).layout
    const moves = reply.actions.filter((a) => a.type === 'move')
    // sozinho, o rack bate no sofá (que ainda está na parede da direita)
    const rackFirst = moves[0]
    expect(rackFirst.key).toBe('sala:rack')
    expect(tryMove(base, { ...rackFirst })).toBeUndefined()

    const isAt = (move: (typeof moves)[number], pos: object) => {
      const p = layoutWith(pos).placed.find((q) => q.key === move.key && q.unit === move.unit)!
      return (
        Math.abs(p.x + p.w / 2 - move.xCm) <= 1 &&
        Math.abs(p.y + p.d / 2 - move.yCm) <= 1 &&
        p.facing === move.rotation
      )
    }
    const { positions, applied } = applyMoves(moves, {}, (room) => room, isAt)
    expect(applied).toEqual([true, true, true, true, true, true])
    const final = layoutWith(positions)
    const at = (category: string) => final.placed.find((p) => p.category === category)!
    expect(at('rack').x + at('rack').w).toBeCloseTo(size.width, 0) // parede da direita
    expect(at('sofa').x).toBe(0) // parede da esquerda
    expect(at('tv').facing).toBe('left')
    expect(at('tv').y + at('tv').d / 2).toBeCloseTo(at('rack').y + at('rack').d / 2, 0)
  })

  it('TV segue o rack quando só o rack muda', async () => {
    const { applySuggestions } = await import('../src/engine/layout.ts')
    const base = arrangeRoom({ width: 400, depth: 400, openings: [] }, [
      {
        key: 'rack',
        category: 'rack',
        label: 'Rack',
        placement: 'floor',
        width: 180,
        depth: 40,
        height: 55,
        qty: 1,
      },
      {
        key: 'tv',
        category: 'tv',
        label: 'TV',
        placement: 'wall',
        width: 120,
        depth: 6,
        height: 70,
        qty: 1,
      },
    ])
    const moved = applySuggestions(base, [
      { key: 'rack', unit: 0, xCm: 380, yCm: 200, rotation: 'left' },
    ]).layout
    const tv = moved.placed.find((p) => p.key === 'tv')!
    expect(tv.facing).toBe('left')
    expect(tv.x + tv.w).toBeCloseTo(400)
    expect(tv.y + tv.d / 2).toBeCloseTo(200)
  })
})
