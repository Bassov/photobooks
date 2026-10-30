import { useSyncExternalStore } from 'react'
import {
  Input,
  Label,
  NumberField,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components'
import { MIN_FRAME_EDGE_MM, layerOf, type Frame, type ZMove } from '../core'
import { Button } from '../ui/Button'
import { Icon, type IconProps } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import type { CropTarget } from './cropMode'
import {
  getLiveGeometry,
  liveGeometryFor,
  subscribeLiveGeometry,
} from './liveGeometry'
import './FitCropSection.css'
import './FrameSections.css'

const ROT_MIN = -180
const ROT_MAX = 180

function readBook() {
  return getBookStoreSnapshot().book
}

function useTarget(target: CropTarget) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const spread = book.spreads.find((item) => item.id === target.spreadId)
  const frame = spread?.frames.find((item) => item.id === target.frameId)
  return spread === undefined || frame === undefined ? null : { spread, frame }
}

const round1 = (value: number) => Math.round(value * 10) / 10

/** Stored [0, 360) → the kit's signed (−180, 180] slider range. */
const signedDeg = (deg: number) => (deg > ROT_MAX ? deg - 360 : deg)

function MmField({
  label,
  prefix,
  unit = 'mm',
  value,
  min = -Infinity,
  max = Infinity,
  isDisabled,
  onChange,
}: {
  label: string
  prefix: string
  unit?: string
  value: number
  min?: number
  max?: number
  isDisabled: boolean
  onChange: (value: number) => void
}) {
  return (
    <NumberField
      aria-label={label}
      value={round1(value)}
      minValue={min}
      maxValue={max}
      isDisabled={isDisabled}
      formatOptions={{ maximumFractionDigits: 1 }}
      onChange={(next) => {
        if (!Number.isNaN(next)) {
          onChange(next)
        }
      }}
      className="fit-crop-field frame-field"
    >
      <span className="fit-crop-affix">{prefix}</span>
      <Input className="fit-crop-input" />
      <span className="fit-crop-affix">{unit}</span>
    </NumberField>
  )
}

/** Kit GeometrySection: X / Y / W / H in mm, rotation slider + degrees, lock. */
export function GeometrySection({ target }: { target: CropTarget }) {
  const found = useTarget(target)
  const liveAll = useSyncExternalStore(
    subscribeLiveGeometry,
    getLiveGeometry,
    getLiveGeometry,
  )
  if (found === null) {
    return null
  }
  const { frame } = found
  const { spreadId, frameId } = target
  const live = liveGeometryFor(liveAll, spreadId, frameId)
  const locked = frame.locked === true
  // During a drag the numbers follow the gesture's transient state.
  const { x, y, width, height } = live?.rect ?? frame.rect
  const rotation = signedDeg(live?.rotationDeg ?? frame.rotationDeg ?? 0)
  const resize = (patch: Partial<Frame['rect']>) => {
    dispatchBookOp({
      type: 'resizeFrame',
      spreadId,
      frameId,
      rect: { ...frame.rect, ...patch },
    })
  }
  const rotate = (rotationDeg: number, live: boolean) => {
    dispatchBookOp({
      type: 'rotateFrame',
      spreadId,
      frameId,
      rotationDeg,
      live,
    })
  }
  return (
    <section
      className="flex flex-col gap-3 px-4 py-4"
      data-testid="inspector-geometry"
      aria-label="Position and size"
    >
      <div className="flex items-center justify-between">
        <h4 className="inspector-eyebrow">Position &amp; size</h4>
        <IconButton
          label={locked ? 'Unlock frame' : 'Lock frame'}
          size="sm"
          placement="left"
          aria-pressed={locked}
          data-testid="frame-lock"
          onPress={() => {
            dispatchBookOp({
              type: 'setFrameLocked',
              spreadId,
              frameId,
              locked: !locked,
            })
          }}
        >
          <Icon name={locked ? 'lock' : 'unlock'} />
        </IconButton>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MmField
          label="X"
          prefix="X"
          value={x}
          isDisabled={locked}
          onChange={(next) => {
            dispatchBookOp({
              type: 'moveFrame',
              spreadId,
              frameId,
              dx: next - x,
              dy: 0,
            })
          }}
        />
        <MmField
          label="Y"
          prefix="Y"
          value={y}
          isDisabled={locked}
          onChange={(next) => {
            dispatchBookOp({
              type: 'moveFrame',
              spreadId,
              frameId,
              dx: 0,
              dy: next - y,
            })
          }}
        />
        <MmField
          label="Width"
          prefix="W"
          value={width}
          min={MIN_FRAME_EDGE_MM}
          isDisabled={locked}
          onChange={(next) => {
            resize({ width: next })
          }}
        />
        <MmField
          label="Height"
          prefix="H"
          value={height}
          min={MIN_FRAME_EDGE_MM}
          isDisabled={locked}
          onChange={(next) => {
            resize({ height: next })
          }}
        />
      </div>
      <div className="grid grid-cols-[1fr_96px] items-end gap-2">
        <Slider
          className="fit-crop-slider"
          data-testid="frame-rotation"
          aria-label="Frame rotation"
          minValue={ROT_MIN}
          maxValue={ROT_MAX}
          step={1}
          value={rotation}
          isDisabled={locked}
          onChange={(next) => {
            rotate(next, true)
          }}
          formatOptions={{
            style: 'unit',
            unit: 'degree',
            unitDisplay: 'narrow',
          }}
        >
          <div className="flex items-center justify-between text-xs">
            <Label className="fit-crop-label">Frame rotation</Label>
            <SliderOutput className="font-medium tabular-nums" />
          </div>
          <SliderTrack className="fit-crop-track">
            {({ state }) => (
              <>
                <div
                  className="fit-crop-fill"
                  style={{
                    width: `${String(state.getThumbPercent(0) * 100)}%`,
                  }}
                />
                <SliderThumb className="fit-crop-thumb" />
              </>
            )}
          </SliderTrack>
        </Slider>
        <MmField
          label="Rotation"
          prefix="∠"
          unit="°"
          value={rotation}
          min={ROT_MIN}
          max={ROT_MAX}
          isDisabled={locked}
          onChange={(next) => {
            rotate(next, false)
          }}
        />
      </div>
    </section>
  )
}

