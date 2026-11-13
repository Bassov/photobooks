import type { PrintProfile } from '../print/profileSchema'
import { bookPrintProfile } from '../printProfile'
import type { Book } from '../schema'
import { paintBookPdf, type SkippedPhoto } from './paintPdf'

export interface PdfPaintRequest {
  book: Book
  /** The library's custom print profiles (Spec D6). */
  printProfiles?: readonly PrintProfile[]
  /** Original photo files by asset id; `File`s clone without reading them. */
  photos: Readonly<Record<string, Blob>>
}

export type PdfPaintMessage =
  | { done: { pdf: ArrayBuffer; sheets: number; skipped: SkippedPhoto[] } }
  | { failed: { message: string } }

/** Paints the book's PDF; exactly one `done` / `failed` message follows. */
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
    })
    const pdf = new Uint8Array(result.pdf).buffer
    post({ done: { pdf, sheets: result.sheets, skipped: result.skipped } }, [
      pdf,
    ])
  } catch (error) {
    post({ failed: { message: String(error) } }, [])
  }
}

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<PdfPaintRequest>) => void) | null
  postMessage: (message: PdfPaintMessage, transfer: Transferable[]) => void
}

workerScope.onmessage = (event: MessageEvent<PdfPaintRequest>) => {
  void runPdfPaint(event.data, (message, transfer) => {
    workerScope.postMessage(message, transfer)
  })
}
