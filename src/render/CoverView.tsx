import {
  memo,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from 'react'
import type { Cover } from '../core'
// Not the barrel: the site entry must not pull the zod schemas in.
import {
  bookCoverGeometry,
  type CoverGeometry,
  type CoverGeometryBook,
} from '../core/print/coverGeometry'
import { coverLayout, type CoverLayout, type PctBox } from './coverLayout'
import './CoverView.css'

/** Editor chrome: labels, test ids, sheet overlays and the photo drop target. */
export interface CoverEdit {
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDrop: (event: DragEvent<HTMLElement>) => void
}

/** Designer D6: the wrap chip shows only while the band is this tall. */
const CHIP_MIN_BAND_PX = 18
/** Chip line height (px): it is centred in the band. */
const CHIP_LINE_PX = 14

function pct(value: number): string {
  return `${String(value)}%`
}

function boxStyle(box: PctBox): CSSProperties {
  return {
    left: pct(box.left),
    top: pct(box.top),
    width: pct(box.width),
    height: pct(box.height),
  }
}

function PanelLabel({ text }: { text: string }) {
  return (
    <span
      className="cover-panel-label"
      data-testid={`cover-label-${text.toLowerCase()}`}
    >
      {text}
    </span>
  )
}

/** Front photo drops count only over the front board and its wrap band. */
function overFront(event: DragEvent<HTMLElement>, from: number): boolean {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientX >= rect.left + rect.width * from
}

/**
 * Edit canvas: the printed sheet (Designer cover-editor "Layers") fitted to
 * the stage, with the closed cover, hinge strips, safe frames, the veiled
 * wrap band and its chip on top.
 */
function CoverSheet({
  layout,
  wrapMm,
  sheetH,
  backFill,
  edit,
  children,
}: {
  layout: CoverLayout
  wrapMm: number
  sheetH: number
  backFill: string
  edit: CoverEdit
  children: ReactNode
}) {
  // Callback ref in state: the commit that attaches the sheet re-runs the
  // layout effect before paint, so the first frame already has the chip.
  const [el, ref] = useState<HTMLDivElement | null>(null)
  const [bandPx, setBandPx] = useState(0)
  const [dropTarget, setDropTarget] = useState(false)
  useLayoutEffect(() => {
    if (el === null) {
      return undefined
    }
    const measure = () => {
      setBandPx((el.getBoundingClientRect().height * wrapMm) / sheetH)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [el, wrapMm, sheetH])
  const strip = (style: CSSProperties) => (
    <div className="cover-wrap-strip" style={style} />
  )
  const bandY = pct(layout.bandYPct)
  const sideY = { top: bandY, height: pct(100 - 2 * layout.bandYPct) }
  return (
    <div
      ref={ref}
      className="cover-sheet"
      data-testid="cover-sheet"
      data-drop-target={dropTarget ? 'true' : undefined}
      style={{
        aspectRatio: layout.sheetAspectRatio,
        width: layout.sheetFitWidth,
        background: `linear-gradient(90deg, ${backFill} ${pct(layout.spineFromPct)}, var(--cover-spine) ${pct(layout.spineFromPct)} ${pct(layout.spineToPct)}, var(--cover-front-empty) ${pct(layout.spineToPct)})`,
      }}
      onDragOver={(event) => {
        const over = overFront(event, layout.frontDropFrom)
        if (over) {
          edit.onDragOver(event)
        }
        setDropTarget(over && event.defaultPrevented)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropTarget(false)
        }
      }}
      onDrop={(event) => {
        setDropTarget(false)
        if (overFront(event, layout.frontDropFrom)) {
          edit.onDrop(event)
        }
      }}
    >
      {children}
      <div
        className="cover-hinge"
        data-testid="cover-hinge-back"
        style={boxStyle(layout.hingeBack)}
      />
      <div
        className="cover-hinge"
        data-testid="cover-hinge-front"
        style={boxStyle(layout.hingeFront)}
      />
      <div
        className="cover-safe"
        data-testid="cover-safe-back"
        style={boxStyle(layout.safeBack)}
      />
      <div
        className="cover-safe"
        data-testid="cover-safe-front"
        style={boxStyle(layout.safeFront)}
      />
      <div className="cover-wrap" aria-hidden="true" data-testid="cover-wrap">
        {strip({ left: 0, top: 0, width: '100%', height: bandY })}
        {strip({ left: 0, bottom: 0, width: '100%', height: bandY })}
        {strip({ left: 0, ...sideY, width: pct(layout.bandXPct) })}
        {strip({ right: 0, ...sideY, width: pct(layout.bandXPct) })}
      </div>
      {bandPx >= CHIP_MIN_BAND_PX ? (
        <span
          className="cover-wrap-chip"
          data-testid="cover-wrap-chip"
          style={{ top: (bandPx - CHIP_LINE_PX) / 2 }}
        >
          Wrap {wrapMm} mm
        </span>
      ) : null}
    </div>
  )
}

/**
 * Pure kit CoverSpread painter: back · spine · front, no store and no tiers.
 * Without `edit` it is the mini cover (spread-list row, Preview) at `widthPx`
 * or the parent width; `edit` draws the printed sheet with the editor chrome.
 * Memoised on its props: a Pages change re-renders only the cover views.
 */
export const CoverPainter = memo(function CoverPainter({
  cover,
  geometry,
  frontUrl,
  frontTier,
  widthPx,
  edit,
}: {
  cover: Cover
  geometry: CoverGeometry
  frontUrl?: string | undefined
  /** Edge of the shown working preview (`data-tier`). */
  frontTier?: number | undefined
  widthPx?: number
  edit?: CoverEdit | undefined
}) {
  const { style: look } = cover
  const mini = edit === undefined
  const layout = coverLayout(geometry)
  const id = (name: string): string | undefined => (mini ? undefined : name)
  const vars: Record<string, number> = {
    '--spine-frac': layout.spineFrac,
    '--spine-len-frac': layout.spineLenFrac,
    '--band-of-trim': layout.bandOfTrim,
  }
  const box: CSSProperties = mini
    ? { aspectRatio: layout.aspectRatio, width: widthPx ?? '100%' }
    : { position: 'absolute', ...boxStyle(layout.cover) }
  const spread = (
    <div
      className="cover-spread"
      data-testid={id('canvas-cover')}
      data-mini={mini ? 'true' : undefined}
      data-title-font={look.titleFont}
      data-material={look.material}
      data-finish={look.finish}
      style={{ ...vars, ...box }}
    >
      <div
        className="cover-back"
        data-testid={id('cover-back')}
        style={{ width: pct(layout.pagePct), background: look.backFill }}
      >
        {mini ? null : <PanelLabel text="Back" />}
        <div className="cover-back-text" data-testid={id('cover-back-text')}>
          {cover.back.text}
        </div>
      </div>
      <div
        className="cover-spine"
        data-testid={id('cover-spine')}
        style={{ width: pct(layout.spinePct) }}
      >
        {mini ? null : <PanelLabel text="Spine" />}
        <span
          className="cover-spine-text"
          data-testid={id('cover-spine-text')}
          data-direction={look.spineDirection}
        >
          <em>{cover.spine.text}</em>
        </span>
      </div>
      <div
        className="cover-front"
        data-testid={id('cover-front')}
        data-photo-id={cover.front.assetId}
        data-tier={frontTier}
        style={{ width: pct(layout.pagePct) }}
      >
        {frontUrl === undefined ? null : (
          <div
            className="cover-front-photo"
            data-testid={id('cover-front-photo')}
            style={{
              top: pct(-layout.photoOverflowYPct),
              bottom: pct(-layout.photoOverflowYPct),
              right: pct(-layout.photoOverflowXPct),
              backgroundImage: `url(${frontUrl})`,
            }}
          />
        )}
        {mini ? null : <PanelLabel text="Front" />}
        <div className="cover-front-text" data-testid={id('cover-front-text')}>
          <em>{cover.front.text}</em>
        </div>
      </div>
    </div>
  )
  return mini ? (
    spread
  ) : (
    <div className="cover-stage" data-testid="cover-stage">
      <CoverSheet
        layout={layout}
        wrapMm={geometry.wrap}
        sheetH={geometry.sheetH}
        backFill={look.backFill}
        edit={edit}
      >
        {spread}
      </CoverSheet>
    </div>
  )
})

/** `CoverPainter` over a whole book (site, library): the geometry from its profile. */
export function CoverView({
  book,
  ...rest
}: {
  book: CoverGeometryBook
  frontUrl?: string | undefined
  frontTier?: number | undefined
  widthPx?: number
  edit?: CoverEdit | undefined
}) {
  return (
    <CoverPainter
      cover={book.cover}
      geometry={bookCoverGeometry(book)}
      {...rest}
    />
  )
}
