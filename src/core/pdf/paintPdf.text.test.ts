import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
} from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { genericPrintProfile } from '../print/genericProfile'
import type { Book, Frame } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { paintBookPdf } from './paintPdf'
import { pdfChunks } from './pdfChunks.test-helpers'
import { bookFontFiles, pageContent, pageLines } from './pdfText.test-helpers'

/** 1 × 1 RGBA PNG. */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
)

function textFrame(
  id: string,
  text: string,
  rect: Frame['rect'],
  styleId: 'title' | 'caption' | 'body',
  align: 'left' | 'center' | 'right' = 'left',
): Frame {
  return makeFrame({
    id,
    rect,
    kind: 'text',
    styleId,
    align,
    content: { type: 'static', text },
  })
}

/**
 * Caption fixtures on page 2 (the left page of spread 2): every style, Latin
 * and Cyrillic, each alignment, multi-line frames, a master Running head and
 * page number, a photo caption. Line breaks as Chromium sets the same text
 * (fonts, styles, widths) at 10 px/mm.
 */
function captionBook(): Book {
  return makeBook({
    settings: { trim: { widthMm: 300, heightMm: 300 } },
    parents: [
      {
        id: 'm1',
        name: 'Master A',
        guides: [],
        frames: [
          textFrame(
            'head',
            'Running head · Колонтитул',
            { x: 20, y: 8, width: 260, height: 6 },
            'caption',
            'center',
          ),
        ],
        pageNumbers: [
          {
            id: 'm1-pn-l',
            rect: { x: 140, y: 285, width: 20, height: 6 },
            align: 'center',
          },
        ],
      },
    ],
    spreads: [
      makeSpread({ id: 's1', frames: [] }),
      makeSpread({
        id: 's2',
        parentId: 'm1',
        frames: [
          textFrame(
            'title',
            'Summer by the lake, Лето на озере',
            { x: 20, y: 30, width: 100, height: 25 },
            'title',
          ),
          textFrame(
            'cyrillic',
            'Morning swim\nМы вышли к воде на рассвете, and the lake was still',
            { x: 20, y: 60, width: 50, height: 30 },
            'body',
            'right',
          ),
          textFrame(
            'latin',
            'Morning swim\nWe walked down to the water at dawn and the lake was still',
            { x: 80, y: 60, width: 50, height: 30 },
            'body',
            'center',
          ),
          textFrame(
            'band',
            'Running head · Колонтитул with a long tail of words',
            { x: 140, y: 60, width: 45, height: 9 },
            'caption',
          ),
          makeFrame({
            id: 'photo',
            assetId: 'gone',
            caption: 'Озеро at dawn',
            rect: { x: 20, y: 100, width: 100, height: 60 },
          }),
        ],
      }),
    ],
  })
}

async function paint(book: Book) {
  const file = pdfChunks()
  await paintBookPdf({
    book,
    profile: genericPrintProfile(),
    photos: () => Promise.resolve(undefined),
    fonts: bookFontFiles,
    marks: false,
    onChunk: file.onChunk,
  })
  return PDFDocument.load(file.bytes())
}

function objects(doc: PDFDocument): PDFDict[] {
  return doc.context
    .enumerateIndirectObjects()
    .map(([, object]) =>
      object instanceof PDFRawStream ? object.dict : object,
    )
    .filter((object) => object instanceof PDFDict)
}

function nameOf(dict: PDFDict, key: string): string | undefined {
  return dict.lookupMaybe(PDFName.of(key), PDFName)?.asString()
}

