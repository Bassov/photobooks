import { useSyncExternalStore, type ReactNode } from 'react'
import { ProgressBar } from '../ui/ProgressBar'
import { Status } from '../ui/Status'
import {
  filmstripImportErrorsActionStyle,
  filmstripImportProgressStyle,
} from './filmstripChromeStyles'
import {
  getFolderRescanProgress,
  subscribeFolderRescanProgress,
} from './photoRootSession'
import {
  getImportProgress,
  subscribeImportProgress,
} from './importProgressStore'
import {
  getImportErrors,
  openImportErrorsPanel,
  subscribeImportErrors,
} from './importErrorsStore'

export function FilmstripStatus({ photoCount }: { photoCount: number }) {
  const progress = useSyncExternalStore(
    subscribeImportProgress,
    getImportProgress,
    getImportProgress,
  )
  const storeErrors = useSyncExternalStore(
    subscribeImportErrors,
    getImportErrors,
    getImportErrors,
  )
  const rescan = useSyncExternalStore(
    subscribeFolderRescanProgress,
    getFolderRescanProgress,
    getFolderRescanProgress,
  )
  const running = progress?.running === true
  const rescanning = rescan?.running === true
  const showCount = photoCount > 0 || running || rescanning
  const errorCount = storeErrors.length

  let progressNode: ReactNode = null
  if (progress?.running) {
    progressNode = (
      <span className="import-progress" data-testid="import-progress">
        {`Importing ${String(progress.completed)} / ${String(progress.total)}…`}
      </span>
    )
  } else if (rescanning) {
    const label =
      rescan.phase === 'priority' ? 'Checking photos' : 'Scanning folder'
    progressNode = (
      <span className="import-progress" data-testid="folder-rescan-progress">
        {`${label} ${String(rescan.completed)} / ${String(rescan.total)}…`}
      </span>
    )
  } else if (errorCount > 0) {
    progressNode = (
      <button
        type="button"
        className="import-progress"
        style={filmstripImportErrorsActionStyle}
        data-testid="import-errors"
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

  const barRunning = running || rescanning
  const barValue = running
    ? progress.completed
    : rescanning
      ? rescan.completed
      : 0
  const rawBarMax = running ? progress.total : rescanning ? rescan.total : 1
  const barMax = Math.max(rawBarMax, 1)

  return (
    <Status className="filmstrip-status" data-testid="filmstrip-status">
      {showCount ? (
        <span className="filmstrip-count" data-testid="filmstrip-count">
          {photoCount === 1 ? '1 photo' : `${String(photoCount)} photos`}
        </span>
      ) : null}
      {barRunning ? (
        <ProgressBar
          style={filmstripImportProgressStyle}
          aria-label={running ? 'Importing' : 'Checking photos'}
          value={barValue}
          maxValue={barMax}
          minValue={0}
        />
      ) : null}
      {progressNode}
    </Status>
  )
}
