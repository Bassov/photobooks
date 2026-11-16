import type { PDFOperator, PDFPage } from '@cantoo/pdf-lib'
import type { RectMm } from '../geometry/types'
import { type CoverGeometry, coverGeometry } from '../print/coverGeometry'
import type { Cover, CoverStyle } from '../schema'
import {
  cm,
  type Embedded,
  embedPhotos,
  type PaintPdfInput,
  type PdfLib,
  rgb,
  type SkippedPhoto,
} from './paintPdf'
import { type FontNeed, loadPdfFonts, type PdfFonts } from './pdfFonts'
import { streamPdf } from './pdfStream'
import {
  baselineOffset,
  breakTextLines,
  ellipsize,
  type TextFont,
} from './textLayout'
import {
  compose,
  coverPhotoRect,
  coverSheetMarks,
  CROP_MARK_WIDTH_PT,
  imageMatrix,
  type Matrix,
  orientedAspect,
  PT_PER_MM,
  rotate,
  sheetBoxes,
  sheetMatrix,
  translate,
} from './pdfGeometry'

export type PaintCoverPdfInput = Omit<PaintPdfInput, 'onSheet'>

export interface PaintCoverPdfResult {
  /** Bytes of the PDF file, every chunk together. */
  bytes: number
  /** The front photo when it is gone or unreadable (the cloth shows). */
  skipped: SkippedPhoto[]
}

/** CoverView sizes its text in 848ths of the closed cover's width (kit Fit). */
const COVER_KIT_FIT = 848
/** `--cover-title-ink` and `--cover-ink` (CoverView.css). */
const TITLE_COLOR = '#FFFFFF'
const INK_COLOR = '#E8E6E3'
/** Cover text line height (kit page line-height). */
const LINE_HEIGHT = 1.5
/** Chromium's synthetic italic: x shifts by this per unit of height. */
const OBLIQUE_SKEW = 0.25

/** One cover text in a font: its lines in sheet mm (y down). */
interface CoverText {
  font: TextFont
  color: string
  oblique: boolean
  /** Sheet mm → the lines' mm; omitted: the sheet itself. */
  matrix?: Matrix
  lines: { text: string; x: number; baseline: number }[]
}

/** Title and spine font (CoverView `data-title-font`); the back is `sans`. */
export function titleFace(titleFont: CoverStyle['titleFont']) {
  return {
    family: titleFont === 'sans' ? 'Inter Variable' : 'Lora Variable',
    weight: 400,
    oblique: titleFont === 'serif-italic',
  } as const
}

const BACK_FACE = { family: 'Inter Variable', weight: 400 } as const

/**
 * Paints the book's cover sheet (`coverGeometry` with `profile`) into a
 * one-page print PDF (Designer cover-pdf §2.5): the cloth over the bleed,
 * the front photo as the canvas places it grown to the bleed, the back,
 * spine and front texts in the book fonts, then with `marks` crop and spine
 * fold marks. The file streams to `onChunk` as the interior does.
 */
