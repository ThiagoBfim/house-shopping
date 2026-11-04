/**
 * Cena 3D de um cômodo (three.js), a partir do mesmo layout da vista de cima. Carregado só
 * quando a pessoa abre o 3D (import dinâmico): não pesa no site de quem não usa.
 * Unidades: 1 = 1 metro; x da planta → x, y da planta → z, altura → y.
 */
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { PlacedItem, RoomLayout } from '../engine/layout.ts'

const WALL_HEIGHT = 2.6
const WALL_THICKNESS = 0.1
const DOOR_HEIGHT = 2.1
const WINDOW_SILL = 1.0
const WINDOW_TOP = 2.1

/** Cor por tipo de móvel (tons suaves; a parede e o chão ficam neutros). */
const COLORS: Record<string, string> = {
  'cama-box': '#c9b79c',
  berco: '#e8d8b0',
  'guarda-roupa': '#a0785a',
  'guarda-roupa-infantil': '#b98d6b',
  comoda: '#a0785a',
  'comoda-trocador': '#b98d6b',
  'criado-mudo': '#8b6a50',
  sofa: '#6f8fa6',
  poltrona: '#8aa3b5',
  'poltrona-amamentacao': '#8aa3b5',
  rack: '#7a5c45',
  'mesa-de-centro': '#9a7b5f',
  'mesa-de-jantar': '#9a7b5f',
  'mesa-externa': '#9a7b5f',
  'mesa-escritorio': '#9a7b5f',
  'mesa-regulavel': '#9a7b5f',
  geladeira: '#d9dde0',
  freezer: '#d9dde0',
  fogao: '#b8bec3',
  'lava-loucas': '#c7ccd0',
  'lava-roupas': '#e4e7ea',
  tapete: '#d8c3a5',
  tv: '#222222',
  'ar-condicionado': '#f2f2f2',
}

export interface Room3D {
  /** Destaca e enquadra um móvel (tocado na cena ou escolhido na lista). */
  select: (id: string | undefined) => void
  /** Posição na tela (px dentro do canvas) do centro de um móvel; para testes. */
  screenPosition: (id: string) => { x: number; y: number } | undefined
  dispose: () => void
}

/** Id de cada móvel na cena: chave do item + unidade (criado-mudo 0 e 1). */
export const itemId = (p: Pick<PlacedItem, 'key' | 'unit'>) => `${p.key}#${p.unit}`

