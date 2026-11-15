import type { BookFontFamily } from '../../fonts/bookFonts'
import type { ResolvedFolio, ResolvedText } from '../geometry/types'
import type { TextStyleId } from '../schema'

/**
 * Text layout shared by the canvas page painter and the print PDF: the
 * built-in styles, line breaking and line placement, in book mm.
 */

/** One built-in text style in book units (Designer text-frames). */
export interface TextStyleSpec {
  /** The book font the style sets (`fontFamily` names it first). */
  family: BookFontFamily
  fontFamily: string
  sizeMm: number
  weight: number
  lineHeight: number
}

export const TEXT_STYLES: Readonly<Record<TextStyleId, TextStyleSpec>> = {
  title: {
    family: 'Lora Variable',
    fontFamily: "'Lora Variable', Georgia, serif",
    sizeMm: 9,
    weight: 500,
    lineHeight: 1.15,
  },
  caption: {
    family: 'Inter Variable',
    fontFamily: "'Inter Variable', system-ui, sans-serif",
    sizeMm: 3.1,
    weight: 400,
    lineHeight: 1.4,
  },
  body: {
    family: 'Inter Variable',
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

/** `--muted-foreground` (styles/tokens.css): `.spread-frame-caption` colour. */
export const CAPTION_COLOR = '#535152'
/** `SpreadView` CAPTION_GAP_MM: the caption sits 1.5 mm under the frame. */
export const CAPTION_GAP_MM = 1.5
/** `.spread-frame-caption` / `.spread-view-folio` line heights. */
export const CAPTION_LINE_HEIGHT = 1.3
export const FOLIO_LINE_HEIGHT = 1.4
/** `--font-ui` (styles/tokens.css) for captions and folios, at weight 400. */
const UI_FONT_FAMILY: BookFontFamily = 'Inter Variable'
const ELLIPSIS = '…'

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

/**
 * Lines of `text` in a box `maxWidth` wide, as CSS `white-space: pre-wrap;
 * overflow-wrap: anywhere` breaks them: hard breaks, then greedy at spaces
 * (trailing spaces hang), and a word wider than the box splits anywhere.
 */
export function breakTextLines(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const token of paragraph.match(/[^ ]+ *| /g) ?? []) {
      if (measure((line + token).trimEnd()) <= maxWidth) {
        line += token
        continue
      }
      if (line !== '') {
        lines.push(line.trimEnd())
        line = ''
      }
      const word = token.trimEnd()
      for (const char of word) {
        if (line !== '' && measure(line + char) > maxWidth) {
          lines.push(line)
          line = ''
        }
        line += char
      }
      line += token.slice(word.length)
    }
    lines.push(line.trimEnd())
  }
  return lines
}

/** `text` cut with an ellipsis to fit `maxWidth`, like `text-overflow`. */
export function ellipsize(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
): string {
  if (measure(text) <= maxWidth) return text
  const chars = Array.from(text)
  while (chars.length > 0 && measure(chars.join('') + ELLIPSIS) > maxWidth) {
    chars.pop()
  }
  return chars.join('') + ELLIPSIS
}

/** First line box baseline: half-leading above the font's ascent. */
export function baselineOffset(
  lineHeight: number,
  ascent: number,
  descent: number,
): number {
  return (lineHeight - (ascent + descent)) / 2 + ascent
}

/** A font at a size: what a line is set in. */
export interface TextFont {
  family: BookFontFamily
  weight: number
  sizeMm: number
}

/** Widths and vertical metrics of set text, in mm. */
export interface TextMetrics {
  width: (text: string, font: TextFont) => number
  /** Font ascent / descent (both ≥ 0) at the font's size. */
  ascent: (font: TextFont) => number
  descent: (font: TextFont) => number
}

interface PlacedLine {
  text: string
  /** Left end of the line, in the block's mm. */
  x: number
  /** Baseline, y down from the block's top. */
  baseline: number
}

/** Lines in one font and colour, with the clip they print in (block mm). */
export interface TextBlock {
  font: TextFont
  color: string
  /** Omitted: the lines print unclipped. */
  clip?: { x: number; y: number; width: number; height: number }
  lines: PlacedLine[]
}

function lineX(
  align: ResolvedText['align'],
  boxWidth: number,
  lineWidth: number,
): number {
  if (align === 'center') return (boxWidth - lineWidth) / 2
  return align === 'right' ? boxWidth - lineWidth : 0
}

/** Font of a text style. */
export function styleFont(styleId: TextStyleId): TextFont {
  const { family, weight, sizeMm } = TEXT_STYLES[styleId]
  return { family, weight, sizeMm }
}

/** Captions and folios. */
export const UI_FONT: TextFont = {
  family: UI_FONT_FAMILY,
  weight: 400,
  sizeMm: PHOTO_CAPTION_SIZE_MM,
}

/**
 * A text frame's lines as `SpreadView` sets them: the frame's width, whole
 * lines of its height only, aligned per line; frame-local mm.
 */
export function layoutTextFrame(
  text: ResolvedText,
  size: { width: number; height: number },
  metrics: TextMetrics,
): TextBlock {
  const font = styleFont(text.styleId)
  const lineHeight = textLineMm(text.styleId)
  const measure = (line: string) => metrics.width(line, font)
  const visible = Math.round(
    wholeLinesHeightMm(size.height, text.styleId) / lineHeight,
  )
  const top = baselineOffset(
    lineHeight,
    metrics.ascent(font),
    metrics.descent(font),
  )
  const lines = breakTextLines(measure, text.text, size.width)
    .slice(0, visible)
    .map((line, index) => ({
      text: line,
      x: lineX(text.align, size.width, measure(line)),
      baseline: index * lineHeight + top,
    }))
  return {
    font,
    color: TEXT_COLOR,
    clip: { x: 0, y: 0, width: size.width, height: size.height },
    lines,
  }
}

/** The one-line caption under a frame `size`, frame-local mm. */
export function layoutCaption(
  caption: string,
  size: { width: number; height: number },
  metrics: TextMetrics,
): TextBlock {
  const font = UI_FONT
  const lineHeight = font.sizeMm * CAPTION_LINE_HEIGHT
  const top = size.height + CAPTION_GAP_MM
  const line = ellipsize(
    (text) => metrics.width(text, font),
    caption,
    size.width,
  )
  return {
    font,
    color: CAPTION_COLOR,
    clip: { x: 0, y: top, width: size.width, height: lineHeight },
    lines: [
      {
        text: line,
        x: 0,
        baseline:
          top +
          baselineOffset(
            lineHeight,
            metrics.ascent(font),
            metrics.descent(font),
          ),
      },
    ],
  }
}

/** A page number in its folio rect, spread mm (unclipped, as the DOM). */
export function layoutFolio(
  folio: ResolvedFolio,
  metrics: TextMetrics,
): TextBlock {
  const font = UI_FONT
  const { x, y, width } = folio.rectMm
  const lineHeight = font.sizeMm * FOLIO_LINE_HEIGHT
  return {
    font,
    color: TEXT_COLOR,
    lines: [
      {
        text: folio.text,
        x: x + lineX(folio.align, width, metrics.width(folio.text, font)),
        baseline:
          y +
          baselineOffset(
            lineHeight,
            metrics.ascent(font),
            metrics.descent(font),
          ),
      },
    ],
  }
}
