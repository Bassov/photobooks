import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Label,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components'
import { COVER_CROP } from '../core'
import { measureHandlerSync } from '../perf/measureHandler'
import { clearPhotoPreview, paintPhotoPreview } from '../render/photoLayout'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import {
  getAssetAspectSnapshot,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import type { CropTarget } from './cropMode'
import {
  flipPhoto,
  STRAIGHTEN_LIMIT_DEG,
  straightenedCrop,
  straightenPhoto,
  straightenPreviewTransform,
  turnPhoto,
} from './photoRotate'
import './FitCropSection.css'

const STEP_DEG = 0.5

function readBook() {
  return getBookStoreSnapshot().book
}

function frameElements(frameId: string): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      `[data-testid="spread-frame"][data-frame-id="${CSS.escape(frameId)}"]`,
    ),
  )
}

/**
 * Kit PhotoRotateSection: 90° left / right and the straighten slider. The
 * slider previews as a `transform` painted in rAF and commits one crop op when
 * the gesture ends.
 */
export function PhotoRotateSection({ target }: { target: CropTarget }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const frame = book.spreads
    .find((spread) => spread.id === target.spreadId)
    ?.frames.find((item) => item.id === target.frameId)
  const [live, setLive] = useState<number | null>(null)
  const raf = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (raf.current !== null) {
        cancelAnimationFrame(raf.current)
      }
    },
    [],
  )
  if (frame?.assetId === undefined) {
    return null
  }
  const crop = frame.crop ?? COVER_CROP
  const aspect = getAssetAspectSnapshot(frame.assetId)
  const stored = crop.straightenDeg ?? 0
  const quarterTurns = crop.quarterTurns ?? 0

  const paint = (deg: number) => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current)
    }
    raf.current = requestAnimationFrame(() => {
      raf.current = null
      for (const element of frameElements(target.frameId)) {
        const next = straightenedCrop(frame.rect, crop, aspect, frame.fit, deg)
        paintPhotoPreview(
          element,
          straightenPreviewTransform(
            {
              rect: frame.rect,
              aspect,
              fit: frame.fit,
              framePx: {
                width: element.offsetWidth,
                height: element.offsetHeight,
              },
            },
            crop,
            next,
          ),
        )
      }
    })
  }
  const end = (deg: number) => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current)
      raf.current = null
    }
    setLive(null)
    straightenPhoto(target, deg)
    // A no-op commit leaves the layout alone; drop the preview ourselves.
    for (const element of frameElements(target.frameId)) {
      if (deg === stored) {
        clearPhotoPreview(element)
      }
    }
  }
  return (
    <section
      className="flex flex-col gap-3 px-4 py-4"
      data-testid="inspector-rotate"
      data-crop-keep=""
      aria-label="Rotate & flip"
    >
      <h4 className="inspector-eyebrow">Rotate &amp; flip</h4>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          data-testid="rot-left"
          aria-keyshortcuts=","
          onPress={() => {
            turnPhoto(target, -1)
          }}
        >
          <Icon name="rotateCcw" />
          90° left
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          data-testid="rot-right"
          aria-keyshortcuts="."
          onPress={() => {
            turnPhoto(target, 1)
          }}
        >
          <Icon name="rotateCw" />
          90° right
        </Button>
      </div>
      {/* Kit Flip H / Flip V: uikit/src/sandbox/inspector.tsx:156-158. */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          data-testid="flip-h"
          aria-pressed={crop.flipH === true}
          onPress={() => {
            flipPhoto(target, 'h')
          }}
        >
          <Icon name="flipHorizontal" />
          Flip H
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          data-testid="flip-v"
          aria-pressed={crop.flipV === true}
          onPress={() => {
            flipPhoto(target, 'v')
          }}
        >
          <Icon name="flipVertical" />
          Flip V
        </Button>
      </div>
      <Slider
        className="fit-crop-slider"
        data-testid="photo-straighten"
        minValue={-STRAIGHTEN_LIMIT_DEG}
        maxValue={STRAIGHTEN_LIMIT_DEG}
        step={STEP_DEG}
        value={live ?? stored}
        onChange={(next) => {
          measureHandlerSync('straighten', () => {
            setLive(next)
            paint(next)
          })
        }}
        onChangeEnd={end}
        formatOptions={{
          style: 'unit',
          unit: 'degree',
          unitDisplay: 'narrow',
        }}
      >
        <div className="flex items-center justify-between text-xs">
          <Label className="fit-crop-label">Straighten</Label>
          <SliderOutput className="font-medium tabular-nums" />
        </div>
        <SliderTrack
          className="fit-crop-track"
          onDoubleClick={() => {
            end(0)
          }}
        >
          {({ state }) => (
            <>
              <div
                className="fit-crop-fill"
                style={{ width: `${String(state.getThumbPercent(0) * 100)}%` }}
              />
              <SliderThumb className="fit-crop-thumb" />
            </>
          )}
        </SliderTrack>
      </Slider>
      <p className="text-xs" data-testid="rotate-summary">
        Quarter turn: {quarterTurns * 90}° · cover fit recomputed
      </p>
    </section>
  )
}
