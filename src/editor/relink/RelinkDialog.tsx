import {
  useId,
  useRef,
  useSyncExternalStore,
  type ReactElement,
  type RefObject,
} from 'react'
import { photoInputAccept } from '../../photo/pickPhotos'
import { Button } from '../../ui/Button'
import { getAssetDisplayName } from '../bookStore'
import {
  bindFolderInput,
  clickFolderInput,
  folderInputChanged,
  resolveAndMaybeClose,
  skipRelinkDialog,
} from './dialogActions'
import {
  buildRelinkDialogView,
  rowBadgeLabel,
  rowStatusAttr,
} from './dialogView'
import {
  badgeStyle,
  relinkBackdropStyle,
  relinkDialogStyle,
  relinkEmptyStyle,
  relinkFileInputStyle,
  relinkFootStyle,
  relinkHeadStyle,
  relinkListStyle,
  relinkProgressStyle,
  relinkRowNameStyle,
  relinkRowStyle,
  relinkSubStyle,
  relinkTitleStyle,
} from './relinkStyles'
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
    <div style={relinkProgressStyle} data-testid="relink-scan-progress">
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
    <div style={relinkListStyle} data-testid="relink-list" tabIndex={0}>
      {view.rows.length === 0 ? (
        <p style={relinkEmptyStyle} data-testid="relink-empty">
          Everything is linked.
        </p>
      ) : (
        view.rows.map((row) => (
          <div
            key={row.assetId}
            style={relinkRowStyle}
            data-testid="relink-row"
            data-asset-id={row.assetId}
            data-status={rowStatusAttr(row.found, row.status)}
          >
            <div style={relinkRowNameStyle}>
              {getAssetDisplayName(row.assetId)}
            </div>
            <span style={badgeStyle(row.found, row.status)}>
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
    <Button
      variant="secondary"
      size="sm"
      data-testid="relink-rescan"
      isDisabled={scanning}
      onPress={() => {
        clickFolderInput(props.folderRef.current)
      }}
    >
      Rescan folder…
    </Button>
  )
}

function RelinkDialogFooter(props: {
  onResolve: () => Promise<number>
  folderRef: RefObject<HTMLInputElement | null>
}): ReactElement {
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
    <footer style={relinkFootStyle}>
      <Button
        variant="ghost"
        size="sm"
        data-testid="relink-skip"
        onPress={skipRelinkDialog}
      >
        Skip for now
      </Button>
      <RelinkRescanButton folderRef={props.folderRef} />
      <Button
        size="sm"
        data-testid="relink-resolve"
        isDisabled={view.resolveDisabled}
        onPress={() => {
          void resolveAndMaybeClose(props.onResolve)
        }}
      >
        {view.resolveText}
      </Button>
    </footer>
  )
}

/**
 * Minimal missing-assets dialog shell. Matching / progress / apply live in
 * pure modules; dialog chrome stays minimal in this slice.
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
      style={relinkBackdropStyle}
      data-testid="relink-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relink-dialog-title"
    >
      <div style={relinkDialogStyle}>
        <header style={relinkHeadStyle}>
          <h2 id="relink-dialog-title" style={relinkTitleStyle}>
            {view.title}
          </h2>
          <p style={relinkSubStyle}>
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
          style={relinkFileInputStyle}
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
