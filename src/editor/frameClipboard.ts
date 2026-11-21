/*
 * Frame copy / cut / paste / duplicate on the canvas (Designer
 * frame-copy-paste FC4; kit twin `uikit/src/sandbox/viewport.tsx`
 * `useFrameClipboard`). The clipboard is the document `copy` / `cut` /
 * `paste` events (D1) plus an in-tab mirror for commands without an event
 * (the frame menu). Core does the geometry (`src/core/ops/clipboard.ts`).
 */
import {
  FRAMES_PAYLOAD_TYPE,
  findBookFrame,
  framesPayload,
  nextFrameIds,
  stepRepeatOffset,
  unmatchedPhotoCount,
  type FramesPayload,
  type LastDuplicate,
} from '../core'
import { parseFramesPayload } from '../core/ops/clipboard'
import { dispatchBookOp, getBookStoreSnapshot } from './bookStore'
import { isCoverSelected } from './coverSelection'
import { exitCropMode, getCropTarget } from './cropMode'
import {
  STATUS_FRAME_LOCKED,
  copiedFramesStatus,
  emptyPastedFramesStatus,
  flashEditorStatus,
  setEditorStatus,
} from './editorStatus'
import { getSelectedEndpaper } from './endpaperSelection'
import { revealFrames } from './frameReveal'
import {
  getFrameSelection,
  setFrameSelection,
  type FrameSelection,
} from './frameSelection'
import { isTypingTarget } from './isTypingTarget'
import { getLeftPanelTab } from './leftPanelTabStore'
import { getActiveSpreadId, setActiveSpreadId } from './photoRootSession'
import { getTextEdit } from './textEditStore'

const COPIED_STATUS_MS = 2000
const EMPTY_PASTE_STATUS_MS = 4000

/**
 * Where the keys belong to something else: fields, the spreads list (its
 * Ctrl+D duplicates the spread), the filmstrip dock and dialogs.
 */
const OWN_KEYS =
  'input, textarea, select, [contenteditable="true"], [data-testid="spreads-panel"], [data-testid="dock"], [role="dialog"]'

let mirror: FramesPayload | null = null
let lastDuplicate: LastDuplicate | null = null
/** Set by Ctrl/⌘+Shift+V's keydown for the paste event that follows. */
let inPlaceNext = false

/** The last copied or cut frames in this tab (the frame menu's Paste). */
export function frameClipboardMirror(): FramesPayload | null {
  return mirror
}

export function resetFrameClipboard(): void {
  mirror = null
  lastDuplicate = null
  inPlaceNext = false
}

const isInteriorSpread = (spreadId: string): boolean =>
  getBookStoreSnapshot().book.spreads.some((spread) => spread.id === spreadId)

/** D10: pages of the book in Pages mode, not the cover / endpapers / text edit. */
function onPages(): boolean {
  return (
    getLeftPanelTab() === 'pages' &&
    !isCoverSelected() &&
    getSelectedEndpaper() === null &&
    getTextEdit() === null
  )
}

/** The frame selection on an interior spread; in crop mode, the cropped frame. */
function selectedFrames(): FrameSelection | null {
  const crop = getCropTarget()
  const selection =
    getFrameSelection() ??
    (crop === null
      ? null
      : { spreadId: crop.spreadId, frameIds: [crop.frameId] })
  return selection !== null && onPages() && isInteriorSpread(selection.spreadId)
    ? selection
    : null
}

/** New frames become the selection on their (active) spread, then show. */
function selectNew(spreadId: string, frameIds: readonly string[]): void {
  exitCropMode()
  setActiveSpreadId(spreadId)
  setFrameSelection({ spreadId, frameIds })
  revealFrames(spreadId, frameIds)
}

/** Copy the selected frames: the payload (also kept in the mirror), else null. */
export function copySelectedFrames(): FramesPayload | null {
  const selection = selectedFrames()
  if (selection === null) {
    return null
  }
  const payload = framesPayload(
    getBookStoreSnapshot().book,
    selection.spreadId,
    selection.frameIds,
  )
  mirror = payload
  flashEditorStatus(copiedFramesStatus(payload.frames.length), COPIED_STATUS_MS)
  return payload
}

/**
 * Copy and remove the selected unlocked frames as one step (D9); locked ones
 * stay selected. All locked: the lock status and nothing is copied.
 */
export function cutSelectedFrames(): FramesPayload | null {
  const selection = selectedFrames()
  if (selection === null) {
    return null
  }
  const { book } = getBookStoreSnapshot()
  const { spreadId } = selection
  const frameIds = selection.frameIds.filter(
    (id) => findBookFrame(book, spreadId, id)?.locked !== true,
  )
  if (frameIds.length === 0) {
    setEditorStatus(STATUS_FRAME_LOCKED)
    return null
  }
  const payload = framesPayload(book, spreadId, frameIds)
  mirror = payload
  dispatchBookOp({ type: 'removeFrames', spreadId, frameIds, cut: true })
  exitCropMode()
  setFrameSelection({
    spreadId,
    frameIds: selection.frameIds.filter((id) => !frameIds.includes(id)),
  })
  return payload
}

