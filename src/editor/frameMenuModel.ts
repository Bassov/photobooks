/*
 * Designer frame-context-menu M1/M2 (kit `uikit/src/sandbox/frame-menu.tsx`
 * `frameGroups`): the frame menu rows in one fixed order, groups photo · edit
 * · order · lock + delete. A row that does not apply now is disabled (not
 * hidden); a group that never applies to that kind of frame is left out.
 * Each row is enabled exactly when its command would act.
 */
import type { Book, Frame } from '../core'
import type { IconProps } from '../ui/Icon'
import {
  findSetFrames,
  findTargetFrame,
  LOCK_KEYS,
  setZMovesFor,
  Z_MOVES,
  zMovesFor,
  type FrameSetTarget,
  type FrameTarget,
} from './frameArrange'
import { overrideCopyOf } from './parentChanges'

type FrameMenuRowId =
  | 'reset-parent'
  | 'hide-parent'
  | 'replace'
  | 'place'
  | 'remove'
  | 'fit'
  | 'crop'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'duplicate'
  | 'front'
  | 'forward'
  | 'backward'
  | 'back'
  | 'lock'
  | 'delete'

interface FrameMenuRow {
  id: FrameMenuRowId
  label: string
  icon: IconProps['name']
  /** Today's shortcut string (M7); `menuKeys` formats it for the platform. */
  keys?: string
  enabled: boolean
  destructive?: boolean
}

export type FrameMenuEntry = FrameMenuRow | 'separator'

export interface FrameMenuContext {
  /** The multi-selection the menu acts on; null for one frame. */
  set: FrameSetTarget | null
  /** Frames were copied or cut in this tab (Paste). */
  mirrorHasFrames: boolean
  /** D10: frame copy / paste act on the target's spread (Pages canvas). */
  editScope: boolean
}

const row = (
  id: FrameMenuRowId,
  label: string,
  icon: IconProps['name'],
  enabled = true,
  keys?: string,
): FrameMenuRow =>
  keys === undefined
    ? { id, label, icon, enabled }
    : { id, label, icon, enabled, keys }

function photoGroup(book: Book, frame: Frame): FrameMenuRow[] {
  // A pick is a drop: refused on a locked frame, and needs a photo to pick.
  const pickable = frame.locked !== true && book.gallery.length > 0
  if (frame.assetId === undefined) {
    return [row('place', 'Place photo…', 'imagePlus', pickable)]
  }
  const fill = (frame.fit ?? 'fill') === 'fill'
  return [
    row('replace', 'Replace photo…', 'replace', pickable),
    row('remove', 'Remove photo', 'imageOff'),
    fill
      ? row('fit', 'Fit photo to frame', 'shrink')
      : row('fit', 'Fill frame', 'expand'),
    row('crop', 'Crop', 'crop'),
  ]
}

function editGroup(frames: readonly Frame[], ctx: FrameMenuContext) {
  return [
    // D9: Cut leaves locked frames; all locked = nothing to cut.
    row(
      'cut',
      'Cut',
      'scissors',
      frames.some((frame) => frame.locked !== true),
      'Ctrl+X',
    ),
    row('copy', 'Copy', 'copy', true, 'Ctrl+C'),
    row('paste', 'Paste', 'clipboardPaste', ctx.mirrorHasFrames, 'Ctrl+V'),
    row('duplicate', 'Duplicate', 'duplicate', true, 'Ctrl+D'),
  ]
}

/**
 * The rows of the frame menu on `target` (or on `ctx.set`), separators
 * between groups; empty when the frames are gone.
 */
export function frameMenuRows(
  book: Book,
  target: FrameTarget,
  ctx: FrameMenuContext,
): FrameMenuEntry[] {
  const { set } = ctx
  const one = findTargetFrame(book, target)
  const frames =
    set === null ? (one === undefined ? [] : [one]) : findSetFrames(book, set)
  const [first] = frames
  if (first === undefined) {
    return []
  }
  const copy = set === null && overrideCopyOf(book, target) !== undefined
  const groups: FrameMenuRow[][] = []
  if (copy) {
    groups.push([
      row('reset-parent', 'Reset to parent', 'rotateCcw'),
      row('hide-parent', 'Hide on this spread', 'eyeOff'),
    ])
  }
  if (set === null && first.kind !== 'text' && ctx.editScope) {
    groups.push(photoGroup(book, first))
  }
  if (ctx.editScope) {
    groups.push(editGroup(frames, ctx))
  }
  // PO3: a copy keeps its parent slot (no order rows); Hide is its delete.
  if (!copy) {
    const moves =
      set === null ? zMovesFor(book, target) : setZMovesFor(book, set)
    groups.push(
      Z_MOVES.map((entry) =>
        row(
          entry.move,
          entry.label,
          entry.icon,
          moves.includes(entry.move),
          entry.keys,
        ),
      ),
    )
  }
  const locked = frames.every((frame) => frame.locked === true)
  const last = [
    row(
      'lock',
      locked ? 'Unlock' : 'Lock',
      locked ? 'unlock' : 'lock',
      true,
      LOCK_KEYS,
    ),
  ]
  if (!copy) {
    last.push({
      ...row(
        'delete',
        frames.length > 1
          ? `Delete ${String(frames.length)} frames`
          : 'Delete frame',
        'delete',
        true,
        'Del',
      ),
      destructive: true,
    })
  }
  groups.push(last)
  return groups.flatMap((group, index): FrameMenuEntry[] =>
    index === 0 ? group : ['separator', ...group],
  )
}

/** Ids of the disabled rows (react-aria `disabledKeys`: arrows skip them). */
export function disabledRowIds(entries: readonly FrameMenuEntry[]): string[] {
  return entries.flatMap((entry) =>
    entry === 'separator' || entry.enabled ? [] : [entry.id],
  )
}
