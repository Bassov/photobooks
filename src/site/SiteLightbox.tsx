import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { getSpreadSizeMm } from '../core/geometry/spreadSize'
import { hoverPointer } from '../render/hoverPointer'
import { fitBox, fitInsets } from '../render/pagerZoom'
import { SpreadPager } from '../render/SpreadPager'
import { spreadRatio, spreadSide, viewLabel } from './siteModel'
import { SlideContent, type RoomBook } from './SiteSlide'

/** The width the pager lays a slide out at (it scales it to fit). */
const SLIDE_W = 760

/** The spread's fitted width before the pager has measured it. */
function fittedSpreadWidth(rb: RoomBook): number {
  const view = { w: window.innerWidth, h: window.innerHeight }
  const ratio = spreadRatio(rb.book.settings.trim)
  return fitBox({ w: ratio, h: 1 }, view, fitInsets(hoverPointer())).w
}

/**
 * Fullscreen (Designer personal-site Spec "Fullscreen"): the pager's
 * `lightbox` variant over the spreads only (slide i = spread i; a one-page
 * spread sits on its side of the endpaper). It keeps its own slide and hands
 * it back on close.
 */
export function SiteLightbox({
  rb,
  start,
  onClose,
}: {
  rb: RoomBook
  start: number
  onClose: (slide: number) => void
}) {
  const { book, images, entry, renderSlide } = rb
  const n = book.spreads.length
  const [slide, setSlide] = useState(start)
  // Photo `sizes` follow the painted width × zoom, only upwards while open:
  // zooming out never reloads a smaller derivative.
  const [sizesPx, setSizesPx] = useState(() => Math.ceil(fittedSpreadWidth(rb)))

  useEffect(() => {
    const html = document.documentElement
    const overflow = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = overflow
    }
  }, [])

  const renderSpread = useCallback(
    (s: number) => {
      const H = SLIDE_W / spreadRatio(book.settings.trim)
      const side = spreadSide(book, s)
      const pageW =
        side === undefined
          ? SLIDE_W
          : (SLIDE_W * getSpreadSizeMm(book, s).widthMm) /
            (2 * book.settings.trim.widthMm)
      const place: CSSProperties = {
        position: 'absolute',
        top: 0,
        width: pageW,
        height: H,
        overflow: 'hidden',
        ...(side === 'left' ? { left: 0 } : { right: 0 }),
      }
      return (
        <div
          style={{
            position: 'relative',
            width: SLIDE_W,
            height: H,
            background: entry.endpaper,
          }}
          data-testid="site-lb-slide"
          data-side={side}
        >
          <div style={place}>
            {renderSlide === undefined ? (
              <SlideContent
                book={book}
                images={images}
                slide={s + 1}
                width={SLIDE_W}
                sizesPx={sizesPx}
              />
            ) : (
              renderSlide(s + 1, SLIDE_W)
            )}
          </div>
        </div>
      )
    },
    [book, images, entry.endpaper, sizesPx, renderSlide],
  )

  return (
    <SpreadPager
      variant="lightbox"
      ariaLabel={`${entry.title} — fullscreen`}
      testId="lightbox"
      count={n}
      index={slide}
      onIndexChange={setSlide}
      onExit={() => {
        onClose(slide)
      }}
      renderSpread={renderSpread}
      position={(i) => viewLabel(i + 1, n)}
      onZoomSettle={(z, width) => {
        setSizesPx((prev) => Math.max(prev, Math.ceil(width * z)))
      }}
    />
  )
}
