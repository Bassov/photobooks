/** Relative “edited …” label for library caption meta (kit-style). */
export function formatLibraryEditedLabel(
  editedAtMs: number,
  nowMs: number = Date.now(),
): string {
  const delta = Math.max(0, nowMs - editedAtMs)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (delta < minute) {
    return 'just now'
  }
  if (delta < hour) {
    const n = Math.floor(delta / minute)
    return n === 1 ? '1 minute ago' : `${String(n)} minutes ago`
  }
  if (delta < day) {
    const n = Math.floor(delta / hour)
    return n === 1 ? '1 hour ago' : `${String(n)} hours ago`
  }
  if (delta < 2 * day) {
    return 'yesterday'
  }
  const d = new Date(editedAtMs)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Caption line: `N pages` or `N pages · edited …` when mtime is known. */
export function formatLibraryBookMeta(
  pageCount: number,
  editedAtMs: number | undefined,
  nowMs: number = Date.now(),
): string {
  const pages = `${String(pageCount)} pages`
  if (editedAtMs === undefined) {
    return pages
  }
  return `${pages} · edited ${formatLibraryEditedLabel(editedAtMs, nowMs)}`
}
