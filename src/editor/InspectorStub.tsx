import { useSyncExternalStore } from 'react'
import { COVER_CROP, MAX_CROP_ZOOM, clampCrop } from '../core'
import { Button } from '../ui/Button'
import {
  dispatchBookOp,
  getAssetAspectSnapshot,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import {
  getCropTarget,
  getCropTargetKey,
  subscribeCropMode,
  type CropTarget,
} from './cropMode'

const ZOOM_STEP = 0.01

/** Kit right inspector frame — crop section only while a frame is in crop mode. */
export function InspectorStub() {
  const cropKey = useSyncExternalStore(
    subscribeCropMode,
    getCropTargetKey,
    getCropTargetKey,
  )
  const target = cropKey === '' ? null : getCropTarget()
  return (
    <div
      className="editor-inspector-stub flex h-full min-h-0 flex-col px-4 py-4"
      data-testid="inspector-stub"
    >
      <h3 className="editor-inspector-stub__title mb-3 text-2xs font-semibold tracking-[0.12em] uppercase">
        Inspector
      </h3>
      {target === null ? (
        <p className="editor-inspector-stub__body text-sm">
          Double-click a photo to crop it. Full inspector tools arrive later.
        </p>
      ) : (
        <FitAndCrop target={target} />
      )}
    </div>
  )
}

function useFrameCrop(target: CropTarget) {
  const book = useSyncExternalStore(
    subscribeBookStore,
    () => getBookStoreSnapshot().book,
    () => getBookStoreSnapshot().book,
  )
  const frame = book.spreads
    .find((spread) => spread.id === target.spreadId)
    ?.frames.find((item) => item.id === target.frameId)
  return frame
}

function FitAndCrop({ target }: { target: CropTarget }) {
  const frame = useFrameCrop(target)
  if (frame?.assetId === undefined) {
    return null
  }
  const crop = frame.crop ?? COVER_CROP
  const atCover =
    crop.zoom === COVER_CROP.zoom &&
    crop.center.x === COVER_CROP.center.x &&
    crop.center.y === COVER_CROP.center.y
  const aspect = getAssetAspectSnapshot(frame.assetId)
  return (
    <section
      className="flex flex-col gap-3"
      data-testid="inspector-fit-crop"
      data-crop-keep=""
      aria-label="Fit and crop"
    >
      <h4 className="text-2xs font-semibold tracking-[0.12em] uppercase">
        Fit &amp; crop
      </h4>
      <label className="flex flex-col gap-1 text-sm">
        <span>Zoom</span>
        <input
          type="range"
          data-testid="crop-zoom"
          min={1}
          max={MAX_CROP_ZOOM}
          step={ZOOM_STEP}
          value={crop.zoom}
          onChange={(event) => {
            dispatchBookOp({
              type: 'setCrop',
              spreadId: target.spreadId,
              frameId: target.frameId,
              crop: clampCrop(
                frame.rect,
                {
                  zoom: Number(event.currentTarget.value),
                  center: crop.center,
                },
                aspect,
              ),
            })
          }}
        />
      </label>
      <Button
        variant="secondary"
        size="sm"
        data-testid="crop-reset"
        isDisabled={atCover}
        onPress={() => {
          dispatchBookOp({
            type: 'resetCrop',
            spreadId: target.spreadId,
            frameId: target.frameId,
          })
        }}
      >
        Reset to cover
      </Button>
    </section>
  )
}
