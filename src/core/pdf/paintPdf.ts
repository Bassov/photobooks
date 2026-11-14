import type {
  PDFDocument,
  PDFImage,
  PDFName,
  PDFOperator,
  PDFPage,
  PDFRef,
} from '@cantoo/pdf-lib'
import { resolveSpread } from '../geometry/resolveSpread'
import type { ResolvedItem, ResolvedSpread } from '../geometry/types'
import type { PrintProfile } from '../print/profileSchema'
import type { Book } from '../schema'
import {
  type FrameLook,
  frameLook,
  insetPhotoMatrix,
  type RoundedRect,
  roundedRectPath,
} from './frameLookGeometry'
import { profileForImage, readSourceColor } from './iccProfile'
import {
  blankSheets,
  compose,
  CROP_MARK_WIDTH_PT,
  cropMarkSegments,
  frameMatrix,
  frameTouches,
  imageMatrix,
  type Matrix,
  orientedAspect,
  pdfSheets,
  printBleedMm,
  PT_PER_MM,
  sheetBoxes,
  sheetMatrix,
  type PdfSheet,
} from './pdfGeometry'

/** Original file bytes of a photo; undefined when the source is gone. */
export type PhotoByteSource = (
  assetId: string,
) => Promise<Uint8Array | undefined>

export interface PaintPdfInput {
  book: Book
  /** The book's effective print profile (`bookPrintProfile`). */
  profile: PrintProfile
  photos: PhotoByteSource
  /**
   * The user's "bleed and crop marks" choice, over the profile's crop marks:
   * on = the profile bleed and crop marks, off = trim size, no marks.
   */
  marks: boolean
  /** Called after each PDF page, `painted` 1..`sheets`. */
  onSheet?: (painted: number, sheets: number) => void
}

export interface SkippedPhoto {
  assetId: string
  reason: 'missing' | 'unsupported'
}

export interface PaintPdfResult {
  pdf: Uint8Array
  /** PDF pages written, blank padding pages included. */
  sheets: number
  /** Photos left as paper, each once. */
  skipped: SkippedPhoto[]
}

type PdfLib = typeof import('@cantoo/pdf-lib')

interface Embedded {
  image: PDFImage
  orientation: number | undefined
}

/**
 * Paints the book's interior (page backgrounds and photos) into a print PDF
 * per `profile`: one page per book page or per spread, blank pages after the
 * book up to the profile's minimum page count. With `marks`, bleed from the
 * book inside the profile's range and crop marks; without, trim size only.
 * JPEGs go in as their original bytes, each asset once.
 */
export async function paintBookPdf(
  input: PaintPdfInput,
): Promise<PaintPdfResult> {
  // Loaded on export only: the library stays out of every other chunk.
  const lib: PdfLib = await import('@cantoo/pdf-lib')
  const { book, profile } = input
  const doc = await lib.PDFDocument.create()
  if (book.title !== undefined && book.title !== '') doc.setTitle(book.title)

  const assetIds = resolveAll(book)
    .flatMap((spread) => spread.items)
    .map((item) => item.assetId)
    .filter((assetId) => assetId !== undefined)
  const { embedded, skipped } = await embedPhotos(
    lib,
    doc,
    [...new Set(assetIds)],
    input,
  )
  const resolved = resolveAll(book, {
    getAspectRatio: (assetId) => {
      const photo = embedded.get(assetId)
      return photo === undefined
        ? 1
        : orientedAspect(
            photo.image.width,
            photo.image.height,
            photo.orientation,
          )
    },
  })

  const { marks } = input
  const bleedMm = marks ? printBleedMm(book.settings.bleedMm, profile) : 0
  const sheets = pdfSheets(
    book.spreads.length,
    book.settings.trim,
    profile.output,
  )
  // A book below the profile minimum prints as the minimum (print issues).
  const blanks = blankSheets(
    book.spreads.length,
    profile.pageCount.min,
    book.settings.trim,
    profile.output,
  )
  const total = sheets.length + blanks.length
  let painted = 0
  const added = () => {
    painted += 1
    input.onSheet?.(painted, total)
  }
  for (const [index, spread] of resolved.entries()) {
    for (const sheet of sheets.filter((s) => s.spreadIndex === index)) {
      addSheetPage(lib, doc, sheet, marks, bleedMm, (page, slugMm) => {
        paintSheet(lib, page, sheet, spread, embedded, slugMm, bleedMm)
      })
      added()
    }
  }
  for (const sheet of blanks) {
    addSheetPage(lib, doc, sheet, marks, bleedMm)
    added()
  }

  return { pdf: await doc.save(), sheets: total, skipped }
}

