import { describe, expect, it } from 'vitest'
import { checkBookInvariants } from '../invariants'
import { resolveSpread } from '../geometry/resolveSpread'
import {
  makePainterFixture,
  PAINTER_ASSET_IDS,
  PAINTER_SPREAD_COUNT,
} from './painterFixture'

describe('makePainterFixture', () => {
  it('builds 40 four-grid spreads with the first frame empty', () => {
    const { book, previewUrls } = makePainterFixture()

    expect(book.spreads).toHaveLength(PAINTER_SPREAD_COUNT)
    expect(book.spreads.every((spread) => spread.frames.length === 4)).toBe(
      true,
    )
    expect(book.spreads.every((spread) => spread.templateId === '4-grid')).toBe(
      true,
    )
    expect(book.spreads[0]?.frames[0]?.assetId).toBeUndefined()
    expect(book.spreads[0]?.frames[1]?.assetId).toBe('painter-b')
    expect(book.spreads[1]?.frames[0]?.assetId).toBe('painter-a')
    expect(checkBookInvariants(book).ok).toBe(true)
    expect([...previewUrls.keys()]).toEqual([...PAINTER_ASSET_IDS])

    const right = book.spreads[1]?.frames[1]?.rect
    expect((right?.x ?? 0) + (right?.width ?? 0)).toBeGreaterThan(
      book.settings.trim.widthMm,
    )

    const interior = resolveSpread(book, 'painter-spread-1')
    expect(interior?.pageCuts).toEqual([
      {
        orientation: 'vertical',
        offsetMm: book.settings.trim.widthMm,
      },
    ])
  })
})