const Z_BUTTONS: readonly {
  move: ZMove
  label: string
  icon: IconProps['name']
}[] = [
  { move: 'back', label: 'Send to back', icon: 'sendToBack' },
  { move: 'backward', label: 'Send backward', icon: 'arrowDown' },
  { move: 'forward', label: 'Bring forward', icon: 'arrowUp' },
  { move: 'front', label: 'Bring to front', icon: 'bringToFront' },
]

/** Kit ArrangeSection: z-order buttons and the "layer N of M" label. */
export function ArrangeSection({ target }: { target: CropTarget }) {
  const found = useTarget(target)
  const layer = found === null ? null : layerOf(found.spread, target.frameId)
  if (layer === null) {
    return null
  }
  return (
    <section
      className="flex flex-col gap-3 px-4 py-4"
      data-testid="inspector-arrange"
      aria-label="Arrange"
    >
      <h4 className="inspector-eyebrow">Arrange</h4>
      <div
        role="group"
        aria-label="Arrange"
        className="flex items-center gap-1"
      >
        {Z_BUTTONS.map(({ move, label, icon }) => (
          <IconButton
            key={move}
            label={label}
            className="frame-z-button"
            data-testid={`z-${move}`}
            onPress={() => {
              dispatchBookOp({
                type: 'reorderFrame',
                spreadId: target.spreadId,
                frameId: target.frameId,
                move,
              })
            }}
          >
            <Icon name={icon} />
          </IconButton>
        ))}
        <span
          className="frame-layer ml-auto text-xs tabular-nums"
          data-testid="frame-layer"
        >
          layer {layer.layer} of {layer.count}
        </span>
      </div>
    </section>
  )
}

/** Kit DeleteFrameButton: removes the frame and leaves its template. */
export function DeleteFrameButton({ target }: { target: CropTarget }) {
  const found = useTarget(target)
  if (found === null) {
    return null
  }
  return (
    <div className="px-4 pb-4">
      <Button
        variant="ghost"
        size="sm"
        className="frame-delete w-full"
        data-testid="frame-delete"
        onPress={() => {
          dispatchBookOp({
            type: 'removeFrames',
            spreadId: target.spreadId,
            frameIds: [target.frameId],
          })
        }}
      >
        <Icon name="delete" />
        Delete frame
        <span className="ml-auto text-xs">Del</span>
      </Button>
    </div>
  )
}
