import { pillCount } from './relinkModel'
import {
  getFoundRelinkIds,
  missingCount,
  problemAssetIds,
  setRelinkDialogOpen,
} from './statusStore'

/** Pill count from store counters (single subscription snapshot). */
export function relinkPillCount(
  missing: number,
  problemCount: number,
  foundSize: number,
): number {
  return pillCount(missing, problemCount, foundSize)
}

/** Live store snapshot for RelinkHost useSyncExternalStore. */
export function readRelinkPillCount(): number {
  return relinkPillCount(
    missingCount(),
    problemAssetIds().length,
    getFoundRelinkIds().size,
  )
}

export function shouldShowMissingPill(count: number): boolean {
  return count > 0
}

export function missingPillLabel(count: number): string {
  return `${String(count)} photos missing · export paused`
}

export function openRelinkReview(): void {
  setRelinkDialogOpen(true)
}
