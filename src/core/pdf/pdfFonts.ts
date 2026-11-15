import type {
  PDFDocument,
  PDFFont,
  PDFName,
  PDFOperator,
  PDFPage,
} from '@cantoo/pdf-lib'
import type { Font, Glyph, Subset } from '@pdf-lib/fontkit'
import {
  type BookFontFace,
  type BookFontFamily,
  clampWeight,
  facesForCodePoint,
} from '../../fonts/bookFonts'
import type { TextFont, TextMetrics } from './textLayout'

type PdfLib = typeof import('@cantoo/pdf-lib')

/** Bytes of a book font file (`public/fonts/<file>`, the DOM's own files). */
export type FontFileSource = (file: string) => Promise<Uint8Array>

/** Text a PDF sets in a book font: which font files it embeds. */
export interface FontNeed {
  font: Pick<TextFont, 'family' | 'weight'>
  text: string
}

export interface PdfFonts extends TextMetrics {
  /**
   * Sets `text` on `page` in `font`, its baseline's left end at
   * (`x`, `baseline`) in the current mm space (y down), kerned as measured.
   */
  show: (
    page: PDFPage,
    font: TextFont,
    text: string,
    x: number,
    baseline: number,
  ) => PDFOperator[]
  /** Writes each face (a subset of the glyphs shown) once: after the last page. */
  embed: () => Promise<void>
}

/** A book font file at one weight, in fontkit and in the PDF. */
interface LoadedFace {
  font: Font
  pdf: PDFFont
}

/** The fontkit 1.x internals `openFace` works around. */
interface FontInternals {
  variationCoords: number[] | null
  fvar?: { axis: { axisTag: string; defaultValue: number }[] }
  _glyphs: Record<number, Glyph>
}

interface SubsetInternals {
  font: Font & { stream: { buffer: Uint8Array } }
  glyf: Uint8Array[]
  loca: { offsets: number[] }
  hmtx: { metrics: { advance: number; bearing: number }[] }
  offset: number
  _addGlyph: (gid: number) => number
}

interface GlyphInternals {
  _getMetrics: () => { leftBearing: number }
}

/** One command of a TrueType glyph outline (fontkit `Path`). */
export interface OutlineCommand {
  command: string
  args: number[]
}

const ON_CURVE = 1

/**
 * A TrueType simple glyph (`glyf` record) of `commands`: points rounded to
 * font units, every flag and delta written out, no instructions, padded to
 * 4 bytes. No contours: the empty glyph.
 */
export function simpleGlyph(commands: readonly OutlineCommand[]): Uint8Array {
  const points: { x: number; y: number; flag: number }[] = []
  const ends: number[] = []
  const endContour = () => {
    if (points.length - 1 > (ends.at(-1) ?? -1)) ends.push(points.length - 1)
  }
  const add = (args: readonly number[], at: number, flag: number) => {
    points.push({
      x: Math.round(args[at] ?? 0),
      y: Math.round(args[at + 1] ?? 0),
      flag,
    })
  }
  for (const { command, args } of commands) {
    if (command === 'moveTo') endContour()
    if (command === 'moveTo' || command === 'lineTo') add(args, 0, ON_CURVE)
    if (command === 'quadraticCurveTo') {
      add(args, 0, 0)
      add(args, 2, ON_CURVE)
    }
    if (command === 'closePath') endContour()
  }
  endContour()
  if (points.length === 0) return new Uint8Array(0)
  const size = 12 + 2 * ends.length + 5 * points.length
  const bytes = new Uint8Array(Math.ceil(size / 4) * 4)
  const view = new DataView(bytes.buffer)
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  let at = 0
  const int16 = (value: number) => {
    view.setInt16(at, value)
    at += 2
  }
  int16(ends.length)
  for (const value of [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
    ...ends,
    0,
  ]) {
    int16(value)
  }
  for (const point of points) bytes[at++] = point.flag
  for (const axis of [xs, ys]) {
    axis.forEach((value, index) => {
      int16(value - (axis[index - 1] ?? 0))
    })
  }
  return bytes
}

/**
 * fontkit's TrueType subset copies each glyph's bytes through `loca`, which a
 * WOFF2 file does not keep: every glyph is written from its outline at the
 * face's weight instead (unhinted, composites flattened).
 */
