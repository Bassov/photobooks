import { describe, expect, it } from 'vitest'
import {
  fitTextHeightMm,
  TEXT_COLOR,
  TEXT_STYLES,
  textLineMm,
  textNodeStyle,
  textStyleFonts,
  wholeLinesHeightMm,
} from './textStyles'

describe('text styles', () => {
  it('pins the Designer type scale', () => {
    expect(TEXT_STYLES).toEqual({
      title: {
        fontFamily: "'Lora Variable', Georgia, serif",
        sizeMm: 9,
        weight: 500,
        lineHeight: 1.15,
      },
      caption: {
        fontFamily: "'Inter Variable', system-ui, sans-serif",
        sizeMm: 3.1,
        weight: 400,
        lineHeight: 1.4,
      },
      body: {
        fontFamily: "'Inter Variable', system-ui, sans-serif",
        sizeMm: 3.6,
        weight: 400,
        lineHeight: 1.5,
      },
    })
    expect(TEXT_COLOR).toBe('#232220')
  })

  it('derives the line in mm', () => {
    expect(textLineMm('title')).toBeCloseTo(10.35, 10)
    expect(textLineMm('caption')).toBeCloseTo(4.34, 10)
    expect(textLineMm('body')).toBeCloseTo(5.4, 10)
  })
})

describe('wholeLinesHeightMm', () => {
  it('keeps whole lines only', () => {
    expect(wholeLinesHeightMm(14, 'caption')).toBeCloseTo(3 * 4.34, 10)
    expect(wholeLinesHeightMm(14, 'title')).toBeCloseTo(10.35, 10)
    expect(wholeLinesHeightMm(10, 'title')).toBe(0)
  })

  it('keeps an exact multiple despite float error', () => {
    // 3 × 4.34 in floats is 13.020000000000001; 13.02 must still hold 3 lines.
    expect(wholeLinesHeightMm(13.02, 'caption')).toBeCloseTo(13.02, 10)
    expect(wholeLinesHeightMm(13.0199, 'caption')).toBeCloseTo(8.68, 10)
  })
})

describe('fitTextHeightMm', () => {
  it('rounds content up to whole lines', () => {
    expect(fitTextHeightMm(4.35, 'caption')).toBeCloseTo(8.68, 10)
    expect(fitTextHeightMm(13.02, 'caption')).toBeCloseTo(13.02, 10)
    expect(fitTextHeightMm(0, 'body')).toBeCloseTo(0, 10)
    expect(fitTextHeightMm(5.41, 'body')).toBeCloseTo(10.8, 10)
  })
})

describe('textNodeStyle', () => {
  it('scales book units by px/mm', () => {
    expect(textNodeStyle({ styleId: 'body', align: 'center' }, 11, 2)).toEqual({
      height: 2 * textLineMm('body') * 2,
      fontFamily: "'Inter Variable', system-ui, sans-serif",
      fontSize: 7.2,
      fontWeight: 400,
      lineHeight: 1.5,
      textAlign: 'center',
      color: '#232220',
    })
  })
})

describe('textStyleFonts', () => {
  it('lists a loadable font per style, Lora 500 included', () => {
    expect(textStyleFonts()).toEqual([
      "500 16px 'Lora Variable', Georgia, serif",
      "400 16px 'Inter Variable', system-ui, sans-serif",
      "400 16px 'Inter Variable', system-ui, sans-serif",
    ])
  })
})
