import { useSyncExternalStore, type ReactNode } from 'react'
import { frameDpi, lowDpi, sourceCropRect } from '../core'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Disclosure } from '../ui/Disclosure'
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
import './PhotoSection.css'

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
      <PhotoDisclosure>
        <div
          className="rounded-md px-3 py-3 text-center text-xs"
          style={{ color: SUB, background: 'var(--field)' }}
          data-testid="inspector-photo-empty"
        >
          Empty — drag a photo
        </div>
      </PhotoDisclosure>
    )
  }
  const size = getAssetPixelSizeSnapshot(assetId)
  return (
    <PhotoDisclosure>
      <section data-testid="inspector-photo" aria-label="Photo">
        <div className="flex gap-3">
          <div
            className="inspector-photo-thumb"
            data-testid="inspector-photo-thumb"
            style={{
              backgroundImage: url === undefined ? undefined : `url(${url})`,
            }}
          />
          <div className="inspector-photo-info min-w-0">
            <div className="truncate font-medium">
              {sessionMeta.get(assetId)?.name ??
                book.assets[assetId]?.relativePath ??
                assetId}
            </div>
            {size === undefined ? null : (
              <>
                <div
                  className="inspector-photo-px tabular-nums"
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
        <div className="mt-2">
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
        </div>
      </section>
    </PhotoDisclosure>
  )
}

/**
 * Kit `Section title="Photo"` (uikit/src/sandbox/inspector.tsx:109): open by
 * default and collapsible like Fit & crop (Owner Must M60, round 10).
 */
function PhotoDisclosure({ children }: { children: ReactNode }) {
  return (
    <Disclosure
      title="Photo"
      defaultExpanded
      data-testid="inspector-photo-disclosure"
    >
      <div className="px-4 pt-0.5 pb-3">{children}</div>
    </Disclosure>
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
