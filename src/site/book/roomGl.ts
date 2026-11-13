/*
 * The room's WebGL books (Designer D39–D41), loaded lazily with three: the
 * desktop reader's `OpenBook` and the phone page turn's `PageCurl`, both over
 * pages painted by `createFaceSource` from the site's photos. `OpenBook` and
 * `PageCurl` load on demand: a static import would fold the shared
 * `gl/closed` into a common chunk instead of its own lazy entry.
 */
import type { Book } from '../../core'
import { resolveParentFrames } from '../../core/parentSpreads'
import type { PageImage } from '../../render/pagePainter'
import type { ImageRef, SiteCatalogBook } from '../siteInput'
import type { CurlSheet, PageCurl } from './gl/curl'
import { createFaceSource, type FaceSource } from './gl/faces'
import type { OpenBook } from './gl/open'
import { drawInto, loadThree, type Three } from './gl/three'
import { glBook, type GlBook } from './gl/types'
import { glInput, photoOf } from './glCover'

export interface RoomGlInput {
  entry: SiteCatalogBook
  book: Book
  images: Readonly<Record<string, ImageRef>>
  /** face width in device px */
  pagePx: number
}

/** Decoded photos of physical page `page` (1-based): its spread's frames, each photo loaded once. */
export function pageImages(
  book: Book,
  images: Readonly<Record<string, ImageRef>>,
): (page: number) => Promise<ReadonlyMap<string, PageImage>> {
  const cache = new Map<string, Promise<PageImage | null>>()
  const load = (id: string) => {
    let p = cache.get(id)
    if (p === undefined) {
      const ref = images[id]
      p =
        ref === undefined
          ? Promise.resolve(null)
          : photoOf(ref.src).catch(() => null)
      cache.set(id, p)
    }
    return p
  }
  return async (page) => {
    const spread = book.spreads[Math.floor(page / 2)]
    const ids =
      spread === undefined
        ? []
        : [
            ...new Set(
              resolveParentFrames(book, spread).flatMap(({ frame }) =>
                frame.assetId === undefined ? [] : [frame.assetId],
              ),
            ),
          ]
    const loaded = await Promise.all(
      ids.map(async (id) => [id, await load(id)] as const),
    )
    return new Map(
      loaded.filter((e): e is readonly [string, PageImage] => e[1] !== null),
    )
  }
}

async function glOf(
  i: RoomGlInput,
): Promise<{ T: Three; b: GlBook; faces: FaceSource }> {
  const [T, photo] = await Promise.all([
    loadThree(),
    photoOf(i.entry.cover?.src).catch(() => null),
  ])
  const faces = createFaceSource({
    book: i.book,
    images: pageImages(i.book, i.images),
    pagePx: i.pagePx,
  })
  return {
    T,
    b: glBook({ ...glInput(i.entry, photo, i.pagePx), face: faces.face }),
    faces,
  }
}

export interface ReaderGlBook {
  book: OpenBook
  faces: FaceSource
  draw: (canvas: HTMLCanvasElement) => void
}

/** The desktop reader's open book (the leaf bends). */
export async function openReaderGl(i: RoomGlInput): Promise<ReaderGlBook> {
  const [{ T, b, faces }, { OpenBook }] = await Promise.all([
    glOf(i),
    import('./gl/open'),
  ])
  const book = new OpenBook(T, b, { dark: false, bend: true, pagePx: i.pagePx })
  return {
    book,
    faces,
    draw: (canvas) => {
      drawInto(T, book.scene, book.cam, canvas, true)
    },
  }
}

/** The phone page turn's sheets, `pw` × `ph` css px. */
export async function openCurlGl(
  i: RoomGlInput,
  sheets: readonly CurlSheet[],
  pw: number,
  ph: number,
): Promise<{ curl: PageCurl; faces: FaceSource }> {
  const [{ T, b, faces }, { PageCurl }] = await Promise.all([
    glOf(i),
    import('./gl/curl'),
  ])
  return { curl: new PageCurl(T, b, sheets, i.pagePx, pw, ph), faces }
}
