import {
  BOOK_FONT_FACES,
  unicodeRangeCss,
  type BookFontFace,
} from './bookFonts'

/** Reads one font file from the book folder (or any equivalent store). */
type FontFileReader = (file: string) => Promise<ArrayBuffer>

interface FontSetLike {
  add(face: FontFace): unknown
  ready: Promise<unknown>
}

type FontFaceFactory = (
  family: string,
  source: ArrayBuffer,
  descriptors: FontFaceDescriptors,
) => FontFace

export interface LoadBookFontsOptions {
  read: FontFileReader
  faces?: readonly BookFontFace[]
  fontSet?: FontSetLike
  createFace?: FontFaceFactory
}

export interface LoadedBookFonts {
  /** Raw bytes per file name: the same buffers the PDF painter embeds. */
  files: ReadonlyMap<string, ArrayBuffer>
}

export function faceDescriptors(face: BookFontFace): FontFaceDescriptors {
  return {
    style: face.style,
    weight: `${face.weightMin.toString()} ${face.weightMax.toString()}`,
    unicodeRange: unicodeRangeCss(face),
    display: 'swap',
  }
}

/**
 * Reads every curated file, registers it in `document.fonts` and resolves
 * after each face loaded and `fonts.ready` settled. Rejects if any file fails.
 */
export async function loadBookFonts(
  options: LoadBookFontsOptions,
): Promise<LoadedBookFonts> {
  const faces = options.faces ?? BOOK_FONT_FACES
  const fontSet = options.fontSet ?? document.fonts
  const createFace: FontFaceFactory =
    options.createFace ??
    ((family, source, d) => new FontFace(family, source, d))
  const files = new Map<string, ArrayBuffer>()
  await Promise.all(
    faces.map(async (face) => {
      const bytes = await options.read(face.file)
      files.set(face.file, bytes)
      const loaded = await createFace(
        face.family,
        bytes,
        faceDescriptors(face),
      ).load()
      fontSet.add(loaded)
    }),
  )
  await fontSet.ready
  return { files }
}
