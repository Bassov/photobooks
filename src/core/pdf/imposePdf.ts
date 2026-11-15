import {
  imposition,
  type ImposedSlot,
  type ImpositionLayout,
} from '../print/imposition'

export interface ImposePdfInput {
  /** The page PDF (one PDF page per book page, as `paintBookPdf` writes it). */
  pdf: Uint8Array | ArrayBuffer
  layout: ImpositionLayout
  /** Called after each sheet (front and back), `imposed` 1..`sheets`. */
  onSheet?: (imposed: number, sheets: number) => void
}

export interface ImposePdfResult {
  /** Two PDF pages per sheet: front, then back. */
  pdf: Uint8Array
  sheets: number
}

/**
 * Imposes the page PDF for home duplex printing: each page is embedded as
 * is (vector form, photos are never re-rendered) and placed by
 * `imposition`; a cell is the largest page, a sheet side 2 × `rows` cells.
 */
export async function imposePdf(
  input: ImposePdfInput,
): Promise<ImposePdfResult> {
  // Loaded on export only: the library stays out of every other chunk.
  const lib = await import('@cantoo/pdf-lib')
  const source = await lib.PDFDocument.load(input.pdf)
  const doc = await lib.PDFDocument.create()
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
    input.onSheet?.(index + 1, plan.sheets.length)
  }
  return { pdf: await doc.save(), sheets: plan.sheets.length }
}
