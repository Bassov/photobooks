import type { CSSProperties } from 'react'
import type { ResolvedText, TextStyleId } from '../core'

/** One built-in text style in book units (Designer text-frames). */
export interface TextStyleSpec {
  fontFamily: string
  sizeMm: number
  weight: number
  lineHeight: number
}

export const TEXT_STYLES: Readonly<Record<TextStyleId, TextStyleSpec>> = {
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
}

/** Printed text colour (rgb(35 34 32)). */
export const TEXT_COLOR = '#232220'

/** Photo caption size under a frame (kit Caption), in mm. */
export const PHOTO_CAPTION_SIZE_MM = 3.1

/** Slack that keeps an exact multiple of the line from losing a line to float error. */
const LINE_EPSILON = 1e-6

export function textLineMm(styleId: TextStyleId): number {
  const style = TEXT_STYLES[styleId]
  return style.sizeMm * style.lineHeight
}

/** Visible text height: whole lines only, so no line is cut mid-glyph. */
export function wholeLinesHeightMm(
  heightMm: number,
  styleId: TextStyleId,
): number {
  const line = textLineMm(styleId)
  return Math.floor(heightMm / line + LINE_EPSILON) * line
}

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
