import { memo, useRef, type PointerEvent } from 'react'
import type { Book } from '../core'
// Not the barrel: it would pull the zod schemas into the viewer entry.
import { resolveSpread } from '../core/geometry/resolveSpread'
import { CoverView } from '../render/CoverView'
import { swipeDelta } from '../render/pagerIndex'
import { SpreadView } from '../render/SpreadView'
import type { ImageRef } from './siteInput'
import { frameSizes, slideSide, spreadRatio, STAGE_MAX } from './siteModel'

type Images = Readonly<Record<string, ImageRef>>

const noPreview = (): undefined => undefined

/**
 * One slide's paint; memoised, so a step re-renders only the new neighbour.
 * `sizesPx` (lightbox): the spread's painted width × zoom; photos then ask
 * for their share of it and load eagerly.
 */
export const SlideContent = memo(function SlideContent({
  book,
  images,
  slide,
  width,
  sizesPx,
}: {
  book: Book
  images: Images
  slide: number
  width: number
  sizesPx?: number
}) {
  const { trim } = book.settings
  if (slide === 0) {
    // The cover (2 pages + spine) is wider for its height than a spread, so
    // at the stage width it is never taller than the stage: centred in it.
    const frontId = book.cover.front.assetId ?? ''
    return (
      <CoverView book={book} frontUrl={images[frontId]?.src} widthPx={width} />
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
        return sizesPx === undefined
          ? {
              src: ref.src,
              srcset: ref.srcset,
              sizes: frameSizes(share),
              loading: slide <= 1 ? 'eager' : 'lazy',
            }
          : {
              src: ref.src,
              srcset: ref.srcset,
              sizes: `${String(Math.ceil(sizesPx * share))}px`,
              loading: 'eager',
            }
      }}
    />
  )
})

/**
 * Constant-size stage: the current slide, with its neighbours mounted inert at
 * opacity 0 so their photos load first. `width` is undefined until measured
 * (server render): CSS sizes the stage, the content paints at 760. A click
 * on the stage opens the lightbox; a swipe steps and does not.
 */
export function SiteStage({
  book,
  images,
  slide,
  width,
  onStep,
  onOpen,
}: {
  book: Book
  images: Images
  slide: number
  width: number | undefined
  onStep: (delta: 1 | -1) => void
  onOpen: () => void
}) {
  const n = book.spreads.length
  const { trim } = book.settings
  const w = width ?? STAGE_MAX
  const swipeStart = useRef<number | null>(null)
  const swiped = useRef(false)
  const slides = [slide - 1, slide, slide + 1].filter((s) => s >= 0 && s <= n)
  return (
    <div
      className="site-stage"
      data-testid="site-stage"
      style={
        width === undefined
          ? {
              aspectRatio: `${String(2 * trim.widthMm)} / ${String(trim.heightMm)}`,
            }
          : { width, height: width / spreadRatio(trim) }
      }
      onPointerDown={(event: PointerEvent) => {
        swipeStart.current = event.clientX
      }}
      onPointerUp={(event: PointerEvent) => {
        const start = swipeStart.current
        swipeStart.current = null
        if (start === null) return
        const delta = swipeDelta(start, event.clientX)
        swiped.current = delta !== 0
        if (delta !== 0) onStep(delta)
      }}
      onPointerCancel={() => {
        swipeStart.current = null
      }}
    >
      {slides.map((s) => {
        const current = s === slide
        return (
          <div
            key={s}
            className="site-slide"
            style={{ width: w }}
            data-slide={s}
            data-side={slideSide(book, s)}
            data-testid={current ? 'site-spread' : undefined}
            data-off={current ? undefined : ''}
            aria-hidden={current ? undefined : true}
            inert={!current}
          >
            <SlideContent book={book} images={images} slide={s} width={w} />
          </div>
        )
      })}
      <button
        type="button"
        className="site-open"
        aria-label="Open fullscreen"
        data-testid="site-open"
        onClick={() => {
          if (swiped.current) {
            swiped.current = false
            return
          }
          onOpen()
        }}
      />
    </div>
  )
}
