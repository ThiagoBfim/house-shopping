/**
 * Móveis em 3D com forma reconhecível (cama com cabeceira e travesseiros, sofá com braços e
 * encosto, mesa com pés e cadeiras…), sempre na medida real do item. Coordenadas locais:
 * largura em x, profundidade em z, a frente apontando para +z, a base em y = 0. Em metros.
 */
import type { BuiltIn } from '../engine/house3d.ts'
import type { RealisticKit } from './realistic-materials.ts'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type ColorRepresentation,
} from 'three'

const materials = new Map<string, MeshStandardMaterial>()

/** Material compartilhado por cor e acabamento (menos memória e menos trocas na GPU). */
export function material(
  color: ColorRepresentation,
  { roughness = 0.75, metalness = 0 }: { roughness?: number; metalness?: number } = {},
) {
  const key = `${String(color)}|${roughness}|${metalness}`
  let m = materials.get(key)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness, metalness })
    materials.set(key, m)
  }
  return m
}

/** Modo realista: madeira e tecido com textura, cantos arredondados. */
let kit: RealisticKit | undefined
export function setRealistic(next: RealisticKit | undefined) {
  kit = next
}

const isDark = (color: string) => {
  const c = parseInt(color.slice(1), 16)
  return ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11 < 120
}

/** Madeira (veio real no modo realista). */
export const wood = (color: string) =>
  kit ? kit.wood(color, isDark(color)) : material(color, { roughness: 0.6 })

/** Tecido (trama real no modo realista). */
export const fabric = (color: string) =>
  kit ? kit.fabric(color) : material(color, { roughness: 0.95 })

export function disposeMaterials() {
  for (const m of materials.values()) m.dispose()
  materials.clear()
}

const WOOD = '#a0785a'
const WOOD_DARK = '#6e5240'
const WOOD_LIGHT = '#c8a985'
const WHITE = '#eceeef'
const STEEL = '#b8bec3'
const BLACK = '#1d1f22'

type Mat = MeshStandardMaterial

function addBox(
  g: Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  m: Mat,
) {
  if (w <= 0 || h <= 0 || d <= 0) return
  const small = Math.min(w, h, d)
  // Realista: quina arredondada (a luz desenha a borda, como num móvel de verdade).
  const geometry =
    kit && small >= 0.02
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(0.012, small * 0.25))
      : new BoxGeometry(w, h, d)
  const mesh = new Mesh(geometry, m)
  mesh.position.set(x, y + h / 2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  g.add(mesh)
  return mesh
}

function addCylinder(g: Group, r: number, h: number, x: number, y: number, z: number, m: Mat) {
  const mesh = new Mesh(new CylinderGeometry(r, r, h, 20), m)
  mesh.position.set(x, y + h / 2, z)
  mesh.castShadow = true
  g.add(mesh)
  return mesh
}

/** Quatro pés nos cantos (recuados `inset`). */
function legs(g: Group, w: number, d: number, h: number, size: number, inset: number, m: Mat) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(
        g,
        size,
        h,
        size,
        sx * (w / 2 - inset - size / 2),
        0,
        sz * (d / 2 - inset - size / 2),
        m,
      )
    }
  }
}

/** Corpo com portas ou gavetas na frente (frisos escuros e puxadores). */
function cabinet(
  g: Group,
  w: number,
  h: number,
  d: number,
  body: Mat,
  { doors = 2, drawers = 0, plinth = 0.06 }: { doors?: number; drawers?: number; plinth?: number },
) {
  const front = d / 2
  addBox(g, w - 0.02, plinth, d - 0.04, 0, 0, -0.01, wood(WOOD_DARK))
  addBox(g, w, h - plinth, d, 0, plinth, 0, body)
  const line = material(WOOD_DARK, { roughness: 0.5 })
  const handle = material(STEEL, { roughness: 0.3, metalness: 0.8 })
  const usable = h - plinth
  if (drawers) {
    for (let i = 1; i < drawers; i++) {
      addBox(g, w - 0.04, 0.008, 0.006, 0, plinth + (usable * i) / drawers, front, line)
    }
    for (let i = 0; i < drawers; i++) {
      addBox(
        g,
        Math.min(0.18, w * 0.3),
        0.015,
        0.02,
        0,
        plinth + (usable * (i + 0.5)) / drawers,
        front + 0.01,
        handle,
      )
    }
  } else {
    for (let i = 1; i < doors; i++) {
      addBox(g, 0.008, usable - 0.04, 0.006, -w / 2 + (w * i) / doors, plinth + 0.02, front, line)
    }
    for (let i = 0; i < doors; i++) {
      const x = -w / 2 + (w * (i + 0.5)) / doors + (i % 2 ? -1 : 1) * (w / doors) * 0.38
      addBox(
        g,
        0.015,
        Math.min(0.25, usable * 0.3),
        0.02,
        x,
        plinth + usable * 0.45,
        front + 0.01,
        handle,
      )
    }
  }
}

