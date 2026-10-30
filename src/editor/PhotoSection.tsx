import { useSyncExternalStore } from 'react'
import { frameDpi, lowDpi, sourceCropRect } from '../core'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import {
  dispatchBookOp,
  getAssetAspectSnapshot,
  getAssetPixelSizeSnapshot,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import type { CropTarget } from './cropMode'
import { SUB } from './editorChromeTokens'
import { useCoverPhotoUrl } from './useCoverPhotoUrl'

/**
 * Kit PhotoSection: thumb, file name, pixel size, ppi chip and Remove from
 * frame. Renders nothing for an empty frame.
 */
export function PhotoSection({ target }: { target: CropTarget }) {
  const { book, sessionMeta } = useSyncExternalStore(
    subscribeBookStore,
    getBookStoreSnapshot,
    getBookStoreSnapshot,
  )
  const frame = book.spreads
    .find((spread) => spread.id === target.spreadId)
    ?.frames.find((item) => item.id === target.frameId)
  const assetId = frame?.assetId
  const url = useCoverPhotoUrl(assetId)
  if (frame === undefined) {
    return null
  }
  if (assetId === undefined) {
    return (
      <p
        className="mx-4 my-4 rounded-md px-3 py-3 text-center text-xs"
        style={{ color: SUB, background: 'var(--field)' }}
        data-testid="inspector-photo-empty"
      >
        Empty — drag a photo
      </p>
    )
  }
  const size = getAssetPixelSizeSnapshot(assetId)
  return (
    <section
      className="flex flex-col gap-3 px-4 py-4"
      data-testid="inspector-photo"
      aria-label="Photo"
    >
      <div className="flex gap-3">
        <div
          className="cover-thumb"
          data-testid="inspector-photo-thumb"
          style={{
            backgroundImage: url === undefined ? undefined : `url(${url})`,
          }}
        />
        <div className="min-w-0 text-sm">
          <div className="truncate font-medium">
            {sessionMeta.get(assetId)?.name ??
              book.assets[assetId]?.relativePath ??
              assetId}
          </div>
          {size === undefined ? null : (
            <>
              <div
                className="text-xs tabular-nums"
                style={{ color: SUB }}
                data-testid="inspector-photo-px"
              >
                {size.widthPx} × {size.heightPx} px
              </div>
              <PpiChip
                dpi={frameDpi(
                  frame.rect,
                  sourceCropRect(
                    frame.rect,
                    frame.crop,
                    getAssetAspectSnapshot(assetId),
                    frame.fit,
                  ),
                  frame.crop?.quarterTurns ?? 0,
                  size.widthPx,
                  size.heightPx,
                )}
              />
            </>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        data-testid="photo-remove"
        onPress={() => {
          dispatchBookOp({
            type: 'unplace',
            spreadId: target.spreadId,
            frameId: target.frameId,
          })
        }}
      >
        Remove from frame
      </Button>
    </section>
  )
}

/** Kit ppi chip: green at print quality, warning / error below the DPI gates. */
function PpiChip({ dpi }: { dpi: number }) {
  const low = lowDpi(dpi)
  return (
    <Badge
      color={
        low === undefined
          ? 'success'
          : low.level === 'min'
            ? 'error'
            : 'warning'
      }
      className="mt-1"
      dot
      data-testid="inspector-photo-dpi"
    >
      {Math.round(dpi)} ppi
    </Badge>
  )
}
