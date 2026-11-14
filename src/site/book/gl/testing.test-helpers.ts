/*
 * Test doubles of the GL book: a recording canvas 2D context (happy-dom has
 * none), the real three r170 with a fake WebGLRenderer (no WebGL), and a
 * compact digest of a scene graph for snapshots.
 */
import { vi } from 'vitest'
import type { Three } from './three'
import type { GlBook, GlCoverPanels } from './types'
import * as THREE from './vendor/three.module.min.js'
import type { Object3D } from './vendor/three.module.min.js'

export type Call = [string, ...unknown[]]

/** a call argument as text: canvases and images by size, numbers rounded */
const arg = (v: unknown): unknown => {
  if (typeof v === 'number') return Math.round(v * 1000) / 1000
  if (v instanceof HTMLCanvasElement) {
    return `canvas ${String(v.width)}×${String(v.height)}`
  }
  if (v instanceof Uint8ClampedArray) return `data ${String(v.length)}`
  if (v !== null && typeof v === 'object') {
    return 'id' in v ? `image ${String(v.id)}` : 'object'
  }
  return v
}

export interface FakeContext {
  calls: Call[]
  /** the last `putImageData` pixels */
  put: Uint8ClampedArray | undefined
}

/** recording 2D contexts for every canvas (`contexts.get(canvas)`); `getImageData` reads grey 128 */
export function fakeCanvas2d(): Map<HTMLCanvasElement, FakeContext> {
  const contexts = new Map<HTMLCanvasElement, FakeContext>()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement, kind: string) {
      if (kind !== '2d') return null
      const known = contexts.get(this)
      if (known) return (known as unknown as { proxy: never }).proxy
      const rec: FakeContext = { calls: [], put: undefined }
      const record = (name: string, args: unknown[]) =>
        rec.calls.push([name, ...args.map(arg)])
      const methods: Record<string, (...a: never[]) => unknown> = {
        getImageData: (x: number, y: number, w: number, h: number) => {
          record('getImageData', [x, y, w, h])
          return {
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4).fill(128),
          }
        },
        putImageData: (
          d: { data: Uint8ClampedArray },
          x: number,
          y: number,
        ) => {
          record('putImageData', [d.data, x, y])
          rec.put = d.data
        },
        createLinearGradient: (...a: number[]) => {
          record('createLinearGradient', a)
          return {
            addColorStop: (o: number, c: string) => {
              record('addColorStop', [o, c])
            },
          }
        },
      }
      const proxy = new Proxy(
        {},
        {
          get: (_, p: string) =>
            methods[p] ??
            ((...a: unknown[]) => {
              record(p, a)
            }),
          set: (_, p: string, v: unknown) => {
            record(`set ${p}`, typeof v === 'object' ? ['gradient'] : [v])
            return true
          },
        },
      )
      contexts.set(this, Object.assign(rec, { proxy }))
      return proxy as never
    },
  )
  return contexts
}

/** the fake renderer's calls, across instances */
export const rendererCalls: Call[] = []

/** the fake renderer's WebGL2 fences: `done` says whether the GPU has caught up; `lost`: no fences */
export const fakeGpu = {
  done: true,
  lost: false,
  SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
  SYNC_STATUS: 0x9114,
  SIGNALED: 0x9119,
  UNSIGNALED: 0x9118,
  fenceSync() {
    rendererCalls.push(['fenceSync'])
    return this.lost ? null : {}
  },
  flush() {
    rendererCalls.push(['flush'])
  },
  getSyncParameter() {
    return this.done ? this.SIGNALED : this.UNSIGNALED
  },
  deleteSync() {
    rendererCalls.push(['deleteSync'])
  },
}

class FakeRenderer {
  domElement = document.createElement('canvas')
  outputColorSpace = ''
  toneMapping = -1
  shadowMap = { enabled: false, type: -1 }
  capabilities = { getMaxAnisotropy: () => 16 }
  constructor(p: unknown) {
    rendererCalls.push(['new', p])
  }
  setPixelRatio(...a: unknown[]) {
    rendererCalls.push(['setPixelRatio', ...a])
  }
  setClearColor(...a: unknown[]) {
    rendererCalls.push(['setClearColor', ...a])
  }
  setSize(...a: unknown[]) {
    rendererCalls.push(['setSize', ...a])
  }
  setViewport(...a: unknown[]) {
    rendererCalls.push(['setViewport', ...a])
  }
  setScissor(...a: unknown[]) {
    rendererCalls.push(['setScissor', ...a])
  }
  setScissorTest(...a: unknown[]) {
    rendererCalls.push(['setScissorTest', ...a])
  }
  clear() {
    rendererCalls.push(['clear'])
  }
  getContext() {
    return fakeGpu as unknown as WebGL2RenderingContext
  }
  compileAsync(scene: Object3D) {
    rendererCalls.push([
      'compileAsync',
      scene.children.length,
      this.shadowMap.enabled,
    ])
    return Promise.resolve(scene)
  }
  render(scene: Object3D) {
    rendererCalls.push([
      'render',
      scene.children.length,
      this.shadowMap.enabled,
    ])
  }
}

