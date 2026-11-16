import { describe, expect, it } from 'vitest'
import {
  baselineOffset,
  CAPTION_COLOR,
  CAPTION_GAP_MM,
  CAPTION_LINE_HEIGHT,
  ellipsize,
  FOLIO_LINE_HEIGHT,
  layoutCaption,
  layoutFolio,
  layoutTextFrame,
  TEXT_COLOR,
  TEXT_STYLES,
  type TextMetrics,
  textLineMm,
  UI_FONT,
} from './textLayout'

/** Every character half the size wide; ascent 0.8, descent 0.2 of the size. */
const MONO: TextMetrics = {
  width: (text, font) => Array.from(text).length * font.sizeMm * 0.5,
  ascent: (font) => font.sizeMm * 0.8,
  descent: (font) => font.sizeMm * 0.2,
}

const body = TEXT_STYLES.body
/** One body character, in mm. */
const CHAR = body.sizeMm * 0.5
const LINE = textLineMm('body')

describe('textLayout', () => {
  it('names each style font family first in its CSS stack', () => {
    for (const style of Object.values(TEXT_STYLES)) {
      expect(style.fontFamily.startsWith(`'${style.family}'`)).toBe(true)
    }
  })

  it('puts the baseline half the leading below the line top, plus the ascent', () => {
    expect(baselineOffset(10, 6, 2)).toBe(7)
  })

  it('sets text frame lines left, centred or right per line, a line apart', () => {
    const size = { width: 10 * CHAR, height: 5 * LINE }
    const lines = (align: 'left' | 'center' | 'right') =>
      layoutTextFrame(
        { text: 'aaaa bbbbbb\ncc', styleId: 'body', align },
        size,
        MONO,
      ).lines

    const top = baselineOffset(LINE, body.sizeMm * 0.8, body.sizeMm * 0.2)
    expect(lines('left')).toEqual([
      { text: 'aaaa', x: 0, baseline: top },
      { text: 'bbbbbb', x: 0, baseline: top + LINE },
      { text: 'cc', x: 0, baseline: top + 2 * LINE },
    ])
    const inChars = (align: 'center' | 'right') =>
      lines(align).map((line) => Math.round((line.x / CHAR) * 1e9) / 1e9)
    expect(inChars('right')).toEqual([6, 4, 8])
    expect(inChars('center')).toEqual([3, 2, 4])
  })

  it('keeps whole lines of the frame height only, clipped to the frame', () => {
    const block = layoutTextFrame(
      { text: 'a\nb\nc', styleId: 'body', align: 'left' },
      { width: 40, height: 2.5 * LINE },
      MONO,
    )

    expect(block.lines.map((line) => line.text)).toEqual(['a', 'b'])
    expect(block.clip).toEqual({ x: 0, y: 0, width: 40, height: 2.5 * LINE })
    expect(block.color).toBe(TEXT_COLOR)
    expect(block.font).toEqual({
      family: body.family,
      weight: body.weight,
      sizeMm: body.sizeMm,
    })
  })

  it('cuts a caption to the frame width with an ellipsis, under the frame', () => {
    const char = UI_FONT.sizeMm * 0.5
    const block = layoutCaption(
      'Lake at dawn',
      { width: 6 * char, height: 50 },
      MONO,
    )

    expect(block.lines.map((line) => line.text)).toEqual(['Lake …'])
    expect(block.color).toBe(CAPTION_COLOR)
    expect(block.clip?.y).toBe(50 + CAPTION_GAP_MM)
    expect(block.clip?.width).toBe(6 * char)
    const line = UI_FONT.sizeMm * CAPTION_LINE_HEIGHT
    expect(block.clip?.height).toBeCloseTo(line)
    expect(block.lines[0]?.baseline).toBeCloseTo(
      50 + CAPTION_GAP_MM + (line - UI_FONT.sizeMm) / 2 + UI_FONT.sizeMm * 0.8,
    )
  })

  it('aligns a folio in its rect, unclipped', () => {
    const char = UI_FONT.sizeMm * 0.5
    const folio = (align: 'left' | 'center' | 'right') =>
      layoutFolio(
        {
          id: 'pn',
          text: '12',
          align,
          rectMm: { x: 100, y: 280, width: 10 * char, height: 6 },
        },
        MONO,
      )

    expect(folio('left').lines[0]?.x).toBe(100)
    expect(folio('center').lines[0]?.x).toBe(100 + 4 * char)
    expect(folio('right').lines[0]?.x).toBe(100 + 8 * char)
    expect(folio('left').clip).toBeUndefined()
    const line = UI_FONT.sizeMm * FOLIO_LINE_HEIGHT
    expect(folio('left').lines[0]?.baseline).toBeCloseTo(
      280 + (line - UI_FONT.sizeMm) / 2 + UI_FONT.sizeMm * 0.8,
    )
  })

  it('ellipsize keeps text that fits and drops every character when none fits', () => {
    const measure = (text: string) => text.length
    expect(ellipsize(measure, 'abc', 3)).toBe('abc')
    expect(ellipsize(measure, 'abcd', 3)).toBe('ab…')
    expect(ellipsize(measure, 'abcd', 0)).toBe('…')
  })
})
