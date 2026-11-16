import {
  photoPages,
  preflight,
  type PreflightAssetStatus,
  type PreflightCoverOptions,
} from '../print/preflight'
import { preflightRows, type PreflightRow } from '../print/preflightText'
import type { PrintProfile } from '../print/profileSchema'
import { bookPrintProfile } from '../printProfile'
import type { Book } from '../schema'
import { colorWarnings } from './colorPreflight'
import type { ImpositionLayout } from '../print/imposition'
import { readSourceColor } from './iccProfile'
import { imposePdf } from './imposePdf'
import { paintCoverPdf, titleFace } from './paintCoverPdf'
import {
  loadPdfFonts,
  type FontFileSource,
  type FontNeed,
  type PdfFonts,
} from './pdfFonts'
import { paintBookPdf, type SkippedPhoto } from './paintPdf'

export interface PdfPaintRequest {
  book: Book
  /** The library's custom print profiles (Spec D6). */
  printProfiles?: readonly PrintProfile[]
  /** Original photo files by asset id; `File`s clone without reading them. */
  photos: Readonly<Record<string, Blob>>
  /** The user's "bleed and crop marks" choice (Spec D4). */
  marks: boolean
}

export interface PdfCheckRequest extends Omit<PdfPaintRequest, 'marks'> {
  /** Relink scan result by asset id; absent ids are present and unchanged. */
  assetStatus?: Readonly<Record<string, PreflightAssetStatus>>
  /** The dialog's layout: only 1 per sheet prints a cover, so checks it (C9). */
  layout: 'single' | ImpositionLayout
}

export interface PdfImposeRequest {
  /** The page PDF: a `paint` request's chunks; a Blob clones unread. */
  pdf: Blob
  layout: ImpositionLayout
}

export type PdfWorkerRequest =
  | { paint: PdfPaintRequest }
  | { check: PdfCheckRequest }
  | { impose: PdfImposeRequest }

/**
 * The one-page cover PDF of the same paint request (Designer cover-pdf);
 * the print dialog's item joins it to `PdfWorkerRequest`.
 */
export interface PdfCoverWorkerRequest {
  cover: PdfPaintRequest
}

/** The next bytes of the PDF file, transferred; chunks come in file order. */
export interface PdfChunkMessage {
  chunk: ArrayBuffer
}

export type PdfPaintMessage =
  | PdfChunkMessage
  /** After each PDF page, `painted` 1..`sheets`. */
  | { progress: { painted: number; sheets: number } }
  /** After the last chunk; `bytes` = every chunk together. */
  | { done: { bytes: number; sheets: number; skipped: SkippedPhoto[] } }
  | { failed: { message: string } }

export type PdfCoverMessage =
  | PdfChunkMessage
  /** After the last chunk; `skipped` = the front photo when it is gone. */
  | { done: { bytes: number; skipped: SkippedPhoto[] } }
  | { failed: { message: string } }

export type PdfCheckMessage =
  { checked: { rows: PreflightRow[] } } | { failed: { message: string } }

export type PdfImposeMessage =
  | PdfChunkMessage
  /** After each sheet (front and back), `imposed` 1..`sheets`. */
  | { progress: { imposed: number; sheets: number } }
  | { done: { bytes: number; sheets: number } }
  | { failed: { message: string } }

/** Posts a writer chunk, moving its buffer (the chunk owns all of it). */
function postChunk(
  post: (message: PdfChunkMessage, transfer: Transferable[]) => void,
): (chunk: Uint8Array) => void {
  return (chunk) => {
    const buffer = chunk.buffer as ArrayBuffer
    post({ chunk: buffer }, [buffer])
  }
}

