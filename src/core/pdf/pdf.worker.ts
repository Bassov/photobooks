import {
  photoPages,
  preflight,
  type PreflightAssetStatus,
} from '../print/preflight'
import { preflightRows, type PreflightRow } from '../print/preflightText'
import type { PrintProfile } from '../print/profileSchema'
import { bookPrintProfile } from '../printProfile'
import type { Book } from '../schema'
import { colorWarnings } from './colorPreflight'
import type { ImpositionLayout } from '../print/imposition'
import { readSourceColor } from './iccProfile'
import { imposePdf } from './imposePdf'
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

/** Bytes read from the head of each photo: JPEG APP2 / PNG iCCP sit there. */
export const COLOR_READ_BYTES = 256 * 1024

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
      book: request.book,
      profile: bookPrintProfile(request.book, request.printProfiles),
      photos: async (assetId) => {
        const blob = request.photos[assetId]
        return blob === undefined
          ? undefined
          : new Uint8Array(await blob.arrayBuffer())
      },
      marks: request.marks,
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
    })
    const sources = await Promise.all(
      [...photoPages(book)].flatMap(([assetId, pages]) => {
        const blob = request.photos[assetId]
        return blob === undefined ? [] : [sourceColor(assetId, pages, blob)]
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

async function sourceColor(assetId: string, pages: number[], blob: Blob) {
  const head = await blob.slice(0, COLOR_READ_BYTES).arrayBuffer()
  const { family } = await readSourceColor(new Uint8Array(head))
  return { assetId, pages, family }
}

type PdfWorkerMessage = PdfPaintMessage | PdfCheckMessage | PdfImposeMessage

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<PdfWorkerRequest>) => void) | null
  postMessage: (message: PdfWorkerMessage, transfer: Transferable[]) => void
}

workerScope.onmessage = (event: MessageEvent<PdfWorkerRequest>) => {
  const post = (message: PdfWorkerMessage, transfer: Transferable[]) => {
    workerScope.postMessage(message, transfer)
  }
  const request = event.data
  void ('check' in request
    ? runPdfCheck(request.check, post)
    : 'impose' in request
      ? runPdfImpose(request.impose, post)
      : runPdfPaint(request.paint, post))
}
