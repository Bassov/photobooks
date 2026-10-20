import { ProgressBar } from '../ui/ProgressBar'
import { Status } from '../ui/Status'
import type { ImportProgress } from './importPhotos'

export function FilmstripStatus({
  photoCount,
  progress,
}: {
  photoCount: number
  progress: ImportProgress | null
}) {
  const running = progress?.running === true
  const showCount = photoCount > 0 || running

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
    <Status className="filmstrip-status" data-testid="filmstrip-status">
      {showCount ? (
        <span className="filmstrip-count" data-testid="filmstrip-count">
          {photoCount === 1 ? '1 photo' : `${String(photoCount)} photos`}
        </span>
      ) : null}
      {progress?.running ? (
        <ProgressBar
          className="filmstrip-import-progress"
          aria-label="Importing"
          value={progress.completed}
          maxValue={progress.total > 0 ? progress.total : 1}
          minValue={0}
        />
      ) : null}
      {progressText !== null ? (
        <span className="import-progress" data-testid="import-progress">
          {progressText}
        </span>
      ) : null}
    </Status>
  )
}
