import { describe, expect, it } from 'vitest'
import { COVER_TITLE_FONTS } from '../core/schema'
import {
  COVER_TITLE_FACES,
  coverInk,
  siteTitleFace,
  siteTitleStyle,
} from './coverTitleFace'

const SERIF = '"Lora Cover", "Lora Variable", Lora, serif'

describe('cover title faces', () => {
  it('maps every Title font to its editor cover face', () => {
    expect(Object.keys(COVER_TITLE_FACES).sort()).toStrictEqual(
      [...COVER_TITLE_FONTS].sort(),
    )
    expect(COVER_TITLE_FACES).toStrictEqual({
      'serif-italic': { family: SERIF, style: 'italic', weight: 400 },
      serif: { family: SERIF, style: 'normal', weight: 400 },
      sans: {
        family: 'var(--font-sans, sans-serif)',
        style: 'normal',
        weight: 400,
      },
    })
  })

  it('gives the site front the serif faces only (D38)', () => {
    expect(siteTitleFace('serif-italic')).toBe(
      COVER_TITLE_FACES['serif-italic'],
    )
    expect(siteTitleFace('serif')).toBe(COVER_TITLE_FACES.serif)
    expect(siteTitleFace('sans')).toBeUndefined()
    expect(siteTitleFace(undefined)).toBeUndefined()
    expect(siteTitleFace('cursive')).toBeUndefined()
  })

  it('inks a photo-less front by the D38 cloth luminance', () => {
    // #3E3C3B (default cloth) ≈ 0.045; #838383 ≈ 0.227 and #848484 ≈ 0.231 bracket 0.23.
    expect(coverInk('#3E3C3B')).toBe('#F5F5F5')
    expect(coverInk('#838383')).toBe('#F5F5F5')
    expect(coverInk('#848484')).toBe('#2E2C2D')
    expect(coverInk('#E8E6E3')).toBe('#2E2C2D')
  })

  it('styles the site title inline, nothing for the site sans', () => {
    expect(siteTitleStyle('serif')).toStrictEqual({
      fontFamily: SERIF,
      fontStyle: 'normal',
      fontWeight: 400,
    })
    expect(siteTitleStyle('sans')).toStrictEqual({})
    expect(siteTitleStyle('constructor')).toStrictEqual({})
  })
})
