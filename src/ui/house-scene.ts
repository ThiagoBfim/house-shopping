/**
 * A casa inteira em 3D (three.js): cômodos na posição da planta, piso com textura do
 * acabamento, paredes com rodapé, portas com batente e folha aberta, janelas com vidro, móveis
 * da lista com forma e medida reais, luz com sombra.
 *
 * Três jeitos de ver: de cima ("maquete", paredes cortadas a meia altura), andando em primeira
 * pessoa (sem atravessar parede nem móvel) e o tour, que passa por todos os cômodos pelas
 * portas e pode ser gravado em vídeo. Carregado só quando a pessoa abre (import dinâmico).
 * Unidades: 1 = 1 metro; x da planta → x, y da planta → z, altura → y.
 */
import {
  ACESFilmicToneMapping,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Raycaster,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { SSAARenderPass } from 'three/examples/jsm/postprocessing/SSAARenderPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import {
  DOOR_HEIGHT,
  WALL_HEIGHT,
  WALL_THICKNESS,
  blockersOf,
  buildWorld,
  move,
  startRoom,
  freeSpot,
  tourPath,
  type Rect2,
} from '../engine/house-world.ts'
import type { Floor, HouseModel } from '../engine/house3d.ts'
import { isGeometry, type FurnishedRoom } from '../engine/house3d.ts'
import type { PlacedItem } from '../engine/layout.ts'
import {
  builtInModel,
  disposeMaterials,
  furnitureModel,
  material,
  setRealistic,
} from './furniture-models.ts'
import type { RealisticKit } from './realistic-materials.ts'

export type ViewMode = 'orbit' | 'walk' | 'tour'

export interface HouseScene {
  setMode: (mode: 'orbit' | 'walk') => void
  /** Tour pelos cômodos; com `record`, devolve o vídeo no fim. */
  startTour: (options: { record: boolean; onEnd: (video?: Blob) => void }) => void
  stopTour: () => void
  select: (id: string | undefined) => void
  /** Imagem PNG do que está na tela. */
  screenshot: () => string
  /**
   * Render realista do que está na tela (modo realista): 2× a resolução, 8 amostras por pixel e
   * oclusão de ambiente completa. Devolve a imagem PNG.
   */
  renderRealistic: () => { done: Promise<string | undefined>; cancel: () => void }
  /** Estado para a interface e os testes. */
  state: () => { mode: ViewMode; x: number; z: number; room: number; tour: number }
  screenPosition: (id: string) => { x: number; y: number } | undefined
  dispose: () => void
}

interface Callbacks {
  onPick: (id: string | undefined) => void
  onRoom: (index: number) => void
  onMode: (mode: ViewMode) => void
}

export const EYE_HEIGHT = 1.6
const EXPOSURE = 1.05
const WALK_SPEED = 1.4
const TOUR_SPEED = 0.9
const TOUR_PAUSE = 3.2
const ORBIT_CUT = 1.35

/** Id de cada móvel na cena: chave do item + unidade. */
export const itemId = (p: Pick<PlacedItem, 'key' | 'unit'>) => `${p.key}#${p.unit}`

// ---------- texturas do piso (desenhadas num canvas, sem baixar imagem) ----------

function shade(hex: string, amount: number) {
  const c = new Color(hex)
  c.offsetHSL(0, 0, amount)
  return `#${c.getHexString()}`
}

