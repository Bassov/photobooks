import { memo, type ReactNode } from 'react'
import type { Book } from '../core'
// Not the barrel: it would pull the zod schemas into the viewer entry.
import { resolveSpread } from '../core/geometry/resolveSpread'
import { CoverView } from '../render/CoverView'
import { SpreadView } from '../render/SpreadView'
import type { ImageRef, SiteCatalogBook } from './siteInput'
import { spreadSide } from './siteModel'
import { imageSrc } from './siteUrl'

export type Images = Readonly<Record<string, ImageRef>>

/** What the room paints a book from: the home's entry, the document and its photos. */
export interface RoomBook {
  entry: SiteCatalogBook
  book: Book
  images: Images
  /** the host's own slide paint (editor preview): CSS reader only */
  renderSlide?: RenderSlide | undefined
}

const noPreview = (): undefined => undefined

/** A host's own slide paint (editor preview) at `widthPx`: 0 the cover, s spread s − 1. */
export type RenderSlide = (slide: number, widthPx: number) => ReactNode

/**
 * One slide's paint at spread width `width` (0 the cover, s spread s − 1);
 * memoised. Photos ask for their share of `sizesPx` (default `width`).
 */
export const SlideContent = memo(function SlideContent({
  book,
  images,
  slide,
  width,
  sizesPx = width,
  eager = false,
}: {
  book: Book
  images: Images
  slide: number
  width: number
  sizesPx?: number
  eager?: boolean | undefined
}) {
  const { trim } = book.settings
  if (slide === 0) {
    const frontId = book.cover.front.assetId ?? ''
    const front = images[frontId]?.src
    return (
      <CoverView
        book={book}
        frontUrl={front === undefined ? undefined : imageSrc(front)}
        widthPx={width}
      />
    )
  }
  const spreadId = book.spreads[slide - 1]?.id ?? ''
  const resolved = resolveSpread(book, spreadId, {
    getAspectRatio: (assetId) => {
      const ref = images[assetId]
      return ref === undefined ? 1 : ref.w / ref.h
    },
  })
  if (resolved === undefined) return null
  return (
    <SpreadView
      spreadId={spreadId}
      resolved={resolved}
      pxPerMm={width / (2 * trim.widthMm)}
      lowDpiBadge={false}
      previewUrlFor={noPreview}
      imageFor={(assetId, widthMm) => {
        const ref = images[assetId]
        if (ref === undefined) return undefined
        const share = widthMm / (2 * trim.widthMm)
        return {
          src: imageSrc(ref.src),
          srcset: ref.srcset
            .split(',')
            .map((part) => imageSrc(part.trim()).replace(/(\d+w)$/, ' $1'))
            .join(', '),
          sizes: `${String(Math.ceil(sizesPx * share))}px`,
          loading: eager ? 'eager' : 'lazy',
        }
      }}
    />
  )
})

/**
 * One page of spread `spread` at page size `pw` × `ph`: `side` picks the half
 * of a two-page spread; a one-page spread shows its page on its own side and
 * paper on the other (`null`: the endpaper side).
 */
export function PageFace({
  book,
  images,
  spread,
  side,
  pw,
  renderSlide,
  eager,
}: {
  book: Book
  images: Images
  spread: number
  side: 'left' | 'right'
  pw: number
  renderSlide?: RenderSlide | undefined
  eager?: boolean | undefined
}) {
  const single = spreadSide(book, spread)
  if (single !== undefined && single !== side) return null
  const W = 2 * pw
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: single === undefined && side === 'right' ? -pw : 0,
      }}
    >
      {renderSlide === undefined ? (
        <SlideContent
          book={book}
          images={images}
          slide={spread + 1}
          width={W}
          eager={eager}
        />
      ) : (
        renderSlide(spread + 1, W)
      )}
    </div>
  )
}

/** The front cover of `b` filling its box (the home `Book3D` cover look). */
export function CoverFace({
  b,
  w,
  h,
}: {
  b: SiteCatalogBook
  w: number
  h: number
}) {
  return (
    <div className="sb-cover" style={{ background: b.spine.cloth }}>
      {b.cover === null ? null : (
        <img src={imageSrc(b.cover.src)} alt="" decoding="async" />
      )}
      <div className="sd-b3-hinge" style={{ width: Math.max(8, h / 30) }} />
      <div
        className="sd-it sd-b3-title"
        style={{
          color: b.ink,
          fontSize: `calc(var(--cover-k) * ${String(Math.min(w, h))}px)`,
          [b.place]: '9%',
        }}
      >
        {b.title}
      </div>
    </div>
  )
}
