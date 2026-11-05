import { useCallback, useEffect, useState } from 'react'
import type { Book } from '../core'
import { hoverPointer } from '../render/hoverPointer'
import { fitBox, fitInsets } from '../render/pagerZoom'
import { SpreadPager } from '../render/SpreadPager'
import type { ImageRef } from './siteInput'
import { slideLabel, slideSide, spreadRatio, STAGE_MAX } from './siteModel'
import { SlideContent } from './SiteStage'

/** The spread's fitted width before the pager has measured it. */
function fittedSpreadWidth(book: Book): number {
  const view = { w: window.innerWidth, h: window.innerHeight }
  const ratio = spreadRatio(book.settings.trim)
  return fitBox({ w: ratio, h: 1 }, view, fitInsets(hoverPointer())).w
}

/**
 * Book page lightbox (Designer site-lightbox): the pager's `lightbox`
 * variant over the same slides as the stage. It keeps its own slide (the
 * stage behind does not step or load) and hands it back on close.
 */
export function SiteLightbox({
  book,
  images,
  title,
  start,
  onClose,
}: {
  book: Book
  images: Readonly<Record<string, ImageRef>>
  title: string
  start: number
  onClose: (slide: number) => void
}) {
  const n = book.spreads.length
  const [slide, setSlide] = useState(start)
  // Photo `sizes` follow the painted width × zoom, only upwards while open:
  // zooming out never reloads a smaller derivative.
  const [sizesPx, setSizesPx] = useState(() =>
    Math.ceil(fittedSpreadWidth(book)),
  )

  useEffect(() => {
    const html = document.documentElement
    const overflow = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = overflow
    }
  }, [])

  const renderSpread = useCallback(
    (s: number) => (
      <div
        className="site-lb-slide"
        style={{ width: STAGE_MAX }}
        data-side={slideSide(book, s)}
      >
        <SlideContent
          book={book}
          images={images}
          slide={s}
          width={STAGE_MAX}
          sizesPx={sizesPx}
        />
      </div>
    ),
    [book, images, sizesPx],
  )

  return (
    <SpreadPager
      variant="lightbox"
      ariaLabel={`${title} — fullscreen`}
      testId="lightbox"
      count={n + 1}
      index={slide}
      onIndexChange={setSlide}
      onExit={() => {
        onClose(slide)
      }}
      renderSpread={renderSpread}
      position={(i) => slideLabel(i, n)}
      onZoomSettle={(z, width) => {
        setSizesPx((prev) => Math.max(prev, Math.ceil(width * z)))
      }}
    />
  )
}