/** A book font file as the app serves it (`public/fonts`, the DOM's files). */
async function fetchBookFont(file: string): Promise<Uint8Array> {
  const url = new URL(
    `${import.meta.env.BASE_URL}fonts/${file}`,
    globalThis.location.href,
  )
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`font ${file}: HTTP ${String(response.status)}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

/** Bytes read from the head of each photo: JPEG APP2 / PNG iCCP sit there. */
export const COLOR_READ_BYTES = 256 * 1024

/** The painter input of a paint / cover request, without its sinks. */
function paintInput(request: PdfPaintRequest) {
  return {
    book: request.book,
    profile: bookPrintProfile(request.book, request.printProfiles),
    photos: async (assetId: string) => {
      const blob = request.photos[assetId]
      return blob === undefined
        ? undefined
        : new Uint8Array(await blob.arrayBuffer())
    },
    fonts: fetchBookFont,
    marks: request.marks,
  }
}

/**
 * Paints the book's one-page cover PDF: `chunk` messages as the file grows,
 * then exactly one `done` / `failed` message.
 */
export async function runPdfCover(
  request: PdfPaintRequest,
  post: (message: PdfCoverMessage, transfer: Transferable[]) => void,
): Promise<void> {
  try {
    const { bytes, skipped } = await paintCoverPdf({
      ...paintInput(request),
      onChunk: postChunk(post),
    })
    post({ done: { bytes, skipped } }, [])
  } catch (error) {
    post({ failed: { message: String(error) } }, [])
  }
}

/**
 * Paints the book's PDF: `chunk` messages as the file grows, a `progress`
 * message per page (posted, never awaited), then exactly one `done` /
 * `failed` message.
 */
export async function runPdfPaint(
  request: PdfPaintRequest,
  post: (message: PdfPaintMessage, transfer: Transferable[]) => void,
): Promise<void> {
  try {
    const result = await paintBookPdf({
      ...paintInput(request),
      onChunk: postChunk(post),
      onSheet: (painted, sheets) => {
        post({ progress: { painted, sheets } }, [])
      },
    })
    const { bytes, sheets, skipped } = result
    post({ done: { bytes, sheets, skipped } }, [])
  } catch (error) {
    post({ failed: { message: String(error) } }, [])
  }
}

/**
 * Preflight plus the colour check of every placed photo's file head;
 * exactly one `checked` / `failed` message follows.
 */
export async function runPdfCheck(
  request: PdfCheckRequest,
  post: (message: PdfCheckMessage, transfer: Transferable[]) => void,
): Promise<void> {
  try {
    const { book } = request
    const profile = bookPrintProfile(book, request.printProfiles)
    const issues = preflight(book, profile, {
      assetStatus: new Map(Object.entries(request.assetStatus ?? {})),
      ...(request.layout === 'single'
        ? { cover: await coverCheck(request, profile) }
        : {}),
    })
    const sources = await Promise.all(
      [...photoPages(book)].flatMap(([assetId, pages]) => {
        const blob = request.photos[assetId]
        return blob === undefined
          ? []
          : [
              sourceColor(assetId, blob).then((source) => ({
                ...source,
                pages,
              })),
            ]
      }),
    )
    const colors = sources.flatMap((source) =>
      colorWarnings([source], profile).map(({ family }) => ({
        family,
        pages: source.pages,
      })),
    )
    post({ checked: { rows: preflightRows({ issues, colors, profile }) } }, [])
  } catch (error) {
    post({ failed: { message: String(error) } }, [])
  }
}

/**
 * Imposes the page PDF (read whole): `chunk` messages as the imposed file
 * grows, a `progress` message per sheet (posted, never awaited), then
 * exactly one `done` / `failed` message.
 */
export async function runPdfImpose(
  request: PdfImposeRequest,
  post: (message: PdfImposeMessage, transfer: Transferable[]) => void,
): Promise<void> {
  try {
    const result = await imposePdf({
      pdf: request.pdf,
      layout: request.layout,
      onChunk: postChunk(post),
      onSheet: (imposed, sheets) => {
        post({ progress: { imposed, sheets } }, [])
      },
    })
    post({ done: { bytes: result.bytes, sheets: result.sheets } }, [])
  } catch (error) {
    post({ failed: { message: String(error) } }, [])
  }
}

/**
 * The cover rules' input at 1 per sheet: the front photo's colour and the
 * spine text measured in the book font the cover painter sets it in.
 */
async function coverCheck(
  request: PdfCheckRequest,
  profile: PrintProfile,
): Promise<PreflightCoverOptions> {
  const { cover } = request.book
  const fronts = Object.entries(request.photos).filter(
    ([assetId]) => assetId === cover.front.assetId,
  )
  const sources = await Promise.all(
    fronts.map(([assetId, blob]) => sourceColor(assetId, blob)),
  )
  const face = titleFace(cover.style.titleFont)
  // An empty spine text loads no font file.
  const fonts = await spineFonts(
    { font: face, text: cover.spine.text.trim() },
    fetchBookFont,
  )
  return {
    layout: 'single',
    colors: colorWarnings(sources, profile),
    textAdvanceMm: (line, sizeMm) => fonts.width(line, { ...face, sizeMm }),
  }
}

/** The book font faces of `need`, opened in a throwaway PDF to measure. */
async function spineFonts(
  need: FontNeed,
  source: FontFileSource,
): Promise<PdfFonts> {
  // Loaded on a cover check only, as the cover painter does.
  const lib = await import('@cantoo/pdf-lib')
  const doc = await lib.PDFDocument.create()
  return loadPdfFonts(lib, doc, [need], source)
}

async function sourceColor(assetId: string, blob: Blob) {
  const head = await blob.slice(0, COLOR_READ_BYTES).arrayBuffer()
  const { family } = await readSourceColor(new Uint8Array(head))
  return { assetId, family }
}

type PdfWorkerMessage =
  PdfPaintMessage | PdfCoverMessage | PdfCheckMessage | PdfImposeMessage

type PdfAnyRequest = PdfWorkerRequest | PdfCoverWorkerRequest

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<PdfAnyRequest>) => void) | null
  postMessage: (message: PdfWorkerMessage, transfer: Transferable[]) => void
}

workerScope.onmessage = (event: MessageEvent<PdfAnyRequest>) => {
  const post = (message: PdfWorkerMessage, transfer: Transferable[]) => {
    workerScope.postMessage(message, transfer)
  }
  const request = event.data
  void ('check' in request
    ? runPdfCheck(request.check, post)
    : 'impose' in request
      ? runPdfImpose(request.impose, post)
      : 'cover' in request
        ? runPdfCover(request.cover, post)
        : runPdfPaint(request.paint, post))
}
