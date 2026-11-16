import { PDFDocument, PDFName, PDFRawStream } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { defaultCover } from '../cover'
import { genericPrintProfile } from '../print/genericProfile'
import type { Book, Cover } from '../schema'
import { ADOBE_RGB_ICC, colorJpeg } from '../testing/colorFixtures'
import { makeBook, makeSpread } from '../testing/fixtures'
import { paintCoverPdf } from './paintCoverPdf'
import { pdfChunks } from './pdfChunks.test-helpers'
import { bookFontFiles, pageContent, pageLines } from './pdfText.test-helpers'

/** A5 (148 × 210 mm) with 20 pages: Generic spine 12 mm, sheet 338 × 240 mm. */
function a5Book(cover: Partial<Cover> = {}, assets: Book['assets'] = {}) {
  return makeBook({
    title: 'Summer',
    settings: { trim: { widthMm: 148, heightMm: 210 } },
    spreads: Array.from({ length: 11 }, (_, index) =>
      makeSpread({ id: `s${String(index)}`, frames: [] }),
    ),
    assets,
    cover: { ...defaultCover('Summer'), ...cover },
  })
}

async function paint(
  book: Book,
  marks: boolean,
  photos: Record<string, Uint8Array> = {},
  fonts = bookFontFiles,
) {
  const sink = pdfChunks()
  const result = await paintCoverPdf({
    book,
    profile: genericPrintProfile(),
    photos: (assetId) => Promise.resolve(photos[assetId]),
    fonts,
    marks,
    onChunk: sink.onChunk,
  })
  const bytes = sink.bytes()
  expect(result.bytes).toBe(bytes.length)
  const doc = await PDFDocument.load(bytes)
  const [page] = doc.getPages()
  if (page === undefined) throw new Error('no page')
  return { result, doc, page, content: pageContent(doc, page), sink }
}

function expectBox(
  box: { x: number; y: number; width: number; height: number },
  x: number,
  width: number,
  height: number,
) {
  expect(box.x).toBeCloseTo(x, 2)
  expect(box.y).toBeCloseTo(x, 2)
  expect(box.width).toBeCloseTo(width, 2)
  expect(box.height).toBeCloseTo(height, 2)
}

