import {
  useLayoutEffect,
  useRef,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from 'react'
import type { ResolvedItem, ResolvedSpread } from '../core'

export interface FrameControl {
  label: string
  pressed?: boolean
  onActivate: () => void
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>) => void
  /** Crop mode: unclipped dim ghost, no drag; the editor owns the gestures. */
  cropActive?: boolean
  /** Crop zoom (1 = cover) shown in the "Crop · N%" tag. */
  cropZoom?: number
  onDoubleActivate?: () => void
}
import { dropChipLabel } from './dropChip'
import {
  frameBox,
  imageCropBox,
  pageCutLine,
  SPREAD_PX_PER_MM,
} from './frameBox'
import {
  frameShowsMissing,
  missingPlaceholderClass,
  missingPlaceholderTestId,
  previewUrlUnlessMissing,
  tierUnlessMissing,
} from './spreadMissing'
import { spreadFrameControlStyle } from './spreadChromeStyles'
import './SpreadView.css'

/** Keeps the crop-mode frame (and its ghost) above neighbouring frames. */
const CROP_Z_BOOST = 1000

const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 } as const

/** Kit selection handles: corners + edge midpoints, % of the frame. */
const HANDLE_POINTS = [
  ['nw', '0%', '0%'],
  ['n', '50%', '0%'],
  ['ne', '100%', '0%'],
  ['w', '0%', '50%'],
  ['e', '100%', '50%'],
  ['sw', '0%', '100%'],
  ['s', '50%', '100%'],
  ['se', '100%', '100%'],
] as const

function sizeLabel(item: ResolvedItem): string {
  const round = (mm: number) => String(Math.round(mm * 10) / 10)
  return `${round(item.rectMm.width)} × ${round(item.rectMm.height)} mm`
}

export function SpreadView({
  spreadId,
  resolved,
  previewUrlFor,
  tierFor,
  frameControlFor,
  isMissingAsset,
  pxPerMm = SPREAD_PX_PER_MM,
  thumb = false,
  overlay,
}: {
  spreadId: string
  resolved: ResolvedSpread
  previewUrlFor: (assetId: string) => string | undefined
  tierFor?: (assetId: string) => number | undefined
  frameControlFor?: (item: ResolvedItem) => FrameControl
  /** When true, show hatched missing placeholder instead of a stale preview. */
  isMissingAsset?: (assetId: string) => boolean
  pxPerMm?: number
  /**
   * Inert list thumbnail: no test ids / data ids (so pasteboard selectors and
   * counts never match it) and no pointer events.
   */
  thumb?: boolean
  /** Editor-layer chrome (e.g. the layout grid) painted above the frames. */
  overlay?: ReactNode
}) {
  return (
    <div
      className={thumb ? 'spread-view spread-view--thumb' : 'spread-view'}
      data-testid={thumb ? undefined : 'spread-view'}
      data-spread-id={thumb ? undefined : spreadId}
      aria-hidden={thumb ? true : undefined}
      style={{
        width: resolved.spreadWidthMm * pxPerMm,
        height: resolved.spreadHeightMm * pxPerMm,
      }}
    >
      {resolved.items.map((item) => {
        const missing = frameShowsMissing(item.assetId, isMissingAsset)
        return (
          <SpreadFrame
            key={item.frameId}
            item={item}
            pxPerMm={pxPerMm}
            thumb={thumb}
            missing={missing}
            previewUrl={previewUrlUnlessMissing(
              missing,
              item.assetId,
              previewUrlFor,
            )}
            tier={tierUnlessMissing(missing, item.assetId, tierFor)}
            control={frameControlFor?.(item)}
          />
        )
      })}
      {resolved.pageCuts.map((cut) => {
        const line = pageCutLine(cut, pxPerMm)
        const vertical = line.orientation === 'vertical'
        return (
          <div
            key={`${line.orientation}:${String(line.offsetPx)}`}
            className="spread-page-cut"
            data-testid={thumb ? undefined : 'spread-page-cut'}
            data-orientation={line.orientation}
            aria-hidden="true"
            style={
              vertical
                ? {
                    left: line.offsetPx,
                    top: 0,
                    width: 1,
                    height: '100%',
                  }
                : {
                    left: 0,
                    top: line.offsetPx,
                    width: '100%',
                    height: 1,
                  }
            }
          />
        )
      })}
      {thumb ? null : overlay}
    </div>
  )
}

