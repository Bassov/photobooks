import type { DragEvent as ReactDragEvent } from 'react'
import type { ResolvedItem, ResolvedSpread } from '../core'

export interface FrameControl {
  label: string
  pressed?: boolean
  onActivate: () => void
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>) => void
}
import {
  frameBox,
  imageCropBox,
  pageCutLine,
  SPREAD_PX_PER_MM,
} from './frameBox'
import './SpreadView.css'

const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 } as const

export function SpreadView({
  spreadId,
  resolved,
  previewUrlFor,
  tierFor,
  frameControlFor,
  pxPerMm = SPREAD_PX_PER_MM,
}: {
  spreadId: string
  resolved: ResolvedSpread
  previewUrlFor: (assetId: string) => string | undefined
  tierFor?: (assetId: string) => number | undefined
  frameControlFor?: (item: ResolvedItem) => FrameControl
  pxPerMm?: number
}) {
  return (
    <div
      className="spread-view"
      data-testid="spread-view"
      data-spread-id={spreadId}
      style={{
        width: resolved.spreadWidthMm * pxPerMm,
        height: resolved.spreadHeightMm * pxPerMm,
      }}
    >
      {resolved.items.map((item) => (
        <SpreadFrame
          key={item.frameId}
          item={item}
          pxPerMm={pxPerMm}
          previewUrl={
            item.assetId === undefined ? undefined : previewUrlFor(item.assetId)
          }
          tier={
            item.assetId === undefined ? undefined : tierFor?.(item.assetId)
          }
          control={frameControlFor?.(item)}
        />
      ))}
      {resolved.pageCuts.map((cut) => {
        const line = pageCutLine(cut, pxPerMm)
        const vertical = line.orientation === 'vertical'
        return (
          <div
            key={`${line.orientation}:${String(line.offsetPx)}`}
            className="spread-page-cut"
            data-testid="spread-page-cut"
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
    </div>
  )
}

function SpreadFrame({
  item,
  previewUrl,
  tier,
  pxPerMm,
  control,
}: {
  item: ResolvedItem
  previewUrl: string | undefined
  tier: number | undefined
  pxPerMm: number
  control: FrameControl | undefined
}) {
  const box = frameBox(item.rectMm, pxPerMm)
  const crop = imageCropBox(item.sourceCropRect ?? FULL_CROP)
  const style = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    zIndex: item.z,
  }
  const image =
    previewUrl === undefined ? (
      <div
        className="spread-frame-placeholder"
        data-testid="spread-frame-placeholder"
      />
    ) : (
      <img
        className="spread-frame-image"
        data-testid="spread-frame-image"
        alt=""
        decoding="async"
        src={previewUrl}
        data-tier={tier}
        style={{
          left: crop.left,
          top: crop.top,
          width: crop.width,
          height: crop.height,
        }}
      />
    )
  // Stay mounted when a frame empties mid-drop so dragend still reaches document.
  // A draggable element inside a button is invalid HTML; Chromium still drags it.
  const body = (
    <div
      className="spread-frame-body"
      draggable={control?.onDragStart !== undefined}
      onDragStart={control?.onDragStart}
    >
      {image}
    </div>
  )
  if (control === undefined) {
    return (
      <div
        className="spread-frame"
        data-testid="spread-frame"
        data-frame-id={item.frameId}
        data-filled={item.assetId === undefined ? 'false' : 'true'}
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
      aria-label={control.label}
      aria-pressed={control.pressed === true ? true : undefined}
      style={style}
      onClick={control.onActivate}
    >
      {body}
    </button>
  )
}
