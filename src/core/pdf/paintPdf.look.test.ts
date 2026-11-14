import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { genericPrintProfile } from '../print/genericProfile'
import type { FrameStyle } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { paintBookPdf } from './paintPdf'
import { PT_PER_MM } from './pdfGeometry'

/** 1 × 1 RGBA PNG. */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
)

const PRESET_MIX: FrameStyle = {
  strokeMm: 0.3,
  strokeColor: '#1c1b1a',
  matMm: 3,
  matColor: '#ffffff',
  cornerRadiusMm: 4,
}

/** Content stream lines of the single page painted for a one-frame book. */
async function pageLines(style: FrameStyle | undefined): Promise<string[]> {
  const book = makeBook({
    assets: { photo: {} },
    frameStyles: style === undefined ? {} : { look: style },
    spreads: [
      makeSpread({
        frames: [
          makeFrame({
            assetId: 'photo',
            ...(style === undefined ? {} : { frameStyleId: 'look' }),
          }),
        ],
      }),
    ],
  })
  const result = await paintBookPdf({
    book,
    profile: genericPrintProfile(),
    photos: () => Promise.resolve(PNG),
    marks: false,
  })
  const doc = await PDFDocument.load(result.pdf)
  const contents = doc.getPage(0).node.normalizedEntries().Contents
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => doc.context.lookup(ref))
      : []
  return streams
    .filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
    .flatMap((stream) =>
      new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode()),
    )
    .join('\n')
    .split('\n')
    .filter((line) => line !== '')
}

/** Operators of the frame, from its `cm` to its closing `Q`. */
function frameOps(lines: string[]): string[] {
  const ops = lines.map((line) => line.split(' ').at(-1) ?? '')
  // Sheet `q cm re W n`, then the frame's `q cm …`.
  const start = ops.indexOf('cm', ops.indexOf('n'))
  return ops.slice(start, ops.lastIndexOf('Q'))
}

const ROUNDED = ['m', 'l', 'c', 'l', 'c', 'l', 'c', 'l', 'c', 'h']

describe('paintBookPdf frame looks', () => {
  it('paints the mat, the rounded clip, the inset photo and the stroke on top', async () => {
    const lines = await pageLines(PRESET_MIX)

    expect(frameOps(lines)).toEqual([
      'cm',
      ...ROUNDED,
      'W',
      'n',
      'rg',
      ...ROUNDED,
      'f',
      'q',
      ...ROUNDED,
      'W',
      'n',
      'cm',
      'Do',
      'Q',
      'RG',
      'w',
      ...ROUNDED,
      'S',
      'Q',
    ])
    expect(lines).toContain('1 1 1 rg')
    const strokeColor = lines.find((line) => line.endsWith(' RG'))
    expect(strokeColor?.split(' ').slice(0, 3).map(Number)).toEqual([
      0x1c / 255,
      0x1b / 255,
      0x1a / 255,
    ])
    const width = Number(
      lines.find((line) => line.endsWith(' w'))?.split(' ')[0],
    )
    // Frame space is mm; the page CTM scales it by PT_PER_MM: 0.3 mm = 0.85 pt.
    expect(Math.abs(width * PT_PER_MM - 0.85)).toBeLessThan(0.01)
  })

  it('paints a frame without a style as a plain clipped photo', async () => {
    const lines = await pageLines(undefined)

    expect(frameOps(lines)).toEqual(['cm', 're', 'W', 'n', 'cm', 'Do', 'Q'])
  })

  it('paints a style that draws nothing like no style', async () => {
    const none = await pageLines(undefined)
    const empty = await pageLines({ strokeMm: 0, matMm: 0 })

    expect(empty).toEqual(none)
  })

  it('leaves out the mat fill and the stroke the style does not have', async () => {
    const lines = await pageLines({ cornerRadiusMm: 4 })

    expect(frameOps(lines)).toEqual([
      'cm',
      ...ROUNDED,
      'W',
      'n',
      'q',
      ...ROUNDED,
      'W',
      'n',
      'cm',
      'Do',
      'Q',
      'Q',
    ])
  })

  it('uses the canvas colours when the style sets none', async () => {
    const lines = await pageLines({ strokeMm: 0.3, matMm: 3 })

    expect(lines).toContain('1 1 1 rg')
    const strokeColor = lines.find((line) => line.endsWith(' RG'))
    expect(strokeColor?.split(' ').slice(0, 3).map(Number)).toEqual([
      0x1c / 255,
      0x1b / 255,
      0x1a / 255,
    ])
  })
})