function SpreadFrame({
  item,
  previewUrl,
  tier,
  pxPerMm,
  control,
  missing,
  thumb,
}: {
  thumb: boolean
  item: ResolvedItem
  previewUrl: string | undefined
  tier: number | undefined
  pxPerMm: number
  control: FrameControl | undefined
  missing: boolean
}) {
  const box = frameBox(item.rectMm, pxPerMm)
  const crop = imageCropBox(item.sourceCropRect ?? FULL_CROP)
  const cropActive = control?.cropActive === true
  const bodyRef = useRef<HTMLDivElement>(null)
  // The committed crop replaces the rAF preview transform.
  useLayoutEffect(() => {
    bodyRef.current?.querySelectorAll('img').forEach((img) => {
      img.style.transform = ''
    })
  }, [crop.left, crop.top, crop.width, crop.height])
  const style = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    zIndex: cropActive ? item.z + CROP_Z_BOOST : item.z,
    ...(item.rotation === 0
      ? {}
      : { transform: `rotate(${String(item.rotation)}deg)` }),
  }
  const selected = control?.pressed === true && !cropActive
  const imageStyle = {
    left: crop.left,
    top: crop.top,
    width: crop.width,
    height: crop.height,
  }
  const image =
    previewUrl === undefined ? (
      <div
        className={missingPlaceholderClass(missing)}
        data-testid={thumb ? undefined : missingPlaceholderTestId(missing)}
      />
    ) : (
      <img
        className="spread-frame-image"
        data-testid={thumb ? undefined : 'spread-frame-image'}
        alt=""
        decoding="async"
        src={previewUrl}
        data-tier={tier}
        style={imageStyle}
      />
    )
  // Stay mounted when a frame empties mid-drop so dragend still reaches document.
  // A draggable element inside a button is invalid HTML; Chromium still drags it.
  const body = (
    <div
      ref={bodyRef}
      className="spread-frame-body"
      draggable={!cropActive && !selected && control?.onDragStart !== undefined}
      onDragStart={control?.onDragStart}
    >
      {cropActive && previewUrl !== undefined ? (
        <>
          <img
            className="spread-frame-image spread-frame-ghost"
            data-testid="spread-frame-ghost"
            alt=""
            aria-hidden
            src={previewUrl}
            style={imageStyle}
          />
          <div className="spread-frame-clip">{image}</div>
        </>
      ) : (
        image
      )}
    </div>
  )
  if (control === undefined) {
    return (
      <div
        className="spread-frame"
        data-testid={thumb ? undefined : 'spread-frame'}
        data-frame-id={thumb ? undefined : item.frameId}
        data-filled={item.assetId === undefined ? 'false' : 'true'}
        data-drop-label={
          thumb ? undefined : dropChipLabel(item.assetId !== undefined)
        }
        data-asset-id={thumb ? undefined : item.assetId}
        style={style}
      >
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      className="spread-frame"
      data-testid="spread-frame"
      data-frame-id={item.frameId}
      data-filled={item.assetId === undefined ? 'false' : 'true'}
      data-drop-label={dropChipLabel(item.assetId !== undefined)}
      data-asset-id={item.assetId}
      data-crop-active={cropActive ? 'true' : undefined}
      data-locked={item.locked === true ? 'true' : undefined}
      aria-label={control.label}
      aria-pressed={control.pressed === true ? true : undefined}
      style={spreadFrameControlStyle(style, control.pressed === true)}
      onClick={control.onActivate}
      onDoubleClick={control.onDoubleActivate}
    >
      {body}
      {cropActive ? (
        <span className="spread-frame-crop-tag" data-testid="crop-overlay-tag">
          Crop · {Math.round((control.cropZoom ?? 1) * 100)}%
        </span>
      ) : null}
      {selected && item.locked !== true ? (
        <>
          <span
            className="spread-frame-handles"
            data-testid="spread-frame-handles"
            aria-hidden
          >
            {HANDLE_POINTS.map(([id, x, y]) => (
              <span
                key={id}
                className="spread-frame-handle"
                data-handle={id}
                data-testid="sel-handle"
                style={{ left: x, top: y }}
              />
            ))}
            <span
              className="spread-frame-handle spread-frame-rotate"
              data-handle="rotate"
              data-testid="rotate-handle"
            />
          </span>
          <span
            className="spread-frame-size-tag"
            data-testid="frame-size-tag"
            aria-hidden
          >
            {sizeLabel(item)}
          </span>
        </>
      ) : null}
    </button>
  )
}
