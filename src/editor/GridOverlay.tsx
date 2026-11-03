import { useCallback, useDeferredValue, useSyncExternalStore } from 'react'
import { editableSpread, resolveLayoutGrid, type PageGrid } from '../core'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { getGridVisible, subscribeGridVisible } from './gridView'
import { SnapLabel } from './SnapLabel'

/** `spread`: the toolbar Grid toggle; `master`: always on, kit master look. */
export type GridOverlayVariant = 'spread' | 'master'

// Grayscale tokens (`.e7` in EDITOR_CHROME_CSS): no accent, no black.
const LOOK = {
  spread: { line: 'var(--grid-line)', fill: 'var(--grid-fill)' },
  master: { line: 'var(--grid-master-line)', fill: 'var(--grid-master-fill)' },
} as const

/**
 * Grid pages of a spread or parent (Masters canvas). The resolver caches per
 * spread object and grid inputs, so an edit elsewhere (another master, another
 * spread) returns the same object and the overlay skips the render.
 */
function readGridPages(spreadId: string): readonly PageGrid[] | null {
  const book = getBookStoreSnapshot().book
  const target = editableSpread(book, spreadId)
  return target === undefined
    ? null
    : resolveLayoutGrid(book, target.index, target.spread).pages
}

/** Editor-layer layout grid over one spread; absent from thumbs and exports. */
export function GridOverlay({
  spreadId,
  pxPerMm,
  variant = 'spread',
}: {
  spreadId: string
  pxPerMm: number
  variant?: GridOverlayVariant
}) {
  const visible = useSyncExternalStore(
    subscribeGridVisible,
    getGridVisible,
    getGridVisible,
  )
  return (
    <>
      {visible || variant === 'master' ? (
        <GridOverlayLayer
          spreadId={spreadId}
          pxPerMm={pxPerMm}
          variant={variant}
        />
      ) : null}
      {visible ? <SnapLabel spreadId={spreadId} /> : null}
    </>
  )
}

function GridOverlayLayer({
  spreadId,
  pxPerMm,
  variant,
}: {
  spreadId: string
  pxPerMm: number
  variant: GridOverlayVariant
}) {
  const read = useCallback(() => readGridPages(spreadId), [spreadId])
  // Deferred like the spread paint: a master grid edit redraws every spread
  // using it in a yielding pass after the urgent update.
  const pages = useDeferredValue(
    useSyncExternalStore(subscribeBookStore, read, read),
  )
  if (pages === null) {
    return null
  }
  const px = (mm: number) => mm * pxPerMm
  const look = LOOK[variant]
  const master = variant === 'master'
  return (
    <svg
      className="grid-overlay"
      data-testid="grid-overlay"
      data-variant={variant}
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
            style={{ stroke: look.line }}
            {...(master
              ? { strokeDasharray: '3 3', strokeWidth: 1 }
              : { strokeDasharray: '6 4', strokeWidth: 1.5 })}
          />
          {master ? (
            // Kit MasterSpread (v7.tsx:113-114): a cell per column × row, gutters unfilled.
            page.columns.flatMap((c, i) =>
              page.rows.map((r, j) => (
                <rect
                  key={`m${String(i)}-${String(j)}`}
                  data-testid="grid-overlay-cell"
                  x={px(c.x)}
                  y={px(r.y)}
                  width={px(c.width)}
                  height={px(r.height)}
                  style={{ fill: look.fill }}
                />
              )),
            )
          ) : (
            <>
              {page.columns.map((c, i) => (
                <rect
                  key={`c${String(i)}`}
                  data-testid="grid-overlay-column"
                  x={px(c.x)}
                  y={px(c.y)}
                  width={px(c.width)}
                  height={px(c.height)}
                  style={{ fill: look.fill }}
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
                  style={{ stroke: look.line, strokeOpacity: 0.5 }}
                  strokeWidth={1}
                />
              ))}
            </>
          )}
        </g>
      ))}
    </svg>
  )
}
