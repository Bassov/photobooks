import { useSyncExternalStore, type ReactNode } from 'react'
import { ProgressBar } from '../ui/ProgressBar'
import { Status } from '../ui/Status'
import { filmstripImportProgressStyle } from './filmstripChromeStyles'
import type { ImportProgress } from './importPhotos'
import {
  getImportErrors,
  openImportErrorsPanel,
  subscribeImportErrors,
} from './importErrorsStore'

export function FilmstripStatus({
  photoCount,
  progress,
}: {
  photoCount: number
  progress: ImportProgress | null
}) {
  const storeErrors = useSyncExternalStore(
    subscribeImportErrors,
    getImportErrors,
    getImportErrors,
  )
  const running = progress?.running === true
  const showCount = photoCount > 0 || running
  const errorCount = storeErrors.length

  let progressNode: ReactNode = null
  if (progress?.running) {
    progressNode = (
      <span className="import-progress" data-testid="import-progress">
        {`Importing ${String(progress.completed)} / ${String(progress.total)}…`}
      </span>
    )
  } else if (errorCount > 0) {
    progressNode = (
      <button
        type="button"
        className="import-progress import-progress--action"
        data-testid="import-progress"
        onClick={() => {
          openImportErrorsPanel()
        }}
      >
        {`Imported with ${String(errorCount)} error(s)`}
      </button>
    )
  }

  if (!showCount && progressNode === null) {
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
          style={filmstripImportProgressStyle}
          aria-label="Importing"
          value={progress.completed}
          maxValue={progress.total > 0 ? progress.total : 1}
          minValue={0}
        />
      ) : null}
      {progressNode}
    </Status>
  )
}
