import { useSyncExternalStore } from 'react'
import {
  frameStylePresets,
  frameStyleName,
  isAdjusted,
  type FrameAdjust,
  type FrameStyle,
} from '../core'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { Button } from '../ui/Button'
import type { CropTarget } from './cropMode'
import { InspectorSlider } from './InspectorControls'
import './FrameSections.css'

function readBook() {
  return getBookStoreSnapshot().book
}

function useImageFrame(target: CropTarget) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const frame = book.spreads
    .find((spread) => spread.id === target.spreadId)
    ?.frames.find((item) => item.id === target.frameId)
  return frame === undefined || frame.kind === 'text' ? null : { book, frame }
}

const ADJUST_ROWS: readonly { key: keyof FrameAdjust; label: string }[] = [
  { key: 'brightness', label: 'Brightness' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'saturation', label: 'Saturation' },
]

/** Kit AdjustSection (uikit/src/sandbox/inspector.tsx:273-283). */
export function AdjustSection({ target }: { target: CropTarget }) {
  const found = useImageFrame(target)
  if (found?.frame.assetId === undefined) {
    return null
  }
  const adjust = found.frame.adjust
  return (
    <div className="flex flex-col gap-2 px-4 pt-0.5 pb-3" data-testid="adjust">
      {ADJUST_ROWS.map(({ key, label }) => (
        <InspectorSlider
          key={key}
          label={label}
          min={-100}
          max={100}
          value={adjust?.[key] ?? 0}
          testId={`adjust-${key}`}
          className="fit-crop-slider--row"
          onChange={(value) => {
            dispatchBookOp({
              type: 'setFrameAdjust',
              ...target,
              patch: { [key]: Math.round(value) },
            })
          }}
        />
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        isDisabled={!isAdjusted(adjust)}
        data-testid="adjust-reset"
        onPress={() => {
          dispatchBookOp({ type: 'setFrameAdjust', ...target, patch: null })
        }}
      >
        Reset adjustments
      </Button>
    </div>
  )
}

/** Kit CaptionSection (uikit/src/sandbox/inspector.tsx:285-296). */
export function CaptionSection({ target }: { target: CropTarget }) {
  const found = useImageFrame(target)
  if (found === null) {
    return null
  }
  return (
    // Kit Section panel padding (M76, round 12).
    <div className="px-4 pt-0.5 pb-3">
      <input
        type="text"
        aria-label="Caption"
        data-testid="caption-input"
        className="cover-text-input"
        placeholder="Add a caption under the photo"
        value={found.frame.caption ?? ''}
        onKeyDown={(event) => {
          event.stopPropagation()
        }}
        onChange={(event) => {
          dispatchBookOp({
            type: 'setFrameCaption',
            ...target,
            caption: event.currentTarget.value,
          })
        }}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        Printed 1.5 mm under the frame, Caption style
      </p>
    </div>
  )
}

function styleSwatchShadow(style: FrameStyle): string {
  const mat = style.matMm ?? 0
  const stroke = style.strokeMm ?? 0
  const parts: string[] = []
  if (mat > 0) {
    parts.push(`0 0 0 ${String(mat)}px ${style.matColor ?? '#ffffff'}`)
  }
  if (stroke > 0) {
    parts.push(
      `0 0 0 ${String(mat + Math.max(1, stroke * 2))}px ${style.strokeColor ?? '#1c1b1a'}`,
    )
  }
  parts.push('0 1px 3px rgb(0 0 0 / 0.2)')
  return parts.join(', ')
}

/** Kit FrameStyleSection (uikit/src/sandbox/sections.tsx:107-134). */
export function FrameStyleSection({ target }: { target: CropTarget }) {
  const found = useImageFrame(target)
  if (found === null) {
    return null
  }
  const { book, frame } = found
  const currentId = frame.frameStyleId
  const current =
    currentId === undefined ? undefined : book.frameStyles[currentId]
  const presetIds = new Set(frameStylePresets().map((item) => item.id))
  const options: { id: string | undefined; name: string; style: FrameStyle }[] =
    [
      { id: undefined, name: 'None', style: {} },
      ...frameStylePresets().map((item) => ({
        id: item.id,
        name: item.name,
        style: book.frameStyles[item.id] ?? item.style,
      })),
      ...Object.entries(book.frameStyles)
        .filter(([id]) => !presetIds.has(id))
        .map(([id, style]) => ({ id, name: frameStyleName(id), style })),
    ]
  const uses =
    currentId === undefined
      ? 0
      : book.spreads.reduce(
          (sum, spread) =>
            sum +
            spread.frames.filter((item) => item.frameStyleId === currentId)
              .length,
          0,
        )
  const edit = (patch: Partial<FrameStyle>) => {
    if (currentId !== undefined) {
      dispatchBookOp({ type: 'editFrameStyle', styleId: currentId, patch })
    }
  }
  return (
    <div className="flex flex-col px-4 pt-0.5 pb-3" data-testid="frame-style">
      <div className="grid grid-cols-4 gap-1.5" data-testid="style-list">
        {options.map((option) => (
          <button
            key={option.id ?? 'none'}
            type="button"
            aria-label={option.name}
            aria-pressed={option.id === currentId}
            data-testid={`style-${option.id ?? 'none'}`}
            className="frame-style-chip"
            onClick={() => {
              dispatchBookOp({
                type: 'applyFrameStyle',
                ...target,
                styleId: option.id,
              })
            }}
          >
            <span
              className="frame-style-chip-thumb"
              style={{
                borderRadius: `${String(option.style.cornerRadiusMm ?? 0)}px`,
                boxShadow: styleSwatchShadow(option.style),
              }}
            />
            <span className="w-full truncate text-center">{option.name}</span>
          </button>
        ))}
      </div>
      {currentId === undefined || current === undefined ? null : (
        <div className="mt-6 flex flex-col gap-2">
          <InspectorSlider
            label="Mat"
            min={0}
            max={10}
            step={0.5}
            unit="millimeter"
            value={current.matMm ?? 0}
            testId="style-mat"
            onChange={(matMm) => {
              edit({ matMm })
            }}
          />
          <InspectorSlider
            label="Stroke"
            min={0}
            max={2}
            step={0.1}
            unit="millimeter"
            value={current.strokeMm ?? 0}
            testId="style-stroke"
            onChange={(strokeMm) => {
              edit({ strokeMm: Math.round(strokeMm * 10) / 10 })
            }}
          />
          <InspectorSlider
            label="Corner radius"
            min={0}
            max={12}
            step={0.5}
            unit="millimeter"
            value={current.cornerRadiusMm ?? 0}
            testId="style-radius"
            onChange={(cornerRadiusMm) => {
              edit({ cornerRadiusMm })
            }}
          />
          <p className="text-xs text-muted-foreground" data-testid="style-uses">
            Editing “{frameStyleName(currentId)}” updates all{' '}
            <b>{String(uses)}</b> frames that use it.
          </p>
        </div>
      )}
      <button
        type="button"
        className="e7-ghost mt-2 h-8 w-full rounded-md text-sm"
        data-testid="style-new"
        onClick={() => {
          dispatchBookOp({ type: 'newFrameStyle', ...target })
        }}
      >
        New style from this frame
      </button>
    </div>
  )
}