export async function paintCoverPdf(
  input: PaintCoverPdfInput,
): Promise<PaintCoverPdfResult> {
  // Loaded on export only: the library stays out of every other chunk.
  const lib: PdfLib = await import('@cantoo/pdf-lib')
  const { book, profile, marks } = input
  const doc = await lib.PDFDocument.create()
  if (book.title !== undefined && book.title !== '') doc.setTitle(book.title)
  const stream = streamPdf(lib, doc.context, input.onChunk)

  const geometry = coverGeometry(profile, book)
  const { assetId } = book.cover.front
  const { embedded, skipped } = await embedPhotos(
    lib,
    doc,
    stream,
    assetId === undefined ? [] : [assetId],
    input,
  )
  const photo = embedded.get(assetId)
  const fonts = await loadPdfFonts(lib, doc, fontNeeds(book.cover), input.fonts)

  const bleedMm = marks ? profile.coverBleedMm : 0
  const { sheetW, sheetH } = geometry
  const boxes = sheetBoxes(sheetW, sheetH, bleedMm, marks)
  const page = doc.addPage([boxes.media.width, boxes.media.height])
  page.setBleedBox(
    boxes.bleed.x,
    boxes.bleed.y,
    boxes.bleed.width,
    boxes.bleed.height,
  )
  page.setTrimBox(
    boxes.trim.x,
    boxes.trim.y,
    boxes.trim.width,
    boxes.trim.height,
  )
  const sheet = {
    spreadIndex: 0,
    trim: { x: 0, y: 0, width: sheetW, height: sheetH },
  }
  const bleedRect = () =>
    lib.rectangle(
      -bleedMm,
      -bleedMm,
      sheetW + 2 * bleedMm,
      sheetH + 2 * bleedMm,
    )
  const ops: PDFOperator[] = [
    lib.pushGraphicsState(),
    cm(lib, sheetMatrix(sheet, boxes.slugMm)),
    bleedRect(),
    lib.clip(),
    lib.endPath(),
    lib.setFillingRgbColor(...rgb(book.cover.style.backFill)),
    bleedRect(),
    lib.fill(),
  ]
  if (photo !== undefined) {
    ops.push(...paintFront(lib, page, geometry, bleedMm, photo, book.cover))
  }
  for (const text of coverTexts(book.cover, geometry, fonts)) {
    ops.push(...paintText(lib, page, fonts, text))
  }
  ops.push(lib.popGraphicsState())
  if (marks) {
    ops.push(
      lib.pushGraphicsState(),
      cm(lib, sheetMatrix(sheet, boxes.slugMm)),
      lib.setLineWidth(CROP_MARK_WIDTH_PT / PT_PER_MM),
      lib.setStrokingGrayscaleColor(0),
      ...coverSheetMarks(geometry, bleedMm).flatMap(({ from, to }) => [
        lib.moveTo(from.x, from.y),
        lib.lineTo(to.x, to.y),
      ]),
      lib.stroke(),
      lib.popGraphicsState(),
    )
  }
  page.pushOperators(...ops)
  // Each font once, with every glyph the page sets; the page streams with it.
  await fonts.embed()

  return { bytes: stream.finish(), skipped }
}

/**
 * The front photo box B grown by the bleed on its top, outer and bottom
 * edges (B'); the spine-side edge stays on the fold.
 */
function frontBleedBox(box: RectMm, bleedMm: number): RectMm {
  return {
    x: box.x,
    y: box.y - bleedMm,
    width: box.width + bleedMm,
    height: box.height + 2 * bleedMm,
  }
}

function paintFront(
  lib: PdfLib,
  page: PDFPage,
  geometry: CoverGeometry,
  bleedMm: number,
  photo: Embedded,
  cover: Cover,
): PDFOperator[] {
  const box = geometry.rects.frontPhoto
  const clip = frontBleedBox(box, bleedMm)
  const aspect = orientedAspect(photo.width, photo.height, photo.orientation)
  const rect = coverPhotoRect(box, aspect, cover.front.crop, clip)
  const name = page.node.newXObject('Image', photo.ref)
  return [
    lib.pushGraphicsState(),
    lib.rectangle(clip.x, clip.y, clip.width, clip.height),
    lib.clip(),
    lib.endPath(),
    cm(
      lib,
      compose(
        translate(rect.x, rect.y),
        imageMatrix({ rectMm: rect }, photo.orientation),
      ),
    ),
    lib.drawObject(name),
    lib.popGraphicsState(),
  ]
}

/** Text sizes in mm: CoverView's `100cqw × n / 848` of the closed cover. */
function textSizes(geometry: CoverGeometry) {
  const cqw = geometry.coverW / COVER_KIT_FIT
  return {
    title: 34 * cqw,
    back: 11 * cqw,
    spine: Math.min(12 * cqw, geometry.spine / 2),
  }
}

/** The spine line: one line, cut with "…" past trim height − 2 × safe. */
function spineLength(geometry: CoverGeometry): number {
  return geometry.trimH - 2 * geometry.safe
}

