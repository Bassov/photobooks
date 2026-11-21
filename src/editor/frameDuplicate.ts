/*
 * Alt-press duplicate drag (Designer frame-copy-paste D2 / "Alt-drag look",
 * FC5; kit twin `uikit/src/sandbox/canvas.tsx` `moveFrames(…, dup)`). The
 * gesture itself runs in `frameGesture.ts` (session `duplicate`); this module
 * owns its targets, the clones it paints and the Alt `copy` cursor.
 */
import { getBookStoreSnapshot } from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { getFrameSelection } from './frameSelection'

export const DUPLICATE_DRAG_STATUS = 'Release to place the copy · Esc to cancel'

/** On the spread view while clones are shown: hides the originals' chrome. */
const DUPLICATING_ATTR = 'data-alt-duplicating'
/** On `.editor-workspace` while Alt is held: `cursor: copy` over frames. */
const ALT_DUPLICATE_ATTR = 'data-alt-duplicate'

/** Selection chrome and photo controls a clone must not carry. */
const CLONE_CHROME =
  '[data-handle], [data-photo-pan], [data-photo-handle], .spread-frame-rotate-line, .spread-frame-ghost, [data-testid="photo-crop-tag"]'
/** Identity a clone must not carry (locators, hits, a11y, native drag). */
const CLONE_ATTRS = [
  'data-testid',
  'data-frame-id',
  'aria-pressed',
  'aria-label',
  'id',
  'draggable',
] as const

/**
 * The frames an Alt press on `frameId` duplicates: the whole selection when
 * the frame is in it, else that frame alone. None off the book's interior
 * spreads (cover, endpapers, Masters keep today's press).
 */
export function duplicateFrameIds(spreadId: string, frameId: string): string[] {
  if (
    !getBookStoreSnapshot().book.spreads.some(
      (spread) => spread.id === spreadId,
    )
  ) {
    return []
  }
  const selection = getFrameSelection()
  return selection?.spreadId === spreadId &&
    selection.frameIds.includes(frameId)
    ? [...selection.frameIds]
    : [frameId]
}

export interface DuplicateClone {
  node: HTMLElement
  /** The original's inline transform (a rotation, or ''). */
  saved: string
}

function stripClone(node: HTMLElement): void {
  node.querySelectorAll(CLONE_CHROME).forEach((el) => {
    el.remove()
  })
  for (const el of [node, ...node.querySelectorAll<HTMLElement>('*')]) {
    for (const attr of CLONE_ATTRS) {
      el.removeAttribute(attr)
    }
  }
}

/**
 * Clones of the frames' painted buttons, next to each original: opacity .85,
 * the selection ring, no handles or knob, no hits. The originals stay painted;
 * their own chrome hides while `DUPLICATING_ATTR` is on the spread.
 */
export function paintClones(
  spreadEl: HTMLElement,
  frameIds: readonly string[],
): DuplicateClone[] {
  spreadEl.setAttribute(DUPLICATING_ATTR, 'true')
  setEditorStatus(DUPLICATE_DRAG_STATUS)
  const buttons = Array.from(
    spreadEl.querySelectorAll<HTMLElement>('button.spread-frame'),
  ).filter((button) => frameIds.includes(button.dataset.frameId ?? ''))
  return buttons.map((button) => {
    const node = button.cloneNode(true) as HTMLElement
    stripClone(node)
    node.setAttribute('data-testid', 'frame-duplicate-clone')
    node.setAttribute('aria-hidden', 'true')
    node.tabIndex = -1
    node.style.opacity = '0.85'
    node.style.boxShadow = '0 0 0 2px var(--select)'
    node.style.zIndex = '999'
    node.style.pointerEvents = 'none'
    button.after(node)
    return { node, saved: button.style.transform }
  })
}

/** Every clone follows the pointer by the same layout-px shift. */
export function moveClones(
  clones: readonly DuplicateClone[],
  dxPx: number,
  dyPx: number,
): void {
  const shift = `translate(${String(dxPx)}px, ${String(dyPx)}px)`
  for (const { node, saved } of clones) {
    node.style.transform = `${shift} ${saved}`
  }
}

/** The clones go; the originals' chrome and the status come back. */
export function clearClones(
  spreadEl: HTMLElement,
  clones: readonly DuplicateClone[],
): void {
  for (const { node } of clones) {
    node.remove()
  }
  spreadEl.removeAttribute(DUPLICATING_ATTR)
  if (getEditorStatus() === DUPLICATE_DRAG_STATUS) {
    setEditorStatus('')
  }
}

/**
 * `data-alt-duplicate` on the editor workspace while Alt is held (cleared on
 * keyup and window blur); the CSS shows `cursor: copy` over frames with the
 * Select tool only (`[data-tool='select']`).
 */
export function installAltDuplicateCursor(): () => void {
  const workspace = (): Element | null =>
    document.querySelector('.editor-workspace')
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Alt') {
      return
    }
    if (event.type === 'keydown') {
      workspace()?.setAttribute(ALT_DUPLICATE_ATTR, 'true')
    } else {
      workspace()?.removeAttribute(ALT_DUPLICATE_ATTR)
    }
  }
  const clear = (): void => {
    workspace()?.removeAttribute(ALT_DUPLICATE_ATTR)
  }
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('keyup', onKey, true)
  window.addEventListener('blur', clear)
  return () => {
    clear()
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('keyup', onKey, true)
    window.removeEventListener('blur', clear)
  }
}
