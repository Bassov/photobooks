import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeCanvas2d, fakeThree, rendererCalls } from './testing.test-helpers'

const fresh = async () => {
  vi.resetModules()
  return import('./three')
}

beforeEach(() => {
  rendererCalls.length = 0
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
        { antialias: true, alpha: true, powerPreference: 'high-performance' },
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