function resolveAll(
  book: Book,
  options?: Parameters<typeof resolveSpread>[2],
): ResolvedSpread[] {
  return book.spreads
    .map((spread) => resolveSpread(book, spread.id, options))
    .filter((spread) => spread !== undefined)
}

/**
 * Adds the PDF page of `sheet` with its trim, bleed and media boxes, runs
 * `paint` (nothing: blank paper), then crop marks with `marks`.
 */
function addSheetPage(
  lib: PdfLib,
  doc: PDFDocument,
  sheet: PdfSheet,
  marks: boolean,
  bleedMm: number,
  paint?: (page: PDFPage, slugMm: number) => void,
): void {
  const boxes = sheetBoxes(sheet.trim.width, sheet.trim.height, bleedMm, marks)
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
  paint?.(page, boxes.slugMm)
  if (marks) {
    paintCropMarks(lib, page, sheet, boxes.slugMm, bleedMm)
  }
}

async function embedPhotos(
  lib: PdfLib,
  doc: PDFDocument,
  assetIds: string[],
  input: PaintPdfInput,
): Promise<{
  embedded: Map<string | undefined, Embedded>
  skipped: SkippedPhoto[]
}> {
  const embedded = new Map<string | undefined, Embedded>()
  const skipped: SkippedPhoto[] = []
  const iccRefs = new Map<string, PDFRef>()
  for (const assetId of assetIds) {
    const bytes = await input.photos(assetId)
    if (bytes === undefined) {
      skipped.push({ assetId, reason: 'missing' })
      continue
    }
    // JPEG (0xFF…) goes in as its own bytes, anything else is tried as PNG;
    // pdf-lib rejects broken or other files.
    const jpeg = bytes[0] === 0xff
    const image = await (
      jpeg ? doc.embedJpg(bytes) : doc.embedPng(bytes)
    ).catch(() => null)
    if (image === null) {
      skipped.push({ assetId, reason: 'unsupported' })
      continue
    }
    await tagColor(lib, doc, image, bytes, iccRefs)
    embedded.set(assetId, {
      image,
      // The raw JPEG keeps its EXIF orientation; PDF viewers ignore it.
      orientation: jpeg ? input.book.assets[assetId]?.orientation : undefined,
    })
  }
  return { embedded, skipped }
}

const DEVICE_CHANNELS: Readonly<Record<string, number>> = {
  '/DeviceGray': 1,
  '/DeviceRGB': 3,
  '/DeviceCMYK': 4,
}

/**
 * Gives the image an ICCBased color space: the photo's own profile, sRGB for
 * an untagged RGB photo. Each distinct profile is one stream per PDF.
 */
async function tagColor(
  lib: PdfLib,
  doc: PDFDocument,
  image: PDFImage,
  bytes: Uint8Array,
  iccRefs: Map<string, PDFRef>,
): Promise<void> {
  await image.embed()
  const stream = doc.context.lookup(image.ref, lib.PDFStream)
  const colorSpace = lib.PDFName.of('ColorSpace')
  const device = stream.dict.lookup(colorSpace, lib.PDFName)
  const channels = DEVICE_CHANNELS[device.asString()] ?? 0
  const icc = profileForImage((await readSourceColor(bytes)).icc, channels)
  if (icc === undefined) return
  const key = new TextDecoder('latin1').decode(icc)
  const ref =
    iccRefs.get(key) ??
    doc.context.register(
      doc.context.flateStream(icc, { N: channels, Alternate: device }),
    )
  iccRefs.set(key, ref)
  stream.dict.set(
    colorSpace,
    doc.context.obj([lib.PDFName.of('ICCBased'), ref]),
  )
}

function cm(lib: PdfLib, m: Matrix): PDFOperator {
  return lib.concatTransformationMatrix(...m)
}

/** `#rrggbb` → 0–1 channels. */
function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1, 7), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map(
    (channel) => channel / 255,
  ) as [number, number, number]
}

/** Parent layer beneath the spread's frames, each by `z` (as the canvas paints). */
function paintOrder(items: ResolvedItem[]): ResolvedItem[] {
  const byZ = (list: ResolvedItem[]) => [...list].sort((a, b) => a.z - b.z)
  return [
    ...byZ(items.filter((item) => item.parent === true)),
    ...byZ(items.filter((item) => item.parent !== true)),
  ]
}

