import {
  filmstripScrollQuietRemainingMs,
  isFilmstripScrollQuiet,
} from './filmstripScrollQuiet'

/**
 * Publish filmstrip-visible asset ids, deferring while scroll quiet is open so
 * decode-pool promote/pump does not stack with virtualizer remounts.
 */
export function scheduleFilmstripVisibleSync(
  ids: readonly string[],
  setVisible: (ids: readonly string[]) => void,
): () => void {
  if (!isFilmstripScrollQuiet()) {
    setVisible(ids)
    return () => {
      // No timer to clear.
    }
  }
  const timer = setTimeout(() => {
    setVisible(ids)
  }, filmstripScrollQuietRemainingMs())
  return () => {
    clearTimeout(timer)
  }
}
