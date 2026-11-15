import type { CSSProperties } from 'react'
import type { ResolvedText, TextStyleId } from '../core'
import {
  TEXT_COLOR,
  TEXT_STYLES,
  textLineMm,
  wholeLinesHeightMm,
} from '../core/pdf/textLayout'

// The styles live in core: the print PDF sets the same text.
export {
  PHOTO_CAPTION_SIZE_MM,
  TEXT_COLOR,
  TEXT_STYLES,
  textLineMm,
  wholeLinesHeightMm,
} from '../core/pdf/textLayout'

/** Slack that keeps an exact multiple of the line from losing a line to float error. */
const LINE_EPSILON = 1e-6

/** Box height that fits `contentMm` of text, rounded up to whole lines. */
export function fitTextHeightMm(
  contentMm: number,
  styleId: TextStyleId,
): number {
  const line = textLineMm(styleId)
  return Math.ceil(contentMm / line - LINE_EPSILON) * line
}

/** CSS `font` shorthand of every style (for `loadFonts` before a measure). */
export function textStyleFonts(): string[] {
  return Object.values(TEXT_STYLES).map(
    (style) => `${String(style.weight)} 16px ${style.fontFamily}`,
  )
}

/** Inline style of a text node: book units × `pxPerMm`. */
export function textNodeStyle(
  text: Pick<ResolvedText, 'styleId' | 'align'>,
  heightMm: number,
  pxPerMm: number,
): CSSProperties {
  const style = TEXT_STYLES[text.styleId]
  return {
    height: wholeLinesHeightMm(heightMm, text.styleId) * pxPerMm,
    fontFamily: style.fontFamily,
    fontSize: style.sizeMm * pxPerMm,
    fontWeight: style.weight,
    lineHeight: style.lineHeight,
    textAlign: text.align,
    color: TEXT_COLOR,
  }
}
