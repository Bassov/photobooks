import type { PDFContext, PDFObject, PDFRef } from '@cantoo/pdf-lib'

type PdfLib = typeof import('@cantoo/pdf-lib')

/** Receives the PDF file's bytes in order; a chunk is never touched again. */
export type PdfChunkSink = (chunk: Uint8Array) => void

export interface PdfStream {
  /**
   * Writes every indirect object but the page tree and the catalog, and
   * drops it from the context: a written object (the Info dict included)
   * must not change any more.
   */
  flush: () => void
  /** Writes the rest, the xref table and the trailer; the file's byte count. */
  finish: () => number
}

const END_OBJ = '\nendobj\n\n'
const encoder = new TextEncoder()

/** Writes ASCII `text` at `at`; its length. */
function ascii(text: string, into: Uint8Array, at: number): number {
  return encoder.encodeInto(text, into.subarray(at)).written
}

/**
 * Streams a growing pdf-lib document to `emit` in file order, laid out as
 * pdf-lib's `PDFWriter` does (header, `n g obj … endobj` per object, a
 * classic xref table, trailer). Written objects leave the context, so their
 * bytes (photos above all) are freed once emitted. The page tree stays to
 * the end: pdf-lib looks every earlier page up when it adds one.
 */
export function streamPdf(
  lib: PdfLib,
  context: PDFContext,
  emit: PdfChunkSink,
): PdfStream {
  const offsets: [PDFRef, number][] = []
  let offset = 0
  // pdf-lib wraps every embedded page's content in one shared `q` / `Q`
  // stream pair, looked up again per page.
  const shared = [
    context.getPushGraphicsStateContentStream(),
    context.getPopGraphicsStateContentStream(),
  ]
  const held = (ref: PDFRef, object: PDFObject) =>
    object instanceof lib.PDFPageLeaf ||
    object instanceof lib.PDFPageTree ||
    object instanceof lib.PDFCatalog ||
    shared.includes(ref)

  const write = (all: boolean) => {
    const objects = context
      .enumerateIndirectObjects()
      .filter(([ref, object]) => all || !held(ref, object))
    const heads = objects.map(
      ([ref]) =>
        `${String(ref.objectNumber)} ${String(ref.generationNumber)} obj\n`,
    )
    // The header (`%PDF-…`, binary comment) and a blank line open the file.
    let size = offset === 0 ? context.header.sizeInBytes() + 2 : 0
    for (const [index, [, object]] of objects.entries()) {
      size +=
        (heads[index] ?? '').length + object.sizeInBytes() + END_OBJ.length
    }
    if (size === 0) return
    const chunk = new Uint8Array(size)
    let at = 0
    if (offset === 0) {
      at += context.header.copyBytesInto(chunk, at)
      at += ascii('\n\n', chunk, at)
    }
    for (const [index, [ref, object]] of objects.entries()) {
      offsets.push([ref, offset + at])
      at += ascii(heads[index] ?? '', chunk, at)
      at += object.copyBytesInto(chunk, at)
      at += ascii(END_OBJ, chunk, at)
      context.delete(ref)
    }
    offset += size
    emit(chunk)
  }

  return {
    flush: () => {
      write(false)
    },
    finish: () => {
      write(true)
      // The section puts each entry in object number order itself.
      const xref = lib.PDFCrossRefSection.create()
      for (const [ref, at] of offsets) xref.addEntry(ref, at)
      const { Root, Info, ID } = context.trailerInfo
      const trailerDict = lib.PDFTrailerDict.of(
        context.obj({ Size: context.largestObjectNumber + 1, Root, Info, ID }),
      )
      const trailer = lib.PDFTrailer.forLastCrossRefSectionOffset(offset)
      const chunk = new Uint8Array(
        xref.sizeInBytes() +
          1 +
          trailerDict.sizeInBytes() +
          2 +
          trailer.sizeInBytes(),
      )
      let at = xref.copyBytesInto(chunk, 0)
      at += ascii('\n', chunk, at)
      at += trailerDict.copyBytesInto(chunk, at)
      at += ascii('\n\n', chunk, at)
      trailer.copyBytesInto(chunk, at)
      offset += chunk.length
      emit(chunk)
      return offset
    },
  }
}
