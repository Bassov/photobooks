import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACTIVE,
  BT,
  ClosedBook,
  HOVER,
  OVER,
  REST,
  SQ,
  canvasBox,
  coverCanvas,
  stripes,
  tex,
} from './closed'
import {
  digest,
  fakeCanvas2d,
  fakeThree,
  testBook,
  type FakeContext,
} from './testing.test-helpers'
import * as THREE from './vendor/three.module.min.js'
import type { Mesh, MeshStandardMaterial } from './vendor/three.module.min.js'

const T = fakeThree()
let contexts: Map<HTMLCanvasElement, FakeContext>

beforeEach(() => {
  contexts = fakeCanvas2d()
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
})

afterEach(() => {
  vi.restoreAllMocks()
})

const callsOf = (c: unknown) => contexts.get(c as HTMLCanvasElement)?.calls
/** the panel image drawn into a material's map */
const drawn = (m: MeshStandardMaterial | undefined) =>
  callsOf(m?.map?.image)?.find((c) => c[0] === 'drawImage')?.[1]

const meshes = (book: ClosedBook) => {
  const [piv] = book.scene.children
  const [group] = piv?.children ?? []
  const [hinge, back, spine, block] = group?.children as [
    Mesh,
    Mesh,
    Mesh,
    Mesh,
  ]
  const front = hinge.children[0] as Mesh
  return { piv, group, hinge, front, back, spine, block }
}

describe('textures', () => {
  it('makes sRGB mipmapped textures at the max anisotropy', () => {
    const t = tex(T, document.createElement('canvas'))

    expect(t.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(t.anisotropy).toBe(16)
    expect(t.generateMipmaps).toBe(true)
    expect(t.minFilter).toBe(THREE.LinearMipmapLinearFilter)
  })

  it('paints one light/dark pair of edge stripes per leaf', () => {
    const along = stripes(T, 4, true)
    const across = stripes(T, 4, false)

    const a = callsOf(along.image) ?? []
    expect(a.slice(0, 2)).toEqual([
      ['set fillStyle', 'rgb(251,248,242)'],
      ['fillRect', 0, 0, 1, 8],
    ])
    expect(a[128]).toEqual(['set fillStyle', 'rgb(222,219,213)'])
    expect(a[256]).toEqual(['set fillStyle', 'rgb(251,248,242)'])
    expect(a).toHaveLength(1024)
    expect(callsOf(across.image)?.slice(0, 2)).toEqual([
      ['set fillStyle', 'rgb(251,248,242)'],
      ['fillRect', 0, 511, 8, 1],
    ])
    expect([
      (along.image as HTMLCanvasElement).width,
      (across.image as HTMLCanvasElement).height,
    ]).toEqual([512, 512])
  })

  it('shades a leaf as a cosine with ±3 noise and runs v bottom up', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75)

    const along = callsOf(stripes(T, 4, true).image) ?? []
    const across = callsOf(stripes(T, 4, false).image) ?? []

    // a leaf is 128 px: light edge, mid, dark middle
    expect([0, 32, 64].map((i) => along[2 * i])).toEqual([
      ['set fillStyle', 'rgb(253,250,244)'],
      ['set fillStyle', 'rgb(238,235,229)'],
      ['set fillStyle', 'rgb(224,221,215)'],
    ])
    expect(across[3]).toEqual(['fillRect', 0, 510, 8, 1])
  })

  it('paints the front panel on the cloth with the hinge shade', () => {
    const c = coverCanvas(testBook(), 100)

    expect([c.width, c.height]).toEqual([100, 125])
    expect(callsOf(c)).toEqual([
      ['set fillStyle', '#334455'],
      ['fillRect', 0, 0, 100, 125],
      ['drawImage', 'image front', 0, 0, 100, 125],
      ['createLinearGradient', 0, 0, 5, 0],
      ['addColorStop', 0, 'rgba(0,0,0,.30)'],
      ['addColorStop', 0.45, 'rgba(0,0,0,.06)'],
      ['addColorStop', 0.7, 'rgba(255,255,255,.26)'],
      ['addColorStop', 1, 'rgba(0,0,0,.05)'],
      ['set fillStyle', 'gradient'],
      ['fillRect', 0, 0, 5, 125],
    ])
  })
})

