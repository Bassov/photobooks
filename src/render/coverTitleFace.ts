import type { CSSProperties } from 'react'
import type { CoverStyle } from '../core'

export type CoverTitleFont = CoverStyle['titleFont']

/** A cover title face as CSS / canvas font parts. */
export interface CoverTitleFace {
  family: string
  style: 'italic' | 'normal'
  weight: 400
}

/** The upright-only `Lora Cover` alias (CoverView.css); italic is synthesised. */
const SERIF = '"Lora Cover", "Lora Variable", Lora, serif'

/** The book's Title font → its cover face (the editor cover, the site front, the GL cover). */
export const COVER_TITLE_FACES: Readonly<
  Record<CoverTitleFont, CoverTitleFace>
> = {
  'serif-italic': { family: SERIF, style: 'italic', weight: 400 },
  serif: { family: SERIF, style: 'normal', weight: 400 },
  sans: {
    family: 'var(--font-sans, sans-serif)',
    style: 'normal',
    weight: 400,
  },
}

/**
 * The site front title face (D38): the serif Title fonts; `sans`, a missing
 * (older export) or an unknown value keep the site's own sans.
 */
export function siteTitleFace(
  titleFont: string | undefined,
): CoverTitleFace | undefined {
  if (titleFont !== 'serif-italic' && titleFont !== 'serif') return undefined
  return COVER_TITLE_FACES[titleFont]
}

/** `siteTitleFace` as inline style over `.ss .sd-it` (empty: the site sans). */
export function siteTitleStyle(titleFont: string | undefined): CSSProperties {
  const face = siteTitleFace(titleFont)
  if (face === undefined) return {}
  return {
    fontFamily: face.family,
    fontStyle: face.style,
    fontWeight: face.weight,
  }
}
