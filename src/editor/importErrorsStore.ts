import type { ImportFileError } from '../photo/assetPool'
import {
  groupImportErrorsByReason,
  type ImportErrorGroup,
} from './importErrorsGroup'

type Listener = () => void

const listeners = new Set<Listener>()

let errors: readonly ImportFileError[] = Object.freeze([])
let groups: readonly ImportErrorGroup[] = Object.freeze([])
let panelOpen = false

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function publishErrors(next: readonly ImportFileError[]): void {
  errors = Object.freeze([...next])
  groups = Object.freeze(groupImportErrorsByReason(errors))
  emit()
}

export function subscribeImportErrors(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getImportErrors(): readonly ImportFileError[] {
  return errors
}

export function getImportErrorGroups(): readonly ImportErrorGroup[] {
  return groups
}

export function isImportErrorsPanelOpen(): boolean {
  return panelOpen
}

export function appendImportErrors(batch: readonly ImportFileError[]): void {
  if (batch.length === 0) {
    return
  }
  publishErrors([...errors, ...batch])
}

export function dismissImportError(id: string): void {
  if (!errors.some((error) => error.id === id)) {
    return
  }
  publishErrors(errors.filter((error) => error.id !== id))
}

export function clearImportErrors(): void {
  if (errors.length === 0) {
    return
  }
  publishErrors([])
}

export function openImportErrorsPanel(): void {
  if (panelOpen) {
    return
  }
  panelOpen = true
  emit()
}

export function closeImportErrorsPanel(): void {
  if (!panelOpen) {
    return
  }
  panelOpen = false
  emit()
}

export function setImportErrorsPanelOpen(open: boolean): void {
  if (open) {
    openImportErrorsPanel()
    return
  }
  closeImportErrorsPanel()
}

/** Test seam — clears store without opening/closing side effects. */
export function resetImportErrorsStoreForTests(): void {
  errors = Object.freeze([])
  groups = Object.freeze([])
  panelOpen = false
  emit()
}
