import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleSiteInput } from '../sampleSite'
import type { SiteCatalogBook } from '../siteInput'
import { drawHomeBook, FACE_OUT } from './book3dGl'
import { backPanel, frontPanel, glInput, spinePanel } from './glCover'
import {
  fakeCanvas2d,
  fakeThree,
  panel,
  rendererCalls,
  type FakeContext,
} from './gl/testing.test-helpers'
import { ClosedBook } from './gl/closed'

const FONT = '"Site Inter Display", system-ui, sans-serif'
const alps = (): SiteCatalogBook => {
  const input = sampleSiteInput('')
  if (input.kind !== 'catalog' || input.books[0] === undefined) {
    throw new Error('sample book expected')
  }
  return input.books[0]
}

let contexts: Map<HTMLCanvasElement, FakeContext>
const calls = (c: HTMLCanvasElement) => contexts.get(c)?.calls ?? []
beforeEach(() => {
  contexts = fakeCanvas2d()
  rendererCalls.length = 0
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: () => Promise.resolve([]) },
  })
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('book3dGl panels (D38)', () => {
  it('paints the front: cloth, the photo cover-fit, the title in the cover type', () => {
    const b = alps()
    const c = frontPanel(b, { width: 400, height: 200 } as never, 190)

    expect([c.width, c.height]).toStrictEqual([190, 230])
    expect(calls(c)).toStrictEqual([
      ['set fillStyle', '#3e3c3b'],
      ['fillRect', 0, 0, 190, 230],
      ['drawImage', 'object', -135, 0, 460, 230],
      ['set font', '500 19px "Site Inter Display", system-ui, sans-serif'],
      ['set letterSpacing', '-0.48px'],
      ['set fillStyle', '#F5F5F5'],
      ['set textAlign', 'left'],
      ['set textBaseline', 'top'],
      ['fillText', 'Alps', 15.2, 20.7],
    ])
  })

  it('sets a bottom title on the foot, and no photo on the cloth only', () => {
    const c = frontPanel({ ...alps(), place: 'bottom' }, null, 190)

    expect(calls(c).some(([name]) => name === 'drawImage')).toBe(false)
    expect(calls(c)).toContainEqual(['set textBaseline', 'bottom'])
    expect(calls(c)).toContainEqual(['fillText', 'Alps', 15.2, 209.3])
  })

  it('paints the spine top → bottom: cloth, the spine text at the head, the year at the foot', () => {
    const c = spinePanel(alps(), 460)
    const ink = calls(c)

    expect(c.height).toBe(460)
    expect(c.width).toBeGreaterThanOrEqual(8)
    expect(ink.slice(0, 2)).toStrictEqual([
      ['set fillStyle', '#3e3c3b'],
      ['fillRect', 0, 0, c.width, 460],
    ])
    expect(ink).toContainEqual(['rotate', 1.571])
    expect(ink).toContainEqual(['fillText', 'Alps', 46, 0])
    expect(ink).toContainEqual(['fillText', '2024', 423.2, 0])
    expect(ink).toContainEqual(['set fillStyle', '#F1F3F6'])
  })

  it('sizes the spine to the drawn thickness and sets its type from it', () => {
    // 23 cm at 20 px/cm, 1.7 cm thick → 34 px; type min(34 · .42, 460 · .045)
    expect(calls(spinePanel(alps(), 460))).toStrictEqual([
      ['set fillStyle', '#3e3c3b'],
      ['fillRect', 0, 0, 34, 460],
      ['set fillStyle', '#F1F3F6'],
      ['set textBaseline', 'middle'],
      ['translate', 17, 0],
      ['rotate', 1.571],
      ['set font', `500 14.28px ${FONT}`],
      ['set textAlign', 'left'],
      ['fillText', 'Alps', 46, 0],
      ['set font', `400 ${String(14.28 * 0.7)}px ${FONT}`],
      ['set textAlign', 'right'],
      ['fillText', '2024', 423.2, 0],
    ])
  })

  it('floors a small spine at the GL book’s 12 px thickness', () => {
    const c = spinePanel(alps(), 46)

    expect([c.width, c.height]).toStrictEqual([12, 46])
  })

  it('centres a tall photo vertically on the front', () => {
    const c = frontPanel(alps(), { width: 100, height: 400 } as never, 190)

    expect(calls(c)).toContainEqual(['drawImage', 'object', 0, -265, 190, 760])
  })

  it('reads an image’s natural size', () => {
    const img = new Image()
    Object.defineProperties(img, {
      naturalWidth: { value: 400 },
      naturalHeight: { value: 200 },
    })

    const c = frontPanel(alps(), img, 190)

    const draw = calls(c).find(([name]) => name === 'drawImage')
    expect(draw?.slice(2)).toStrictEqual([-135, 0, 460, 230])
  })

  it('backs the book with the cloth', () => {
    const c = backPanel(alps())
    expect(calls(c)).toStrictEqual([
      ['set fillStyle', '#3e3c3b'],
      ['fillRect', 0, 0, 4, 4],
    ])
  })

  it('maps the site facts into the GL input', async () => {
    const input = glInput(alps(), panel('photo'), 190)

    expect(input.cloth).toBe('#3e3c3b')
    expect(input.pageCount).toBe(20)
    expect(input.trimMm).toStrictEqual({ widthMm: 190, heightMm: 230 })
    expect([input.paper, input.endpaper]).toStrictEqual(['#FBFAF7', '#E9E4DA'])
    const face = (await input.face(3)) as HTMLCanvasElement
    expect(calls(face)).toStrictEqual([
      ['set fillStyle', '#FBFAF7'],
      ['fillRect', 0, 0, 4, 4],
    ])
    const { front, spine, back } = input.cover
    expect(
      [front, spine, back].map((c) => [
        (c as HTMLCanvasElement).width,
        (c as HTMLCanvasElement).height,
      ]),
    ).toStrictEqual([
      [190, 230],
      [17, 230],
      [4, 4],
    ])
  })
})

