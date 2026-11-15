import {
  imposition,
  type ImposedSlot,
  type ImpositionLayout,
} from '../print/imposition'
import { type PdfChunkSink, streamPdf } from './pdfStream'

/**
 * The page PDF's bytes, whose `slice` is a view: pdf-lib slices every stream
 * it parses or copies out of the file, so the page PDF is held once instead
 * of once per parse and per copy.
 */
class SharedBytes extends Uint8Array {
  override slice(start?: number, end?: number): Uint8Array<ArrayBuffer> {
    return this.subarray(start, end)
  }
}

/** The whole Blob in one buffer of its size (no grown or joined copies). */
async function readShared(blob: Blob): Promise<SharedBytes> {
  const bytes = new SharedBytes(blob.size)
  const reader = blob.stream().getReader()
  let at = 0
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    bytes.set(part.value, at)
    at += part.value.length
  }
  return bytes
}

export interface ImposePdfInput {
  /** The page PDF (one PDF page per book page, as `paintBookPdf` writes it). */
  pdf: Blob
  layout: ImpositionLayout
  /** The imposed PDF file's bytes, in order: each sheet once imposed. */
  onChunk: PdfChunkSink
  /** Called after each sheet (front and back), `imposed` 1..`sheets`. */
  onSheet?: (imposed: number, sheets: number) => void
}

export interface ImposePdfResult {
  /** Bytes of the imposed PDF file, every chunk together. */
  bytes: number
  sheets: number
}

/**
 * Imposes the page PDF for home duplex printing: each page is embedded as
 * is (vector form, photos are never re-rendered) and placed by
 * `imposition`; a cell is the largest page, a sheet side 2 × `rows` cells.
 * The page PDF is read whole; the imposed file streams to `onChunk` sheet
 * by sheet.
 */
export async function imposePdf(
  input: ImposePdfInput,
): Promise<ImposePdfResult> {
  // Loaded on export only: the library stays out of every other chunk.
  const lib = await import('@cantoo/pdf-lib')
  const source = await lib.PDFDocument.load(await readShared(input.pdf))
  const doc = await lib.PDFDocument.create()
  const stream = streamPdf(lib, doc.context, input.onChunk)
  const pages = source.getPages()
  const cell = {
    width: Math.max(...pages.map((page) => page.getWidth())),
    height: Math.max(...pages.map((page) => page.getHeight())),
  }
  const plan = imposition(pages.length, input.layout)
  const addSide = async (slots: ImposedSlot[]) => {
    const side = doc.addPage([
      cell.width * plan.columns,
      cell.height * plan.rows,
    ])
    for (const [index, slot] of slots.entries()) {
      const page = slot === null ? undefined : source.getPage(slot - 1)
      // Blank paper (padding, or a blank page of the page PDF) stays empty.
      if (page?.node.Contents() === undefined) continue
      const embedded = await doc.embedPage(page)
      // Copied now, so the sheet's flush writes it.
      await embedded.embed()
      const column = index % plan.columns
      const row = Math.floor(index / plan.columns)
      side.drawPage(embedded, {
        x: column * cell.width,
        y: (plan.rows - 1 - row) * cell.height,
      })
    }
  }
  for (const [index, sheet] of plan.sheets.entries()) {
    await addSide(sheet.front)
    await addSide(sheet.back)
    stream.flush()
    input.onSheet?.(index + 1, plan.sheets.length)
  }
  return { bytes: stream.finish(), sheets: plan.sheets.length }
}
