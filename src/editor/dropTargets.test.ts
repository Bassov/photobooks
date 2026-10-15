import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  ASSET_DRAG_MIME,
  FRAME_DRAG_MIME,
  buildDropIndex,
  decodeFrameDrag,
  encodeFrameDrag,
  hitTestDrop,
  isAssetDrag,
  isFrameDrag,
  resolveFrameActivation,
  type DropFrameInput,
  type DropIndexInput,
  type DropSpreadInput,
} from './dropTargets'

function indexFor(input: DropIndexInput) {
  return buildDropIndex(input)
}

describe('dropTargets', () => {
  it('centers a frame inside a wider world', () => {
    const index = indexFor({
      pxPerMm: 1,
      stridePx: 80,
      worldWidthPx: 300,
      spreads: [
        {
          spreadId: 's0',
          spreadWidthPx: 100,
          items: [
            {
              frameId: 'f0',
              z: 1,
              filled: false,
              rectMm: { x: 0, y: 4, width: 10, height: 8 },
            },
          ],
        },
      ],
    })

    const hit = hitTestDrop(index, 100, 4)
    expect(hit?.frameId).toBe('f0')
    expect(hit?.filled).toBe(false)
    expect(hitTestDrop(index, 99, 4)).toBeUndefined()
  })

  it('offsets later spreads by stride', () => {
    const index = indexFor({
      pxPerMm: 2,
      stridePx: 50,
      worldWidthPx: 40,
      spreads: [
        { spreadId: 's0', spreadWidthPx: 40, items: [] },
        {
          spreadId: 's1',
          spreadWidthPx: 40,
          items: [
            {
              frameId: 'f1',
              z: 0,
              filled: true,
              rectMm: { x: 1, y: 2, width: 4, height: 3 },
            },
          ],
        },
      ],
    })

    const hit = hitTestDrop(index, 2, 54)
    expect(hit).toMatchObject({ spreadId: 's1', frameId: 'f1', filled: true })
    expect(hitTestDrop(index, 2, 53)).toBeUndefined()
  })

  it('prefers the higher z and then the later equal z', () => {
    const low: DropFrameInput = {
      frameId: 'low',
      z: 1,
      filled: false,
      rectMm: { x: 0, y: 0, width: 10, height: 10 },
    }
    const high: DropFrameInput = {
      frameId: 'high',
      z: 3,
      filled: true,
      rectMm: { x: 0, y: 0, width: 10, height: 10 },
    }
    const stacked = indexFor({
      pxPerMm: 1,
      stridePx: 20,
      worldWidthPx: 10,
      spreads: [{ spreadId: 's', spreadWidthPx: 10, items: [low, high] }],
    })
    expect(hitTestDrop(stacked, 1, 1)?.frameId).toBe('high')

    const same: DropFrameInput = { ...low, frameId: 'later', z: 3 }
    const ties = indexFor({
      pxPerMm: 1,
      stridePx: 20,
      worldWidthPx: 10,
      spreads: [{ spreadId: 's', spreadWidthPx: 10, items: [high, same] }],
    })
    expect(hitTestDrop(ties, 1, 1)?.frameId).toBe('later')
  })

  it('keeps an earlier higher frame when a lower one overlaps it', () => {
    const index = indexFor({
      pxPerMm: 1,
      stridePx: 20,
      worldWidthPx: 10,
      spreads: [
        {
          spreadId: 's',
          spreadWidthPx: 10,
          items: [
            {
              frameId: 'high',
              z: 4,
              filled: true,
              rectMm: { x: 0, y: 0, width: 10, height: 10 },
            },
            {
              frameId: 'low',
              z: 1,
              filled: false,
              rectMm: { x: 0, y: 0, width: 10, height: 10 },
            },
          ],
        },
      ],
    })

    expect(hitTestDrop(index, 1, 1)?.frameId).toBe('high')
  })

  it('treats the right and bottom edges as outside the frame', () => {
    const index = indexFor({
      pxPerMm: 1,
      stridePx: 30,
      worldWidthPx: 10,
      spreads: [
        {
          spreadId: 's',
          spreadWidthPx: 10,
          items: [
            {
              frameId: 'f',
              z: 0,
              filled: false,
              rectMm: { x: 0, y: 0, width: 4, height: 6 },
            },
          ],
        },
      ],
    })
    const frame = index.frames[0]
    if (frame === undefined) {
      throw new Error('expected a frame')
    }

    expect(
      hitTestDrop(index, frame.right - 0.1, frame.bottom - 0.1)?.frameId,
    ).toBe('f')
    expect(hitTestDrop(index, frame.right, frame.top + 1)).toBeUndefined()
    expect(hitTestDrop(index, frame.left + 1, frame.bottom)).toBeUndefined()
  })

  it('drops non-finite scale, non-positive stride, and zero-area frames', () => {
    const solid: DropFrameInput = {
      frameId: 'solid',
      z: 0,
      filled: false,
      rectMm: { x: 0, y: 0, width: 4, height: 4 },
    }
    const flat: DropFrameInput = {
      frameId: 'flat',
      z: 0,
      filled: false,
      rectMm: { x: 0, y: 0, width: 4, height: 0 },
    }
    const spreads = [{ spreadId: 's', spreadWidthPx: 10, items: [solid, flat] }]

    expect(
      indexFor({
        pxPerMm: Number.NaN,
        stridePx: 10,
        worldWidthPx: 10,
        spreads,
      }).frames,
    ).toHaveLength(0)
    expect(
      indexFor({
        pxPerMm: Number.POSITIVE_INFINITY,
        stridePx: 10,
        worldWidthPx: 10,
        spreads,
      }).frames,
    ).toHaveLength(0)
    expect(
      indexFor({ pxPerMm: 1, stridePx: 0, worldWidthPx: 10, spreads }).frames,
    ).toHaveLength(0)
    expect(
      indexFor({ pxPerMm: 1, stridePx: -1, worldWidthPx: 10, spreads }).frames,
    ).toHaveLength(0)
    expect(
      indexFor({
        pxPerMm: 1,
        stridePx: 10,
        worldWidthPx: 10,
        spreads,
      }).frames.map((frame) => frame.frameId),
    ).toEqual(['solid'])
  })

  it('skips a hole and places the next spread on its stride row', () => {
    const spreads: DropSpreadInput[] = []
    spreads[1] = {
      spreadId: 's1',
      spreadWidthPx: 10,
      items: [
        {
          frameId: 'f1',
          z: 0,
          filled: false,
          rectMm: { x: 0, y: 0, width: 4, height: 4 },
        },
      ],
    }

    const index = indexFor({
      pxPerMm: 1,
      stridePx: 20,
      worldWidthPx: 10,
      spreads,
    })

    expect(index.frames).toHaveLength(1)
    expect(hitTestDrop(index, 1, 21)?.frameId).toBe('f1')
    expect(hitTestDrop(index, 1, 1)).toBeUndefined()
  })

  it('recognizes only the gallery asset drag type', () => {
    expect(isAssetDrag(null)).toBe(false)
    const other = new DataTransfer()
    other.setData('text/plain', 'nope')
    expect(isAssetDrag(other)).toBe(false)
    const asset = new DataTransfer()
    asset.setData(ASSET_DRAG_MIME, 'a')
    expect(isAssetDrag(asset)).toBe(true)
    expect(isFrameDrag(asset)).toBe(false)
  })

  it('round-trips a frame payload and rejects a broken one', () => {
    const payload = encodeFrameDrag({ spreadId: 's0', frameId: 'f0' })
    expect(decodeFrameDrag(payload)).toEqual({ spreadId: 's0', frameId: 'f0' })
    expect(decodeFrameDrag('')).toBeNull()
    expect(decodeFrameDrag('only-spread')).toBeNull()
    expect(decodeFrameDrag('\nf0')).toBeNull()
    expect(decodeFrameDrag('s0\n')).toBeNull()
    expect(decodeFrameDrag('s0\nf0\nextra')).toBeNull()
    const frame = new DataTransfer()
    frame.setData(FRAME_DRAG_MIME, payload)
    expect(isFrameDrag(frame)).toBe(true)
    expect(isFrameDrag(null)).toBe(false)
  })

  it('lets a gallery selection place or replace and ignores the frame source', () => {
    const target = { spreadId: 's1', frameId: 'f1', filled: false }
    expect(
      resolveFrameActivation({
        galleryAssetId: 'a',
        source: { spreadId: 's0', frameId: 'f0' },
        target,
      }),
    ).toEqual({ type: 'place', assetId: 'a' })
    expect(
      resolveFrameActivation({
        galleryAssetId: 'a',
        source: null,
        target: { ...target, filled: true },
      }),
    ).toEqual({ type: 'replace', assetId: 'a' })
  })

  it('selects a filled frame, swaps a different one, and clears the same frame', () => {
    const source = { spreadId: 's0', frameId: 'f0' }
    expect(
      resolveFrameActivation({
        galleryAssetId: null,
        source: null,
        target: { ...source, filled: true },
      }),
    ).toEqual({ type: 'select-source' })
    expect(
      resolveFrameActivation({
        galleryAssetId: null,
        source: null,
        target: { ...source, filled: false },
      }),
    ).toEqual({ type: 'noop' })
    expect(
      resolveFrameActivation({
        galleryAssetId: null,
        source,
        target: { spreadId: 's0', frameId: 'f1', filled: false },
      }),
    ).toEqual({ type: 'swap', source })
    expect(
      resolveFrameActivation({
        galleryAssetId: null,
        source,
        target: { ...source, filled: true },
      }),
    ).toEqual({ type: 'clear-source' })
    expect(
      resolveFrameActivation({
        galleryAssetId: '',
        source: null,
        target: { ...source, filled: true },
      }),
    ).toEqual({ type: 'select-source' })
    expect(
      resolveFrameActivation({
        galleryAssetId: null,
        source,
        target: { spreadId: 's1', frameId: 'f0', filled: true },
      }),
    ).toEqual({ type: 'swap', source })
  })

  it('misses outside every frame and ignores a non-finite point', () => {
    const index = indexFor({
      pxPerMm: 1,
      stridePx: 20,
      worldWidthPx: 10,
      spreads: [
        {
          spreadId: 's',
          spreadWidthPx: 10,
          items: [
            {
              frameId: 'f',
              z: 0,
              filled: false,
              rectMm: { x: 0, y: 0, width: 4, height: 4 },
            },
            {
              frameId: 'flat',
              z: 2,
              filled: false,
              rectMm: { x: 0, y: 0, width: 0, height: 4 },
            },
          ],
        },
      ],
    })

    expect(hitTestDrop(index, -1, 1)).toBeUndefined()
    expect(hitTestDrop(index, Number.NaN, 1)).toBeUndefined()
    expect(index.frames).toHaveLength(1)
  })

  test.prop([
    fc.double({ min: 1, max: 400, noNaN: true }),
    fc.double({ min: 1, max: 400, noNaN: true }),
    fc.double({ min: 0, max: 80, noNaN: true }),
    fc.double({ min: 0, max: 80, noNaN: true }),
    fc.double({ min: 1, max: 2000, noNaN: true }),
    fc.integer({ min: 0, max: 4 }),
  ])(
    'hits a point inside the frame and misses just outside it',
    (width, height, x, y, worldWidth, slot) => {
      const index = buildDropIndex({
        pxPerMm: 1,
        stridePx: 1000,
        worldWidthPx: worldWidth + width,
        spreads: [
          {
            spreadId: 's',
            spreadWidthPx: width,
            items: [
              {
                frameId: 'f',
                z: slot,
                filled: slot % 2 === 0,
                rectMm: { x, y, width, height },
              },
            ],
          },
        ],
      })
      const frame = index.frames[0]
      if (frame === undefined) {
        throw new Error('expected a frame')
      }

      expect(hitTestDrop(index, frame.left, frame.top)?.frameId).toBe('f')
      expect(
        hitTestDrop(index, frame.right, frame.top + height / 2),
      ).toBeUndefined()
      expect(hitTestDrop(index, frame.left - 0.01, frame.top)).toBeUndefined()
    },
  )
})
