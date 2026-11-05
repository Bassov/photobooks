import {
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  editableSpread,
  layerOf,
  type Book,
  type Frame,
  type Spread,
  type TextStyleId,
} from '../core'
import { fitTextHeightMm } from '../render/textStyles'
import { Disclosure } from '../ui/Disclosure'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Select } from '../ui/Select'
import { ICON_GLYPHS } from '../ui/icons/glyphs'
import { FrameGlyph } from '../render/SpreadView'
import {
  dispatchBookOp,
  getAssetDisplayName,
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
import { ToggleSwitch } from './InspectorControls'
import {
  anchorOptions,
  chipAnchor,
  chipState,
  editableText,
  imageFrames,
  insertToken,
  isLive,
  LIVE_TOKENS,
  type Caret,
  type LiveToken,
} from './liveCaption'
import {
  isTextOverflowing,
  nextEditKey,
  subscribeTextOverflow,
} from './textEditStore'
import './TextSection.css'

type TextAlign = NonNullable<Frame['align']>

/** `scrollHeight` is whole px: a box this close to its content fits. */
const ROUNDING_PX = 1

const LIVE_LABEL = 'Live from photo metadata'
const INSERT_LABEL = 'Insert token'

const readBook = (): Book => getBookStoreSnapshot().book

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

/** The target's spread (a stable object until one of its frames changes). */
function useTargetSpread(target: CropTarget): Spread | undefined {
  const read = () =>
    editableSpread(getBookStoreSnapshot().book, target.spreadId)?.spread
  return useSyncExternalStore(subscribeBookStore, read, read)
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
      text: editableText(frame),
      fitHeightMm: fitTextHeightMm(contentMm, frame.styleId ?? 'caption'),
    },
    key,
  )
}

function textTarget(
  spread: Spread | undefined,
  frameId: string,
): { spread: Spread; frame: Frame } | undefined {
  if (spread === undefined) {
    return undefined
  }
  const frame = spread.frames.find(
    (item) => item.id === frameId && item.kind === 'text',
  )
  return frame === undefined ? undefined : { spread, frame }
}

/** Remembered Text field selection of one frame (a chip inserts there). */
interface FrameCaret {
  frameId: string
  caret: Caret | null
}

/**
 * Designer live-captions: Live from photo metadata, Anchored to (while Live)
 * and the token chips; no image frame on the spread → disabled + hint.
 */
function LiveCaptionBlock({
  target,
  spread,
  frame,
  caretRef,
}: {
  target: CropTarget
  spread: Spread
  frame: Frame
  caretRef: RefObject<FrameCaret | null>
}) {
  // Chip titles and file names read the assets too.
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const live = isLive(frame)
  const enabled = imageFrames(spread).length > 0
  const anchor = chipAnchor(spread, frame)
  const insert = (token: LiveToken) => {
    const saved = caretRef.current
    const remembered = saved?.frameId === target.frameId ? saved.caret : null
    const next = insertToken(editableText(frame), token, remembered)
    caretRef.current = { frameId: target.frameId, caret: next.caret }
    const session = nextEditKey('txt', target.frameId)
    // Live already on: a no-op that records nothing.
    dispatchBookOp(
      { type: 'setTextLive', ...target, live: true },
      session,
      INSERT_LABEL,
    )
    dispatchBookOp(
      { type: 'editText', ...target, text: next.text },
      session,
      INSERT_LABEL,
    )
    requestAnimationFrame(() => {
      growToText(target, session)
    })
  }
  return (
    <div className="live-caption" data-testid="live-caption">
      <div
        className="live-caption-row"
        data-disabled={enabled ? undefined : 'true'}
      >
        <span>{LIVE_LABEL}</span>
        <ToggleSwitch
          label={LIVE_LABEL}
          testId="live-caption-switch"
          on={live}
          disabled={!enabled}
          onChange={(next) => {
            dispatchBookOp({ type: 'setTextLive', ...target, live: next })
          }}
        />
      </div>
      {enabled ? (
        <>
          {live ? (
            <Select
              label="Anchored to"
              data-testid="live-caption-anchor"
              className="live-caption-select"
              value={frame.anchorFrameId ?? ''}
              options={anchorOptions(book, spread, getAssetDisplayName)}
              onChange={(anchorFrameId) => {
                dispatchBookOp({
                  type: 'setTextAnchor',
                  ...target,
                  anchorFrameId,
                })
              }}
            />
          ) : null}
          <div className="live-caption-chips" data-testid="live-tokens">
            {LIVE_TOKENS.map((token) => {
              const chip = chipState(book, spread, anchor, token)
              return (
                <button
                  key={token}
                  type="button"
                  className="live-caption-chip"
                  data-testid={`live-token-${token}`}
                  data-missing={chip.missing ? 'true' : undefined}
                  title={chip.title}
                  onClick={() => {
                    insert(token)
                  }}
                >
                  <FrameGlyph
                    nodes={ICON_GLYPHS.braces}
                    size={12}
                    name="braces"
                  />
                  {token}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <p className="live-caption-hint" data-testid="live-caption-hint">
          Add a photo frame to this spread to use its metadata.
        </p>
      )}
    </div>
  )
}

/** Kit TextSection (uikit/src/sandbox/sections.tsx) with its Live block. */
function TextSection({ target }: { target: CropTarget }) {
  const found = textTarget(useTargetSpread(target), target.frameId)
  const key = useRef('')
  const caret = useRef<FrameCaret | null>(null)
  if (found === undefined) {
    return null
  }
  const { spread, frame } = found
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
          value={editableText(frame)}
          onFocus={() => {
            key.current = nextEditKey('txt', target.frameId)
          }}
          onBlur={(event) => {
            const el = event.currentTarget
            caret.current = {
              frameId: target.frameId,
              caret: { start: el.selectionStart, end: el.selectionEnd },
            }
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
        <LiveCaptionBlock
          target={target}
          spread={spread}
          frame={frame}
          caretRef={caret}
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
