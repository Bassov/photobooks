import { findBookFrame } from '../core'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { exitCropMode } from './cropMode'
import { setEditorStatus, subscribeEditorStatus } from './editorStatus'
import { setFrameSource } from './frameSelection'
import { getLeftPanelTab, subscribeLeftPanelTab } from './leftPanelTabStore'
import { subscribeActiveSpreadId } from './photoRootSession'

/**
 * Designer frame-context-menu M3 pick mode: "Replace photo…" / "Place
 * photo…" hand the next filmstrip click / Enter to one frame.
 */
export interface PhotoPick {
  spreadId: string
  frameId: string
  kind: 'replace' | 'place'
}

export const PICK_STATUS: Record<PhotoPick['kind'], string> = {
  replace: 'Click a photo in the filmstrip to replace this one · Esc to cancel',
  place: 'Click a photo in the filmstrip to place it here · Esc to cancel',
}

/** The pointer may press here (filters, scroll, splitter) without ending it. */
const DOCK_SELECTOR = '[data-testid="dock"]'

type Listener = () => void

let pick: PhotoPick | null = null
const NOOP = (): void => undefined
let teardown: () => void = NOOP
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function getPhotoPick(): PhotoPick | null {
  return pick
}

export function isPhotoPicking(): boolean {
  return pick !== null
}

/** `kind:frameId` on `spreadId`, else `''` (a stable snapshot per spread). */
export function photoPickOnSpread(spreadId: string): string {
  return pick?.spreadId === spreadId ? `${pick.kind}:${pick.frameId}` : ''
}

export function subscribePhotoPick(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The frame can no longer take a pick: removed or locked. */
function frameGone(target: PhotoPick): boolean {
  const frame = findBookFrame(
    getBookStoreSnapshot().book,
    target.spreadId,
    target.frameId,
  )
  return frame === undefined || frame.locked === true
}

/** Roving thumb (the last focused one, else the first). */
function focusRovingThumb(): void {
  const strip = document.querySelector('[data-testid="filmstrip"]')
  const row =
    strip?.querySelector<HTMLElement>('.filmstrip-item[tabindex="0"]') ??
    strip?.querySelector<HTMLElement>('.filmstrip-item')
  row?.focus({ preventScroll: true })
}

function install(target: PhotoPick): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') {
      return
    }
    // The first Esc ends the pick before any other Esc layer.
    event.preventDefault()
    event.stopPropagation()
    endPhotoPick()
  }
  const onPointerDown = (event: PointerEvent): void => {
    const inDock =
      event.target instanceof Element &&
      event.target.closest(DOCK_SELECTOR) !== null
    if (!inDock) {
      endPhotoPick()
    }
  }
  const unsubscribers = [
    // Kept while on: a drop's late "clear status" timer must not wipe it
    // (setEditorStatus skips an equal text).
    subscribeEditorStatus(() => {
      setEditorStatus(PICK_STATUS[target.kind])
    }),
    subscribeBookStore(() => {
      if (frameGone(target)) {
        endPhotoPick()
      }
    }),
    // Both stores notify on a change only: another active spread, and Pages →
    // Masters (picking starts on Pages only).
    subscribeActiveSpreadId(endPhotoPick),
    subscribeLeftPanelTab(endPhotoPick),
  ]
  window.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  // A frame after the menu's own focus restore.
  const focusId = requestAnimationFrame(focusRovingThumb)
  return () => {
    cancelAnimationFrame(focusId)
    window.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('pointerdown', onPointerDown, true)
    for (const unsubscribe of unsubscribers) {
      unsubscribe()
    }
  }
}

/** Start picking for one photo frame: crop ends, the frame stays selected. */
export function startPhotoPick(next: PhotoPick): void {
  if (frameGone(next) || getLeftPanelTab() === 'masters') {
    return
  }
  endPhotoPick()
  exitCropMode()
  setFrameSource({ spreadId: next.spreadId, frameId: next.frameId })
  pick = { ...next }
  setEditorStatus(PICK_STATUS[next.kind])
  teardown = install(pick)
  emit()
}

/** Cancel: no change to the book. */
export function endPhotoPick(): void {
  if (pick === null) {
    return
  }
  pick = null
  teardown()
  teardown = NOOP
  setEditorStatus('')
  emit()
}

/**
 * A filmstrip click / Enter on `assetId` = the same replace / place as a
 * drop (one undo step); the mode then ends and the frame stays selected.
 */
export function pickPhoto(assetId: string): void {
  const target = pick
  if (target === null) {
    return
  }
  endPhotoPick()
  dispatchBookOp({
    type: target.kind,
    spreadId: target.spreadId,
    frameId: target.frameId,
    assetId,
  })
}
