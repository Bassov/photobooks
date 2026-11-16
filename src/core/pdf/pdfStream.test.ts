import * as lib from '@cantoo/pdf-lib'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { pdfChunks } from './pdfChunks.test-helpers'
import { streamPdf } from './pdfStream'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number } }

/** SOI, SOF0 (1 × 1, 3 channels), EOI. */
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 1, 0, 1, 3, 1, 0x22, 0, 2, 0x11, 1, 3,
  0x11, 1, 0xff, 0xd9,
])

interface PageSpec {
  photo: boolean
  flush: boolean
}

/** A document of `pages`, streamed with a flush after the pages that ask. */
async function streamed(pages: PageSpec[]) {
  const doc = await lib.PDFDocument.create()
  doc.setTitle('Streamed')
  const file = pdfChunks()
  const stream = streamPdf(lib, doc.context, file.onChunk)
  for (const [index, spec] of pages.entries()) {
    const page = doc.addPage([200, 300])
    page.drawRectangle({ x: 0, y: 0, width: index + 1, height: 1 })
    if (spec.photo) {
      const image = await doc.embedJpg(JPEG)
      await image.embed()
      page.drawImage(image, { x: 10, y: 10, width: 20, height: 20 })
    }
    if (spec.flush) stream.flush()
  }
  const bytes = stream.finish()
  return { doc, file, bytes }
}

/** The xref table `startxref` points at: in-use object number → offset. */
function xrefOf(text: string): { offsets: Map<number, number>; size: number } {
  const start = Number(/startxref\n(\d+)\n%%EOF$/.exec(text)?.[1])
  expect(text.startsWith('xref\n', start)).toBe(true)
  const lines = text.slice(start).split('\n').slice(1)
  const offsets = new Map<number, number>()
  let line = 0
  let next = 0
  for (
    let head = /^(\d+) (\d+)$/.exec(lines[line] ?? '');
    head !== null;
    head = /^(\d+) (\d+)$/.exec(lines[line] ?? '')
  ) {
    const first = Number(head[1])
    const count = Number(head[2])
    // Subsections run in object number order.
    expect(first).toBeGreaterThanOrEqual(next)
    next = first + count
    for (let entry = 0; entry < count; entry += 1) {
      const [offset, , kind] = (lines[line + 1 + entry] ?? '').split(' ')
      if (kind === 'n') offsets.set(first + entry, Number(offset))
    }
    line += count + 1
  }
  const size = Number(/\/Size (\d+)/.exec(text.slice(start))?.[1])
  return { offsets, size }
}

describe('streamPdf', () => {
  it('chunks join into a PDF whose xref offsets point at each object, for any pages and flushes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ photo: fc.boolean(), flush: fc.boolean() }), {
          maxLength: 12,
        }),
        async (pages) => {
          const { file, bytes } = await streamed(pages)
          const pdf = file.bytes()
          const text = new TextDecoder('latin1').decode(pdf)

          expect(pdf.length).toBe(bytes)
          expect(text.startsWith('%PDF-1.7\n')).toBe(true)
          const { offsets, size } = xrefOf(text)
          const written = [...text.matchAll(/(?<=\n)(\d+) 0 obj\n/g)]
          expect(
            written.map(([, n]) => Number(n)).sort((a, b) => a - b),
          ).toEqual([...offsets.keys()].sort((a, b) => a - b))
          for (const [n, offset] of offsets) {
            expect(text.startsWith(`${String(n)} 0 obj\n`, offset)).toBe(true)
          }
          expect(size).toBe(Math.max(...offsets.keys()) + 1)

          const loaded = await lib.PDFDocument.load(pdf)
          expect(loaded.getPageCount()).toBe(pages.length)
          expect(loaded.getTitle()).toBe('Streamed')
          for (const page of loaded.getPages()) {
            expect(page.getSize()).toEqual({ width: 200, height: 300 })
            const content = page.node.normalizedEntries().Contents
            expect(content?.size()).toBeGreaterThan(0)
          }
        },
      ),
      { seed: gates.pbt.seed, numRuns: 40 },
    )
  })

  it('drops written objects from the document, keeping the page tree', async () => {
    const doc = await lib.PDFDocument.create()
    const file = pdfChunks()
    const stream = streamPdf(lib, doc.context, file.onChunk)
    const page = doc.addPage([200, 300])
    const image = await doc.embedJpg(JPEG)
    await image.embed()
    page.drawImage(image, { x: 0, y: 0 })

    stream.flush()

    const left = doc.context
      .enumerateIndirectObjects()
      .map(([, object]) => object.constructor.name)
    expect(left).not.toContain('PDFRawStream')
    expect(left).toContain('PDFPageLeaf')
    expect(left).toContain('PDFPageTree')
    expect(left).toContain('PDFCatalog')
    expect(file.chunks).toHaveLength(1)
  })

  it('emits nothing on a flush with nothing new', async () => {
    const doc = await lib.PDFDocument.create()
    const file = pdfChunks()
    const stream = streamPdf(lib, doc.context, file.onChunk)
    doc.addPage([10, 10])

    stream.flush()
    const first = file.chunks.length
    stream.flush()

    expect(file.chunks).toHaveLength(first)
  })
})
