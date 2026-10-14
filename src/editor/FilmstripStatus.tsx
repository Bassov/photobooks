import type { ImportProgress } from './importPhotos'

export function FilmstripStatus({
  photoCount,
  progress,
}: {
  photoCount: number
  progress: ImportProgress | null
}) {
  const showCount = photoCount > 0 || (progress?.running ?? false)

  let progressText: string | null = null
  if (progress !== null) {
    if (progress.running) {
      progressText = `Importing ${String(progress.completed)} / ${String(progress.total)}…`
    } else if (progress.errors.length > 0) {
      progressText = `Imported with ${String(progress.errors.length)} error(s)`
    }
  }

  if (!showCount && progressText === null) {
    return null
  }

  return (
    <div className="filmstrip-status" data-testid="filmstrip-status">
      {showCount ? (
        <p className="filmstrip-count" data-testid="filmstrip-count">
          {photoCount === 1 ? '1 photo' : `${String(photoCount)} photos`}
        </p>
      ) : null}
      {progressText !== null ? (
        <p
          className="import-progress"
          data-testid="import-progress"
          aria-live="polite"
        >
          {progressText}
        </p>
      ) : null}
    </div>
  )
}
