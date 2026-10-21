import {
  useId,
  useRef,
  useSyncExternalStore,
  type ReactElement,
  type RefObject,
} from 'react'
import { photoInputAccept } from '../../photo/pickPhotos'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Dialog, DialogTitle } from '../../ui/Dialog'
import { getAssetDisplayName } from '../bookStore'
import {
  bindFolderInput,
  clearFolderInputValue,
  clickFolderInput,
  folderInputChanged,
  onRelinkDialogOpenChange,
  resolveAndMaybeClose,
  skipRelinkDialog,
} from './dialogActions'
import {
  buildRelinkDialogView,
  rowBadgeColor,
  rowBadgeLabel,
  rowStatusAttr,
} from './dialogView'
import {
  relinkEmptyStyle,
  relinkFileInputStyle,
  relinkFootStyle,
  relinkListStyle,
  relinkProgressStyle,
  relinkRowNameStyle,
  relinkRowStyle,
  relinkSubStyle,
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
    <div
      style={relinkListStyle}
      data-testid="relink-list"
      data-scrollport="relink-list"
      tabIndex={0}
    >
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
            <Badge
              color={rowBadgeColor(row.found, row.status)}
              size="sm"
              type="pill-color"
            >
              {rowBadgeLabel(row.found, row.status)}
            </Badge>
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
 * Missing-assets dialog on shared Dialog / Badge primitives. Matching /
 * progress / apply live in pure modules.
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
  const view = buildRelinkDialogView(statuses, found, null, 'problems')

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onRelinkDialogOpenChange}
      isDismissable={false}
      className="relink-dialog-panel"
      data-testid="relink-dialog"
      style={{
        width: 'min(760px, calc(100vw - 2rem))',
        maxHeight: 'min(520px, calc(100vh - 2rem))',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
      }}
    >
      <header style={{ padding: '1.1rem 1.35rem 0.6rem' }}>
        <DialogTitle>{view.title}</DialogTitle>
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
            clearFolderInputValue(target)
          })
        }}
      />
    </Dialog>
  )
}
