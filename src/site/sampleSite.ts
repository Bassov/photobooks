import type { Book, Frame, Spread } from '../core'
import { defaultCover } from '../core/cover'
import { pagesOf } from '../core/pages'
import { makeBook } from '../core/testing/fixtures'
import { bookFormatFromTrim } from '../render/bookObjectLayout'
import type { ImageRef, SiteMeta, SitePageInput } from './siteInput'

/**
 * Sample library `site.html` shows without `#site-data` (hosted preview,
 * Lighthouse, e2e): `?book=<id>` opens a book page, `?empty=1` the empty
 * catalog. Photos are the two app fixtures in `public/photos/hi`.
 */
const SITE: SiteMeta = { title: 'Sample photobooks', author: 'A. Photographer' }

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

const BOOKS = [
  sampleBook('alps', 'Alps', 11, { widthMm: 190, heightMm: 230 }),
  sampleBook('sea', 'Sea', 4, { widthMm: 280, heightMm: 210 }),
]

export function sampleSiteInput(search: string): SitePageInput {
  const params = new URLSearchParams(search)
  const book = BOOKS.find((entry) => entry.id === params.get('book'))
  if (book !== undefined) {
    return {
      kind: 'book',
      site: SITE,
      path: '',
      catalogHref: 'site.html',
      book,
      images: IMAGES,
    }
  }
  const shown = params.get('empty') === '1' ? [] : BOOKS
  return {
    kind: 'catalog',
    site: SITE,
    path: '',
    books: shown.map((entry) => ({
      id: entry.id,
      href: `site.html?book=${entry.id}`,
      title: entry.title ?? '',
      pages: pagesOf(entry.spreads.length),
      fmt: bookFormatFromTrim(
        entry.settings.trim.widthMm,
        entry.settings.trim.heightMm,
      ),
      cover: IMAGES['photo-a'] ?? null,
      ink: '#F5F5F5',
      place: 'top',
    })),
  }
}
