import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenBook, curve, readAt } from './open'
import {
  digest,
  fakeCanvas2d,
  fakeThree,
  panel,
  testBook,
  type FakeContext,
} from './testing.test-helpers'
import type { GlBook } from './types'
import * as THREE from './vendor/three.module.min.js'
import type {
  Group,
  Mesh,
  MeshStandardMaterial,
} from './vendor/three.module.min.js'

const T = fakeThree()
const look = { dark: false, bend: true, pagePx: 100 }
let contexts: Map<HTMLCanvasElement, FakeContext>

beforeEach(() => {
  contexts = fakeCanvas2d()
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
})

afterEach(() => {
  vi.restoreAllMocks()
})

const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
const group = (o: OpenBook) => o.scene.children[3] as Group
/** the image on a mesh's material map: a panel id or a canvas */
const imageOf = (m: unknown) => {
  const mat = (m as Mesh).material as MeshStandardMaterial
  const img = mat.map?.image as { id?: string } | undefined
  return img instanceof HTMLCanvasElement ? 'canvas' : img?.id
}
/** the book's meshes (the boards sit in pivot groups) */
const meshes = (o: OpenBook) =>
  group(o).children.filter((c): c is Mesh => 'geometry' in c)
const tops = (o: OpenBook) =>
  meshes(o)
    .filter((m) => (m.material as MeshStandardMaterial).polygonOffset)
    .map(imageOf)

describe('curve', () => {
  it('walks N segments of arc length W / N from (0, y0)', () => {
    const flat = curve(7.2, 1, () => 0)
    const up = curve(7.2, 0, () => Math.PI / 2)

    expect(flat).toHaveLength(73)
    expect(flat[0]).toEqual([0, 1])
    expect(flat[1]?.[0]).toBeCloseTo(0.1)
    expect(flat[72]?.[0]).toBeCloseTo(7.2)
    expect(flat[72]?.[1]).toBe(1)
    expect(up[72]?.[1]).toBeCloseTo(7.2)
  })

  it('samples the angle at segment midpoints', () => {
    const at: number[] = []

    curve(1, 0, (t) => {
      at.push(t)
      return 0
    })

    expect(at[0]).toBeCloseTo(0.5 / 72)
    expect(at.at(-1)).toBeCloseTo(71.5 / 72)
  })
})

describe('readAt', () => {
  it('piles read pages up from view 1 to the last spread', () => {
    expect([0, 1, 3, 5, 6, 9].map((v) => readAt(8, v))).toEqual([
      0, 0, 0.4, 0.8, 1, 1,
    ])
  })
})

