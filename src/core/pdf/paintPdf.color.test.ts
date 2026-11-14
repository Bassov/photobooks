import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
} from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { genericPrintProfile } from '../print/genericProfile'
import {
  ADOBE_RGB_ICC,
  CAMERA_SRGB_ICC,
  colorJpeg,
  DISPLAY_P3_ICC,
} from '../testing/colorFixtures'
import {
  makePainterFixture,
  PAINTER_ASSET_IDS,
} from '../testing/painterFixture'
import { srgbIccProfile } from './iccProfile'
import { paintBookPdf } from './paintPdf'

const [first, second, third, fourth] = PAINTER_ASSET_IDS
const { book } = makePainterFixture()

/** 1 × 1 RGBA PNG. */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
)

async function paint(bytes: Record<string, Uint8Array>) {
  const result = await paintBookPdf({
    book,
    profile: genericPrintProfile(),
    photos: (assetId) => Promise.resolve(bytes[assetId]),
    marks: true,
  })
  return PDFDocument.load(result.pdf)
}

function streams(doc: PDFDocument): PDFRawStream[] {
  return doc.context
    .enumerateIndirectObjects()
    .map(([, object]) => object)
    .filter((object) => object instanceof PDFRawStream)
}

/** Color space of the image stream holding `original` (JPEG) bytes. */
function colorOf(doc: PDFDocument, original: Uint8Array | undefined) {
  const image = streams(doc).find(
    (stream) =>
      stream.dict.get(PDFName.of('Subtype')) === PDFName.of('Image') &&
      (original === undefined ||
        Buffer.from(stream.contents).equals(Buffer.from(original))),
  )
  const space = image?.dict.get(PDFName.of('ColorSpace'))
  if (!(space instanceof PDFArray)) return { device: space, icc: undefined }
  const ref = space.get(1)
  const icc = ref instanceof PDFRef ? doc.context.lookup(ref) : undefined
  if (!(icc instanceof PDFRawStream)) throw new Error('no ICC stream')
  return {
    family: space.get(0),
    n: icc.dict.lookup(PDFName.of('N'), PDFNumber).asNumber(),
    alternate: icc.dict.get(PDFName.of('Alternate')),
    icc: decodePDFRawStream(icc).decode(),
  }
}

function iccStreams(doc: PDFDocument): PDFRawStream[] {
  return streams(doc).filter((stream) =>
    stream.dict.has(PDFName.of('Alternate')),
  )
}

describe('paintBookPdf colors', () => {
  it('tags each color fixture with its own profile, untagged with sRGB', async () => {
    const bytes = {
      [first]: colorJpeg('srgb-tagged', CAMERA_SRGB_ICC),
      [second]: colorJpeg('untagged'),
      [third]: colorJpeg('adobe-rgb', ADOBE_RGB_ICC, { chunk: 1000 }),
      [fourth]: colorJpeg('display-p3', DISPLAY_P3_ICC),
    }
    const doc = await paint(bytes)

    const expected = [
      [first, CAMERA_SRGB_ICC],
      [second, srgbIccProfile()],
      [third, ADOBE_RGB_ICC],
      [fourth, DISPLAY_P3_ICC],
    ] as const
    for (const [assetId, icc] of expected) {
      expect(colorOf(doc, bytes[assetId]), assetId).toEqual({
        family: PDFName.of('ICCBased'),
        n: 3,
        alternate: PDFName.of('DeviceRGB'),
        icc,
      })
    }
    expect(iccStreams(doc)).toHaveLength(4)
  })

  it('writes each profile once however many photos carry it', async () => {
    const doc = await paint({
      [first]: colorJpeg('a', ADOBE_RGB_ICC),
      [second]: colorJpeg('b', ADOBE_RGB_ICC),
      [third]: colorJpeg('c'),
      [fourth]: colorJpeg('d'),
    })

    expect(iccStreams(doc)).toHaveLength(2)
  })

  it('tags an untagged PNG as sRGB', async () => {
    const doc = await paint({ [first]: PNG })

    expect(colorOf(doc, undefined).icc).toEqual(srgbIccProfile())
  })

  it('leaves untagged gray and CMYK photos device colored', async () => {
    const gray = colorJpeg('gray', undefined, { components: 1 })
    const cmyk = colorJpeg('cmyk', ADOBE_RGB_ICC, { components: 4 })
    const doc = await paint({ [first]: gray, [second]: cmyk })

    expect(colorOf(doc, gray)).toEqual({
      device: PDFName.of('DeviceGray'),
      icc: undefined,
    })
    expect(colorOf(doc, cmyk)).toEqual({
      device: PDFName.of('DeviceCMYK'),
      icc: undefined,
    })
    expect(iccStreams(doc)).toHaveLength(0)
  })
})
