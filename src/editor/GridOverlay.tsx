import { useSyncExternalStore } from 'react'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { getGridVisible, subscribeGridVisible } from './gridView'
import { pageGridRects } from './gridOverlayModel'
import { SnapLabel } from './SnapLabel'

// Grayscale tokens (`.e7` in EDITOR_CHROME_CSS): no accent, no black.
const LINE = 'var(--grid-line)'
const FILL = 'var(--grid-fill)'

function readBook() {
  return getBookStoreSnapshot().book
}

/** Editor-layer layout grid over one spread; absent from thumbs and exports. */
export function GridOverlay({
  spreadId,
  pxPerMm,
}: {
  spreadId: string
  pxPerMm: number
}) {
  const visible = useSyncExternalStore(
    subscribeGridVisible,
    getGridVisible,
    getGridVisible,
  )
  return visible ? (
    <>
      <GridOverlayLayer spreadId={spreadId} pxPerMm={pxPerMm} />
      <SnapLabel />
    </>
  ) : null
}

function GridOverlayLayer({
  spreadId,
  pxPerMm,
}: {
  spreadId: string
  pxPerMm: number
}) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const index = book.spreads.findIndex((spread) => spread.id === spreadId)
  if (index < 0) {
    return null
  }
  const pages = pageGridRects(book, index)
  const px = (mm: number) => mm * pxPerMm
  return (
    <svg
      className="grid-overlay"
      data-testid="grid-overlay"
      aria-hidden="true"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {pages.map((page, p) => (
        <g key={p} data-testid="grid-overlay-page">
          <rect
            data-testid="grid-overlay-content"
            x={px(page.content.x)}
            y={px(page.content.y)}
            width={px(page.content.width)}
            height={px(page.content.height)}
            fill="none"
            style={{ stroke: LINE }}
            strokeDasharray="6 4"
            strokeWidth={1.5}
          />
          {page.columns.map((c, i) => (
            <rect
              key={`c${String(i)}`}
              data-testid="grid-overlay-column"
              x={px(c.x)}
              y={px(c.y)}
              width={px(c.width)}
              height={px(c.height)}
              style={{ fill: FILL }}
            />
          ))}
          {page.rows.map((r, i) => (
            <rect
              key={`r${String(i)}`}
              data-testid="grid-overlay-row"
              x={px(r.x)}
              y={px(r.y)}
              width={px(r.width)}
              height={px(r.height)}
              fill="none"
              style={{ stroke: LINE, strokeOpacity: 0.5 }}
              strokeWidth={1}
            />
          ))}
        </g>
      ))}
    </svg>
  )
}
