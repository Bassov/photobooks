import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OV, PageCurl, hex, sheetCanvas, type CurlSheet } from './curl'
import {
  digest,
  fakeCanvas2d,
  fakeThree,
  panel,
  rendererCalls,
  testBook,
  type FakeContext,
} from './testing.test-helpers'
import * as THREE from './vendor/three.module.min.js'
import type { Mesh, Scene, ShaderMaterial } from './vendor/three.module.min.js'

const T = fakeThree()
let contexts: Map<HTMLCanvasElement, FakeContext>

beforeEach(() => {
  contexts = fakeCanvas2d()
  rendererCalls.length = 0
})

afterEach(() => {
  vi.restoreAllMocks()
})

const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })

const sheets: CurlSheet[] = [
  { kind: 'cover' },
  { kind: 'page', page: 0 },
  { kind: 'spread', left: 1, right: 2 },
  { kind: 'spread', left: 3, right: 4 },
  { kind: 'page', page: 5 },
]

/** a uniform value as plain data */
const plain = (v: unknown): unknown => {
  if (v instanceof THREE.Texture) {
    const img = v.image
    return img instanceof HTMLCanvasElement
      ? `tex ${String(contexts.get(img)?.calls.find((c) => c[0] === 'drawImage')?.[1])}`
      : 'tex'
  }
  if (v !== null && typeof v === 'object' && 'x' in v) {
    return Object.values(v).map((n) => Math.round(Number(n) * 1000) / 1000)
  }
  return typeof v === 'number' ? Math.round(v * 1000) / 1000 : v
}
const uniformsOf = (m: Mesh) =>
  Object.fromEntries(
    Object.entries((m.material as ShaderMaterial).uniforms).map(([k, u]) => [
      k,
      plain(u.value),
    ]),
  )
/** the curl's scene, as drawn (the renderer gets it) */
const sceneOf = (curl: PageCurl) => (curl as unknown as { scene: Scene }).scene
const layers = (curl: PageCurl) => {
  const [under, shadow, top] = sceneOf(curl).children as Mesh[]
  return { under, shadow, top } as { under: Mesh; shadow: Mesh; top: Mesh }
}

describe('hex', () => {
  it('reads #RRGGBB as 0…1 channels', () => {
    expect(hex('#FF8000')).toEqual([1, 128 / 255, 0])
    expect(OV).toBe(24)
  })
})

describe('sheetCanvas', () => {
  it('paints the cover like the closed book', async () => {
    const c = await sheetCanvas(testBook(), { kind: 'cover' }, 80)

    expect([c.width, c.height]).toEqual([80, 100])
    expect(contexts.get(c)?.calls[2]).toEqual([
      'drawImage',
      'image front',
      0,
      0,
      80,
      100,
    ])
  })

  it('paints a page with the sheen', async () => {
    const c = await sheetCanvas(testBook(), { kind: 'page', page: 3 }, 80)

    expect(contexts.get(c)?.calls).toEqual([
      ['drawImage', 'image page 3', 0, 0, 80, 100],
      ['createLinearGradient', -7.344, 41.652, 87.344, 58.348],
      ['addColorStop', 0, 'rgba(255,255,255,.08)'],
      ['addColorStop', 0.4, 'rgba(255,255,255,0)'],
      ['set fillStyle', 'gradient'],
      ['fillRect', 0, 0, 80, 100],
    ])
  })

  it('centres a spread on paper', async () => {
    const c = await sheetCanvas(
      testBook(),
      { kind: 'spread', left: 1, right: 2 },
      80,
    )

    expect(contexts.get(c)?.calls.slice(0, 4)).toEqual([
      ['set fillStyle', '#FBFAF7'],
      ['fillRect', 0, 0, 80, 100],
      ['drawImage', 'image page 1', 0, 25, 40, 50],
      ['drawImage', 'image page 2', 40, 25, 40, 50],
    ])
    expect(contexts.get(c)?.calls[5]?.[0]).toBe('addColorStop')
  })
})

