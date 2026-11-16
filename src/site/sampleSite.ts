import type { Book, Frame, Spread } from '../core'
import { defaultCover } from '../core/cover'
import { pagesOf } from '../core/pages'
import { makeBook } from '../core/testing/fixtures'
import { bookFormatFromTrim } from '../render/bookObjectLayout'
import type {
  ImageRef,
  SiteCatalogBook,
  SiteMeta,
  SitePageInput,
} from './siteInput'
import { siteBookFacts } from './siteModel'

/**
 * Sample library `site.html` shows without `#site-data` (hosted preview,
 * Lighthouse, e2e): `?book=<id>` opens a book page, `?empty=1` the empty
 * catalog. Photos are the two app fixtures in `public/photos/hi`.
 */
const SITE: SiteMeta = {
  title: 'Sample photobooks',
  author: 'A. Photographer',
  intro: 'Travel books from three summers, printed and bound by hand.',
}

/** `photo-a` (covers, first spread) is the light one: phones load it first. */
const IMAGES: Record<string, ImageRef> = {
  'photo-a': {
    src: '/photos/hi/c18b.jpg',
    srcset: '/photos/hi/c18b.jpg 1400w',
    w: 1400,
    h: 933,
  },
  'photo-b': {
    src: '/photos/hi/c18.jpg',
    srcset: '/photos/hi/c18.jpg 2400w',
    w: 2400,
    h: 1600,
  },
}

const PHOTOS = Object.keys(IMAGES)

/** A 3:2 photo frame on the page that starts at `x0` mm. */
function photoFrame(
  id: string,
  x0: number,
  trim: { widthMm: number; heightMm: number },
  assetId: string,
  caption?: string,
): Frame {
  const width = trim.widthMm * 0.84
  const height = (width * 2) / 3
  return {
    id,
    rect: {
      x: x0 + trim.widthMm * 0.08,
      y: (trim.heightMm - height) / 2,
      width,
      height,
    },
    z: 0,
    assetId,
    ...(caption === undefined ? {} : { caption }),
  }
}

function sampleBook(
  id: string,
  title: string,
  spreadCount: number,
  trim: { widthMm: number; heightMm: number },
): Book {
  const photo = (i: number) => PHOTOS[i % PHOTOS.length] ?? 'photo-a'
  const spreads: Spread[] = Array.from({ length: spreadCount }, (_, i) => {
    const single = i === 0 || i === spreadCount - 1
    const frames = single
      ? [photoFrame(`${id}-f${String(i)}`, 0, trim, photo(i))]
      : [
          photoFrame(
            `${id}-f${String(i)}l`,
            0,
            trim,
            photo(i),
            `Day ${String(i)}`,
          ),
          photoFrame(`${id}-f${String(i)}r`, trim.widthMm, trim, photo(i + 1)),
        ]
    return { id: `${id}-s${String(i)}`, frames }
  })
  const cover = defaultCover(title)
  return makeBook({
    id,
    title,
    settings: { trim },
    cover: { ...cover, front: { ...cover.front, assetId: 'photo-a' } },
    assets: Object.fromEntries(PHOTOS.map((photoId) => [photoId, {}])),
    spreads,
  })
}

/**
 * A square book whose spread 2 is a panorama across the gutter and whose
 * page 3 (the right page of spread 1) is blank: phone slides skip it.
 */
function lakeBook(): Book {
  const trim = { widthMm: 210, heightMm: 210 }
  const book = sampleBook('lake', 'Lake', 5, trim)
  const panorama: Frame = {
    id: 'lake-pano',
    rect: { x: 0, y: 30, width: 2 * trim.widthMm, height: 150 },
    z: 0,
    assetId: 'photo-b',
  }
  const spreads = book.spreads.map((spread, i) =>
    i === 1
      ? { ...spread, frames: spread.frames.slice(0, 1) }
      : i === 2
        ? { ...spread, frames: [panorama] }
        : spread,
  )
  return {
    ...book,
    cover: {
      ...book.cover,
      style: { ...book.cover.style, backFill: '#c9c2b4' },
    },
    settings: { ...book.settings, pageColor: '#f7f4ee' },
    spreads,
  }
}

/** Sample books with the UTC publish time they show the year of. */
const BOOKS: readonly { book: Book; publishedAtMs: number }[] = [
  {
    book: sampleBook('alps', 'Alps', 11, { widthMm: 190, heightMm: 230 }),
    publishedAtMs: Date.UTC(2024, 8, 1),
  },
  {
    book: sampleBook('sea', 'Sea', 4, { widthMm: 280, heightMm: 210 }),
    publishedAtMs: Date.UTC(2023, 6, 15),
  },
  { book: lakeBook(), publishedAtMs: Date.UTC(2025, 5, 20) },
]

/** Unlisted (`?book=crop`): one page, the 3:2 photo filling a portrait frame. */
function cropBook(): Book {
  const trim = { widthMm: 190, heightMm: 230 }
  const base = sampleBook('crop', 'Crop', 1, trim)
  const frame: Frame = {
    id: 'crop-f0',
    rect: { x: 15, y: 15, width: 160, height: 200 },
    z: 0,
    assetId: 'photo-b',
  }
  return { ...base, spreads: [{ id: 'crop-s0', frames: [frame] }] }
}

const UNLISTED = [cropBook()]

const entryOf = (book: Book, publishedAtMs: number): SiteCatalogBook => ({
  id: book.id,
  href: `site.html?book=${book.id}`,
  title: book.title ?? '',
  pages: pagesOf(book.spreads.length),
  fmt: bookFormatFromTrim(
    book.settings.trim.widthMm,
    book.settings.trim.heightMm,
  ),
  cover: IMAGES['photo-a'] ?? null,
  ink: '#F5F5F5',
  place: 'top',
  ...siteBookFacts(book, publishedAtMs),
})

/** The publish time of the unlisted books. */
const UNLISTED_AT = Date.UTC(2025, 0, 1)

export function sampleSiteInput(search: string): SitePageInput {
  const params = new URLSearchParams(search)
  const found = [
    ...BOOKS,
    ...UNLISTED.map((book) => ({ book, publishedAtMs: UNLISTED_AT })),
  ].find(({ book }) => book.id === params.get('book'))
  if (found !== undefined) {
    return {
      kind: 'book',
      site: SITE,
      path: '',
      catalogHref: 'site.html',
      book: found.book,
      images: IMAGES,
      entry: entryOf(found.book, found.publishedAtMs),
    }
  }
  const shown = params.get('empty') === '1' ? [] : BOOKS
  return {
    kind: 'catalog',
    site: SITE,
    path: '',
    books: shown.map(({ book, publishedAtMs }) => entryOf(book, publishedAtMs)),
  }
}