/** The paste target: the frame selection's spread, else the active spread. */
function targetSpreadId(): string | null {
  const selected = selectedFrames()?.spreadId ?? getActiveSpreadId()
  return selected !== null && onPages() && isInteriorSpread(selected)
    ? selected
    : null
}

/**
 * Paste `payload` (D3–D7; in place: D4 clamp only) as one step; the copies
 * become the selection. False when there is nowhere to paste.
 */
export function pasteFrames(
  payload: FramesPayload,
  options: { inPlace: boolean },
): boolean {
  const spreadId = targetSpreadId()
  if (spreadId === null) {
    return false
  }
  const { book } = getBookStoreSnapshot()
  const ids = nextFrameIds(book, spreadId, payload.frames.length)
  const empty = unmatchedPhotoCount(book, payload)
  dispatchBookOp({
    type: 'pasteFrames',
    spreadId,
    payload,
    inPlace: options.inPlace,
    ids,
  })
  if (getBookStoreSnapshot().book === book) {
    return false
  }
  selectNew(spreadId, ids)
  if (empty > 0) {
    flashEditorStatus(emptyPastedFramesStatus(empty), EMPTY_PASTE_STATUS_MS)
  }
  return true
}

/**
 * Duplicate the selected frames as one step (D8): the offset of the last
 * duplicate's move when run on its copies, else +5/+5 mm.
 */
export function duplicateSelectedFrames(): boolean {
  const selection = selectedFrames()
  if (selection === null) {
    return false
  }
  const { spreadId, frameIds } = selection
  const offset = stepRepeatOffset(
    getBookStoreSnapshot().book,
    spreadId,
    frameIds,
    lastDuplicate,
  )
  return duplicateFramesBy(spreadId, frameIds, offset.x, offset.y)
}

/**
 * Duplicate `frameIds` on `spreadId` by (dx, dy) mm as one step (Ctrl+D, and
 * a finished Alt-drag): the copies become the selection and the step memory
 * a following Ctrl+D repeats (D8). False when the book did not change.
 */
export function duplicateFramesBy(
  spreadId: string,
  frameIds: readonly string[],
  dx: number,
  dy: number,
): boolean {
  const { book } = getBookStoreSnapshot()
  const sources = framesPayload(book, spreadId, frameIds).frames
  const ids = nextFrameIds(book, spreadId, sources.length)
  dispatchBookOp({ type: 'duplicateFrames', spreadId, frameIds, dx, dy, ids })
  if (getBookStoreSnapshot().book === book) {
    return false
  }
  lastDuplicate = {
    spreadId,
    sourceRects: sources.map((frame) => frame.rect),
    newIds: ids,
  }
  selectNew(spreadId, ids)
  return true
}

/** The canvas owns the event: no field / panel focus and no Site preview. */
function canvasTarget(target: EventTarget | null): boolean {
  if (
    isTypingTarget(target) ||
    (target instanceof Element && target.closest(OWN_KEYS) !== null)
  ) {
    return false
  }
  return document.querySelector('[data-testid="site-preview"]') === null
}

function onCopyOrCut(event: ClipboardEvent): void {
  if (!canvasTarget(event.target) || selectedFrames() === null) {
    return
  }
  event.preventDefault()
  const payload =
    event.type === 'cut' ? cutSelectedFrames() : copySelectedFrames()
  if (payload !== null) {
    event.clipboardData?.setData(FRAMES_PAYLOAD_TYPE, JSON.stringify(payload))
  }
}

function onPaste(event: ClipboardEvent): void {
  const inPlace = inPlaceNext
  inPlaceNext = false
  if (!canvasTarget(event.target)) {
    return
  }
  // D1: the event's payload only, so text copied elsewhere since pastes no
  // frames. Chromium's Ctrl+Shift+V event carries plain text only: with no
  // text on it, the mirror pastes (kit).
  const data = event.clipboardData
  const own = data?.getData(FRAMES_PAYLOAD_TYPE) ?? ''
  const payload =
    own !== ''
      ? parseFramesPayload(own)
      : inPlace && data?.types.includes('text/plain') !== true
        ? mirror
        : null
  if (payload !== null && pasteFrames(payload, { inPlace })) {
    event.preventDefault()
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return
  }
  const key = event.key.toLowerCase()
  if (key === 'v') {
    inPlaceNext = event.shiftKey
    return
  }
  if (
    key === 'd' &&
    !event.shiftKey &&
    canvasTarget(event.target) &&
    selectedFrames() !== null
  ) {
    event.preventDefault()
    duplicateSelectedFrames()
  }
}

/** Document listeners for the frame clipboard keys; returns the uninstall. */
export function installFrameClipboard(): () => void {
  document.addEventListener('copy', onCopyOrCut)
  document.addEventListener('cut', onCopyOrCut)
  document.addEventListener('paste', onPaste)
  document.addEventListener('keydown', onKeyDown)
  return () => {
    document.removeEventListener('copy', onCopyOrCut)
    document.removeEventListener('cut', onCopyOrCut)
    document.removeEventListener('paste', onPaste)
    document.removeEventListener('keydown', onKeyDown)
    inPlaceNext = false
  }
}
