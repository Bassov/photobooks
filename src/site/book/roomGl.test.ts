import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleSiteInput } from '../sampleSite'
import type { SiteBookData } from '../siteInput'
import { fakeCanvas2d } from './gl/testing.test-helpers'
import { openCurlGl, openReaderGl, pageImages } from './roomGl'

const gl = vi.hoisted(() => ({
  photo: vi.fn((src: string | undefined): Promise<HTMLImageElement | null> =>
    src === undefined
      ? Promise.resolve(null)
      : Promise.resolve({ src } as unknown as HTMLImageElement),
  ),
  drawInto: vi.fn(),
  made: [] as [string, unknown[]][],
}))

vi.mock('./glCover', async (real) => ({
  ...(await real<typeof import('./glCover')>()),
  photoOf: gl.photo,
}))
vi.mock('./gl/three', async (real) => ({
  ...(await real<typeof import('./gl/three')>()),
  loadThree: () => Promise.resolve({ three: true }),
  drawInto: gl.drawInto,
}))
vi.mock('./gl/faces', () => ({
  createFaceSource: (o: unknown) => {
    gl.made.push(['faces', [o]])
    return { face: () => null }
  },
}))
vi.mock('./gl/open', () => ({
  OpenBook: class {
    scene = 'scene'
    cam = 'cam'
    constructor(...args: unknown[]) {
      gl.made.push(['open', args])
    }
  },
}))
vi.mock('./gl/curl', () => ({
  PageCurl: class {
    kind = 'curl'
    constructor(...args: unknown[]) {
      gl.made.push(['curl', args])
    }
  },
}))

function alps(): SiteBookData {
  const input = sampleSiteInput('?book=alps')
  if (input.kind !== 'book') throw new Error('sample book expected')
  return input
}

beforeEach(() => {
  fakeCanvas2d()
})

afterEach(() => {
  vi.restoreAllMocks()
  gl.photo.mockClear()
  gl.drawInto.mockClear()
  gl.made.length = 0
})

describe('pageImages', () => {
  it("loads a page's photos once each, skipping unknown and failed ones", async () => {
    const { book, images } = alps()
    const ids = (await pageImages(book, images)(2)).keys()
    const first = [...ids]
    expect(first.length).toBeGreaterThan(0)

    const known = Object.fromEntries(
      Object.entries(images).filter(([id]) => id !== first[0]),
    )
    gl.photo.mockClear()
    gl.photo.mockImplementationOnce(() => Promise.reject(new Error('404')))
    const read = pageImages(book, known)
    const page = await read(2)
    const again = await read(3)

    expect(page.has(first[0] ?? '')).toBe(false)
    expect(page.size).toBe(first.length - 2)
    expect(again.size).toBe(page.size)
    expect(gl.photo).toHaveBeenCalledTimes(first.length - 1)
  })

  it('has no photos past the last spread', async () => {
    const { book, images } = alps()

    const page = await pageImages(book, images)(book.spreads.length * 2 + 2)

    expect(page.size).toBe(0)
  })
})

describe('room GL books', () => {
  it('opens the reader book over the cover photo and draws it', async () => {
    const { entry, book, images } = alps()

    const r = await openReaderGl({ entry, book, images, pagePx: 400 })
    const canvas = document.createElement('canvas')
    r.draw(canvas)

    expect(gl.photo).toHaveBeenCalledWith(entry.cover?.src)
    expect(gl.made.map(([k]) => k)).toStrictEqual(['faces', 'open'])
    expect(gl.made[1]?.[1][2]).toStrictEqual({
      dark: false,
      bend: true,
      pagePx: 400,
    })
    expect(gl.drawInto).toHaveBeenCalledWith(
      { three: true },
      'scene',
      'cam',
      canvas,
      true,
    )
  })

  it('opens the page curl over the sheets, with no photo when the cover fails', async () => {
    const { entry, book, images } = alps()
    gl.photo.mockImplementationOnce(() => Promise.reject(new Error('404')))
    const sheets = [{ kind: 'cover' } as const]

    const r = await openCurlGl(
      { entry, book, images, pagePx: 300 },
      sheets,
      300,
      400,
    )

    expect(r.faces).toBeDefined()
    expect(gl.made.map(([k]) => k)).toStrictEqual(['faces', 'curl'])
    expect(gl.made[1]?.[1].slice(2)).toStrictEqual([sheets, 300, 300, 400])
  })
})
