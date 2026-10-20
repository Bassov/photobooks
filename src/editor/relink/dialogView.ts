import type { RelinkProgress, RelinkStatus } from './statusStore'
import {
  badgeLabel,
  isResolveDisabled,
  relinkTitle,
  resolveLabel,
  rowDataStatus,
  scanPercent,
  selectRelinkRows,
  unresolvedProblemCount,
  type RelinkRowModel,
} from './relinkModel'

export type RelinkTab = 'problems' | 'all'

export interface RelinkDialogView {
  title: string
  rows: RelinkRowModel[]
  scanning: boolean
  pct: number
  resolveCount: number
  resolveDisabled: boolean
  resolveText: string
}

/** Pure view model for the missing-assets dialog shell. */
export function buildRelinkDialogView(
  statuses: ReadonlyMap<string, RelinkStatus>,
  found: ReadonlySet<string>,
  progress: RelinkProgress | null,
  tab: RelinkTab,
): RelinkDialogView {
  const scanning = progress?.running === true
  const resolveCount = found.size
  return {
    title: relinkTitle(unresolvedProblemCount(statuses, found)),
    rows: selectRelinkRows(statuses, found, tab),
    scanning,
    pct: scanPercent(progress),
    resolveCount,
    resolveDisabled: isResolveDisabled(resolveCount, scanning),
    resolveText: resolveLabel(resolveCount),
  }
}

export function badgeClassName(found: boolean, status: RelinkStatus): string {
  return `relink-badge relink-badge-${rowDataStatus(found, status)}`
}

export function filesFromFileList(list: FileList | null): File[] | null {
  if (list === null || list.length === 0) {
    return null
  }
  return [...list]
}

export function shouldCloseAfterResolve(resolvedCount: number): boolean {
  return resolvedCount > 0
}

export function rowBadgeLabel(found: boolean, status: RelinkStatus): string {
  return badgeLabel(found, status)
}

export function rowStatusAttr(found: boolean, status: RelinkStatus): string {
  return rowDataStatus(found, status)
}