function bed(g: Group, w: number, d: number, h: number, crib: boolean) {
  const frame = crib ? wood('#e8d8b0') : fabric('#c9b79c')
  const sheet = fabric('#f4f1ea')
  if (crib) {
    // Berço: estrado alto, grades de ripas dos quatro lados.
    const top = Math.max(0.8, h)
    addBox(g, w, 0.04, d, 0, 0.3, 0, frame)
    addBox(g, w - 0.06, 0.12, d - 0.06, 0, 0.34, 0, sheet)
    legs(g, w, d, top, 0.05, 0, frame)
    for (const [len, along, fixed] of [
      [w, 'x', d / 2],
      [w, 'x', -d / 2],
      [d, 'z', w / 2],
      [d, 'z', -w / 2],
    ] as const) {
      addBox(
        g,
        along === 'x' ? len : 0.04,
        0.04,
        along === 'x' ? 0.04 : len,
        along === 'x' ? 0 : fixed,
        top - 0.04,
        along === 'x' ? fixed : 0,
        frame,
      )
      const n = Math.floor(len / 0.08)
      for (let i = 1; i < n; i++) {
        const t = -len / 2 + (len * i) / n
        addBox(
          g,
          0.025,
          top - 0.38,
          0.025,
          along === 'x' ? t : fixed,
          0.34,
          along === 'x' ? fixed : t,
          frame,
        )
      }
    }
    return
  }
  // Cama box: base, colchão, cabeceira, travesseiros e manta no pé.
  const base = Math.max(0.2, h * 0.55)
  addBox(g, w, base, d - 0.06, 0, 0, 0.03, frame)
  addBox(g, w - 0.02, Math.max(0.15, h - base), d - 0.08, 0, base, 0.04, sheet)
  addBox(g, w + 0.04, 1.05, 0.08, 0, 0, -d / 2 + 0.04, wood(WOOD_DARK))
  const pillows = w > 1.2 ? 2 : 1
  for (let i = 0; i < pillows; i++) {
    const pw = w / pillows - 0.12
    addBox(
      g,
      pw,
      0.12,
      0.38,
      -w / 2 + (w / pillows) * (i + 0.5),
      h,
      -d / 2 + 0.32,
      fabric('#ffffff'),
    )
  }
  addBox(g, w + 0.02, 0.04, d * 0.3, 0, h - 0.01, d / 2 - d * 0.15 - 0.04, fabric('#7d8f9c'))
}

function sofa(g: Group, w: number, d: number, h: number, color: string) {
  const cover = fabric(color)
  const seat = Math.min(0.45, h * 0.5)
  const arm = Math.min(0.18, w * 0.12)
  const back = Math.min(0.22, d * 0.25)
  legs(g, w, d, 0.08, 0.04, 0.05, wood(WOOD_DARK))
  addBox(g, w, seat - 0.08, d, 0, 0.08, 0, cover)
  addBox(g, w, h - 0.08, back, 0, 0.08, -d / 2 + back / 2, cover)
  for (const s of [-1, 1]) addBox(g, arm, seat + 0.12, d, s * (w / 2 - arm / 2), 0.08, 0, cover)
  // Almofadas do assento (uma por lugar).
  const seats = Math.max(1, Math.round((w - 2 * arm) / 0.65))
  const cw = (w - 2 * arm) / seats
  const cushion = fabric(color)
  for (let i = 0; i < seats; i++) {
    addBox(
      g,
      cw - 0.02,
      0.1,
      d - back - 0.04,
      -w / 2 + arm + cw * (i + 0.5),
      seat,
      back / 2 + 0.01,
      cushion,
    )
  }
}

