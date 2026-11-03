/**
 * Materiais do modo realista: texturas CC0 do Poly Haven (`public/textures`, ver o README de
 * lá) com mapa de cor, relevo (normal) e rugosidade, na escala real, e o céu (HDRI) que ilumina
 * a casa e aparece nas janelas. A cor continua sendo a das fotos: o material é tingido para
 * que a média da textura dê a cor lida pela skill.
 */
import {
  Color,
  EquirectangularReflectionMapping,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  type Texture,
} from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import type { Floor } from '../engine/house3d.ts'

const BASE = `${import.meta.env.BASE_URL}textures/`

interface Maps {
  color: Texture
  normal: Texture
  rough: Texture
  /** Metros que a imagem cobre. */
  meters: number
  /** Cor média da imagem de cor (para tingir). */
  average: Color
}

/** Textura → tamanho real (m), ver public/textures/README.md. */
const SETS = {
  laminate_floor_02: 1.7,
  marble_01: 1.5,
  concrete_floor_02: 2,
  wood_floor_deck: 1.8,
  painted_plaster_wall: 2,
  oak_veneer_01: 1.83,
  walnut_veneer: 1.8,
  denim_fabric: 0.1,
} as const
type SetName = keyof typeof SETS

const FLOOR_SET: Record<Floor, SetName> = {
  madeira: 'laminate_floor_02',
  porcelanato: 'marble_01',
  ceramica: 'marble_01',
  cimento: 'concrete_floor_02',
  carpete: 'denim_fabric',
  deck: 'wood_floor_deck',
}

function averageOf(texture: Texture): Color {
  const image = texture.image as CanvasImageSource & { width: number; height: number }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 16
  const ctx = canvas.getContext('2d')
  if (!ctx) return new Color('#808080')
  ctx.drawImage(image, 0, 0, 16, 16)
  const data = ctx.getImageData(0, 0, 16, 16).data
  let [r, g, b] = [0, 0, 0]
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  const n = data.length / 4
  return new Color().setRGB(r / n / 255, g / n / 255, b / n / 255, SRGBColorSpace)
}

export interface RealisticKit {
  /** Céu (HDRI) para `scene.environment` e o fundo. */
  sky: Texture
  floor: (
    kind: Floor,
    color: string,
    widthM: number,
    depthM: number,
    tileCm?: number,
  ) => MeshStandardMaterial
  wall: (color: string) => MeshStandardMaterial
  wood: (color: string, dark?: boolean) => MeshStandardMaterial
  fabric: (color: string) => MeshStandardMaterial
  glass: () => MeshPhysicalMaterial
  dispose: () => void
}

export async function loadRealisticKit(): Promise<RealisticKit> {
  const loader = new TextureLoader()
  const load = (url: string) => loader.loadAsync(url)
  const sets = {} as Record<SetName, Maps>
  await Promise.all(
    (Object.keys(SETS) as SetName[]).map(async (name) => {
      const [color, normal, rough] = await Promise.all([
        load(`${BASE}${name}_color.jpg`),
        load(`${BASE}${name}_normal.jpg`),
        load(`${BASE}${name}_rough.jpg`),
      ])
      color.colorSpace = SRGBColorSpace
      for (const t of [color, normal, rough]) {
        t.wrapS = t.wrapT = RepeatWrapping
        t.anisotropy = 8
      }
      sets[name] = { color, normal, rough, meters: SETS[name], average: averageOf(color) }
    }),
  )
  const sky = await new HDRLoader().loadAsync(`${BASE}sky_1k.hdr`)
  sky.mapping = EquirectangularReflectionMapping

  const owned: (MeshStandardMaterial | Texture)[] = []
  /** Cópia das texturas com a repetição deste uso (cada piso tem seu tamanho). */
  const maps = (name: SetName, repeatX: number, repeatY: number, withColor = true) => {
    const set = sets[name]
    const clone = (t: Texture) => {
      const c = t.clone()
      c.repeat.set(repeatX, repeatY)
      c.needsUpdate = true
      owned.push(c)
      return c
    }
    return {
      ...(withColor && { map: clone(set.color) }),
      normalMap: clone(set.normal),
      roughnessMap: clone(set.rough),
    }
  }
  /** Tinge para a média da textura virar a cor lida (limitado para não estourar). */
  const tint = (name: SetName, color: string) => {
    const target = new Color(color)
    const avg = sets[name].average
    const ratio = (t: number, a: number) => Math.min(2.2, t / Math.max(0.04, a))
    return new Color(ratio(target.r, avg.r), ratio(target.g, avg.g), ratio(target.b, avg.b))
  }
  const keep = <T extends MeshStandardMaterial>(m: T) => {
    owned.push(m)
    return m
  }
  const cache = new Map<string, MeshStandardMaterial>()
  const cached = (key: string, make: () => MeshStandardMaterial) => {
    let m = cache.get(key)
    if (!m) {
      m = keep(make())
      cache.set(key, m)
    }
    return m
  }

  return {
    sky,
    floor: (kind, color, widthM, depthM, tileCm) => {
      const name = FLOOR_SET[kind]
      // marble_01 tem 4 peças por imagem (~75 cm): o tamanho real da peça muda a repetição.
      const meters =
        name === 'marble_01'
          ? ((tileCm ?? (kind === 'ceramica' ? 40 : 75)) / 100) * 2
          : sets[name].meters
      return keep(
        new MeshStandardMaterial({
          color: tint(name, color),
          ...maps(name, widthM / meters, depthM / meters),
          roughness: kind === 'porcelanato' ? 0.35 : 1,
          metalness: 0,
          envMapIntensity: kind === 'porcelanato' ? 1 : 0.7,
        }),
      )
    },
    wall: (color) =>
      cached(`wall${color}`, () => {
        // Só o relevo da pintura (a cor é a da foto, sem manchas da textura).
        return new MeshStandardMaterial({
          color,
          ...maps('painted_plaster_wall', 1.5, 1.5, false),
          normalScale: new Vector2(0.35, 0.35),
          roughness: 0.95,
        })
      }),
    wood: (color, dark) =>
      cached(`wood${color}${dark}`, () => {
        const name = dark ? 'walnut_veneer' : 'oak_veneer_01'
        return new MeshStandardMaterial({
          color: tint(name, color),
          ...maps(name, 1, 1),
          roughness: 0.6,
        })
      }),
    fabric: (color) =>
      cached(
        `fabric${color}`,
        () =>
          // Trama do tecido no relevo; a cor é a do móvel.
          new MeshPhysicalMaterial({
            color,
            ...maps('denim_fabric', 6, 6, false),
            roughness: 1,
            sheen: 0.6,
            sheenRoughness: 0.8,
            sheenColor: new Color(color).offsetHSL(0, 0, 0.15),
          }),
      ),
    glass: () =>
      keep(
        new MeshPhysicalMaterial({
          color: '#ffffff',
          transmission: 1,
          thickness: 0.006,
          roughness: 0.02,
          ior: 1.5,
          transparent: true,
          opacity: 0.25,
        }),
      ),
    dispose: () => {
      for (const o of owned) o.dispose()
      for (const set of Object.values(sets)) {
        set.color.dispose()
        set.normal.dispose()
        set.rough.dispose()
      }
      sky.dispose()
    },
  }
}
