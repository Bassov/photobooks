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
import { profileForImage, readSourceColor } from './iccProfile'
import {
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
}

export interface SkippedPhoto {
  assetId: string
  reason: 'missing' | 'unsupported'
}

export interface PaintPdfResult {
  pdf: Uint8Array
  /** PDF pages written. */
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
 * per `profile`: one page per book page or per spread, bleed from the book
 * inside the profile's range, crop marks only when the profile asks. JPEGs
 * go in as their original bytes, each asset once.
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

  const bleedMm = printBleedMm(book.settings.bleedMm, profile)
  const sheets = pdfSheets(
    book.spreads.length,
    book.settings.trim,
    profile.output,
  )
  for (const [index, spread] of resolved.entries()) {
    for (const sheet of sheets.filter((s) => s.spreadIndex === index)) {
      paintPage(lib, doc, sheet, spread, embedded, profile, bleedMm)
    }
  }

  return { pdf: await doc.save(), sheets: sheets.length, skipped }
}

function resolveAll(
  book: Book,
  options?: Parameters<typeof resolveSpread>[2],
): ResolvedSpread[] {
  return book.spreads
    .map((spread) => resolveSpread(book, spread.id, options))
    .filter((spread) => spread !== undefined)
}

function paintPage(
  lib: PdfLib,
  doc: PDFDocument,
  sheet: PdfSheet,
  spread: ResolvedSpread,
  embedded: Map<string | undefined, Embedded>,
  profile: PrintProfile,
  bleedMm: number,
): void {
  const boxes = sheetBoxes(
    sheet.trim.width,
    sheet.trim.height,
    bleedMm,
    profile.cropMarks,
  )
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
  paintSheet(lib, page, sheet, spread, embedded, boxes.slugMm, bleedMm)
  if (profile.cropMarks) {
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
    ops.push(
      lib.pushGraphicsState(),
      cm(lib, frameMatrix(item)),
      lib.rectangle(0, 0, item.rectMm.width, item.rectMm.height),
      lib.clip(),
      lib.endPath(),
      cm(lib, imageMatrix(item, photo.orientation)),
      lib.drawObject(name),
      lib.popGraphicsState(),
    )
  }
  ops.push(lib.popGraphicsState())
  page.pushOperators(...ops)
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