function outlineSubset(subset: Subset): Subset {
  const s = subset as unknown as SubsetInternals
  // fontkit streams only its own `Buffer` type.
  const FontBuffer = s.font.stream.buffer.constructor as unknown as {
    from: (bytes: Uint8Array) => Uint8Array
  }
  s._addGlyph = (gid) => {
    const glyph = s.font.getGlyph(gid)
    const { commands } = glyph.path as unknown as {
      commands: OutlineCommand[]
    }
    const buffer = FontBuffer.from(simpleGlyph(commands))
    s.glyf.push(buffer)
    s.loca.offsets.push(s.offset)
    s.hmtx.metrics.push({
      advance: glyph.advanceWidth,
      bearing: (glyph as unknown as GlyphInternals)._getMetrics().leftBearing,
    })
    s.offset += buffer.length
    return s.glyf.length - 1
  }
  return subset
}

/** A (variable) font file at `weight`, ready to measure and subset. */
function openFace(
  fontkit: { create: (bytes: Uint8Array) => Font },
  bytes: Uint8Array,
  weight: number,
): Font {
  const font = fontkit.create(bytes)
  const internals = font as unknown as FontInternals
  const axes = internals.fvar?.axis ?? []
  if (axes.length > 0) {
    internals.variationCoords = axes.map((axis) =>
      axis.axisTag.trim() === 'wght' ? weight : axis.defaultValue,
    )
    // fontkit 1.x decodes WOFF2 composite glyphs through a stub that breaks
    // under a variation: decode them at the default instance first, then
    // drop the cached glyph so every outline and advance takes the weight.
    Object.defineProperty(font, '_variationProcessor', {
      value: null,
      configurable: true,
    })
    font.getGlyph(0)
    Reflect.deleteProperty(font, '_variationProcessor')
    internals._glyphs = {}
  }
  const createSubset = font.createSubset.bind(font)
  font.createSubset = () => streamOnly(outlineSubset(createSubset()))
  return font
}

/**
 * pdf-lib calls a subset's `encode()` without arguments (fontkit 2), which
 * fontkit 1.x needs a stream for: offer it the stream encoder only.
 */
function streamOnly(subset: Subset): Subset {
  return {
    includeGlyph: (glyph: number | Glyph) => subset.includeGlyph(glyph),
    encodeStream: () => subset.encodeStream(),
  }
}

/** The family's face for `codePoint` as CSS `unicode-range` picks it. */
function faceFor(family: BookFontFamily, codePoint: number): BookFontFace {
  const [face] = facesForCodePoint(family, 'normal', codePoint)
  // Outside every range: the Latin face (its .notdef), as the primary font.
  return face ?? primaryFace(family)
}

/** The face holding the space: the DOM's primary font of the family. */
function primaryFace(family: BookFontFamily): BookFontFace {
  const [face] = facesForCodePoint(family, 'normal', 0x20)
  if (face === undefined) throw new Error(`no ${family} face`)
  return face
}

function faceKey(face: BookFontFace, weight: number): string {
  return `${face.file}@${String(clampWeight(face, weight))}`
}

/** `text` split into runs of one face each. */
function faceRuns(
  family: BookFontFamily,
  text: string,
): { face: BookFontFace; text: string }[] {
  const runs: { face: BookFontFace; text: string }[] = []
  for (const char of text) {
    const face = faceFor(family, char.codePointAt(0) ?? 0)
    const last = runs.at(-1)
    if (last?.face === face) last.text += char
    else runs.push({ face, text: char })
  }
  return runs
}

/**
 * Opens every book font face `needs` set (each file at each weight once),
 * fetched from `source`, and adds it to `doc` as a subset font.
 */
