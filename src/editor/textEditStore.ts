import { editableSpread } from '../core'
import { discardStep, dispatchBookOp, getBookStoreSnapshot } from './bookStore'
import { getFrameSource, setFrameSource } from './frameSelection'

type Listener = () => void

/** The text frame being edited on the canvas (Designer text-frames). */
interface TextEdit {
  spreadId: string
  frameId: string
  /**
   * History key shared with the Text tool's create step ("Add text"); none
   * later. A keyed frame left empty goes away.
   */
  addKey: string | undefined
}

/** What the edit overlay holds: the text and the whole-line height it needs. */
export interface TextDraft {
  text: string
  fitHeightMm: number
}

let current: TextEdit | null = null
let readDraft: (() => TextDraft) | null = null
let sessions = 0
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function getTextEdit(): TextEdit | null {
  return current
}

/** Per-spread key: the edited frame's id on that spread, else `''`. */
export function getSpreadTextEditKey(spreadId: string): string {
  return current?.spreadId === spreadId ? current.frameId : ''
}

export function subscribeTextEdit(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * A fresh history key: `add` for a Text-tool create and its first edit, `txt`
 * for one focus of the inspector Text field.
 */
export function nextEditKey(kind: 'add' | 'txt', frameId: string): string {
  sessions += 1
  return `${kind}:${frameId}:${String(sessions)}`
}

/** Edit a text frame (the previous edit commits first). */
export function startTextEdit(
  target: { spreadId: string; frameId: string },
  addKey?: string,
): void {
  commitTextEdit()
  current = { spreadId: target.spreadId, frameId: target.frameId, addKey }
  emit()
}

/** The overlay's textarea while it is mounted. */
export function registerTextDraft(read: () => TextDraft): () => void {
  readDraft = read
  return () => {
    if (readDraft === read) {
      readDraft = null
    }
  }
}

function frameText(edit: TextEdit): string | undefined {
  const frame = editableSpread(
    getBookStoreSnapshot().book,
    edit.spreadId,
  )?.spread.frames.find((item) => item.id === edit.frameId)
  if (frame?.kind !== 'text') {
    return undefined
  }
  return frame.content?.type === 'static' ? frame.content.text : ''
}

/**
 * Leave edit mode: the draft lands as one `editText`, and an empty frame made
 * in this session is removed (its create step is taken back, no new step).
 */
export function commitTextEdit(): void {
  const edit = current
  if (edit === null) {
    return
  }
  current = null
  const draft = readDraft?.()
  // Only a content edit grows the box: leaving untouched text writes nothing.
  if (draft !== undefined && draft.text !== frameText(edit)) {
    dispatchBookOp(
      {
        type: 'editText',
        spreadId: edit.spreadId,
        frameId: edit.frameId,
        text: draft.text,
        fitHeightMm: draft.fitHeightMm,
      },
      edit.addKey,
    )
  }
  if (edit.addKey !== undefined && frameText(edit) === '') {
    const selected = getFrameSource()
    if (!discardStep(edit.addKey)) {
      dispatchBookOp({
        type: 'removeFrames',
        spreadId: edit.spreadId,
        frameIds: [edit.frameId],
      })
    }
    if (selected?.frameId === edit.frameId) {
      setFrameSource(null)
    }
  }
  emit()
}

/** Drop the edit without writing (its frame is gone). */
export function cancelTextEdit(): void {
  if (current === null) {
    return
  }
  current = null
  emit()
}

/** Text frames whose text runs past their whole-line box, per spread. */
const overflowing = new Map<string, readonly string[]>()
const overflowListeners = new Set<Listener>()
const NONE: readonly string[] = []

/** The measured overflowing frame ids of one painted spread. */
export function setSpreadOverflow(
  spreadId: string,
  frameIds: readonly string[],
): void {
  const prev = getSpreadOverflow(spreadId)
  if (
    prev.length === frameIds.length &&
    prev.every((id, index) => frameIds[index] === id)
  ) {
    return
  }
  overflowing.set(spreadId, frameIds)
  for (const listener of overflowListeners) {
    listener()
  }
}

/** Stable per change: a `useSyncExternalStore` snapshot. */
export function getSpreadOverflow(spreadId: string): readonly string[] {
  return overflowing.get(spreadId) ?? NONE
}

export function isTextOverflowing(spreadId: string, frameId: string): boolean {
  return getSpreadOverflow(spreadId).includes(frameId)
}

export function subscribeTextOverflow(listener: Listener): () => void {
  overflowListeners.add(listener)
  return () => {
    overflowListeners.delete(listener)
  }
}

export function resetTextEditForTests(): void {
  current = null
  readDraft = null
  sessions = 0
  overflowing.clear()
}
