import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  type PDFPage,
} from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { imposePdf } from './imposePdf'

const PAGE = { width: 300, height: 400 }

/** A page PDF whose page `n` fills an `n`-wide rectangle (`n 0 l`), so a copy names its page. */
async function pagePdf(pages: number, blank = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let n = 1; n <= pages; n += 1) {
    const page = doc.addPage([PAGE.width, PAGE.height])
    // Like `paintBookPdf`'s padding sheets: no content stream at all.
    if (n !== blank) page.drawRectangle({ x: 0, y: 0, width: n, height: 1 })
  }
  return doc.save()
}

function decoded(stream: PDFRawStream): string {
  return new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode())
}

function contentOf(doc: PDFDocument, page: PDFPage): string {
  const contents = page.node.normalizedEntries().Contents
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => doc.context.lookup(ref))
      : []
  return streams
    .filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
    .map(decoded)
    .join('\n')
}

/** Each placed page as `page@x,y`, in paint order. */
function placements(doc: PDFDocument, page: PDFPage): string[] {
  const xObjects = page.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
  const draws = contentOf(doc, page).matchAll(
    /1 0 0 1 (\S+) (\S+) cm\n[\s\S]*?\/(\S+) Do/g,
  )
  return [...draws].map(([, x, y, name = '']) => {
    const ref = xObjects?.get(PDFName.of(name))
    const form = ref instanceof PDFRef ? doc.context.lookup(ref) : undefined
    if (!(form instanceof PDFRawStream)) throw new Error(`no form ${name}`)
    const n = /^(\d+) 0 l$/m.exec(decoded(form))?.[1]
    return `${String(n)}@${String(x)},${String(y)}`
  })
}

async function impose(pages: number, layout: '2up' | '4up', blank = 0) {
  const progress: [number, number][] = []
  const result = await imposePdf({
    pdf: await pagePdf(pages, blank),
    layout,
    onSheet: (imposed, sheets) => progress.push([imposed, sheets]),
  })
  const doc = await PDFDocument.load(result.pdf)
  return { result, progress, doc, sides: doc.getPages() }
}

describe('imposePdf', () => {
  it('2-up: 8 pages on 2 sheets, 4 PDF pages twice the page wide', async () => {
    const { result, progress, doc, sides } = await impose(8, '2up')

    expect(result.sheets).toBe(2)
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ])
    expect(sides.map((side) => side.getSize())).toEqual(
      Array.from({ length: 4 }, () => ({ width: 600, height: 400 })),
    )
    expect(sides.map((side) => placements(doc, side))).toEqual([
      ['8@0,0', '1@300,0'],
      ['2@0,0', '7@300,0'],
      ['6@0,0', '3@300,0'],
      ['4@0,0', '5@300,0'],
    ])
  })

  it('2-up: 13 pages on 4 sheets, blank cells left empty', async () => {
    const { result, doc, sides } = await impose(13, '2up')

    expect(result.sheets).toBe(4)
    expect(sides).toHaveLength(8)
    expect(sides.slice(0, 4).map((side) => placements(doc, side))).toEqual([
      ['13@0,0', '1@300,0'],
      ['2@0,0'],
      ['3@300,0'],
      ['4@0,0'],
    ])
  })

  it('leaves a blank page of the page PDF as empty paper', async () => {
    const { doc, sides } = await impose(4, '2up', 3)

    expect(sides.map((side) => placements(doc, side))).toEqual([
      ['4@0,0', '1@300,0'],
      ['2@0,0'],
    ])
  })

  it('4-up: 8 pages on 1 sheet, 13 pages on 2, top row first', async () => {
    const eight = await impose(8, '4up')
    expect(eight.result.sheets).toBe(1)
    expect(eight.sides.map((side) => side.getSize())).toEqual([
      { width: 600, height: 800 },
      { width: 600, height: 800 },
    ])
    expect(eight.sides.map((side) => placements(eight.doc, side))).toEqual([
      ['8@0,400', '1@300,400', '6@0,0', '3@300,0'],
      ['2@0,400', '7@300,400', '4@0,0', '5@300,0'],
    ])

    const thirteen = await impose(13, '4up')
    expect(thirteen.result.sheets).toBe(2)
    expect(thirteen.progress).toEqual([
      [1, 2],
      [2, 2],
    ])
    expect(thirteen.sides).toHaveLength(4)
  })
})