describe('OpenBook', () => {
  it('lights the scene and frames its floor', () => {
    const light = new OpenBook(T, testBook(), look)
    const dark = new OpenBook(T, testBook(), { ...look, dark: true })

    expect(light.scene.children.map((c) => digest(c))).toMatchSnapshot()
    expect(
      dark.scene.children.slice(0, 3).map((c) => digest(c)),
    ).toMatchSnapshot()
    expect([light.n, light.W, light.H]).toEqual([13, 20, 25])
    expect(light.block).toBeCloseTo(1.2)
  })

  it('paints the paper bump and the blank page', () => {
    new OpenBook(T, testBook(), look)

    const painted = [...contexts].map(([c, { calls }]) => [
      c.width,
      c.height,
      calls.length,
      ...calls.slice(0, 2),
    ])
    expect(painted).toContainEqual([
      256,
      256,
      4,
      ['set fillStyle', '#808080'],
      ['fillRect', 0, 0, 256, 256],
    ])
    expect(painted).toContainEqual([
      64,
      80,
      2,
      ['set fillStyle', '#FBFAF7'],
      ['fillRect', 0, 0, 64, 80],
    ])
  })

  it.each([
    [0, 0],
    [0, 90],
    [1, 0],
    [3, 60],
    [11, 0],
    [11, 90],
    [11, 180],
  ])('builds view %i with the leaf at %i°', (a, th) => {
    const o = new OpenBook(T, testBook(), look)

    o.set(a, th)

    expect(digest(group(o))).toMatchSnapshot()
  })

  it('turns a flat leaf without the bend', () => {
    const bent = new OpenBook(T, testBook(), look)
    const flat = new OpenBook(T, testBook(), { ...look, bend: false })

    bent.set(3, 90)
    flat.set(3, 90)

    const leafTip = (o: OpenBook) => {
      const leaf = group(o).children.at(-3) as Mesh
      leaf.geometry.computeBoundingBox()
      return leaf.geometry.boundingBox?.max.y ?? 0
    }
    expect(leafTip(flat) - leafTip(bent)).toBeGreaterThan(0.5)
    expect(digest(group(flat))).toMatchSnapshot()
  })

  it('shows paper until a face lands, then the page and the endpaper', async () => {
    const face = vi.fn((page: number) =>
      Promise.resolve(panel(`page ${String(page)}`)),
    )
    const o = new OpenBook(T, testBook({ face }), look)
    const changed = vi.fn()
    o.onChange = changed

    o.set(1, 0)

    expect(o.loading).toBe(true)
    expect(tops(o)).toEqual(['canvas', 'canvas'])
    expect(face.mock.calls.map(([p]) => p)).toEqual([0, 1, 2, 3, 4])
    await settle()
    expect(o.loading).toBe(false)
    expect(changed).toHaveBeenCalledTimes(6)
    o.set(1, 0)
    expect(tops(o)).toEqual(['canvas', 'page 0'])
    const endpaper = (
      meshes(o).find((m) => (m.material as MeshStandardMaterial).polygonOffset)
        ?.material as MeshStandardMaterial
    ).map?.image as HTMLCanvasElement
    expect([endpaper.width, endpaper.height]).toEqual([100, 125])
    expect(contexts.get(endpaper)?.calls.slice(0, 2)).toEqual([
      ['set fillStyle', '#E9E4DA'],
      ['fillRect', 0, 0, 100, 125],
    ])
    expect(contexts.get(endpaper)?.put).toBeDefined()
  })

  it('keeps the faces of the spreads around the view only', async () => {
    const face = vi.fn((page: number) =>
      Promise.resolve(panel(`page ${String(page)}`)),
    )
    const o = new OpenBook(T, testBook({ face }), look)
    o.set(1, 0)
    await settle()
    const disposed = vi.spyOn(THREE.Texture.prototype, 'dispose')
    face.mockClear()

    o.set(4, 0)

    expect(face.mock.calls.map(([p]) => p)).toEqual([5, 6, 7, 8, 9, 10])
    expect(disposed).toHaveBeenCalledTimes(4)
    o.set(5, 0)
    expect(face.mock.calls.map(([p]) => p)).toEqual([5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('asks again for faces it dropped on the way back', async () => {
    const face = vi.fn((page: number) =>
      Promise.resolve(panel(`page ${String(page)}`)),
    )
    const o = new OpenBook(T, testBook({ face }), look)
    o.set(1, 0)
    o.set(5, 0)
    await settle()
    const disposed = vi.spyOn(THREE.Texture.prototype, 'dispose')
    face.mockClear()

    o.set(2, 0)

    expect(face.mock.calls.map(([p]) => p)).toEqual([0, 1, 2, 3, 4])
    // views 5…7 go, view 4 stays
    expect(disposed).toHaveBeenCalledTimes(6)
  })

  it('ignores a face that lands after its spread was dropped', async () => {
    const o = new OpenBook(T, testBook(), look)
    const changed = vi.fn()
    o.onChange = changed

    o.set(1, 0)
    o.set(8, 0)
    await settle()

    expect(o.loading).toBe(false)
    // views 7…10, two faces each
    expect(changed).toHaveBeenCalledTimes(8)
  })

  it('stays loading on a failed face and drops faces after dispose', async () => {
    let fail = true
    const face = (page: number) =>
      fail
        ? Promise.reject(new Error('no'))
        : Promise.resolve(panel(String(page)))
    const o = new OpenBook(T, testBook({ face }), look)
    const changed = vi.fn()
    o.onChange = changed

    o.set(2, 0)
    await settle()
    const failed = o.loading
    const late = new OpenBook(T, testBook({ face }), look)
    late.onChange = changed
    fail = false
    late.set(2, 0)
    late.dispose()
    await settle()

    expect(failed).toBe(true)
    // only the endpaper of the first book lands
    expect(changed).toHaveBeenCalledTimes(1)
  })

  it('paints the gutter band once', () => {
    const o = new OpenBook(T, testBook(), look)

    const gutters = () =>
      meshes(o).filter((m) => m.geometry.type === 'PlaneGeometry')
    o.set(2, 0)
    const first = gutters()[0]?.material
    o.set(3, 0)

    expect(gutters()).toHaveLength(1)
    expect(gutters()[0]?.material).toBe(first)
    const c = (first as MeshStandardMaterial).map?.image as HTMLCanvasElement
    expect(contexts.get(c)?.calls).toMatchSnapshot()
  })

  it('frames the camera on the book at s px per cm', () => {
    const o = new OpenBook(T, testBook(), look)
    const box = { x: 100, y: 50, w: 400, h: 300 }

    o.frame(800, 600, 10, box)
    o.cam.updateMatrixWorld(true)

    const px = (x: number, y: number, z: number) => {
      const v = new T.Vector3(x, y, z).project(o.cam)
      return [((v.x + 1) / 2) * box.w + box.x, ((1 - v.y) / 2) * box.h + box.y]
    }
    const [cx, cy] = px(0, 0.6, 0)
    expect(cx).toBeCloseTo(400, 3)
    expect(cy).toBeCloseTo(300, 3)
    expect((px(1, 0.6, 0)[0] ?? 0) - (cx ?? 0)).toBeCloseTo(10, 1)
    expect(digest(o.cam)).toMatchSnapshot()
    expect([o.cam.fov, o.cam.aspect, o.cam.near, o.cam.far]).toMatchSnapshot()
  })

  it('disposes every geometry, material and texture', async () => {
    const o = new OpenBook(T, testBook(), look)
    o.set(2, 30)
    await settle()
    const spies = [
      vi.spyOn(THREE.Material.prototype, 'dispose'),
      vi.spyOn(THREE.Texture.prototype, 'dispose'),
      vi.spyOn(THREE.BufferGeometry.prototype, 'dispose'),
    ]
    const changed = vi.fn()
    o.onChange = changed

    o.dispose()

    expect(spies.map((s) => s.mock.calls.length)).toMatchSnapshot()
  })
})

describe('book sizes', () => {
  it('uses the input page count for views and the block', () => {
    const b: GlBook = testBook({ pages: 4 })
    const o = new OpenBook(T, b, look)

    expect(o.n).toBe(5)
    expect(o.block).toBeCloseTo(0.4)
  })
})
