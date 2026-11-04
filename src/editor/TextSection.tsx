import { useRef, useSyncExternalStore, type ReactNode } from 'react'
import { editableSpread, layerOf, type Frame, type TextStyleId } from '../core'
import { fitTextHeightMm } from '../render/textStyles'
import { Disclosure } from '../ui/Disclosure'
import { SegmentedControl } from '../ui/SegmentedControl'
import { ICON_GLYPHS } from '../ui/icons/glyphs'
import { FrameGlyph } from '../render/SpreadView'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import type { CropTarget } from './cropMode'
import {
  ArrangeSection,
  DeleteFrameButton,
  FrameLockButton,
  GeometrySection,
} from './FrameSections'
import {
  isTextOverflowing,
  nextEditKey,
  subscribeTextOverflow,
} from './textEditStore'
import './TextSection.css'

type TextAlign = NonNullable<Frame['align']>

/** `scrollHeight` is whole px: a box this close to its content fits. */
const ROUNDING_PX = 1

const STYLE_ITEMS: { id: TextStyleId; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'caption', label: 'Caption' },
  { id: 'body', label: 'Body' },
]

const ALIGN_ITEMS: {
  id: TextAlign
  label: ReactNode
  ariaLabel: string
}[] = [
  {
    id: 'left',
    label: (
      <FrameGlyph nodes={ICON_GLYPHS.alignLeft} size={16} name="align-left" />
    ),
    ariaLabel: 'Left',
  },
  {
    id: 'center',
    label: (
      <FrameGlyph
        nodes={ICON_GLYPHS.alignCenter}
        size={16}
        name="align-center"
      />
    ),
    ariaLabel: 'Center',
  },
  {
    id: 'right',
    label: (
      <FrameGlyph nodes={ICON_GLYPHS.alignRight} size={16} name="align-right" />
    ),
    ariaLabel: 'Right',
  },
]

function readTextFrame(target: CropTarget): Frame | undefined {
  const frame = editableSpread(
    getBookStoreSnapshot().book,
    target.spreadId,
  )?.spread.frames.find((item) => item.id === target.frameId)
  return frame?.kind === 'text' ? frame : undefined
}

function useTextFrame(target: CropTarget): Frame | undefined {
  const read = () => readTextFrame(target)
  return useSyncExternalStore(subscribeBookStore, read, read)
}

function staticText(frame: Frame): string {
  return frame.content?.type === 'static' ? frame.content.text : ''
}

/**
 * Inspector typing grows the box like canvas typing: the painted text node
 * tells the whole lines it needs (same history key, so the same step).
 */
function growToText(target: CropTarget, key: string): void {
  const frame = readTextFrame(target)
  const button = document.querySelector<HTMLElement>(
    `[data-spread-id="${CSS.escape(target.spreadId)}"] button[data-frame-id="${CSS.escape(target.frameId)}"]`,
  )
  const node = button?.querySelector<HTMLElement>('.spread-frame-text')
  if (frame === undefined || button == null || node == null) {
    return
  }
  const pxPerMm = button.offsetWidth / frame.rect.width
  if (!(pxPerMm > 0)) {
    return
  }
  const contentMm = Math.max(node.scrollHeight - ROUNDING_PX, 0) / pxPerMm
  dispatchBookOp(
    {
      type: 'editText',
      ...target,
      text: staticText(frame),
      fitHeightMm: fitTextHeightMm(contentMm, frame.styleId ?? 'caption'),
    },
    key,
  )
}

/** Kit TextSection without the Live block (live-captions is kit-only). */
function TextSection({ target }: { target: CropTarget }) {
  const frame = useTextFrame(target)
  const key = useRef('')
  if (frame === undefined) {
    return null
  }
  return (
    <Disclosure
      title="Text"
      defaultExpanded
      data-testid="inspector-text-disclosure"
    >
      <div className="text-section" data-testid="inspector-text">
        <SegmentedControl
          label="Style"
          size="sm"
          className="text-section-style"
          value={frame.styleId ?? 'caption'}
          onChange={(styleId) => {
            dispatchBookOp({ type: 'setTextStyle', ...target, styleId })
          }}
          items={STYLE_ITEMS}
        />
        <div className="text-section-row">
          <SegmentedControl
            label="Align"
            size="sm"
            className="text-section-align"
            value={frame.align ?? 'left'}
            onChange={(align) => {
              dispatchBookOp({ type: 'setTextAlign', ...target, align })
            }}
            items={ALIGN_ITEMS}
          />
          <span className="text-section-hint">dbl-click to edit on canvas</span>
        </div>
        <textarea
          aria-label="Text"
          data-testid="text-input"
          className="text-section-input"
          value={staticText(frame)}
          onFocus={() => {
            key.current = nextEditKey('txt', target.frameId)
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
          }}
          onChange={(event) => {
            const session = key.current
            dispatchBookOp(
              { type: 'editText', ...target, text: event.currentTarget.value },
              session,
            )
            requestAnimationFrame(() => {
              growToText(target, session)
            })
          }}
        />
      </div>
    </Disclosure>
  )
}

/** Inspector meta while the selected text runs past its box. */
export function TextOverflowMeta({ target }: { target: CropTarget }) {
  const read = () => isTextOverflowing(target.spreadId, target.frameId)
  const overflowing = useSyncExternalStore(subscribeTextOverflow, read, read)
  return overflowing ? (
    <p className="text-overflow-meta" data-testid="inspector-meta">
      Text overflows the frame
    </p>
  ) : null
}

function useArrangeSummary(target: CropTarget): string | undefined {
  const read = () => {
    const spread = editableSpread(
      getBookStoreSnapshot().book,
      target.spreadId,
    )?.spread
    const layer = spread === undefined ? null : layerOf(spread, target.frameId)
    return layer === null
      ? undefined
      : `layer ${String(layer.layer)} of ${String(layer.count)}`
  }
  return useSyncExternalStore(subscribeBookStore, read, read)
}

/** Text inspector body: Text, then Position & size and Arrange collapsed, Delete. */
export function TextFrameSections({ target }: { target: CropTarget }) {
  const arrange = useArrangeSummary(target)
  return (
    <>
      <TextSection target={target} />
      <Disclosure
        title="Position & size"
        right={<FrameLockButton target={target} />}
        data-testid="inspector-geometry-disclosure"
      >
        <GeometrySection target={target} />
      </Disclosure>
      <Disclosure
        title="Arrange"
        summary={arrange}
        data-testid="inspector-arrange-disclosure"
      >
        <ArrangeSection target={target} />
      </Disclosure>
      <DeleteFrameButton target={target} />
    </>
  )
}