describe('paintBookPdf text', () => {
  it('sets each frame line by line as the DOM breaks it, master and folio first', async () => {
    const doc = await paint(captionBook())

    expect(pageLines(doc, doc.getPage(1))).toEqual([
      'Running head · Колонтитул',
      '2',
      'Summer by the lake,',
      'Лето на озере',
      'Morning swim',
      'Мы вышли к воде на',
      'рассвете, and the lake was',
      'still',
      'Morning swim',
      'We walked down to the',
      'water at dawn and the lake',
      'was still',
      'Running head · Колонтитул',
      'with a long tail of words',
      'Озеро at dawn',
    ])
    expect(pageLines(doc, doc.getPage(0))).toEqual([])
    // The right page: the left page's frames and folio stay off it.
    expect(pageLines(doc, doc.getPage(2))).toEqual([])
  })

  it('clips and colours each block in its own state, the photo clip apart from its caption', async () => {
    const book = makeBook({
      assets: { photo: {} },
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ id: 'gone', assetId: 'gone' }),
            makeFrame({
              id: 'photo',
              assetId: 'photo',
              caption: 'Lake',
              rect: { x: 20, y: 20, width: 40, height: 30 },
            }),
            textFrame(
              'gap',
              'One\n\nTwo',
              { x: 20, y: 70, width: 40, height: 20 },
              'body',
            ),
          ],
        }),
      ],
    })
    const file = pdfChunks()
    await paintBookPdf({
      book,
      profile: genericPrintProfile(),
      photos: (assetId) =>
        Promise.resolve(assetId === 'photo' ? PNG : undefined),
      fonts: bookFontFiles,
      marks: false,
      onChunk: file.onChunk,
    })
    const doc = await PDFDocument.load(file.bytes())
    const content = pageContent(doc, doc.getPage(0))

    expect(pageLines(doc, doc.getPage(0))).toEqual(['Lake', 'One', 'Two'])
    // #535152 caption, after the photo's own clipped state.
    expect(content).toMatch(
      /Do\nQ\nq\n[-\d. ]+ re\nW\nn\n0\.3[\d.]* 0\.3[\d.]* 0\.3[\d.]* rg\nBT\n/,
    )
    // #232220 text.
    expect(content).toMatch(
      /q\n[-\d. ]+ re\nW\nn\n0\.13[\d.]* 0\.13[\d.]* 0\.12[\d.]* rg\nBT\n/,
    )
    expect(content.trimEnd()).toMatch(/ET\nQ\nQ\nQ$/)
    // The photo that did not load and has no text prints nothing.
    expect(content).not.toMatch(/cm\nQ/)
  })

  it('embeds the ellipsis face a cut Cyrillic caption needs', async () => {
    const book = makeBook({
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              assetId: 'gone',
              caption: 'Озеро на рассвете у самой воды',
              rect: { x: 20, y: 20, width: 20, height: 30 },
            }),
          ],
        }),
      ],
    })
    const doc = await paint(book)

    const [line = ''] = pageLines(doc, doc.getPage(0))
    expect(line).toMatch(/^Озеро.*…$/)
  })

  it('needs no font files for an empty text frame', async () => {
    const file = pdfChunks()
    await paintBookPdf({
      book: makeBook({
        spreads: [
          makeSpread({
            frames: [
              textFrame(
                'empty',
                '',
                { x: 20, y: 20, width: 40, height: 20 },
                'body',
              ),
            ],
          }),
        ],
      }),
      profile: genericPrintProfile(),
      photos: () => Promise.resolve(undefined),
      marks: false,
      onChunk: file.onChunk,
    })
    const doc = await PDFDocument.load(file.bytes())

    expect(pageLines(doc, doc.getPage(0))).toEqual([])
  })

  it('embeds each font file once per document, as subset TrueType', async () => {
    const book = captionBook()
    // The same frames again on a later spread: no font is written twice.
    const twice: Book = {
      ...book,
      spreads: book.spreads.concat(
        book.spreads.slice(1).map((spread) => ({ ...spread, id: 's3' })),
      ),
    }
    const doc = await paint(twice)

    const page2 = pageLines(doc, doc.getPage(1))
    expect(pageLines(doc, doc.getPage(3))).toEqual(
      page2.map((line) => (line === '2' ? '4' : line)),
    )
    const all = objects(doc)
    const type0 = all.filter((dict) => nameOf(dict, 'Subtype') === '/Type0')
    const descriptors = all.filter(
      (dict) => nameOf(dict, 'Type') === '/FontDescriptor',
    )
    // Inter 400 and Lora 500, each in its Latin and Cyrillic file.
    expect(type0).toHaveLength(4)
    expect(descriptors).toHaveLength(4)
    const baseFonts = type0.map((dict) => nameOf(dict, 'BaseFont') ?? '')
    expect(new Set(baseFonts).size).toBe(4)
    expect(baseFonts.filter((name) => name.includes('Inter'))).toHaveLength(2)
    expect(baseFonts.filter((name) => name.includes('Lora'))).toHaveLength(2)
    for (const descriptor of descriptors) {
      expect(descriptor.get(PDFName.of('FontFile2'))).toBeInstanceOf(PDFRef)
    }
  })

  it('prints no font for a book without text, and needs no font files', async () => {
    const file = pdfChunks()
    await paintBookPdf({
      book: makeBook({ spreads: [makeSpread({ frames: [] })] }),
      profile: genericPrintProfile(),
      photos: () => Promise.resolve(undefined),
      marks: false,
      onChunk: file.onChunk,
    })
    const doc = await PDFDocument.load(file.bytes())

    expect(
      objects(doc).filter((dict) => nameOf(dict, 'Type') === '/Font'),
    ).toEqual([])
  })

  it('fails without font files once the book prints text', async () => {
    await expect(
      paintBookPdf({
        book: captionBook(),
        profile: genericPrintProfile(),
        photos: () => Promise.resolve(undefined),
        marks: false,
        onChunk: () => undefined,
      }),
    ).rejects.toThrow('no font files for PDF text')
  })
})