function chair(g: Group, x: number, z: number, angle: number, m: Mat) {
  const c = new Group()
  legs(c, 0.42, 0.42, 0.45, 0.03, 0.01, m)
  addBox(c, 0.44, 0.04, 0.44, 0, 0.45, 0, m)
  addBox(c, 0.44, 0.45, 0.03, 0, 0.49, -0.205, m)
  c.position.set(x, 0, z)
  c.rotation.y = angle
  g.add(c)
}

function table(
  g: Group,
  w: number,
  d: number,
  h: number,
  top: string,
  chairs: boolean,
  /** Encostada na parede (atrás, −z): sem cadeiras desse lado. */
  againstWall = false,
) {
  const m = wood(top)
  addBox(g, w, 0.035, d, 0, h - 0.035, 0, m)
  legs(g, w, d, h - 0.035, 0.05, 0.05, wood(WOOD_DARK))
  if (!chairs) return
  // Cadeiras: duas por lado no comprimento, uma em cada cabeceira se couber.
  const along = w >= d
  const [long, short] = along ? [w, d] : [d, w]
  const perSide = Math.max(1, Math.floor(long / 0.6))
  const chairMat = wood(WOOD_DARK)
  for (let i = 0; i < perSide; i++) {
    const t = -long / 2 + (long * (i + 0.5)) / perSide
    for (const s of [-1, 1]) {
      if (againstWall && along && s < 0) continue
      const off = short / 2 + 0.12
      if (along) chair(g, t, s * off, s > 0 ? Math.PI : 0, chairMat)
      else chair(g, s * off, t, s > 0 ? -Math.PI / 2 : Math.PI / 2, chairMat)
    }
  }
}

function appliance(g: Group, w: number, d: number, h: number, kind: string) {
  const body = material(kind === 'geladeira' || kind === 'freezer' ? STEEL : WHITE, {
    roughness: 0.35,
    metalness: kind === 'geladeira' ? 0.5 : 0.1,
  })
  const dark = material(BLACK, { roughness: 0.4 })
  const handle = material('#9aa1a7', { roughness: 0.25, metalness: 0.9 })
  addBox(g, w, h, d, 0, 0, 0, body)
  const front = d / 2
  if (kind === 'geladeira') {
    addBox(g, w - 0.01, 0.006, 0.004, 0, h * 0.62, front, dark)
    addBox(g, 0.02, h * 0.25, 0.03, w / 2 - 0.06, h * 0.68, front + 0.015, handle)
    addBox(g, 0.02, h * 0.3, 0.03, w / 2 - 0.06, h * 0.22, front + 0.015, handle)
  } else if (kind === 'fogao') {
    addBox(g, w - 0.02, 0.01, d - 0.04, 0, h, 0, dark)
    const n = w > 0.65 ? 3 : 2
    for (let i = 0; i < n; i++) {
      for (const z of [-d / 5, d / 5]) {
        addCylinder(
          g,
          0.05,
          0.02,
          -w / 2 + (w * (i + 0.5)) / n,
          h + 0.01,
          z,
          material('#3a3d40', { roughness: 0.3, metalness: 0.6 }),
        )
      }
    }
    addBox(
      g,
      w - 0.1,
      h * 0.45,
      0.004,
      0,
      h * 0.1,
      front,
      material('#2b2f33', { roughness: 0.1, metalness: 0.3 }),
    )
    addBox(g, w - 0.12, 0.02, 0.03, 0, h * 0.6, front + 0.015, handle)
  } else if (kind === 'lava-roupas') {
    addCylinder(g, Math.min(w, h) * 0.3, 0.02, 0, h * 0.45, front, dark).rotation.x = Math.PI / 2
    addBox(g, w - 0.04, 0.1, 0.01, 0, h - 0.14, front, material('#d6dadd', { roughness: 0.4 }))
  } else {
    addBox(g, w - 0.04, 0.01, 0.004, 0, h - 0.12, front, dark)
    addBox(g, w - 0.12, 0.02, 0.03, 0, h - 0.18, front + 0.015, handle)
  }
}

function tv(g: Group, w: number, d: number, h: number) {
  addBox(g, w, h, Math.max(0.03, Math.min(d, 0.06)), 0, 0, 0, material(BLACK, { roughness: 0.2 }))
  addBox(
    g,
    w - 0.03,
    h - 0.03,
    0.004,
    0,
    0.015,
    Math.min(d, 0.06) / 2 + 0.002,
    material('#0b0d12', { roughness: 0.05, metalness: 0.2 }),
  )
}