export async function loadPdfFonts(
  lib: PdfLib,
  doc: PDFDocument,
  needs: readonly FontNeed[],
  source: FontFileSource | undefined,
): Promise<PdfFonts> {
  const wanted = new Map<string, { face: BookFontFace; weight: number }>()
  for (const { font, text } of needs) {
    if (text === '') continue
    const faces = [
      primaryFace(font.family),
      ...faceRuns(font.family, text).map((run) => run.face),
    ]
    for (const face of faces) {
      const weight = clampWeight(face, font.weight)
      wanted.set(faceKey(face, weight), { face, weight })
    }
  }
  const loaded = new Map<string, LoadedFace>()
  if (wanted.size > 0) {
    if (source === undefined) throw new Error('no font files for PDF text')
    const fontkit = (await import('@pdf-lib/fontkit')).default
    const files = new Map<string, Promise<Uint8Array>>()
    for (const [key, { face, weight }] of wanted) {
      const read = files.get(face.file) ?? source(face.file)
      files.set(face.file, read)
      const bytes = await read
      const font = openFace(fontkit, bytes, weight)
      // pdf-lib opens the font through the registered fontkit: hand it ours.
      doc.registerFontkit({ create: () => font })
      const pdf = await doc.embedFont(bytes, { subset: true })
      loaded.set(key, { font, pdf })
    }
  }

  const faceOf = (face: BookFontFace, weight: number): LoadedFace => {
    const found = loaded.get(faceKey(face, weight))
    if (found === undefined) throw new Error(`${face.file} not loaded`)
    return found
  }
  const scaleOf = (font: Font, sizeMm: number) => sizeMm / font.unitsPerEm
  const runWidth = (font: Font, text: string) =>
    font.layout(text).positions.reduce((sum, p) => sum + p.xAdvance, 0)
  const width = (text: string, font: TextFont) =>
    faceRuns(font.family, text).reduce((sum, run) => {
      const face = faceOf(run.face, font.weight).font
      return sum + runWidth(face, run.text) * scaleOf(face, font.sizeMm)
    }, 0)
  const primary = (font: TextFont) =>
    faceOf(primaryFace(font.family), font.weight).font

  const pageNames = new WeakMap<PDFPage, Map<PDFFont, PDFName>>()
  const nameOn = (page: PDFPage, pdf: PDFFont): PDFName => {
    const names = pageNames.get(page) ?? new Map<PDFFont, PDFName>()
    pageNames.set(page, names)
    const name =
      names.get(pdf) ?? page.node.newFontDictionary(pdf.name, pdf.ref)
    names.set(pdf, name)
    return name
  }

  return {
    width,
    ascent: (font) => {
      const face = primary(font)
      return face.ascent * scaleOf(face, font.sizeMm)
    },
    descent: (font) => {
      const face = primary(font)
      return -face.descent * scaleOf(face, font.sizeMm)
    },
    show: (page, font, text, x, baseline) => {
      const ops: PDFOperator[] = [lib.beginText()]
      let left = x
      for (const run of faceRuns(font.family, text)) {
        const face = faceOf(run.face, font.weight)
        ops.push(
          lib.setFontAndSize(nameOn(page, face.pdf), font.sizeMm),
          lib.setTextMatrix(1, 0, 0, -1, left, baseline),
          lib.PDFOperator.of(lib.PDFOperatorNames.ShowTextAdjusted, [
            kernedText(lib, doc, face, run.text),
          ]),
        )
        left += runWidth(face.font, run.text) * scaleOf(face.font, font.sizeMm)
      }
      ops.push(lib.endText())
      return ops
    },
    embed: async () => {
      for (const face of loaded.values()) await face.pdf.embed()
    },
  }
}

/**
 * The run's glyphs (subset ids) as a `TJ` array, each kerning pair as a
 * shift in thousandths of the size between them.
 */
function kernedText(
  lib: PdfLib,
  doc: PDFDocument,
  face: LoadedFace,
  text: string,
) {
  const { glyphs, positions } = face.font.layout(text)
  const hex = face.pdf.encodeText(text).asString()
  const scale = 1000 / face.font.unitsPerEm
  const array = lib.PDFArray.withContext(doc.context)
  let pending = ''
  glyphs.forEach((glyph, index) => {
    pending += hex.slice(index * 4, index * 4 + 4)
    const shift =
      (glyph.advanceWidth - (positions[index]?.xAdvance ?? 0)) * scale
    // The last glyph pairs with nothing: its shift is always 0.
    if (shift !== 0) {
      array.push(lib.PDFHexString.of(pending))
      array.push(lib.PDFNumber.of(shift))
      pending = ''
    }
  })
  array.push(lib.PDFHexString.of(pending))
  return array
}
