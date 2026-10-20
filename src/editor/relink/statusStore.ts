import type { AssetMatchStatus } from '../../assets'
import { createProgressBatcher } from './progressBatch'

export type RelinkStatus = AssetMatchStatus

type Listener = () => void

const statuses = new Map<string, RelinkStatus>()
const foundIds = new Set<string>()
const listeners = new Set<Listener>()
let dialogOpen = false
let progress: RelinkProgress | null = null

export interface RelinkProgress {
  total: number
  completed: number
  running: boolean
}

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

const progressBatcher = createProgressBatcher((next) => {
  progress = next
  emit()
})

export function subscribeRelink(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getRelinkStatuses(): ReadonlyMap<string, RelinkStatus> {
  return statuses
}

export function getRelinkStatus(assetId: string): RelinkStatus | undefined {
  return statuses.get(assetId)
}

export function isRelinkDialogOpen(): boolean {
  return dialogOpen
}

export function getRelinkProgress(): RelinkProgress | null {
  return progress
}

export function getFoundRelinkIds(): ReadonlySet<string> {
  return foundIds
}

export function markRelinkFound(ids: readonly string[]): void {
  for (const id of ids) {
    foundIds.add(id)
  }
  emit()
}

export function clearRelinkFound(): void {
  if (foundIds.size === 0) {
    return
  }
  foundIds.clear()
  emit()
}

export function setRelinkDialogOpen(open: boolean): void {
  if (dialogOpen === open) {
    return
  }
  dialogOpen = open
  emit()
}

export function setRelinkProgress(next: RelinkProgress | null): void {
  progressBatcher.schedule(next)
}

/** Replace all statuses; drops keys not present in `next`. */
export function replaceRelinkStatuses(
  next: ReadonlyMap<string, RelinkStatus>,
): void {
  statuses.clear()
  for (const [id, status] of next) {
    statuses.set(id, status)
  }
  emit()
}

export function patchRelinkStatus(assetId: string, status: RelinkStatus): void {
  if (statuses.get(assetId) === status) {
    return
  }
  statuses.set(assetId, status)
  emit()
}

export function problemAssetIds(): string[] {
  const ids: string[] = []
  for (const [id, status] of statuses) {
    if (status === 'missing' || status === 'modified') {
      ids.push(id)
    }
  }
  return ids
}

export function missingCount(): number {
  let count = 0
  for (const status of statuses.values()) {
    if (status === 'missing') {
      count += 1
    }
  }
  return count
}

export function resetRelinkStore(): void {
  progressBatcher.reset()
  statuses.clear()
  foundIds.clear()
  dialogOpen = false
  progress = null
  emit()
}
