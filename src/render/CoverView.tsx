import type { DragEvent } from 'react'
import { bookSpineWidthMm, type Book } from '../core'
import { COVER_WRAP_MM, coverLayout } from './coverLayout'
import './CoverView.css'

/** Editor chrome: labels, test ids, wrap guide and the photo drop target. */
export interface CoverEdit {
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDrop: (event: DragEvent<HTMLElement>) => void
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

/**
 * Pure kit CoverSpread painter: back · spine · front, no store and no tiers.
 * Without `edit` it is the mini cover (spread-list row, Preview, site) at
 * `widthPx` or the parent width; `edit` adds the editor canvas chrome.
 */
export function CoverView({
  book,
  frontUrl,
  frontTier,
  widthPx,
  edit,
}: {
  book: Pick<Book, 'cover' | 'settings' | 'spreads'>
  frontUrl?: string | undefined
  /** Edge of the shown working preview (`data-tier`). */
  frontTier?: number | undefined
  widthPx?: number
  edit?: CoverEdit | undefined
}) {
  const { cover, settings } = book
  const { style: look } = cover
  const mini = edit === undefined
  const layout = coverLayout(
    settings.trim.widthMm,
    settings.trim.heightMm,
    bookSpineWidthMm(book),
  )
  const id = (name: string): string | undefined => (mini ? undefined : name)
  const spread = (
    <div
      className="cover-spread"
      data-testid={id('canvas-cover')}
      data-mini={mini ? 'true' : undefined}
      data-title-font={look.titleFont}
      data-material={look.material}
      data-finish={look.finish}
      style={{
        aspectRatio: layout.aspectRatio,
        width: mini ? (widthPx ?? '100%') : layout.fitWidth,
      }}
    >
      <div
        className="cover-back"
        data-testid={id('cover-back')}
        style={{
          width: `${String(layout.pagePct)}%`,
          background: look.backFill,
        }}
      >
        {mini ? null : <PanelLabel text="Back" />}
        <div className="cover-back-text" data-testid={id('cover-back-text')}>
          {cover.back.text}
        </div>
      </div>
      <div
        className="cover-spine"
        data-testid={id('cover-spine')}
        style={{ width: `${String(layout.spinePct)}%` }}
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
        style={{
          width: `${String(layout.pagePct)}%`,
          backgroundImage:
            frontUrl === undefined ? undefined : `url(${frontUrl})`,
        }}
        onDragOver={edit?.onDragOver}
        onDrop={edit?.onDrop}
      >
        {mini ? null : <PanelLabel text="Front" />}
        <div className="cover-front-text" data-testid={id('cover-front-text')}>
          <em>{cover.front.text}</em>
        </div>
      </div>
      {mini ? null : (
        <>
          <div
            aria-hidden="true"
            className="cover-wrap-guide"
            data-testid="cover-safe"
            style={{
              inset: `${String(layout.wrapInsetYPct)}% ${String(layout.wrapInsetXPct)}%`,
            }}
          />
          <span className="cover-wrap-chip" data-testid="cover-wrap-chip">
            Wrap {COVER_WRAP_MM} mm
          </span>
        </>
      )}
    </div>
  )
  return mini ? (
    spread
  ) : (
    <div className="cover-stage" data-testid="cover-stage">
      {spread}
    </div>
  )
}