function paintSheet(
  lib: PdfLib,
  page: PDFPage,
  sheet: PdfSheet,
  spread: ResolvedSpread,
  embedded: Map<string | undefined, Embedded>,
  slugMm: number,
  bleedMm: number,
): void {
  const { x, y, width, height } = sheet.trim
  const bleed = {
    x: x - bleedMm,
    y: y - bleedMm,
    width: width + 2 * bleedMm,
    height: height + 2 * bleedMm,
  }
  const bleedRect = () =>
    lib.rectangle(bleed.x, bleed.y, bleed.width, bleed.height)
  const ops: PDFOperator[] = [
    lib.pushGraphicsState(),
    cm(lib, sheetMatrix(sheet, slugMm)),
    // Everything stays inside the bleed: the crop marks own the rest.
    bleedRect(),
    lib.clip(),
    lib.endPath(),
  ]
  if (spread.backgroundColor !== undefined) {
    ops.push(
      lib.setFillingRgbColor(...rgb(spread.backgroundColor)),
      bleedRect(),
      lib.fill(),
    )
  }
  // One page resource per image, however many frames show it.
  const names = new Map<PDFImage, PDFName>()
  for (const item of paintOrder(spread.items)) {
    const photo = embedded.get(item.assetId)
    // The other page of a spread is out of this sheet's bleed: skip it.
    if (photo === undefined || !frameTouches(item, bleed)) continue
    const name =
      names.get(photo.image) ?? page.node.newXObject('Image', photo.image.ref)
    names.set(photo.image, name)
    const image = imageMatrix(item, photo.orientation)
    const look = frameLook(item.rectMm, item.style)
    ops.push(
      lib.pushGraphicsState(),
      cm(lib, frameMatrix(item)),
      ...(look === undefined
        ? [
            lib.rectangle(0, 0, item.rectMm.width, item.rectMm.height),
            lib.clip(),
            lib.endPath(),
            cm(lib, image),
            lib.drawObject(name),
          ]
        : paintLook(lib, look, item.rectMm, image, name)),
      lib.popGraphicsState(),
    )
  }
  ops.push(lib.popGraphicsState())
  page.pushOperators(...ops)
}

function path(lib: PdfLib, shape: RoundedRect): PDFOperator[] {
  return roundedRectPath(shape).map((segment) => {
    switch (segment.op) {
      case 'move':
        return lib.moveTo(segment.to.x, segment.to.y)
      case 'line':
        return lib.lineTo(segment.to.x, segment.to.y)
      case 'curve':
        return lib.appendBezierCurve(
          segment.c1.x,
          segment.c1.y,
          segment.c2.x,
          segment.c2.y,
          segment.to.x,
          segment.to.y,
        )
      case 'close':
        return lib.closePath()
    }
  })
}

/**
 * A styled photo frame in frame-local mm: clip to the rounded frame box, the
 * mat fill, the photo clipped to its inset box, the stroke on top.
 */
function paintLook(
  lib: PdfLib,
  look: FrameLook,
  size: { width: number; height: number },
  image: Matrix,
  name: PDFName,
): PDFOperator[] {
  const ops = [...path(lib, look.outer), lib.clip(), lib.endPath()]
  if (look.matColor !== undefined) {
    ops.push(
      lib.setFillingRgbColor(...rgb(look.matColor)),
      ...path(lib, look.outer),
      lib.fill(),
    )
  }
  if (look.photo.rect.width > 0 && look.photo.rect.height > 0) {
    ops.push(
      lib.pushGraphicsState(),
      ...path(lib, look.photo),
      lib.clip(),
      lib.endPath(),
      cm(lib, compose(insetPhotoMatrix(size, look.photo.rect), image)),
      lib.drawObject(name),
      lib.popGraphicsState(),
    )
  }
  if (look.stroke !== undefined) {
    ops.push(
      lib.setStrokingRgbColor(...rgb(look.stroke.color)),
      lib.setLineWidth(look.stroke.widthMm),
      ...path(lib, look.stroke),
      lib.stroke(),
    )
  }
  return ops
}

function paintCropMarks(
  lib: PdfLib,
  page: PDFPage,
  sheet: PdfSheet,
  slugMm: number,
  bleedMm: number,
): void {
  page.pushOperators(
    lib.pushGraphicsState(),
    cm(lib, sheetMatrix(sheet, slugMm)),
    lib.setLineWidth(CROP_MARK_WIDTH_PT / PT_PER_MM),
    lib.setStrokingGrayscaleColor(0),
    ...cropMarkSegments(sheet.trim, bleedMm).flatMap(({ from, to }) => [
      lib.moveTo(from.x, from.y),
      lib.lineTo(to.x, to.y),
    ]),
    lib.stroke(),
    lib.popGraphicsState(),
  )
}
