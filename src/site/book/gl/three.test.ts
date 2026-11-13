import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fakeCanvas2d,
  fakeGpu,
  fakeThree,
  rendererCalls,
} from './testing.test-helpers'

const fresh = async () => {
  vi.resetModules()
  return import('./three')
}

beforeEach(() => {
  rendererCalls.length = 0
  fakeGpu.done = true
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('loadThree', () => {
  it('loads the vendored r170 once', async () => {
    const { loadThree } = await fresh()

    const T = await loadThree()

    expect(T.REVISION).toBe('170')
    expect(loadThree()).toBe(loadThree())
  })
})

describe('drawInto', () => {
  it('renders into the shared renderer and copies the pixels out', async () => {
    const { drawInto, maxAnisotropy } = await fresh()
    const T = fakeThree()
    const contexts = fakeCanvas2d()
    const scene = new T.Scene()
    const cam = new T.PerspectiveCamera()
    const out = Object.assign(document.createElement('canvas'), {
      width: 40,
      height: 30,
    })

    drawInto(T, scene, cam, out)
    drawInto(T, scene, cam, out, true)
    out.width = 20
    out.height = 50
    drawInto(T, scene, cam, out)

    expect(maxAnisotropy(T)).toBe(16)
    expect(rendererCalls).toEqual([
      [
        'new',
        {
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        },
      ],
      ['setPixelRatio', 1],
      ['setClearColor', 0, 0],
      ['setSize', 40, 30, false],
      ['setViewport', 0, 0, 40, 30],
      ['setScissor', 0, 0, 40, 30],
      ['setScissorTest', true],
      ['clear'],
      ['render', 0, false],
      ['setViewport', 0, 0, 40, 30],
      ['setScissor', 0, 0, 40, 30],
      ['setScissorTest', true],
      ['clear'],
      ['render', 0, true],
      ['setSize', 40, 50, false],
      ['setViewport', 0, 0, 20, 50],
      ['setScissor', 0, 0, 20, 50],
      ['setScissorTest', true],
      ['clear'],
      ['render', 0, false],
    ])
    expect(contexts.get(out)?.calls.slice(-2)).toEqual([
      ['clearRect', 0, 0, 20, 50],
      ['drawImage', 'canvas 300×150', 0, 0, 20, 50, 0, 0, 20, 50],
    ])
  })

  it('renders at the bottom of a taller buffer and sets the colour pipeline', async () => {
    const { drawInto } = await fresh()
    const T = fakeThree()
    fakeCanvas2d()
    const big = Object.assign(document.createElement('canvas'), {
      width: 10,
      height: 40,
    })
    const small = Object.assign(document.createElement('canvas'), {
      width: 10,
      height: 10,
    })
    const scene = new T.Scene()
    const cam = new T.PerspectiveCamera()

    drawInto(T, scene, cam, big)
    rendererCalls.length = 0
    drawInto(T, scene, cam, small)

    expect(rendererCalls[0]).toEqual(['setViewport', 0, 30, 10, 10])
    expect(rendererCalls[1]).toEqual(['setScissor', 0, 30, 10, 10])
  })

  it('skips the copy without a 2D context', async () => {
    const { drawInto } = await fresh()
    const T = fakeThree()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const out = document.createElement('canvas')

    drawInto(T, new T.Scene(), new T.PerspectiveCamera(), out)

    expect(rendererCalls.at(-1)).toEqual(['render', 0, false])
  })
})

describe('compileScene', () => {
  it('compiles the scene with the shadow setting of its draws', async () => {
    const { compileScene } = await fresh()
    const T = fakeThree()

    await compileScene(T, new T.Scene(), new T.PerspectiveCamera(), true)

    expect(rendererCalls.at(-1)).toEqual(['compileAsync', 0, true])
  })
})

describe('fencedDraws', () => {
  const setup = async () => {
    const three = await fresh()
    const T = fakeThree()
    const contexts = fakeCanvas2d()
    const frames: (() => void)[] = []
    const tick = () => {
      for (const f of frames.splice(0)) f()
    }
    const scene = new T.Scene()
    const cam = new T.PerspectiveCamera()
    const d = three.fencedDraws(T, scene, cam, true, (f) => frames.push(f))
    const out = document.createElement('canvas')
    const copies = () =>
      (contexts.get(out)?.calls ?? []).filter(([k]) => k === 'drawImage')
    const renders = () => rendererCalls.filter(([k]) => k === 'render')
    return { ...three, T, scene, cam, d, out, tick, copies, renders }
  }

  it('copies only once the GPU has signalled the fence, sized to the draw', async () => {
    const { d, out, tick, copies, renders } = await setup()
    fakeGpu.done = false
    const landed = vi.fn()

    void d.draw(out, 40, 30, () => 'v').then(landed)
    tick()
    tick()
    await Promise.resolve()

    expect(renders()).toEqual([['render', 0, true]])
    expect(rendererCalls.slice(-2)).toEqual([['fenceSync'], ['flush']])
    expect(copies()).toEqual([])
    expect(landed).not.toHaveBeenCalled()

    fakeGpu.done = true
    tick()
    await Promise.resolve()

    expect(rendererCalls.at(-1)).toEqual(['deleteSync'])
    expect([out.width, out.height]).toEqual([40, 30])
    expect(copies()).toEqual([
      ['drawImage', 'canvas 300×150', 0, 0, 40, 30, 0, 0, 40, 30],
    ])
    expect(landed).toHaveBeenCalledExactlyOnceWith('v')
  })

  it('folds the draws asked in flight into one render of the latest', async () => {
    const { d, out, tick, copies, renders } = await setup()
    fakeGpu.done = false
    const prep = vi.fn((v: string) => v)

    const a = d.draw(out, 10, 10, () => prep('a'))
    const b = d.draw(out, 10, 10, () => prep('b'))
    const c = d.draw(out, 20, 10, () => prep('c'))
    tick()

    expect(renders()).toHaveLength(1)
    expect(prep.mock.calls).toEqual([['a']])

    fakeGpu.done = true
    tick()
    expect(await a).toBe('a')
    expect(renders()).toHaveLength(2)
    expect(prep.mock.calls).toEqual([['a'], ['c']])
    tick()

    expect(await Promise.all([b, c])).toEqual(['c', 'c'])
    expect(copies()).toHaveLength(2)
    expect([out.width, out.height]).toEqual([20, 10])
    tick()
    expect(renders()).toHaveLength(2)
  })

  it('renders again when another book drew over the shared buffer meanwhile', async () => {
    const { d, out, tick, copies, renders, drawInto, T, scene, cam } =
      await setup()

    const a = d.draw(out, 10, 10, () => 'a')
    drawInto(T, scene, cam, document.createElement('canvas'))
    tick()

    expect(copies()).toEqual([])
    expect(renders()).toHaveLength(3)
    tick()
    expect(await a).toBe('a')
    expect(copies()).toHaveLength(1)
  })

  it('drops the draw in flight and those asked after a stop', async () => {
    const { d, out, tick, copies, renders } = await setup()
    fakeGpu.done = false
    const landed = vi.fn()

    void d.draw(out, 10, 10, () => 'a').then(landed)
    void d.draw(out, 10, 10, () => 'b').then(landed)
    d.stop()
    fakeGpu.done = true
    tick()
    void d.draw(out, 10, 10, () => 'c').then(landed)
    tick()
    await Promise.resolve()

    expect(rendererCalls.at(-1)).toEqual(['deleteSync'])
    expect(renders()).toHaveLength(1)
    expect(copies()).toEqual([])
    expect(landed).not.toHaveBeenCalled()
  })
})