describe('PageCurl', () => {
  const frame = { top: 1, under: 2, xm: 150, beta: 0.2, r: 30 }
  const out = () =>
    Object.assign(document.createElement('canvas'), {
      width: 464,
      height: 596,
    })

  it('stacks the under sheet, its shadow and the turning sheet', () => {
    const curl = new PageCurl(T, testBook(), sheets, 400, 200, 250)

    expect(digest(sceneOf(curl))).toMatchSnapshot()
    const { under, shadow, top } = layers(curl)
    expect(
      [under, shadow, top].map((m) => [m.renderOrder, m.frustumCulled]),
    ).toEqual([
      [-2, false],
      [-1, false],
      [0, false],
    ])
    expect(uniformsOf(top)).toMatchSnapshot()
    expect(uniformsOf(shadow)).toMatchSnapshot()
    expect((top.material as ShaderMaterial).vertexShader).toContain('zc')
    expect((shadow.material as ShaderMaterial).fragmentShader).toContain('dsil')
  })

  it('builds the textures around the sheet and drops the rest', async () => {
    const face = vi.fn((page: number) =>
      Promise.resolve(panel(`page ${String(page)}`)),
    )
    const curl = new PageCurl(T, testBook({ face }), sheets, 80, 200, 250)
    const changed = vi.fn()
    curl.onChange = changed

    curl.keep(0)
    curl.keep(0)

    expect(curl.ready(0)).toBe(false)
    await settle()
    expect([0, 1, 2, 3].map((i) => curl.ready(i))).toEqual([
      true,
      true,
      true,
      false,
    ])
    expect(changed).toHaveBeenCalledTimes(3)
    expect(face.mock.calls.map(([p]) => p)).toEqual([0, 1, 2])
    const disposed = vi.spyOn(THREE.Texture.prototype, 'dispose')
    curl.keep(3)
    await settle()
    expect(disposed).toHaveBeenCalledTimes(2)
    expect([0, 1, 2, 3, 4].map((i) => curl.ready(i))).toEqual([
      false,
      false,
      true,
      true,
      true,
    ])
  })

  it('draws nothing while a needed texture is missing', async () => {
    const curl = new PageCurl(T, testBook(), sheets, 80, 200, 250)

    expect(curl.draw(out(), 2, frame)).toBe(false)
    curl.keep(0)
    await settle()
    expect(curl.draw(out(), 2, { ...frame, top: 3 })).toBe(false)
    expect(curl.draw(out(), 2, { ...frame, under: 3 })).toBe(false)
    expect(rendererCalls).toEqual([])
  })

  it('sets the curl uniforms and draws through the shared renderer', async () => {
    const curl = new PageCurl(T, testBook(), sheets, 80, 200, 250)
    curl.keep(1)
    await settle()
    const target = out()

    expect(curl.draw(target, 2, frame)).toBe(true)

    const { under, shadow, top } = layers(curl)
    expect(uniformsOf(top)).toMatchSnapshot()
    expect(uniformsOf(under)).toMatchSnapshot()
    expect(uniformsOf(shadow)).toMatchSnapshot()
    expect([under.visible, shadow.visible]).toEqual([true, true])
    expect(rendererCalls.find((c) => c[0] === 'render')).toEqual([
      'render',
      3,
      false,
    ])
    expect(contexts.get(target)?.calls.at(-1)?.[0]).toBe('drawImage')
  })

  it('creases by the farthest sheet corner past the fold, either tilt', async () => {
    const curl = new PageCurl(T, testBook(), sheets, 80, 200, 250)
    curl.keep(1)
    await settle()
    const bent = (beta: number) => {
      curl.draw(out(), 1, { ...frame, xm: 190, beta })
      const { top, shadow } = layers(curl)
      return [uniformsOf(top).crease, uniformsOf(shadow).dsil] as number[]
    }

    // corner 10 · cos 0.2 + 125 · sin 0.2 ≈ 34.6 past the fold: 1.15 rad of a 30 roll
    for (const beta of [0.2, -0.2]) {
      const [crease, dsil] = bent(beta)
      expect(crease).toBeCloseTo(0.735, 2)
      expect(dsil).toBeCloseTo(27.44, 1)
    }
  })

  it('turns the cover over the endpaper and hides the flat layers at rest', async () => {
    const curl = new PageCurl(T, testBook(), sheets, 80, 200, 250)
    curl.keep(0)
    await settle()

    curl.draw(out(), 1, { top: 0, under: null, xm: 200, beta: 0, r: 10 })

    const { under, shadow, top } = layers(curl)
    const u = uniformsOf(top)
    expect(u.back).toEqual([0.914, 0.894, 0.855])
    expect(u.through).toBe(0)
    expect(u.crease).toBe(0)
    expect([under.visible, shadow.visible]).toEqual([false, false])
    curl.draw(out(), 1, { top: 1, under: null, xm: 100, beta: 0, r: 10 })
    expect(uniformsOf(top).back).toEqual([0.955, 0.952, 0.945])
    expect(uniformsOf(top).through).toBe(0.1)
  })

  it('hides the shadow when the fold is past the sheet', async () => {
    const curl = new PageCurl(T, testBook(), sheets, 80, 200, 250)
    curl.keep(1)
    await settle()

    curl.draw(out(), 1, { top: 1, under: 2, xm: 260, beta: 0, r: 10 })

    const { under, shadow } = layers(curl)
    expect([under.visible, shadow.visible]).toEqual([true, false])
    expect(uniformsOf(shadow).dsil).toBe(0)
  })

  it('ignores late textures after dispose and frees the GPU objects', async () => {
    const curl = new PageCurl(T, testBook(), sheets, 80, 200, 250)
    const changed = vi.fn()
    curl.onChange = changed
    curl.keep(0)
    const spies = [
      vi.spyOn(THREE.Material.prototype, 'dispose'),
      vi.spyOn(THREE.BufferGeometry.prototype, 'dispose'),
    ]

    curl.dispose()
    await settle()

    expect(changed).not.toHaveBeenCalled()
    expect(spies.map((s) => s.mock.calls.length)).toEqual([3, 1])
  })

  it('stays not ready on a failed face', async () => {
    const face = () => Promise.reject(new Error('no'))
    const curl = new PageCurl(T, testBook({ face }), sheets, 80, 200, 250)

    curl.keep(1)
    await settle()

    expect([0, 1, 2].map((i) => curl.ready(i))).toEqual([true, false, false])
  })
})
