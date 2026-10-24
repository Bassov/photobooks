import type { ScannedEntry } from '../assets'

/** Visible accepted paths first; preserve relative order within each tier. */
export function orderScannedForVisibleFirst(
  scanned: readonly ScannedEntry[],
  visiblePaths: ReadonlySet<string>,
): ScannedEntry[] {
  const priority: ScannedEntry[] = []
  const rest: ScannedEntry[] = []
  for (const entry of scanned) {
    if (visiblePaths.has(entry.relativePath)) {
      priority.push(entry)
    } else {
      rest.push(entry)
    }
  }
  return [...priority, ...rest]
}