function desk(g: Group, w: number, d: number, h: number, top: string) {
  table(g, w, d, h, top, false)
  chairOffice(g, 0, d / 2 + 0.25)
}

function chairOffice(g: Group, x: number, z: number) {
  const c = new Group()
  const dark = material('#2a2c30', { roughness: 0.7 })
  addCylinder(c, 0.025, 0.4, 0, 0.05, 0, material(STEEL, { metalness: 0.8, roughness: 0.3 }))
  addBox(c, 0.6, 0.04, 0.06, 0, 0.03, 0, dark)
  addBox(c, 0.06, 0.04, 0.6, 0, 0.03, 0, dark)
  addBox(c, 0.48, 0.08, 0.46, 0, 0.45, 0, dark)
  addBox(c, 0.46, 0.55, 0.06, 0, 0.53, 0.22, dark)
  c.position.set(x, 0, z)
  g.add(c)
}

/** Mesma forma da lista de categorias do catálogo; o resto vira caixa com acabamento. */
export function furnitureModel(
  category: string,
  w: number,
  d: number,
  h: number,
  placement: string,
  { againstWall = false }: { againstWall?: boolean } = {},
): Group {
  const g = new Group()
  if (placement === 'rug') {
    const rug = addBox(
      g,
      w,
      0.012,
      d,
      0,
      0,
      0,
      material(category === 'tapete-banheiro' ? '#c7d3dc' : '#d8c3a5', { roughness: 1 }),
    )
    if (rug) rug.castShadow = false
    return g
  }
  switch (category) {
    case 'cama-box':
      bed(g, w, d, h, false)
      break
    case 'berco':
      bed(g, w, d, h, true)
      break
    case 'sofa':
      sofa(g, w, d, h, '#6f8fa6')
      break
    case 'poltrona':
    case 'poltrona-amamentacao':
      sofa(g, w, d, h, '#8aa3b5')
      break
    case 'mesa-de-jantar':
    case 'mesa-externa':
      table(g, w, d, h, WOOD_LIGHT, true, againstWall)
      break
    case 'mesa-de-centro':
      table(g, w, d, h, WOOD, false)
      break
    case 'mesa-escritorio':
    case 'mesa-regulavel':
      desk(g, w, d, h, WOOD_LIGHT)
      break
    case 'cadeira-escritorio':
    case 'cadeira-gamer':
      chairOffice(g, 0, 0)
      break
    case 'guarda-roupa':
    case 'guarda-roupa-infantil':
      cabinet(g, w, h, d, category === 'guarda-roupa' ? wood(WOOD) : wood('#e9dcc7'), {
        doors: Math.max(2, Math.round(w / 0.5)),
      })
      break
    case 'comoda':
    case 'comoda-trocador':
    case 'gaveteiro':
      cabinet(g, w, h, d, category === 'comoda' ? wood(WOOD) : wood('#e9dcc7'), {
        drawers: Math.max(3, Math.round(h / 0.22)),
      })
      break
    case 'criado-mudo':
      cabinet(g, w, h, d, wood(WOOD), { drawers: 2, plinth: 0.1 })
      break
    case 'rack':
      cabinet(g, w, h, d, wood('#7a5c45'), {
        doors: Math.max(2, Math.round(w / 0.6)),
        plinth: 0.08,
      })
      break
    case 'sapateira':
    case 'gabinete-banheiro':
      cabinet(g, w, h, d, material(WHITE, { roughness: 0.4 }), { doors: 2 })
      break
    case 'geladeira':
    case 'freezer':
    case 'fogao':
    case 'lava-loucas':
    case 'lava-roupas':
      appliance(g, w, d, h, category)
      break
    case 'tv':
    case 'monitor':
    case 'monitor-gamer':
      tv(g, w, d, h)
      break
    case 'ar-condicionado':
      addBox(g, w, h, d, 0, 0, 0, material('#f5f5f5', { roughness: 0.4 }))
      addBox(g, w - 0.06, 0.02, 0.01, 0, 0.04, d / 2, material('#cfd3d6'))
      break
    case 'luminaria-de-chao':
      addCylinder(g, 0.13, 0.03, 0, 0, 0, material(BLACK))
      addCylinder(
        g,
        0.015,
        h - 0.3,
        0,
        0.03,
        0,
        material(BLACK, { metalness: 0.6, roughness: 0.3 }),
      )
      addCylinder(g, 0.18, 0.28, 0, h - 0.3, 0, material('#f6eedc', { roughness: 1 }))
      break
    case 'espelho-corpo-inteiro':
      addBox(g, w, h, Math.min(d, 0.04), 0, 0, 0, wood(WOOD_DARK))
      addBox(
        g,
        w - 0.04,
        h - 0.04,
        0.005,
        0,
        0.02,
        Math.min(d, 0.04) / 2,
        material('#cfe0ea', { roughness: 0.02, metalness: 0.9 }),
      )
      break
    case 'lixeira-cozinha':
    case 'lixeira-banheiro': {
      // Lixeira de pedal: corpo inox, tampa preta.
      const steel = material('#c5c9cc', { roughness: 0.3, metalness: 0.85 })
      addCylinder(g, Math.min(w, d) / 2, h - 0.03, 0, 0, 0, steel)
      addCylinder(
        g,
        Math.min(w, d) / 2 + 0.005,
        0.03,
        0,
        h - 0.03,
        0,
        material(BLACK, { roughness: 0.4 }),
      )
      break
    }
    case 'cesto-de-roupa':
      addBox(g, w, h, d, 0, 0, 0, wood('#c9ab7a'))
      addBox(g, w + 0.01, 0.03, d + 0.01, 0, h - 0.03, 0, wood('#a8875a'))
      break
    case 'varal': {
      // Varal de chão: duas laterais em A e as varetas.
      const metal = material('#e3e5e7', { roughness: 0.35, metalness: 0.6 })
      for (const sx of [-1, 1]) {
        addBox(g, 0.02, h, d, sx * (w / 2 - 0.01), 0, 0, metal)
      }
      for (let i = 0; i < 8; i++) {
        addBox(g, w, 0.008, 0.008, 0, h - 0.02, -d / 2 + (d * (i + 0.5)) / 8, metal)
      }
      break
    }
    case 'box-banheiro': {
      // Box: dois vidros (frente e lateral livre) com perfil de alumínio; piso do box.
      const glass = material('#d7e8f0', { roughness: 0.05, metalness: 0.1 })
      glass.transparent = true
      glass.opacity = 0.3
      const frame = material('#c9ccce', { roughness: 0.3, metalness: 0.8 })
      addBox(g, w, h, 0.01, 0, 0, d / 2 - 0.005, glass)
      addBox(g, 0.01, h, d, w / 2 - 0.005, 0, 0, glass)
      addBox(g, w, 0.03, 0.03, 0, h - 0.03, d / 2 - 0.015, frame)
      addBox(g, 0.03, 0.03, d, w / 2 - 0.015, h - 0.03, 0, frame)
      addBox(g, w, 0.02, d, 0, 0, 0, material('#eeeeec', { roughness: 0.4 }))
      // Chuveiro na parede de trás.
      addCylinder(g, 0.1, 0.02, 0, h + 0.05, -d / 2 + 0.15, frame)
      break
    }
    case 'coifa': {
      // Coifa: corpo inclinado de inox e chaminé até perto do teto.
      const steel = material('#c3c8cc', { roughness: 0.25, metalness: 0.9 })
      addBox(g, w, 0.12, d, 0, 0, 0, steel)
      addBox(g, 0.28, Math.max(0.2, 2.6 - 1.65 - 0.12), 0.24, 0, 0.12, -d / 2 + 0.12, steel)
      break
    }
    case 'purificador':
      addBox(g, w, h, d, 0, 0, 0, material(WHITE, { roughness: 0.3 }))
      addBox(
        g,
        w * 0.5,
        0.02,
        0.06,
        0,
        0.04,
        d / 2,
        material('#9aa1a7', { metalness: 0.8, roughness: 0.3 }),
      )
      break
    case 'cooler':
      addBox(g, w, h * 0.85, d, 0, 0, 0, material('#2f6fb3', { roughness: 0.5 }))
      addBox(
        g,
        w + 0.01,
        h * 0.15,
        d + 0.01,
        0,
        h * 0.85,
        0,
        material('#f2f2f0', { roughness: 0.5 }),
      )
      break
    case 'ombrelone': {
      addBox(g, w, 0.06, d, 0, 0, 0, material('#3b3e42', { roughness: 0.6 }))
      addCylinder(
        g,
        0.02,
        h - 0.3,
        0,
        0.06,
        0,
        material('#d9d9d6', { metalness: 0.7, roughness: 0.3 }),
      )
      const canopy = new Mesh(new CylinderGeometry(0.02, 1.2, 0.35, 24), fabric('#e8dcc4'))
      canopy.position.set(0, h - 0.2, 0)
      canopy.castShadow = true
      g.add(canopy)
      break
    }
    default:
      addBox(g, w, h, d, 0, 0, 0, material('#b9b2a8', { roughness: 0.7 }))
  }
  return g
}

