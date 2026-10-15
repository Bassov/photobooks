import type { ResolvedItem, ResolvedSpread } from '../core'
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
  pxPerMm = SPREAD_PX_PER_MM,
}: {
  spreadId: string
  resolved: ResolvedSpread
  previewUrlFor: (assetId: string) => string | undefined
  tierFor?: (assetId: string) => number | undefined
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
}: {
  item: ResolvedItem
  previewUrl: string | undefined
  tier: number | undefined
  pxPerMm: number
}) {
  const box = frameBox(item.rectMm, pxPerMm)
  const crop = imageCropBox(item.sourceCropRect ?? FULL_CROP)
  return (
    <div
      className="spread-frame"
      data-testid="spread-frame"
      data-frame-id={item.frameId}
      data-filled={previewUrl === undefined ? 'false' : 'true'}
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        zIndex: item.z,
      }}
    >
      {previewUrl === undefined ? (
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
      )}
    </div>
  )
}