describe('drawHomeBook', () => {
  const deps = { wanted: () => true, three: () => Promise.resolve(fakeThree()) }

  it('draws the face-out once into a canvas over the host box and marks it ready', async () => {
    const host = document.createElement('div')
    const b = { ...alps(), cover: null }
    const pose = vi.spyOn(ClosedBook.prototype, 'pose')
    const dispose = vi.spyOn(ClosedBook.prototype, 'dispose')
    const hemi: unknown[][] = []
    const T = fakeThree()
    class Hemi extends T.HemisphereLight {
      constructor(...a: ConstructorParameters<typeof T.HemisphereLight>) {
        super(...a)
        hemi.push(a)
      }
    }

    const undo = await drawHomeBook(host, b, 10, {
      wanted: () => true,
      three: () => Promise.resolve({ ...T, HemisphereLight: Hemi }),
    })

    const out = host.querySelector('canvas')
    expect(host.dataset.gl).toBe('ready')
    expect(out?.className).toBe('sd-b3gl')
    expect(out?.getAttribute('aria-hidden')).toBe('true')
    // canvasBox: 190 × 230 px + OVER (l .15, r .35, t .1, b .12)
    expect(out?.style.left).toBe('-28.5px')
    expect(out?.style.top).toBe('-23px')
    expect(out?.style.width).toBe('285px')
    expect(out?.style.height).toBe('280.6px')
    // k = max(2, devicePixelRatio 1)
    expect([out?.width, out?.height]).toStrictEqual([570, 561])
    // one render; the scene holds the book pivot and three lights, no floor
    expect(rendererCalls.filter(([name]) => name === 'render')).toStrictEqual([
      ['render', 4, false],
    ])
    expect(pose).toHaveBeenCalledWith(FACE_OUT)
    expect(dispose).toHaveBeenCalledTimes(1)
    // the front panel at 19 cm × 10 px/cm × k 2 × 1.5, no photo drawn
    const front = [...contexts.keys()].find(
      (c) => c.width === 570 && c.height === 690,
    )
    expect(front).toBeDefined()
    expect(calls(front as never).map(([name]) => name)).not.toContain(
      'drawImage',
    )
    // the light (not the dark) stage's sky / ground
    expect(hemi).toStrictEqual([[0xffffff, 0xd8d1c4, 1.35]])
    undo()
    expect(host.querySelector('canvas')).toBeNull()
    expect(host.dataset.gl).toBeUndefined()
  })

  it('draws the cover photo from its src', async () => {
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: () => Promise.resolve(),
    })
    const host = document.createElement('div')

    await drawHomeBook(host, alps(), 10, deps)

    const front = [...contexts.keys()].find(
      (c) => c.width === 570 && c.height === 690,
    )
    expect(calls(front as never).map(([name]) => name)).toContain('drawImage')
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
  })

  it('asks the page whether GL is wanted (jsdom: no WebGL2)', async () => {
    const host = document.createElement('div')

    const undo = await drawHomeBook(host, alps(), 10)

    undo()
    expect(host.childElementCount).toBe(0)
  })

  it('does nothing without GL', async () => {
    const host = document.createElement('div')
    const three = vi.fn(deps.three)

    const undo = await drawHomeBook(host, alps(), 10, {
      wanted: () => false,
      three,
    })

    undo()
    expect(three).not.toHaveBeenCalled()
    expect(host.childElementCount).toBe(0)
    expect(host.dataset.gl).toBeUndefined()
  })

  it('poses the book as the kit face-out (ry 0, elev 6)', () => {
    expect(FACE_OUT).toStrictEqual({ ry: 0, elev: 6, lift: 0, peek: 0, rz: 0 })
  })
})