describe('ClosedBook', () => {
  const opts = { floor: true, k: 2 }

  it('builds the boards, spine and page block like the kit', () => {
    const book = new ClosedBook(T, testBook(), 10, opts)

    expect(digest(book.scene)).toMatchSnapshot()
    const { front, back, spine, block } = meshes(book)
    const fm = front.material as MeshStandardMaterial[]
    const bm = back.material as MeshStandardMaterial[]
    expect(drawn(fm[4])).toBe('image front')
    expect(fm[5]?.color.getHexString()).toBe('e9e4da')
    expect(drawn(bm[5])).toBe('image back')
    expect(bm[4]?.color.getHexString()).toBe('e9e4da')
    expect(drawn(spine.material as MeshStandardMaterial)).toBe('image spine')
    const blockMats = block.material as MeshStandardMaterial[]
    expect(blockMats[4]?.color.getHexString()).toBe('fbfaf7')
    expect([BT, SQ]).toEqual([0.25, 0.3])
  })

  it('sizes textures by the drawn size and caps them', () => {
    const small = new ClosedBook(T, testBook(), 10, opts)
    const big = new ClosedBook(T, testBook(), 100, opts)
    const size = (book: ClosedBook) => {
      const { front, spine } = meshes(book)
      const cover = (front.material as MeshStandardMaterial[])[4]?.map
      const sp = (spine.material as MeshStandardMaterial).map
      const c = cover?.image as HTMLCanvasElement
      const s = sp?.image as HTMLCanvasElement
      return [c.width, c.height, s.width, s.height]
    }

    expect(size(small)).toEqual([600, 750, 75, 750])
    expect(size(big)).toEqual([1024, 1280, 128, 1280])
  })

  it('poses the book and centres it in the canvas at s px per cm', () => {
    const s = 10
    const b = testBook()
    const book = new ClosedBook(T, b, s, opts)
    const box = canvasBox(b, s)

    book.pose(HOVER)
    book.cam.updateMatrixWorld(true)

    const { piv, hinge } = meshes(book)
    expect(piv?.position.y).toBeCloseTo(0.8)
    expect(piv?.rotation.y).toBeCloseTo((14 * Math.PI) / 180)
    expect(piv?.rotation.order).toBe('ZYX')
    expect(hinge.rotation.y).toBeCloseTo((-22 * Math.PI) / 180)
    const px = (x: number, y: number, z: number) => {
      const v = new T.Vector3(x, y, z).project(book.cam)
      return [((v.x + 1) / 2) * box.width, ((1 - v.y) / 2) * box.height]
    }
    const [cx, cy] = px(0, b.h / 2, 0)
    expect(cx).toBeCloseTo(-box.left + (b.w * s) / 2, 3)
    expect(cy).toBeCloseTo(-box.top + (b.h * s) / 2, 3)
    expect((px(1, b.h / 2, 0)[0] ?? 0) - (cx ?? 0)).toBeCloseTo(s, 3)
    expect(digest(book.cam)).toMatchSnapshot()
    expect([book.cam.near, book.cam.far, book.cam.aspect]).toMatchSnapshot()
  })

  it('bakes the floor shadow: soft footprint and top, then the contact', () => {
    const book = new ClosedBook(T, testBook(), 10, opts)
    const t = book.shadow?.t
    const version = (t as unknown as { version: number }).version

    book.pose(REST)

    const calls = callsOf(book.shadow?.c) ?? []
    const named = (n: string) => calls.filter((c) => c[0] === n)
    expect(book.shadow?.R).toBe(33)
    expect(book.shadow?.c.width).toBe(528)
    expect(named('set filter')).toEqual([
      ['set filter', 'blur(24px)'],
      ['set filter', 'blur(3.2px)'],
      ['set filter', 'none'],
    ])
    expect(named('set fillStyle')).toEqual([
      ['set fillStyle', 'rgba(0,0,0,0.26)'],
      ['set fillStyle', 'rgba(0,0,0,0.42)'],
    ])
    expect(named('fill')).toHaveLength(7)
    expect(named('beginPath')).toHaveLength(7)
    expect(named('closePath')).toHaveLength(7)
    expect(calls[0]).toEqual(['clearRect', 0, 0, 528, 528])
    expect(
      calls.filter((c) => c[0] === 'moveTo' || c[0] === 'lineTo'),
    ).toMatchSnapshot()
    expect((t as unknown as { version: number }).version).toBe(version + 1)
  })

  it('keeps the footprint on the floor and the top on the lifted, tilted book', () => {
    const rest = new ClosedBook(T, testBook(), 10, opts)
    const lifted = new ClosedBook(T, testBook(), 10, opts)
    const path = (book: ClosedBook) =>
      callsOf(book.shadow?.c)?.filter((c) => c[0] === 'moveTo')

    rest.pose(REST)
    lifted.pose({ ...REST, lift: 8, rz: 5 })

    const [restBot, restTop] = path(rest) ?? []
    const [liftBot, liftTop] = path(lifted) ?? []
    expect(liftTop).not.toEqual(restTop)
    expect(liftBot).toMatchSnapshot()
    expect(restBot).toMatchSnapshot()
    expect(meshes(lifted).piv?.rotation.z).toBeCloseTo((5 * Math.PI) / 180)
  })

  it('fades the contact shadow with the lift', () => {
    const lifted = new ClosedBook(T, testBook(), 10, opts)
    const half = new ClosedBook(T, testBook(), 10, opts)

    lifted.pose({ ...ACTIVE, lift: 12 })
    half.pose({ ...REST, lift: 6 })

    const fills = (book: ClosedBook) =>
      callsOf(book.shadow?.c)?.filter((c) => c[0] === 'set fillStyle')
    expect(fills(lifted)).toEqual([['set fillStyle', 'rgba(0,0,0,0.26)']])
    expect(fills(half)).toEqual([
      ['set fillStyle', 'rgba(0,0,0,0.26)'],
      ['set fillStyle', 'rgba(0,0,0,0.21)'],
    ])
  })

  it('poses without a floor and disposes everything once', () => {
    const book = new ClosedBook(T, testBook(), 10, opts)
    const bare = new ClosedBook(T, testBook(), 10, { ...opts, floor: false })
    const spies = [
      vi.spyOn(THREE.Material.prototype, 'dispose'),
      vi.spyOn(THREE.Texture.prototype, 'dispose'),
      vi.spyOn(THREE.BufferGeometry.prototype, 'dispose'),
    ]

    bare.pose(REST)
    book.dispose()
    book.dispose()

    expect(bare.shadow).toBeUndefined()
    expect(spies.map((s) => s.mock.calls.length)).toEqual([9, 6, 5])
  })
})

describe('canvasBox', () => {
  it('grows the host box by the overhang', () => {
    expect(canvasBox({ w: 20, h: 10 }, 10)).toEqual({
      left: -30,
      top: -10,
      width: 300,
      height: expect.closeTo(122, 9) as number,
    })
    expect(OVER).toEqual({ l: 0.15, r: 0.35, b: 0.12, t: 0.1 })
  })
})
