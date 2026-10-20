import {
  useId,
  useRef,
  useSyncExternalStore,
  type ReactElement,
  type RefObject,
} from 'react'
import { photoInputAccept } from '../../photo/pickPhotos'
import { getAssetDisplayName } from '../bookStore'
import {
  bindFolderInput,
  clickFolderInput,
  folderInputChanged,
  resolveAndMaybeClose,
  skipRelinkDialog,
} from './dialogActions'
import {
  badgeClassName,
  buildRelinkDialogView,
  rowBadgeLabel,
  rowStatusAttr,
} from './dialogView'
import {
  getFoundRelinkIds,
  getRelinkProgress,
  getRelinkStatuses,
  isRelinkDialogOpen,
  subscribeRelink,
} from './statusStore'
function RelinkScanProgress(): ReactElement | null {
  const progress = useSyncExternalStore(
    subscribeRelink,
    getRelinkProgress,
    getRelinkProgress,
  )
  if (!progress?.running) {
    return null
  }
  const pct =
    progress.total <= 0
      ? 0
      : Math.min(100, Math.round((100 * progress.completed) / progress.total))
  return (
    <div className="relink-scan-progress" data-testid="relink-scan-progress">
      Hashing in worker · {pct}%
    </div>
  )
}

function RelinkProblemList(): ReactElement {
  const statuses = useSyncExternalStore(
    subscribeRelink,
    getRelinkStatuses,
    getRelinkStatuses,
  )
  const found = useSyncExternalStore(
    subscribeRelink,
    getFoundRelinkIds,
    getFoundRelinkIds,
  )
  const view = buildRelinkDialogView(statuses, found, null, 'problems')
  return (
    <div className="relink-list" data-testid="relink-list" tabIndex={0}>
      {view.rows.length === 0 ? (
        <p className="relink-list-empty" data-testid="relink-empty">
          Everything is linked.
        </p>
      ) : (
        view.rows.map((row) => (
          <div
            key={row.assetId}
            className="relink-row"
            data-testid="relink-row"
            data-asset-id={row.assetId}
            data-status={rowStatusAttr(row.found, row.status)}
          >
            <div className="relink-row-name">
              {getAssetDisplayName(row.assetId)}
            </div>
            <span className={badgeClassName(row.found, row.status)}>
              {rowBadgeLabel(row.found, row.status)}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

function RelinkRescanButton(props: {
  folderRef: RefObject<HTMLInputElement | null>
}): ReactElement {
  const progress = useSyncExternalStore(
    subscribeRelink,
    getRelinkProgress,
    getRelinkProgress,
  )
  const scanning = progress?.running === true
  return (
    <button
      type="button"
      className="relink-btn relink-btn-outline"
      data-testid="relink-rescan"
      disabled={scanning}
      onClick={() => {
        clickFolderInput(props.folderRef.current)
      }}
    >
      Rescan folder…
    </button>
  )
}

function RelinkDialogFooter(props: {
  onResolve: () => Promise<number>
  folderRef: RefObject<HTMLInputElement | null>
}): ReactElement {
  // Statuses/found only — progress ticks must not rebuild Resolve chrome.
  const statuses = useSyncExternalStore(
    subscribeRelink,
    getRelinkStatuses,
    getRelinkStatuses,
  )
  const found = useSyncExternalStore(
    subscribeRelink,
    getFoundRelinkIds,
    getFoundRelinkIds,
  )
  const view = buildRelinkDialogView(statuses, found, null, 'problems')
  return (
    <footer className="relink-dialog-foot">
      <button
        type="button"
        className="relink-btn relink-btn-ghost"
        data-testid="relink-skip"
        onClick={skipRelinkDialog}
      >
        Skip for now
      </button>
      <RelinkRescanButton folderRef={props.folderRef} />
      <button
        type="button"
        className="relink-btn"
        data-testid="relink-resolve"
        disabled={view.resolveDisabled}
        onClick={() => {
          void resolveAndMaybeClose(props.onResolve)
        }}
      >
        {view.resolveText}
      </button>
    </footer>
  )
}

/**
 * Minimal missing-assets dialog shell. Matching / progress / apply live in
 * pure modules; chrome polish deferred to `missing-assets-relink-dialog-polish`.
 * Progress ticks subscribe separately so the problem list does not re-render
 * every hash (keeps filmstrip scroll LoAF-free during rescan).
 */
export function RelinkDialog(props: {
  onRescanFiles: (files: readonly File[]) => Promise<unknown>
  onResolve: () => Promise<number>
}) {
  const open = useSyncExternalStore(
    subscribeRelink,
    isRelinkDialogOpen,
    isRelinkDialogOpen,
  )
  const statuses = useSyncExternalStore(
    subscribeRelink,
    getRelinkStatuses,
    getRelinkStatuses,
  )
  const found = useSyncExternalStore(
    subscribeRelink,
    getFoundRelinkIds,
    getFoundRelinkIds,
  )
  const folderRef = useRef<HTMLInputElement>(null)
  const folderId = useId()

  if (!open) {
    return null
  }

  const view = buildRelinkDialogView(statuses, found, null, 'problems')

  return (
    <div
      className="relink-dialog-backdrop"
      data-testid="relink-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relink-dialog-title"
    >
      <div className="relink-dialog">
        <header className="relink-dialog-head">
          <h2 id="relink-dialog-title" className="relink-dialog-title">
            {view.title}
          </h2>
          <p className="relink-dialog-sub">
            Rescan a folder to match photos by content hash. Skip keeps the book
            editable with hatched frames.
          </p>
        </header>

        <RelinkScanProgress />
        <RelinkProblemList />
        <RelinkDialogFooter onResolve={props.onResolve} folderRef={folderRef} />

        <input
          id={folderId}
          ref={(el) => {
            bindFolderInput(el, folderRef)
          }}
          className="relink-file-input"
          data-testid="relink-folder-input"
          type="file"
          accept={photoInputAccept()}
          multiple
          onChange={(event) => {
            const target = event.currentTarget
            folderInputChanged(target.files, props.onRescanFiles, () => {
              target.value = ''
            })
          }}
        />
      </div>
    </div>
  )
}