/** three r170 with the fake renderer */
export const fakeThree = (): Three => ({
  ...THREE,
  WebGLRenderer: FakeRenderer,
})

/** a panel image stand-in: `drawImage` records it by id */
export const panel = (id: string): CanvasImageSource =>
  ({ id }) as unknown as CanvasImageSource

const cover: GlCoverPanels = {
  front: panel('front'),
  spine: panel('spine'),
  back: panel('back'),
}

/** a 200 × 250 mm book with 20 printed pages */
export function testBook(over: Partial<GlBook> = {}): GlBook {
  return {
    cover,
    cloth: '#334455',
    pages: 20,
    w: 20,
    h: 25,
    paper: '#FBFAF7',
    endpaper: '#E9E4DA',
    face: (page) => Promise.resolve(panel(`page ${String(page)}`)),
    ...over,
  }
}

interface Loose {
  type: string
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  children: Loose[]
  visible: boolean
  castShadow: boolean
  receiveShadow: boolean
  renderOrder: number
  intensity?: number
  color?: { getHexString(): string }
  groundColor?: { getHexString(): string }
  shadow?: {
    mapSize: { x: number; y: number }
    bias: number
    camera: { left: number; right: number; top: number; bottom: number }
  }
  geometry?: LooseGeometry
  material?: LooseMaterial | LooseMaterial[]
}
interface LooseAttribute {
  count: number
  array: ArrayLike<number>
}
interface LooseGeometry {
  type: string
  parameters?: Record<string, number | boolean>
  index: LooseAttribute | null
  attributes: {
    position: LooseAttribute
    uv?: LooseAttribute
    normal?: LooseAttribute
  }
  boundingBox: { min: Loose['position']; max: Loose['position'] } | null
  computeBoundingBox(): void
}
interface LooseMaterial {
  type: string
  color?: { getHexString(): string }
  roughness?: number
  side: number
  transparent: boolean
  depthWrite: boolean
  depthTest: boolean
  opacity: number
  map?: unknown
  bumpMap?: { repeat: { x: number; y: number } } | null
  bumpScale?: number
  polygonOffset?: boolean
}

const r3 = (n: number) => Math.round(n * 1000) / 1000
const xyz = (v: Loose['position']) => [r3(v.x), r3(v.y), r3(v.z)]

/** an attribute as `[count, order-sensitive checksum]` */
const sum = (a: LooseAttribute | null | undefined) =>
  a
    ? [
        a.count,
        r3(Array.from(a.array).reduce((s, v, i) => s + v * ((i % 7) + 1), 0)),
      ]
    : null

function material(m: LooseMaterial) {
  return {
    type: m.type,
    color: m.color?.getHexString(),
    roughness: m.roughness,
    side: m.side,
    transparent: m.transparent,
    depth: [m.depthTest, m.depthWrite],
    opacity: m.opacity,
    map: m.map ? arg((m.map as { image: unknown }).image) : undefined,
    bump: m.bumpMap
      ? [m.bumpMap.repeat.x, m.bumpMap.repeat.y, m.bumpScale]
      : undefined,
    polygonOffset: m.polygonOffset,
  }
}

function geometry(g: LooseGeometry) {
  g.computeBoundingBox()
  const params = Object.fromEntries(
    Object.entries(g.parameters ?? {}).map(([k, v]) => [
      k,
      typeof v === 'number' ? r3(v) : v,
    ]),
  )
  const box = g.boundingBox
  return {
    type: g.type,
    params,
    vertices: g.attributes.position.count,
    box: box ? [xyz(box.min), xyz(box.max)] : null,
    index: sum(g.index),
    uv: sum(g.attributes.uv),
    normal: sum(g.attributes.normal),
  }
}

/** the scene graph as plain data: transforms, geometry sizes, materials, lights */
export function digest(object: Object3D): unknown {
  const o = object as unknown as Loose
  const m = o.material
  return {
    type: o.type,
    pos: xyz(o.position),
    rot: xyz(o.rotation),
    flags: [o.visible, o.castShadow, o.receiveShadow, o.renderOrder],
    light:
      o.intensity === undefined
        ? undefined
        : [
            r3(o.intensity),
            o.color?.getHexString(),
            o.groundColor?.getHexString(),
          ],
    shadow: o.shadow && [
      o.shadow.mapSize.x,
      o.shadow.mapSize.y,
      o.shadow.bias,
      o.shadow.camera.left,
      o.shadow.camera.right,
      o.shadow.camera.top,
      o.shadow.camera.bottom,
    ],
    geo: o.geometry ? geometry(o.geometry) : undefined,
    mat:
      m === undefined
        ? undefined
        : Array.isArray(m)
          ? m.map(material)
          : material(m),
    children: o.children.map((c) => digest(c as unknown as Object3D)),
  }
}
