import type { RelinkStatus } from './statusStore'

export interface RelinkRowModel {
  assetId: string
  status: RelinkStatus
  found: boolean
}

export function selectRelinkRows(
  statuses: ReadonlyMap<string, RelinkStatus>,
  found: ReadonlySet<string>,
  tab: 'problems' | 'all',
): RelinkRowModel[] {
  const ids =
    tab === 'all'
      ? [...statuses.keys()]
      : [...statuses.entries()]
          .filter(([, status]) => status === 'missing' || status === 'modified')
          .map(([id]) => id)
  return ids.map((assetId) => {
    const status = statuses.get(assetId) ?? 'missing'
    return {
      assetId,
      status,
      found: found.has(assetId),
    }
  })
}

export function relinkTitle(problemCount: number): string {
  if (problemCount > 0) {
    return `${String(problemCount)} photos need attention`
  }
  return 'No photos need attention'
}

export function scanPercent(
  progress: { total: number; completed: number } | null,
): number {
  if (progress === null || progress.total <= 0) {
    return 0
  }
  return Math.min(100, Math.round((progress.completed / progress.total) * 100))
}

export function unresolvedProblemCount(
  statuses: ReadonlyMap<string, RelinkStatus>,
  found: ReadonlySet<string>,
): number {
  let count = 0
  for (const [id, status] of statuses) {
    if ((status === 'missing' || status === 'modified') && !found.has(id)) {
      count += 1
    }
  }
  return count
}

export function pillCount(
  missing: number,
  problems: number,
  foundSize: number,
): number {
  return Math.max(missing, problems - foundSize)
}

export function shouldDetectOnActivation(options: {
  surface: string
  bookId: string | null
  restorePending: boolean
  accessPhase: string
}): boolean {
  if (options.surface !== 'editor' || options.bookId === null) {
    return false
  }
  if (options.restorePending) {
    return false
  }
  if (options.accessPhase === 'permission-required') {
    return false
  }
  return true
}

export function badgeLabel(found: boolean, status: RelinkStatus): string {
  if (found) {
    return 'Found'
  }
  if (status === 'missing') {
    return 'Missing'
  }
  if (status === 'modified') {
    return 'Modified'
  }
  return 'Linked'
}

export function rowDataStatus(found: boolean, status: RelinkStatus): string {
  if (found) {
    return 'found'
  }
  return status
}

export function resolveLabel(resolveCount: number): string {
  if (resolveCount > 0) {
    return `Resolve ${String(resolveCount)}`
  }
  return 'Resolve'
}

export function isResolveDisabled(
  resolveCount: number,
  scanning: boolean,
): boolean {
  return resolveCount === 0 || scanning
}