/** Faces and text the page sets: what the PDF embeds. */
function fontNeeds(cover: Cover): FontNeed[] {
  const face = titleFace(cover.style.titleFont)
  const spine = cover.spine.text === '' ? '' : `${cover.spine.text}…`
  return [
    { font: face, text: cover.front.text },
    { font: face, text: spine },
    { font: BACK_FACE, text: cover.back.text },
  ]
}

/** Back, spine and front title as CoverView sets them; empty texts drop out. */
function coverTexts(
  cover: Cover,
  geometry: CoverGeometry,
  fonts: PdfFonts,
): CoverText[] {
  const { trimW, trimH, wrap, rects } = geometry
  const sizes = textSizes(geometry)
  const face = titleFace(cover.style.titleFont)
  const lineOf = (font: TextFont) => {
    const height = font.sizeMm * LINE_HEIGHT
    const top = baselineOffset(height, fonts.ascent(font), fonts.descent(font))
    return { height, top }
  }
  const texts: CoverText[] = []

  if (cover.back.text !== '') {
    const font = { ...BACK_FACE, sizeMm: sizes.back }
    const line = lineOf(font)
    const lines = breakTextLines(
      (text) => fonts.width(text, font),
      cover.back.text,
      0.76 * trimW,
    )
    // The last line box ends at 90 % of the trim height.
    const top = wrap + 0.9 * trimH - lines.length * line.height
    texts.push({
      font,
      color: INK_COLOR,
      oblique: false,
      lines: lines.map((text, index) => ({
        text,
        x: wrap + 0.12 * trimW,
        baseline: top + index * line.height + line.top,
      })),
    })
  }

  if (cover.spine.text !== '') {
    const font = {
      family: face.family,
      weight: face.weight,
      sizeMm: sizes.spine,
    }
    const line = lineOf(font)
    const measure = (text: string) => fonts.width(text, font)
    const text = ellipsize(measure, cover.spine.text, spineLength(geometry))
    const turn = cover.style.spineDirection === 'bottom-to-top' ? -90 : 90
    texts.push({
      font,
      color: INK_COLOR,
      oblique: face.oblique,
      matrix: compose(
        translate(rects.spine.x + geometry.spine / 2, wrap + trimH / 2),
        rotate(turn),
      ),
      lines: [
        {
          text,
          x: -measure(text) / 2,
          baseline: line.top - line.height / 2,
        },
      ],
    })
  }

  if (cover.front.text !== '') {
    const font = {
      family: face.family,
      weight: face.weight,
      sizeMm: sizes.title,
    }
    const line = lineOf(font)
    const top = wrap + 0.09 * trimH
    texts.push({
      font,
      color: TITLE_COLOR,
      oblique: face.oblique,
      lines: breakTextLines(
        (text) => fonts.width(text, font),
        cover.front.text,
        0.8 * trimW,
      ).map((text, index) => ({
        text,
        x: rects.front.x + 0.1 * trimW,
        baseline: top + index * line.height + line.top,
      })),
    })
  }
  return texts
}

/**
 * A cover text's lines; an oblique one is sheared about each baseline as
 * Chromium synthesises italic from an upright face.
 */
function paintText(
  lib: PdfLib,
  page: PDFPage,
  fonts: PdfFonts,
  text: CoverText,
): PDFOperator[] {
  const ops = [lib.pushGraphicsState()]
  if (text.matrix !== undefined) ops.push(cm(lib, text.matrix))
  ops.push(lib.setFillingRgbColor(...rgb(text.color)))
  for (const line of text.lines) {
    if (line.text === '') continue
    const show = fonts.show(page, text.font, line.text, line.x, line.baseline)
    ops.push(
      ...(text.oblique
        ? [
            lib.pushGraphicsState(),
            cm(lib, [1, 0, -OBLIQUE_SKEW, 1, OBLIQUE_SKEW * line.baseline, 0]),
            ...show,
            lib.popGraphicsState(),
          ]
        : show),
    )
  }
  ops.push(lib.popGraphicsState())
  return ops
}