function floorTexture(kind: Floor, color: string) {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
  // Semente fixa: a mesma casa sempre com o mesmo desenho.
  let seed = 7
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  /** Metros que a textura cobre (para repetir na escala certa). */
  let meters: number
  if (kind === 'madeira' || kind === 'deck') {
    const rows = kind === 'deck' ? 8 : 10
    const h = size / rows
    for (let r = 0; r < rows; r++) {
      let x = -rand() * size
      while (x < size) {
        const len = size * (0.45 + rand() * 0.5)
        ctx.fillStyle = shade(color, (rand() - 0.5) * 0.08)
        ctx.fillRect(x, r * h, len, h)
        // veios
        ctx.strokeStyle = shade(color, -0.06)
        ctx.globalAlpha = 0.25
        for (let v = 0; v < 3; v++) {
          ctx.beginPath()
          const y = r * h + h * (0.2 + rand() * 0.6)
          ctx.moveTo(x, y)
          ctx.bezierCurveTo(
            x + len / 3,
            y + (rand() - 0.5) * 4,
            x + (2 * len) / 3,
            y + (rand() - 0.5) * 4,
            x + len,
            y,
          )
          ctx.stroke()
        }
        ctx.globalAlpha = 1
        ctx.fillStyle = shade(color, kind === 'deck' ? -0.25 : -0.15)
        ctx.fillRect(x, r * h, 2, h)
        x += len
      }
      ctx.fillStyle = shade(color, kind === 'deck' ? -0.3 : -0.15)
      ctx.fillRect(0, r * h, size, kind === 'deck' ? 4 : 1.5)
    }
    meters = kind === 'deck' ? 1.2 : 1.5
  } else if (kind === 'porcelanato' || kind === 'ceramica') {
    const tiles = kind === 'porcelanato' ? 2 : 4
    const t = size / tiles
    for (let i = 0; i < tiles; i++) {
      for (let j = 0; j < tiles; j++) {
        ctx.fillStyle = shade(color, (rand() - 0.5) * 0.03)
        ctx.fillRect(i * t, j * t, t, t)
        // leve mármore
        ctx.strokeStyle = shade(color, -0.05)
        ctx.globalAlpha = 0.15
        ctx.beginPath()
        ctx.moveTo(i * t, j * t + rand() * t)
        ctx.quadraticCurveTo(i * t + t / 2, j * t + rand() * t, i * t + t, j * t + rand() * t)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
    ctx.fillStyle = shade(color, -0.12)
    for (let k = 0; k <= tiles; k++) {
      ctx.fillRect(k * t - 1.5, 0, 3, size)
      ctx.fillRect(0, k * t - 1.5, size, 3)
    }
    meters = 1.2
  } else {
    // cimento e carpete: ruído fino
    const img = ctx.getImageData(0, 0, size, size)
    const amp = kind === 'carpete' ? 18 : 10
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rand() - 0.5) * amp
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)
    meters = 2
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.anisotropy = 8
  return { texture, meters }
}

// ---------- cena ----------

export function mountHouse(
  container: HTMLElement,
  model: HouseModel,
  furnished: FurnishedRoom[],
  callbacks: Callbacks,
  /** Modo realista: texturas reais, céu, oclusão de ambiente e render em alta qualidade. */
  kit?: RealisticKit,
): HouseScene {
  setRealistic(kit)
  const world = buildWorld(model)
  // Armários das fotos também bloqueiam quem anda e o ponto de parada do tour.
  const layouts = furnished.map((f) => ({
    ...f.layout,
    // (no L, "fora do cômodo" e passagem de porta são só para posicionar: não bloqueiam no 3D)
    placed: [...f.layout.placed, ...f.fixed.filter((p) => !isGeometry(p))],
  }))
  const blockers: Rect2[] = blockersOf(world, model, layouts)

  const scene = new Scene()
  if (kit) {
    // Céu de verdade: ilumina (reflexos) e aparece pelas janelas.
    scene.environment = kit.sky
    scene.background = kit.sky
    scene.environmentIntensity = 0.55
  } else {
    scene.background = new Color('#dfe7ee')
    scene.fog = new Fog('#dfe7ee', 30, 80)
  }

  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.toneMapping = ACESFilmicToneMapping
  // Realista: um pouco menos de exposição, senão a parede branca estoura e perde o sombreado.
  renderer.toneMappingExposure = kit ? 0.88 : EXPOSURE
  renderer.outputColorSpace = SRGBColorSpace
  renderer.localClippingEnabled = true
  container.appendChild(renderer.domElement)

  const camera = new PerspectiveCamera(55, 1, 0.05, 200)

  // Luz: céu + sol com sombra cobrindo a casa + uma luz de teto por cômodo.
  scene.add(new HemisphereLight('#ffffff', '#b8a690', kit ? 0.45 : 1.4))
  const sun = new DirectionalLight('#fff4e0', 2.2)
  const cx = model.widthM / 2
  const cz = model.depthM / 2
  const span = Math.max(model.widthM, model.depthM)
  sun.position.set(cx + span * 0.4, 12, cz + span * 0.7)
  sun.target.position.set(cx, 0, cz)
  sun.castShadow = true
  sun.shadow.mapSize.set(kit ? 4096 : 2048, kit ? 4096 : 2048)
  sun.shadow.camera.left = -span
  sun.shadow.camera.right = span
  sun.shadow.camera.top = span
  sun.shadow.camera.bottom = -span
  sun.shadow.camera.far = 40
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.02
  scene.add(sun, sun.target)

  // Terreno em volta (grama clara) para a casa não flutuar.
  const ground = new Mesh(
    new PlaneGeometry(span * 40, span * 40),
    new MeshStandardMaterial({ color: '#c9d6b8', roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.set(cx, -0.02, cz)
  ground.receiveShadow = true
  scene.add(ground)

  /**
   * Paredes, portas e janelas ficam neste grupo: na maquete são "cortadas" a ORBIT_CUT achatando
   * cada peça (geometria de verdade, sem plano de corte no material).
   */
  const structure = new Group()
  scene.add(structure)
  const cutMaterial = (color: string, extra: Partial<MeshStandardMaterial> = {}) =>
    new MeshStandardMaterial({ color, roughness: 0.9, ...extra })

  const box = (w: number, h: number, d: number, m: MeshStandardMaterial) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), m)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  // Pisos e tetos.
  const ceilings: Mesh[] = []
  model.rooms.forEach((room, i) => {
    const { floor: kind, floorColor, tileCm } = room.finishes
    const tex = kit ? undefined : floorTexture(kind, floorColor)
    const floorMat = kit
      ? kit.floor(kind, floorColor, room.widthM, room.depthM, tileCm)
      : new MeshStandardMaterial({
          color: tex ? '#ffffff' : floorColor,
          map: tex?.texture,
          roughness: kind === 'porcelanato' ? 0.35 : 0.8,
        })
    if (tex) tex.texture.repeat.set(room.widthM / tex.meters, room.depthM / tex.meters)
    const floor = new Mesh(new PlaneGeometry(room.widthM, room.depthM), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(room.xM + room.widthM / 2, 0.001 * (i % 3), room.yM + room.depthM / 2)
    floor.receiveShadow = true
    scene.add(floor)
    // Teto: só a face de baixo (de cima, na maquete, some sozinho).
    const ceiling = new Mesh(
      new PlaneGeometry(room.widthM, room.depthM),
      // Teto branco: a luz do "chão" do céu deixaria a face de baixo marrom.
      new MeshStandardMaterial({
        color: '#fbfaf7',
        roughness: 1,
        emissive: '#fbfaf7',
        emissiveIntensity: 0.55,
      }),
    )
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.set(room.xM + room.widthM / 2, WALL_HEIGHT, room.yM + room.depthM / 2)
    ceiling.visible = false
    scene.add(ceiling)
    ceilings.push(ceiling)
    const lamp = new PointLight(
      '#fff1d6',
      kit ? 1.6 : 2.2,
      Math.max(room.widthM, room.depthM) * 2.2,
      1.6,
    )
    lamp.position.set(room.xM + room.widthM / 2, WALL_HEIGHT - 0.25, room.yM + room.depthM / 2)
    scene.add(lamp)
  })

  // Paredes (com a cor de cada cômodo), rodapé, vidro das janelas.
  const wallMats = new Map<string, MeshStandardMaterial>()
  const glass = kit
    ? kit.glass()
    : cutMaterial('#a9cfe8', {
        transparent: true,
        opacity: 0.28,
        roughness: 0.05,
        metalness: 0.1,
      })
  glass.depthWrite = false
  const trim = cutMaterial('#f7f5f0', { roughness: 0.5 })
  for (const wall of world.walls) {
    const color = model.rooms[wall.room].finishes.wallColor
    let m = wallMats.get(color)
    if (!m) {
      m = kit ? kit.wall(color) : cutMaterial(color)
      wallMats.set(color, m)
    }
    const w = wall.maxX - wall.minX
    const d = wall.maxZ - wall.minZ
    const h = wall.top - wall.bottom
    const mesh = box(w, h, d, wall.kind === 'glass' ? glass : m)
    if (wall.kind === 'glass') mesh.castShadow = false
    mesh.position.set(
      (wall.minX + wall.maxX) / 2,
      (wall.bottom + wall.top) / 2,
      (wall.minZ + wall.maxZ) / 2,
    )
    structure.add(mesh)
    const horizontal = wall.side === 'top' || wall.side === 'bottom'
    if (wall.kind === 'glass') {
      // Caixilho: moldura fina em volta do vidro e um montante no meio.
      const frame = cutMaterial('#e9e9e6', { roughness: 0.4, metalness: 0.3 })
      const len = horizontal ? w : d
      const t = 0.04
      for (const y of [wall.bottom, wall.top - t]) {
        const bar = box(horizontal ? len : 0.07, t, horizontal ? 0.07 : len, frame)
        bar.position.set(mesh.position.x, y + t / 2, mesh.position.z)
        structure.add(bar)
      }
      for (const along of [-len / 2 + t / 2, 0, len / 2 - t / 2]) {
        const post = box(horizontal ? t : 0.07, h, horizontal ? 0.07 : t, frame)
        post.position.set(
          mesh.position.x + (horizontal ? along : 0),
          mesh.position.y,
          mesh.position.z + (horizontal ? 0 : along),
        )
        structure.add(post)
      }
    } else if (wall.bottom === 0) {
      // Rodapé de 7 cm na face de dentro do cômodo.
      const inward = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] }[wall.side]
      const skirt = box(horizontal ? w : 0.012, 0.07, horizontal ? 0.012 : d, trim)
      const fx = inward[0] > 0 ? wall.maxX : wall.minX
      const fz = inward[1] > 0 ? wall.maxZ : wall.minZ
      skirt.position.set(
        horizontal ? mesh.position.x : fx + inward[0] * 0.006,
        0.035,
        horizontal ? fz + inward[1] * 0.006 : mesh.position.z,
      )
      scene.add(skirt)
    }
  }

  // Portas: batente nos dois lados e folha aberta (75°) ou de correr ao lado do vão.
  const leafMat = cutMaterial('#e8e1d6', { roughness: 0.55 })
  const frameMat = cutMaterial('#d9d0c2', { roughness: 0.5 })
  const handleMat = material('#b9bcc0', { roughness: 0.25, metalness: 0.9 })
  for (const door of world.doors) {
    const horizontal = door.side === 'top' || door.side === 'bottom'
    const [ax, az] = horizontal ? [1, 0] : [0, 1]
    const dir = Math.sign(horizontal ? door.freeX - door.hingeX : door.freeZ - door.hingeZ) || 1
    const midX = (door.hingeX + door.freeX) / 2
    const midZ = (door.hingeZ + door.freeZ) / 2
    // batente
    for (const end of [-1, 1]) {
      const jamb = box(
        horizontal ? 0.05 : WALL_THICKNESS + 0.04,
        DOOR_HEIGHT,
        horizontal ? WALL_THICKNESS + 0.04 : 0.05,
        frameMat,
      )
      jamb.position.set(
        midX + ax * end * (door.widthM / 2),
        DOOR_HEIGHT / 2,
        midZ + az * end * (door.widthM / 2),
      )
      structure.add(jamb)
    }
    const head = box(
      horizontal ? door.widthM + 0.1 : WALL_THICKNESS + 0.04,
      0.05,
      horizontal ? WALL_THICKNESS + 0.04 : door.widthM + 0.1,
      frameMat,
    )
    head.position.set(midX, DOOR_HEIGHT + 0.025, midZ)
    structure.add(head)
    // folha
    const leafW = door.widthM - 0.03
    const leaf = new Group()
    const panel = box(leafW, DOOR_HEIGHT - 0.02, 0.035, leafMat)
    panel.position.set(leafW / 2, (DOOR_HEIGHT - 0.02) / 2 + 0.01, 0)
    leaf.add(panel)
    for (const s of [-1, 1]) {
      const knob = box(0.12, 0.02, 0.03, handleMat)
      knob.position.set(leafW - 0.08, 1.0, s * 0.035)
      leaf.add(knob)
    }
    const inward = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] }[door.side]
    const [nx, nz] = [inward[0] * door.into, inward[1] * door.into]
    // A folha começa no eixo (dobradiça → ponta livre) e gira 75° para o lado da abertura.
    const along = Math.atan2(-(az * dir), ax * dir)
    if (door.sliding) {
      // De correr: folha aberta encostada na parede, ao lado do vão.
      leaf.rotation.y = along
      leaf.position.set(
        door.hingeX + nx * 0.06 - ax * dir * leafW * 0.85,
        0,
        door.hingeZ + nz * 0.06 - az * dir * leafW * 0.85,
      )
    } else {
      leaf.position.set(door.hingeX, 0, door.hingeZ)
      // sentido do giro: a ponta livre vai para (nx, nz)
      const toward = Math.atan2(-nz, nx)
      const diff = Math.atan2(Math.sin(toward - along), Math.cos(toward - along))
      leaf.rotation.y = along + (Math.sign(diff) * (Math.PI * 75)) / 180
    }
    structure.add(leaf)
  }

  const builtIns: Group[] = []
  // Armários das fotos (já estão no imóvel): na medida, na parede onde a foto mostra.
  furnished.forEach(({ room, fixed, builtInDefs, layout }) => {
    const o = layout.origin ?? room
    builtInDefs.forEach((b, i) => {
      const p = fixed[i]
      const sideways = p.facing === 'left' || p.facing === 'right'
      const [w, d] = sideways ? [p.d / 100, p.w / 100] : [p.w / 100, p.d / 100]
      const g = builtInModel(b, w, d, p.height / 100)
      g.rotation.y = { down: 0, up: Math.PI, right: Math.PI / 2, left: -Math.PI / 2 }[p.facing]
      g.position.set(o.xM + (p.x + p.w / 2) / 100, p.elevation / 100, o.yM + (p.y + p.d / 2) / 100)
      g.userData.aboveCut = p.elevation / 100 >= ORBIT_CUT
      scene.add(g)
      builtIns.push(g)
    })
  })

  // Móveis.
  const pickables: Object3D[] = []
  const items = new Map<string, Group>()
  furnished.forEach(({ room, layout }) => {
    const o = layout.origin ?? room
    for (const p of layout.placed) {
      const sideways = p.facing === 'left' || p.facing === 'right'
      const [w, d] = sideways ? [p.d / 100, p.w / 100] : [p.w / 100, p.d / 100]
      const g = furnitureModel(p.category, w, d, Math.max(0.01, p.height / 100), p.placement, {
        againstWall: p.againstWall,
      })
      g.rotation.y = { down: 0, up: Math.PI, right: Math.PI / 2, left: -Math.PI / 2 }[p.facing]
      g.position.set(
        o.xM + (p.x + p.w / 2) / 100,
        p.elevation / 100 + (p.placement === 'rug' ? 0.004 : 0),
        o.yM + (p.y + p.d / 2) / 100,
      )
      const id = itemId(p)
      g.traverse((o) => (o.userData.id = id))
      // Na maquete (paredes cortadas), o que fica acima do corte (ar-condicionado) parece flutuar.
      g.userData.aboveCut = p.elevation / 100 >= ORBIT_CUT
      scene.add(g)
      items.set(id, g)
      pickables.push(g)
    }
  })

  // ---------- controles ----------
  let mode: ViewMode = 'orbit'
  let selected: string | undefined
  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.enableDamping = true
  orbit.maxPolarAngle = Math.PI / 2.1
  orbit.minDistance = 2
  orbit.maxDistance = span * 3
  orbit.target.set(cx, 0.5, cz)
  const orbitHome = () => {
    camera.position.set(cx + span * 0.35, span * 1.05 + 2, cz + span * 0.95)
    orbit.target.set(cx, 0.5, cz)
  }
  orbitHome()

  const first = startRoom(model, world)
  const entrance = world.entrances.find((e) => e.room === first)
  const atDoor = entrance && {
    x: entrance.x - entrance.nx * 0.7,
    z: entrance.z - entrance.nz * 0.7,
  }
  // Começa logo depois da porta de entrada; se tiver móvel ali, no ponto livre do cômodo.
  const blocked = (p: { x: number; z: number }) =>
    blockers.some(
      (b) => p.x > b.minX - 0.3 && p.x < b.maxX + 0.3 && p.z > b.minZ - 0.3 && p.z < b.maxZ + 0.3,
    )
  const spawn = atDoor && !blocked(atDoor) ? atDoor : freeSpot(model, layouts, first)
  // Olhar para dentro de casa: a frente é (−sen yaw, −cos yaw) e a normal da entrada aponta para fora.
  const spawnYaw = entrance ? Math.atan2(entrance.nx, entrance.nz) : 0
  const walker = { x: spawn.x, z: spawn.z, yaw: spawnYaw, pitch: 0 }

  const roomAt = (x: number, z: number) =>
    model.rooms.findIndex(
      (r) => x >= r.xM && x <= r.xM + r.widthM && z >= r.yM && z <= r.yM + r.depthM,
    )
  let currentRoom = -1

  // Altura de cada peça da estrutura (calculada uma vez), para o corte da maquete.
  const pieces = structure.children.map((obj) => {
    const bounds = new Box3().setFromObject(obj)
    return { obj, bottom: bounds.min.y, top: bounds.max.y, y: obj.position.y }
  })
  const applyCut = (on: boolean) => {
    for (const { obj, bottom, top, y } of pieces) {
      obj.visible = !on || bottom < ORBIT_CUT - 0.001
      const s =
        on && top > ORBIT_CUT && bottom < ORBIT_CUT ? (ORBIT_CUT - bottom) / (top - bottom) : 1
      // Achata em volta da base: a base fica onde estava e o topo vai para ORBIT_CUT.
      obj.scale.y = s
      obj.position.y = bottom - (bottom - y) * s
    }
    for (const c of ceilings) c.visible = !on
    for (const g of [...items.values(), ...builtIns]) if (g.userData.aboveCut) g.visible = !on
  }
  applyCut(true)

  const setMode = (next: ViewMode) => {
    mode = next
    orbit.enabled = next === 'orbit'
    applyCut(next === 'orbit')
    camera.fov = next === 'orbit' ? 50 : 70
    camera.updateProjectionMatrix()
    if (next === 'orbit') orbitHome()
    callbacks.onMode(next)
  }

  // Teclado (WASD / setas) e olhar arrastando; no celular, metade esquerda = joystick.
  const keys = new Set<string>()
  const onKey = (e: KeyboardEvent) => {
    if (mode !== 'walk') return
    const k = e.key.toLowerCase()
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return
    e.preventDefault()
    if (e.type === 'keydown') keys.add(k)
    else keys.delete(k)
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)

  const joystick = { active: false, id: -1, x0: 0, y0: 0, dx: 0, dy: 0 }
  let look: { id: number; x: number; y: number; moved: number } | undefined
  let down: { x: number; y: number } | undefined
  const canvas = renderer.domElement
  canvas.style.touchAction = 'none'

  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY }
    if (mode !== 'walk') return
    const rect = canvas.getBoundingClientRect()
    if (e.pointerType === 'touch' && e.clientX - rect.left < rect.width * 0.4 && !joystick.active) {
      Object.assign(joystick, {
        active: true,
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        dx: 0,
        dy: 0,
      })
    } else {
      look = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }
    }
    canvas.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (joystick.active && e.pointerId === joystick.id) {
      joystick.dx = Math.max(-1, Math.min(1, (e.clientX - joystick.x0) / 50))
      joystick.dy = Math.max(-1, Math.min(1, (e.clientY - joystick.y0) / 50))
    } else if (look && e.pointerId === look.id) {
      const dx = e.clientX - look.x
      const dy = e.clientY - look.y
      look.moved += Math.abs(dx) + Math.abs(dy)
      walker.yaw -= dx * 0.005
      walker.pitch = Math.max(-1.1, Math.min(1.1, walker.pitch - dy * 0.004))
      look.x = e.clientX
      look.y = e.clientY
    }
  }
  const raycaster = new Raycaster()
  const pick = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    raycaster.setFromCamera(
      new Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    )
    const hit = raycaster.intersectObjects(pickables, true)[0]
    const id = hit?.object.userData.id as string | undefined
    select(id)
    callbacks.onPick(id)
  }
  const onUp = (e: PointerEvent) => {
    if (joystick.active && e.pointerId === joystick.id) {
      Object.assign(joystick, { active: false, dx: 0, dy: 0 })
      return
    }
    if (look && e.pointerId === look.id) look = undefined
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6 && mode !== 'tour') {
      pick(e.clientX, e.clientY)
    }
    down = undefined
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  const select = (id: string | undefined) => {
    if (selected) {
      items.get(selected)?.traverse((o) => {
        if (o instanceof Mesh && o.userData.highlight) {
          o.material = o.userData.highlight
          delete o.userData.highlight
        }
      })
    }
    selected = id
    if (!id) return
    items.get(id)?.traverse((o) => {
      if (o instanceof Mesh) {
        const original = o.material as MeshStandardMaterial
        const lit = original.clone()
        lit.emissive = new Color('#7a3512')
        lit.emissiveIntensity = 0.45
        o.userData.highlight = original
        o.material = lit
      }
    })
  }

  // ---------- tour ----------
  const route = tourPath(model, world, layouts)
  let tour:
    | {
        leg: number
        t: number
        pause: number
        recorder?: MediaRecorder
        /** Já pediu para terminar (esperando o vídeo fechar). */
        ending?: boolean
        chunks: Blob[]
        onEnd: (video?: Blob) => void
      }
    | undefined

  const finishTour = (video?: Blob) => {
    const done = tour?.onEnd
    tour = undefined
    if (mode === 'tour') setMode('walk')
    done?.(video)
  }
  /** Termina o tour; gravando, espera o vídeo fechar (onstop) para entregar. */
  const endTour = () => {
    if (!tour || tour.ending) return
    tour.ending = true
    if (tour.recorder && tour.recorder.state !== 'inactive') tour.recorder.stop()
    else finishTour()
  }

  const startTour: HouseScene['startTour'] = ({ record, onEnd }) => {
    if (route.stops.length < 1) return onEnd()
    setMode('tour')
    const s = route.stops[0]
    Object.assign(walker, { x: s.x, z: s.z, pitch: -0.08 })
    tour = { leg: 0, t: 0, pause: TOUR_PAUSE, chunks: [], onEnd }
    if (record && typeof MediaRecorder !== 'undefined' && canvas.captureStream) {
      const type = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) =>
        MediaRecorder.isTypeSupported(t),
      )
      try {
        const recorder = new MediaRecorder(canvas.captureStream(30), {
          ...(type && { mimeType: type }),
          videoBitsPerSecond: 8_000_000,
        })
        const current = tour
        recorder.ondataavailable = (e) => {
          if (e.data.size) current.chunks.push(e.data)
        }
        recorder.onstop = () => finishTour(new Blob(current.chunks, { type: recorder.mimeType }))
        recorder.start(500)
        tour.recorder = recorder
      } catch {
        // sem gravação neste navegador: o tour roda igual
      }
    }
  }
  const stopTour = endTour

  const angleTo = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

  const stepTour = (dt: number) => {
    if (!tour || tour.ending) return
    const stops = route.stops
    const here = stops[tour.leg]
    if (tour.pause > 0) {
      // Parado no cômodo: olha em volta devagar.
      tour.pause -= dt
      walker.yaw += dt * 0.55
      return
    }
    const next = stops[tour.leg + 1]
    if (!next) return endTour()
    const dist = Math.hypot(next.x - here.x, next.z - here.z)
    tour.t += dist > 0 ? (dt * TOUR_SPEED) / dist : 1
    const t = Math.min(1, tour.t)
    walker.x = here.x + (next.x - here.x) * t
    walker.z = here.z + (next.z - here.z) * t
    if (dist > 0.05) {
      const target = Math.atan2(-(next.x - here.x), -(next.z - here.z))
      walker.yaw += angleTo(walker.yaw, target) * Math.min(1, dt * 3)
    }
    if (tour.t >= 1) {
      tour.leg++
      tour.t = 0
      tour.pause = next.pause ? TOUR_PAUSE : 0
    }
  }

  // ---------- laço ----------
  // Realista: oclusão de ambiente (sombra suave nos cantos, sob e atrás dos móveis).
  const composer = kit ? new EffectComposer(renderer) : undefined
  if (composer) {
    composer.addPass(new RenderPass(scene, camera))
    const ao = new GTAOPass(scene, camera, 512, 512)
    ao.blendIntensity = 0.85
    ao.updateGtaoMaterial({ radius: 0.5, distanceFallOff: 1, thickness: 1 })
    composer.addPass(ao)
    composer.addPass(new OutputPass())
  }
  const draw = () => (composer ? composer.render() : renderer.render(scene, camera))

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container
    renderer.setSize(w, h, false)
    composer?.setSize(w, h)
    camera.aspect = w / Math.max(1, h)
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  let last = performance.now()
  let frame = 0
  const forward = new Vector3()
  const loop = (now: number) => {
    // Tempo real (até 0,25 s por quadro): em aparelho fraco o tour não fica em câmera lenta.
    const dt = Math.min(0.25, (now - last) / 1000)
    last = now
    if (mode === 'orbit') {
      orbit.update()
    } else {
      if (mode === 'walk') {
        let f = joystick.active ? -joystick.dy : 0
        let s = joystick.active ? joystick.dx : 0
        if (keys.has('w') || keys.has('arrowup')) f += 1
        if (keys.has('s') || keys.has('arrowdown')) f -= 1
        if (keys.has('a')) s -= 1
        if (keys.has('d')) s += 1
        if (keys.has('arrowleft')) walker.yaw += dt * 1.8
        if (keys.has('arrowright')) walker.yaw -= dt * 1.8
        if (f || s) {
          const len = Math.hypot(f, s) || 1
          const sp = (WALK_SPEED * dt) / Math.max(1, len)
          const dx = (-Math.sin(walker.yaw) * f + Math.cos(walker.yaw) * s) * sp
          const dz = (-Math.cos(walker.yaw) * f - Math.sin(walker.yaw) * s) * sp
          Object.assign(walker, move(walker, dx, dz, blockers))
        }
      } else {
        stepTour(dt)
      }
      camera.position.set(walker.x, EYE_HEIGHT, walker.z)
      forward.set(
        -Math.sin(walker.yaw) * Math.cos(walker.pitch),
        Math.sin(walker.pitch),
        -Math.cos(walker.yaw) * Math.cos(walker.pitch),
      )
      camera.lookAt(camera.position.clone().add(forward))
      const room = roomAt(walker.x, walker.z)
      if (room >= 0 && room !== currentRoom) {
        currentRoom = room
        callbacks.onRoom(room)
      }
    }
    if (!tracing) draw()
    frame = requestAnimationFrame(loop)
  }
  frame = requestAnimationFrame(loop)

  /** Render de alta qualidade em andamento (o laço normal não desenha por cima). */
  let tracing = false
  const renderRealistic: HouseScene['renderRealistic'] = () => {
    let cancelled = false
    const done = (async () => {
      if (!kit || tracing) return undefined
      tracing = true
      const ratio = renderer.getPixelRatio()
      const size = renderer.getSize(new Vector2())
      const hq = new EffectComposer(renderer)
      try {
        // 2× a resolução da tela e 8 amostras por pixel: bordas lisas, textura nítida.
        renderer.setPixelRatio(Math.min(4, ratio * 2))
        const ssaa = new SSAARenderPass(scene, camera)
        ssaa.sampleLevel = 3
        ssaa.unbiased = true
        hq.addPass(ssaa)
        const ao = new GTAOPass(scene, camera, size.x, size.y)
        ao.blendIntensity = 1
        ao.updateGtaoMaterial({ radius: 0.6, distanceFallOff: 1, thickness: 1, samples: 24 })
        ao.updatePdMaterial({
          lumaPhi: 10,
          depthPhi: 2,
          normalPhi: 3,
          radius: 6,
          rings: 2,
          samples: 16,
        })
        hq.addPass(ao)
        hq.addPass(new OutputPass())
        hq.setSize(size.x, size.y)
        await new Promise((next) => requestAnimationFrame(next))
        if (cancelled) return undefined
        hq.render()
        return renderer.domElement.toDataURL('image/png')
      } finally {
        hq.dispose()
        renderer.setPixelRatio(ratio)
        resize()
        tracing = false
      }
    })()
    return { done, cancel: () => (cancelled = true) }
  }

  return {
    setMode: (next) => {
      if (tour) stopTour()
      if (next === 'walk' && mode !== 'walk') {
        Object.assign(walker, { x: spawn.x, z: spawn.z, yaw: spawnYaw, pitch: 0 })
        currentRoom = -1
      }
      setMode(next)
    },
    startTour,
    stopTour,
    select,
    renderRealistic,
    screenshot: () => {
      if (!tracing) draw()
      return canvas.toDataURL('image/png')
    },
    state: () => ({
      mode,
      x: walker.x,
      z: walker.z,
      room: currentRoom,
      tour: tour ? tour.leg / Math.max(1, route.stops.length - 1) : 0,
    }),
    screenPosition: (id) => {
      const g = items.get(id)
      if (!g) return undefined
      const p = g.getWorldPosition(new Vector3())
      p.y += 0.3
      const projected = p.project(camera)
      if (projected.z > 1) return undefined
      const rect = canvas.getBoundingClientRect()
      return { x: ((projected.x + 1) / 2) * rect.width, y: ((1 - projected.y) / 2) * rect.height }
    },
    dispose: () => {
      cancelAnimationFrame(frame)
      if (tour?.recorder && tour.recorder.state !== 'inactive') {
        tour.recorder.onstop = null
        tour.recorder.stop()
      }
      tour = undefined
      observer.disconnect()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      orbit.dispose()
      scene.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose()
          const m = o.material as MeshStandardMaterial
          m.map?.dispose()
          m.dispose()
        }
      })
      disposeMaterials()
      composer?.dispose()
      setRealistic(undefined)
      renderer.dispose()
      canvas.remove()
    },
  }
}