describe('paintCoverPdf', () => {
  it('writes one A5 Generic cover page with the Spec §2.5 boxes and the book title', async () => {
    const on = await paint(a5Book(), true)
    expect(on.doc.getPageCount()).toBe(1)
    expect(on.doc.getTitle()).toBe('Summer')
    expectBox(on.page.getTrimBox(), 22.68, 958.11, 680.31)
    expectBox(on.page.getBleedBox(), 14.17, 975.12, 697.32)
    expectBox(on.page.getMediaBox(), 0, 1003.46, 725.67)
    expect(on.sink.chunks.length).toBeGreaterThan(1)
    expect(on.result.skipped).toEqual([])
    // Balanced graphics states, every number finite.
    expect(on.content.match(/\bq\b/g)?.length).toBe(
      on.content.match(/\bQ\b/g)?.length,
    )
    expect(on.content).not.toContain('NaN')

    const untitled = await paint({ ...a5Book(), title: '' }, true)
    expect(untitled.doc.getTitle()).toBeUndefined()

    const off = await paint(a5Book(), false)
    for (const box of [
      off.page.getTrimBox(),
      off.page.getBleedBox(),
      off.page.getMediaBox(),
    ]) {
      expectBox(box, 0, 958.11, 680.31)
    }
  })

  it('fills the bleed box with the cloth backFill first', async () => {
    const { content } = await paint(
      a5Book({ style: { ...defaultCover('').style, backFill: '#336699' } }),
      true,
    )
    const fill = /([\d.]+) ([\d.]+) ([\d.]+) rg\s+-3 -3 344 246 re\s+f/.exec(
      content,
    )
    expect(fill?.slice(1).map(Number)).toEqual([0.2, 0.4, 0.6])
    // Nothing is filled before the cloth.
    expect(/\b(rg|f|Do)\b/.exec(content.slice(0, fill?.index))).toBeNull()
  })

  it('sets back, spine and front text in the book fonts', async () => {
    const book = a5Book({
      front: { text: 'Summer by the sea' },
      spine: { text: 'Summer 2026' },
      back: { text: 'Printed in Riga' },
    })
    const { doc, page } = await paint(book, true)
    expect(pageLines(doc, page)).toEqual([
      'Printed in Riga',
      'Summer 2026',
      'Summer by the sea',
    ])
  })

  it('cuts a spine text longer than trim height − 2 × safe with "…"', async () => {
    const long = 'A very long spine title '.repeat(12).trim()
    const { doc, page } = await paint(
      a5Book({
        front: { text: '' },
        back: { text: '' },
        spine: { text: long },
      }),
      false,
    )
    const [spine = ''] = pageLines(doc, page)
    expect(spine.endsWith('…')).toBe(true)
    expect(long.startsWith(spine.slice(0, -1))).toBe(true)
    expect(spine.length).toBeLessThan(long.length)
  })

  it('places back, spine and title lines as CoverView sets them (A5 sheet mm)', async () => {
    const { doc, page, content } = await paint(
      a5Book({
        front: { text: 'Summer\nby the sea' },
        spine: { text: 'A very long spine title '.repeat(12).trim() },
        back: { text: 'Line one\n\nLine two' },
      }),
      true,
    )
    const tms = [...content.matchAll(/1 0 0 -1 (\S+) (\S+) Tm/g)].map(
      ([, x = '', y = '']) => ({ x: Number(x), y: Number(y) }),
    )
    const sizes = [...content.matchAll(/\/\S+ (\S+) Tf/g)].map(([, size]) =>
      Number(size),
    )
    // Blank back line: no text object.
    expect(pageLines(doc, page)).toHaveLength(5)
    const [back0, back1, spine, title0, title1] = tms
    const coverW = 308
    // Back: 11/848 of the cover, 1.5 lines, x = wrap + 12 %, last box ends at 90 %.
    const backSize = (11 * coverW) / 848
    const backLine = 1.5 * backSize
    expect(sizes[0]).toBeCloseTo(backSize, 6)
    expect(back0?.x).toBeCloseTo(15 + 0.12 * 148, 6)
    expect(back1?.x).toBeCloseTo(15 + 0.12 * 148, 6)
    expect((back1?.y ?? 0) - (back0?.y ?? 0)).toBeCloseTo(2 * backLine, 6)
    expect(back1?.y).toBeGreaterThan(204 - backLine)
    expect(back1?.y).toBeLessThan(204)
    // Spine: min(12/848 cqw, spine / 2), centred, ≤ 200 mm long.
    const spineSize = (12 * coverW) / 848
    expect(sizes[2]).toBeCloseTo(spineSize, 6)
    expect(spine?.x).toBeGreaterThan(-100)
    expect(spine?.x).toBeLessThan(-95)
    expect(spine?.y).toBeGreaterThan(0)
    expect(spine?.y).toBeLessThan((1.5 * spineSize) / 2)
    // Title: 34/848, x = front + 10 %, first box top at wrap + 9 %.
    const titleSize = (34 * coverW) / 848
    expect(sizes[3]).toBeCloseTo(titleSize, 6)
    expect(title0?.x).toBeCloseTo(175 + 0.1 * 148, 6)
    expect(title0?.y).toBeGreaterThan(15 + 0.09 * 210)
    expect(title0?.y).toBeLessThan(15 + 0.09 * 210 + 1.5 * titleSize)
    expect((title1?.y ?? 0) - (title0?.y ?? 0)).toBeCloseTo(1.5 * titleSize, 6)
    // Ink and title colours; the serif-italic shear sits on each baseline.
    expect(content).toMatch(/0\.909\d* 0\.901\d* 0\.890\d* rg/)
    expect(content).toContain('1 1 1 rg')
    const shears = [...content.matchAll(/1 0 -0\.25 1 (\S+) 0 cm/g)].map(
      ([, e]) => Number(e),
    )
    expect(shears).toHaveLength(3)
    expect(shears[0]).toBeCloseTo(0.25 * (spine?.y ?? 0), 6)
    expect(shears[2]).toBeCloseTo(0.25 * (title1?.y ?? 0), 6)
    expect(content).toMatch(/0\.0881\d* w/)
  })

  it('caps the spine type at half the spine', async () => {
    // 300 mm square, 12 mm spine: 12/848 of 612 mm is 8.66, half the spine 6.
    const book = makeBook({
      spreads: Array.from({ length: 11 }, (_, index) =>
        makeSpread({ id: `s${String(index)}`, frames: [] }),
      ),
      cover: {
        ...defaultCover(''),
        spine: { text: 'Lake' },
      },
    })
    const { content } = await paint(book, false)
    expect(content).toMatch(/\/\S+ 6 Tf/)
  })

  it('draws nothing for empty texts', async () => {
    const files: string[] = []
    const { content } = await paint(
      a5Book({ front: { text: '' }, spine: { text: '' }, back: { text: '' } }),
      false,
      {},
      (file) => {
        files.push(file)
        return bookFontFiles(file)
      },
    )
    expect(content).not.toMatch(/\bBT\b/)
    expect(files).toEqual([])
  })

  it('shears serif-italic text as a synthetic oblique, upright for serif', async () => {
    const italic = await paint(a5Book({ back: { text: '' } }), false)
    expect(italic.content).toMatch(/1 0 -0\.25 1 [\d.]+ 0 cm/)
    const style = { ...defaultCover('').style, titleFont: 'serif' as const }
    const upright = await paint(a5Book({ style, back: { text: '' } }), false)
    expect(upright.content).not.toMatch(/-0\.25 1 [\d.]+ 0 cm/)
  })

  it('turns the spine text by its direction', async () => {
    const text = { front: { text: '' }, back: { text: '' } }
    const down = await paint(a5Book(text), false)
    const style = {
      ...defaultCover('').style,
      spineDirection: 'bottom-to-top' as const,
    }
    const up = await paint(a5Book({ ...text, style }), false)
    // Rotation about the spine centre (169, 120) mm.
    expect(down.content).toMatch(/\S+ 1 -1 \S+ 169 120 cm/)
    expect(up.content).toMatch(/\S+ -1 1 \S+ 169 120 cm/)
  })

  it('draws crop marks and spine fold marks with marks on only', async () => {
    const on = await paint(a5Book(), true)
    for (const x of [163, 175]) {
      expect(on.content).toContain(`${String(x)} -3 m\n${String(x)} -8 l`)
      expect(on.content).toContain(`${String(x)} 243 m\n${String(x)} 248 l`)
    }
    expect(on.content).toContain('-3 0 m\n-8 0 l')
    const off = await paint(a5Book(), false)
    expect(off.content).not.toMatch(/\bS\b/)
  })

  it('embeds the front photo once, ICC-tagged, clipped to the front bleed', async () => {
    const book = a5Book({ front: { text: 'Summer', assetId: 'a' } }, { a: {} })
    const { result, doc, content } = await paint(book, true, {
      a: colorJpeg('front', ADOBE_RGB_ICC),
    })
    expect(result.skipped).toEqual([])
    const streams = doc.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter((object) => object instanceof PDFRawStream)
    const jpegs = streams.filter(
      (stream) =>
        stream.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
    )
    expect(jpegs).toHaveLength(1)
    expect(String(jpegs[0]?.dict.get(PDFName.of('ColorSpace')))).toContain(
      'ICCBased',
    )
    // B' = front board + wrap (x 175, 163 × 240) grown by 3 mm.
    expect(content).toContain('175 -3 166 246 re\nW\nn')
    expect(content).toMatch(/\/\S+ Do/)
  })

  it('reports a missing front photo as skipped and keeps the cloth', async () => {
    const book = a5Book({ front: { text: '', assetId: 'gone' } }, { gone: {} })
    const { result, content } = await paint(book, true)
    expect(result.skipped).toEqual([{ assetId: 'gone', reason: 'missing' }])
    expect(content).not.toMatch(/ Do\b/)
    expect(content).toMatch(/rg\s+-3 -3 344 246 re\s+f/)
  })
})
