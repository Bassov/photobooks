import {
  getRelinkStatus,
  problemAssetIds,
  type RelinkStatus,
} from './statusStore'

/**
 * Whether a frame should show the missing hatch for `assetId`, given the
 * current problem-id revision string from `problemAssetIds().join('\\0')`.
 */
export function assetShowsMissingHatch(
  assetId: string,
  problemRevision: string,
  status: RelinkStatus | undefined,
): boolean {
  if (status !== 'missing') {
    return false
  }
  if (problemRevision.length === 0) {
    return false
  }
  return problemRevision.split('\0').includes(assetId)
}

export function problemRevisionFromIds(ids: readonly string[]): string {
  return ids.join('\0')
}

/** Snapshot getter for ConnectedSpreadView useSyncExternalStore. */
export function getProblemRevisionSnapshot(): string {
  return problemRevisionFromIds(problemAssetIds())
}

/** Predicate factory so SpreadView hatch wiring stays a one-liner. */
export function missingAssetChecker(
  problemRevision: string,
): (assetId: string) => boolean {
  return (assetId) =>
    assetShowsMissingHatch(assetId, problemRevision, getRelinkStatus(assetId))
}