export function mountRoom3D(
  container: HTMLElement,
  layout: RoomLayout,
  onPick: (id: string | undefined) => void,
): Room3D {
  const W = layout.width / 100
  const D = layout.depth / 100
  const scene = new Scene()
  scene.background = new Color('#f4f2ee')

  const camera = new PerspectiveCamera(50, 1, 0.05, 100)
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  scene.add(new AmbientLight('#ffffff', 1.6))
  const sun = new DirectionalLight('#ffffff', 1.8)
  sun.position.set(W * 0.3, 6, D * 1.2)
  scene.add(sun)

  const box = (w: number, h: number, d: number, color: string, opacity = 1) => {
    const mesh = new Mesh(
      new BoxGeometry(w, h, d),
      new MeshStandardMaterial({ color, transparent: opacity < 1, opacity, roughness: 0.85 }),
    )
    return mesh
  }

  // Chão
  const floor = box(W, 0.02, D, '#e9e4dc')
  floor.position.set(W / 2, -0.01, D / 2)
  scene.add(floor)

  // Paredes: trechos cheios entre as aberturas; porta com verga, janela com peitoril e vidro.
  const wallColor = '#fbfaf8'
  /** Peças de cada parede, para o corte: a parede entre a câmera e o cômodo fica transparente. */
  const wallMeshes: Record<'top' | 'right' | 'bottom' | 'left', { mesh: Mesh; opacity: number }[]> =
    {
      top: [],
      right: [],
      bottom: [],
      left: [],
    }
  for (const wall of ['top', 'right', 'bottom', 'left'] as const) {
    const horizontal = wall === 'top' || wall === 'bottom'
    const length = horizontal ? W : D
    const openings = layout.openings
      .filter((o) => o.wall === wall)
      .map((o) => {
        const a = Math.max(0, o.position * length - o.widthCm / 200)
        return { ...o, a, b: Math.min(length, a + o.widthCm / 100) }
      })
      .sort((p, q) => p.a - q.a)
    const piece = (
      from: number,
      to: number,
      bottom: number,
      top: number,
      color = wallColor,
      opacity = 1,
    ) => {
      if (to - from <= 0.001 || top - bottom <= 0.001) return
      const mesh = horizontal
        ? box(to - from, top - bottom, WALL_THICKNESS, color, opacity)
        : box(WALL_THICKNESS, top - bottom, to - from, color, opacity)
      const along = (from + to) / 2
      const fixed = {
        top: -WALL_THICKNESS / 2,
        bottom: D + WALL_THICKNESS / 2,
        left: -WALL_THICKNESS / 2,
        right: W + WALL_THICKNESS / 2,
      }[wall]
      mesh.position.set(horizontal ? along : fixed, (bottom + top) / 2, horizontal ? fixed : along)
      scene.add(mesh)
      wallMeshes[wall].push({ mesh, opacity })
    }
    let cursor = 0
    for (const o of openings) {
      piece(cursor, o.a, 0, WALL_HEIGHT)
      if (o.kind === 'door') {
        piece(o.a, o.b, DOOR_HEIGHT, WALL_HEIGHT)
      } else {
        piece(o.a, o.b, 0, WINDOW_SILL)
        piece(o.a, o.b, WINDOW_TOP, WALL_HEIGHT)
        piece(o.a, o.b, WINDOW_SILL, WINDOW_TOP, '#9cc8ec', 0.35)
      }
      cursor = Math.max(cursor, o.b)
    }
    piece(cursor, length, 0, WALL_HEIGHT)
  }

  // Móveis: volumes na medida, com as arestas marcadas.
  const meshes = new Map<string, Mesh>()
  const edges = new Map<string, LineSegments>()
  for (const p of layout.placed) {
    const height = (p.placement === 'rug' ? 1 : p.height) / 100
    const mesh = box(p.w / 100, height, p.d / 100, COLORS[p.category] ?? '#b9b2a8')
    mesh.position.set((p.x + p.w / 2) / 100, p.elevation / 100 + height / 2, (p.y + p.d / 2) / 100)
    mesh.userData.id = itemId(p)
    scene.add(mesh)
    meshes.set(itemId(p), mesh)
    const line = new LineSegments(
      new EdgesGeometry(mesh.geometry),
      new LineBasicMaterial({ color: '#3a3530', transparent: true, opacity: 0.45 }),
    )
    line.position.copy(mesh.position)
    scene.add(line)
    edges.set(itemId(p), line)
  }

  // Câmera de canto, de cima, enquadrando o cômodo.
  const center = new Vector3(W / 2, 0.6, D / 2)
  const distance = Math.max(W, D) * 1.35 + 1
  camera.position.set(W / 2 + distance * 0.55, distance * 0.95, D / 2 + distance * 0.8)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.copy(center)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2.05
  controls.minDistance = 1
  controls.maxDistance = distance * 2.5

  const select = (id: string | undefined) => {
    for (const [key, line] of edges) {
      const material = line.material as LineBasicMaterial
      material.color.set(key === id ? '#b4441c' : '#3a3530')
      material.opacity = key === id ? 1 : 0.45
    }
    for (const [key, mesh] of meshes) {
      const material = mesh.material as MeshStandardMaterial
      material.emissive.set(key === id ? '#5a2a10' : '#000000')
    }
  }

  // Toque/clique (sem arrastar) escolhe o móvel sob o dedo.
  const raycaster = new Raycaster()
  let down: { x: number; y: number } | undefined
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY })
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return
    const rect = renderer.domElement.getBoundingClientRect()
    const pointer = new Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects([...meshes.values()])[0]
    const id = hit?.object.userData.id as string | undefined
    select(id)
    onPick(id)
  }
  renderer.domElement.addEventListener('pointerdown', onDown)
  renderer.domElement.addEventListener('pointerup', onUp)

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(1, h)
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  let frame = 0
  /** Corte: parede do lado da câmera quase transparente (atualiza ao girar). */
  const cutaway = () => {
    const { x, z } = camera.position
    const near = { top: z < 0, bottom: z > D, left: x < 0, right: x > W }
    for (const [wall, pieces] of Object.entries(wallMeshes) as [
      keyof typeof near,
      typeof wallMeshes.top,
    ][]) {
      for (const { mesh, opacity } of pieces) {
        const material = mesh.material as MeshStandardMaterial
        material.transparent = near[wall] || opacity < 1
        material.opacity = near[wall] ? Math.min(opacity, 0.12) : opacity
        material.depthWrite = !near[wall]
      }
    }
  }

  const loop = () => {
    controls.update()
    cutaway()
    renderer.render(scene, camera)
    frame = requestAnimationFrame(loop)
  }
  loop()

  return {
    select,
    screenPosition: (id) => {
      const mesh = meshes.get(id)
      if (!mesh) return undefined
      const top = new Box3().setFromObject(mesh).getCenter(new Vector3())
      top.y = new Box3().setFromObject(mesh).max.y
      const projected = top.project(camera)
      const rect = renderer.domElement.getBoundingClientRect()
      return { x: ((projected.x + 1) / 2) * rect.width, y: ((1 - projected.y) / 2) * rect.height }
    },
    dispose: () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      scene.traverse((object) => {
        if (object instanceof Mesh || object instanceof LineSegments) {
          object.geometry.dispose()
          ;(object.material as MeshStandardMaterial).dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