/** Acabamento do armário das fotos → material. */
function finishMaterial(finish: BuiltIn['finish'], color: string) {
  if (finish === 'madeira-clara' || finish === 'madeira-escura') return wood(color)
  if (finish === 'laca') return material(color, { roughness: 0.18 })
  return material(color, { roughness: finish === 'cinza' ? 0.5 : 0.45 })
}

/** Pedra do tampo (granito, quartzo): lisa e com reflexo. */
const stone = (color: string) => material(color, { roughness: 0.18, metalness: 0.05 })

/**
 * Armário que já está no imóvel (das fotos), na medida: embutido, bancada com tampo (pia e
 * cooktop quando a foto mostra), aéreo, gabinete do banheiro com cuba, prateleira.
 * Mesmas coordenadas dos móveis (frente em +z, base em y = 0).
 */
export function builtInModel(
  b: Pick<BuiltIn, 'kind' | 'finish' | 'color' | 'topColor' | 'sink' | 'cooktop' | 'doors'>,
  w: number,
  d: number,
  h: number,
): Group {
  const g = new Group()
  const body = finishMaterial(b.finish, b.color)
  const doors = b.doors ?? Math.max(1, Math.round(w / (b.kind === 'armario' ? 0.5 : 0.45)))
  const steel = material('#c3c8cc', { roughness: 0.22, metalness: 0.9 })
  switch (b.kind) {
    case 'armario':
      cabinet(g, w, h, d, body, { doors, plinth: 0.05 })
      break
    case 'aereo':
      cabinet(g, w, h, d, body, { doors, plinth: 0 })
      break
    case 'prateleira':
      addBox(g, w, Math.min(h, 0.03), d, 0, 0, 0, body)
      break
    case 'bancada':
    case 'gabinete': {
      const top = Math.min(0.03, h * 0.2)
      const counter = b.topColor ?? (b.kind === 'gabinete' ? '#e9e7e2' : '#2a2a2d')
      cabinet(g, w, h - top, d - 0.02, body, { doors, plinth: b.kind === 'bancada' ? 0.1 : 0.02 })
      addBox(g, w + 0.01, top, d + 0.02, 0, h - top, 0.01, stone(counter))
      if (b.sink || b.kind === 'gabinete') {
        // Cuba (embutida no tampo) e torneira atrás.
        const sw = Math.min(0.5, w * 0.4)
        const x = b.kind === 'gabinete' ? 0 : w / 2 - sw / 2 - 0.25
        addBox(
          g,
          sw,
          0.005,
          Math.min(0.4, d - 0.15),
          x,
          h,
          0.02,
          b.kind === 'gabinete' ? material('#fbfbfa', { roughness: 0.15 }) : steel,
        )
        addCylinder(g, 0.015, 0.25, x, h, -d / 2 + 0.08, steel)
        addBox(g, 0.025, 0.025, 0.16, x, h + 0.23, -d / 2 + 0.15, steel)
      }
      if (b.cooktop && w > 1.2) {
        const cx = -w / 2 + 0.4
        addBox(g, 0.58, 0.006, 0.5, cx, h, 0.02, material('#0d0e10', { roughness: 0.05 }))
        for (const [ox, oz] of [
          [-0.13, -0.11],
          [0.13, -0.11],
          [-0.13, 0.13],
          [0.13, 0.13],
        ]) {
          addCylinder(
            g,
            0.085,
            0.002,
            cx + ox,
            h + 0.006,
            0.02 + oz,
            material('#3b3e42', { roughness: 0.3 }),
          )
        }
      }
      break
    }
  }
  return g
}
