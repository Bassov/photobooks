import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Input,
  Label,
  NumberField,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components'
import { COVER_CROP, clampCrop, type Frame } from '../core'
import { Button } from '../ui/Button'
import { Disclosure } from '../ui/Disclosure'
import { SegmentedControl } from '../ui/SegmentedControl'
import {
  dispatchBookOp,
  getAssetAspectSnapshot,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { enterCropMode, exitCropMode, type CropTarget } from './cropMode'
import './FitCropSection.css'

/** Zoom slider range (percent display); wheel zoom may exceed it. */
const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.01

type Crop = NonNullable<Frame['crop']>

function readBook() {
  return getBookStoreSnapshot().book
}

function useFrame(target: CropTarget) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  return book.spreads
    .find((spread) => spread.id === target.spreadId)
    ?.frames.find((item) => item.id === target.frameId)
}

/** Pan percent (±100) → normalized crop center; 0 is the image center. */
const panToCenter = (percent: number) => 0.5 + percent / 200
const centerToPan = (center: number) => Math.round((center - 0.5) * 200)

/**
 * Kit CropSection: Fill|Fit, zoom, pan, Crop/Done and Reset to cover. The crop
 * overlay itself is canvas chrome that only exists while `cropping`.
 */
export function FitCropSection({
  target,
  cropping,
}: {
  target: CropTarget
  cropping: boolean
}) {
  const frame = useFrame(target)
  if (frame?.assetId === undefined) {
    return null
  }
  const crop: Crop = frame.crop ?? COVER_CROP
  const fit = frame.fit ?? 'fill'
  const aspect = getAssetAspectSnapshot(frame.assetId)
  const atCover =
    crop.zoom === COVER_CROP.zoom &&
    crop.center.x === COVER_CROP.center.x &&
    crop.center.y === COVER_CROP.center.y
  const commit = (next: Crop) => {
    dispatchBookOp({
      type: 'setCrop',
      spreadId: target.spreadId,
      frameId: target.frameId,
      crop: clampCrop(frame.rect, next, aspect, frame.fit),
    })
  }
  // Kit `Section title="Fit & crop"` (uikit/src/sandbox/inspector.tsx:131):
  // open by default, collapsible (Owner Must M60, round 10).
  return (
    <Disclosure
      title="Fit & crop"
      defaultExpanded
      data-testid="inspector-fit-crop-disclosure"
      data-crop-keep=""
    >
      <section
        className="fit-crop flex flex-col gap-3 px-4 pt-0.5 pb-3"
        data-testid="inspector-fit-crop"
        data-crop-keep=""
        aria-label="Fit and crop"
      >
        <SegmentedControl
          label="Photo fit"
          size="sm"
          value={fit}
          onChange={(next) => {
            dispatchBookOp({
              type: 'setFit',
              spreadId: target.spreadId,
              frameId: target.frameId,
              fit: next === 'fit' ? 'fit' : 'fill',
            })
          }}
          items={[
            { id: 'fill', label: 'Fill' },
            { id: 'fit', label: 'Fit' },
          ]}
        />
        <ZoomSlider
          value={crop.zoom}
          onChange={(zoom) => {
            commit({ ...crop, zoom })
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <PanField
            label="Pan X"
            prefix="↔"
            value={centerToPan(crop.center.x)}
            onChange={(percent) => {
              commit({
                ...crop,
                center: { x: panToCenter(percent), y: crop.center.y },
              })
            }}
          />
          <PanField
            label="Pan Y"
            prefix="↕"
            value={centerToPan(crop.center.y)}
            onChange={(percent) => {
              commit({
                ...crop,
                center: { x: crop.center.x, y: panToCenter(percent) },
              })
            }}
          />
        </div>
        <div className="flex gap-2">
          <Button
            // Kit inspector.tsx:139: outline + shadow-xs = app `secondary`.
            variant={cropping ? 'default' : 'secondary'}
            size="sm"
            className="flex-1"
            data-testid="crop-toggle"
            onPress={() => {
              if (cropping) {
                exitCropMode()
              } else {
                enterCropMode(target.spreadId, target.frameId)
              }
            }}
          >
            {cropping ? 'Done' : 'Crop'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
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
        </div>
      </section>
    </Disclosure>
  )
}

function PanField({
  label,
  prefix,
  value,
  onChange,
}: {
  label: string
  prefix: string
  value: number
  onChange: (percent: number) => void
}) {
  return (
    <NumberField
      aria-label={label}
      value={value}
      minValue={-100}
      maxValue={100}
      step={5}
      onChange={(next) => {
        if (!Number.isNaN(next)) {
          onChange(next)
        }
      }}
      className="fit-crop-field"
    >
      <span className="fit-crop-affix">{prefix}</span>
      <Input className="fit-crop-input" />
      <span className="fit-crop-affix">%</span>
    </NumberField>
  )
}

/**
 * Kit slider B. Double-click resets to 100%; while hovered, ArrowUp/Down
 * (Shift ×10) step the value instead of scrolling.
 */
function ZoomSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (zoom: number) => void
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const hovered = useRef(false)
  const live = useRef({ value, onChange })
  useEffect(() => {
    live.current = { value, onChange }
  })
  useEffect(() => {
    if (element === null) {
      return undefined
    }
    const onKey = (event: KeyboardEvent) => {
      const up = event.key === 'ArrowUp'
      if (
        !hovered.current ||
        (!up && event.key !== 'ArrowDown') ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        element.contains(document.activeElement)
      ) {
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      const step = ZOOM_STEP * (event.shiftKey ? 10 : 1) * (up ? 1 : -1)
      const next = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, Math.round((live.current.value + step) * 100) / 100),
      )
      live.current.onChange(next)
    }
    const onDouble = () => {
      live.current.onChange(ZOOM_MIN)
    }
    const enter = () => {
      hovered.current = true
    }
    const leave = () => {
      hovered.current = false
    }
    element.addEventListener('dblclick', onDouble)
    element.addEventListener('pointerenter', enter)
    element.addEventListener('pointerleave', leave)
    window.addEventListener('keydown', onKey, true)
    return () => {
      element.removeEventListener('dblclick', onDouble)
      element.removeEventListener('pointerenter', enter)
      element.removeEventListener('pointerleave', leave)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [element])
  const shown = Math.min(ZOOM_MAX, value)
  return (
    <Slider
      ref={setElement}
      className="fit-crop-slider fit-crop-slider--row"
      data-testid="crop-zoom"
      minValue={ZOOM_MIN}
      maxValue={ZOOM_MAX}
      step={ZOOM_STEP}
      value={shown}
      onChange={(next) => {
        onChange(next)
      }}
      formatOptions={{ style: 'percent' }}
    >
      <div className="flex items-center justify-between text-xs">
        <Label className="fit-crop-label">Zoom</Label>
        <SliderOutput className="font-medium tabular-nums" />
      </div>
      <SliderTrack className="fit-crop-track">
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
  )
}
