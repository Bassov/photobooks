import {
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { createFsaAssetSource } from '../assets'
import { directoryHandleFromFiles } from '../photo/directoryHandleFromFiles'
import {
  canUseDirectoryPicker,
  pickFolderWithDirectoryPicker,
} from '../photo/pickPhotos'
import type { PhotobooksToastQueue } from '../ui/toastQueue'
import { registerAssetSource } from './assetSourceRegistry'
import { isImportDisabled } from './editorChromeDisabled'
import { setEditorStatus } from './editorStatus'
import { applyChromeImportHint } from './chromeImportHint'
import { filesFromInputChange } from './filesFromInputChange'
import {
  clearImportErrorsToast,
  enqueueImportErrorsToast,
  importErrorsStatusText,
} from './importErrorToast'
import { appendImportErrors, openImportErrorsPanel } from './importErrorsStore'
import type { ImportProgress } from './importPhotos'
import {
  getProjectSessionSnapshot,
  isLibraryBacked,
  subscribeProjectSession,
} from './projectSession'
import {
  bindPhotoFolder,
  cancelFolderRescan,
  clearBoundPhotoFolderForReplace,
  getPhotoRootSessionSnapshot,
  importFilesInBatches,
  importScannedEntriesInBatches,
  persistBoundPhotoFolder,
  photoFolderActionLabel,
  registerBoundPhotoFolderSource,
  subscribePhotoRootSession,
} from './photoRootSession'
import { enqueueScannedGalleryList } from './enqueueScannedGalleryList'
import { orderScannedForVisibleFirst } from './orderScannedForVisibleFirst'
import { persistScannedEntryIndex } from '../project/session/sourceRootEntryIndex'
import { isClearFolderSkipPath } from '../photo/pickPhotos'
import { getVisibleAssetIds } from '../photo/assetPool'
import { getGalleryRelativePathIndex, setImportRunning } from './bookStore'
import { yieldForPaint } from './relink/yieldForPaint'

function isE2eBuild(): boolean {
  const env = import.meta.env as { VITE_E2E?: string }
  return env.VITE_E2E === '1' || env.VITE_E2E === 'true'
}

/** Folder non-image skips → editor status line (never toast). */
export function folderSkippedStatusText(skipped: number): string {
  return skipped === 1
    ? '1 non-image file skipped'
    : `${String(skipped)} non-image files skipped`
}

export interface ChromeImportApi {
  onChoosePhotoFolder: () => Promise<void>
  /** Desktop folder dropped on the filmstrip; same path as Choose folder. */
  onDropPhotoFolder: (directory: FileSystemDirectoryHandle) => Promise<void>
  photoFolderLabel: string
  importDisabled: boolean
  pickerBusy: boolean
  inputs: ReactNode
}

export function useChromeImport(options: {
  onImportProgress: (progress: ImportProgress | null) => void
  toastQueue: PhotobooksToastQueue
}): ChromeImportApi {
  const project = useSyncExternalStore(
    subscribeProjectSession,
    getProjectSessionSnapshot,
    getProjectSessionSnapshot,
  )
  const photoRoot = useSyncExternalStore(
    subscribePhotoRootSession,
    getPhotoRootSessionSnapshot,
    getPhotoRootSessionSnapshot,
  )
  const [pickerBusy, setPickerBusy] = useState(false)
  const e2eFolderInputId = useId()
  const e2eFolderInputRef = useRef<HTMLInputElement>(null)

  const writeBlocked = project.accessPhase === 'locked-elsewhere'
  const importDisabled = isImportDisabled(pickerBusy, writeBlocked)
  const photoFolderLabel = photoFolderActionLabel(photoRoot.hasPhotoFolder)

  const reportErrors = (
    next: Parameters<typeof appendImportErrors>[0],
  ): void => {
    if (next.length === 0) {
      clearImportErrorsToast(options.toastQueue)
      return
    }
    const snapshot = [...next]
    appendImportErrors(snapshot)
    setEditorStatus(importErrorsStatusText(snapshot))
    enqueueImportErrorsToast(options.toastQueue, snapshot, () => {
      openImportErrorsPanel()
    })
  }

  const importPickedFolder = async (
    directory: FileSystemDirectoryHandle,
    knownFiles: readonly File[] | null,
    replace: boolean,
  ): Promise<void> => {
    cancelFolderRescan()
    const earlyProgress =
      replace && (knownFiles === null || knownFiles.length > 0)
    const priorRootCleared = replace
      ? clearBoundPhotoFolderForReplace()
      : Promise.resolve()
    if (earlyProgress) {
      flushSync(() => {
        setImportRunning(true, knownFiles?.length ?? 1)
        options.onImportProgress({
          total: knownFiles?.length ?? 1,
          completed: 0,
          errors: [],
          running: true,
        })
      })
    }
    setPickerBusy(true)
    try {
      const { sourceRootId } = await bindPhotoFolder({
        directory,
        replace: false,
        persist: false,
        registerSource: false,
      })
      // Register FSA early so worker scanRoot / path resolve work during import.
      registerAssetSource(
        sourceRootId,
        createFsaAssetSource({ rootId: sourceRootId, directory }),
      )
      const persistRootAfterFirstBatch = async (): Promise<void> => {
        await priorRootCleared
        await persistBoundPhotoFolder(sourceRootId, directory)
        registerBoundPhotoFolderSource(sourceRootId, directory)
      }
      try {
        let result
        if (knownFiles !== null) {
          result = await importFilesInBatches(knownFiles, {
            sourceRootId,
            libraryBacked: isLibraryBacked(),
            onProgress: options.onImportProgress,
            onErrors: reportErrors,
            onFirstBatchYielded: persistRootAfterFirstBatch,
          })
        } else {
          options.onImportProgress({
            total: 1,
            completed: 0,
            errors: [],
            running: true,
          })
          const source = createFsaAssetSource({
            rootId: sourceRootId,
            directory,
          })
          registerAssetSource(sourceRootId, source)
          const scanned = await source.scanRoot(sourceRootId)
          if (!scanned.ok) {
            options.onImportProgress(null)
            setEditorStatus('Could not read photo folder')
            return
          }
          // Always-walk result: persist entry index, then list-first placeholders.
          await persistScannedEntryIndex(sourceRootId, scanned.value)
          enqueueScannedGalleryList(sourceRootId, scanned.value)
          const folderSkipped = scanned.value.filter((entry) =>
            isClearFolderSkipPath(entry.relativePath),
          ).length
          // Resolve image-like + extension-less (HEIC sniff); skip clear non-images.
          const forImport = scanned.value.filter(
            (entry) => !isClearFolderSkipPath(entry.relativePath),
          )
          options.onImportProgress({
            total: Math.max(forImport.length, 1),
            completed: 0,
            errors: [],
            running: true,
          })
          // Let filmstrip mount so visible ids prefer first-window 320 decode.
          await yieldForPaint()
          await yieldForPaint()
          const visibleIds = new Set(getVisibleAssetIds())
          const visiblePaths = new Set<string>()
          for (const [path, id] of getGalleryRelativePathIndex()) {
            if (visibleIds.has(id)) {
              visiblePaths.add(path)
            }
          }
          const ordered = orderScannedForVisibleFirst(forImport, visiblePaths)
          const imported = await importScannedEntriesInBatches(
            directory,
            ordered,
            {
              sourceRootId,
              libraryBacked: isLibraryBacked(),
              listAlreadyEnqueued: true,
              onProgress: options.onImportProgress,
              onErrors: reportErrors,
              onFirstBatchYielded: persistRootAfterFirstBatch,
            },
          )
          result = {
            ...imported,
            skipped: imported.skipped + folderSkipped,
          }
        }
        if (result.skipped > 0 && result.errors.length === 0) {
          setEditorStatus(folderSkippedStatusText(result.skipped))
        }
        applyChromeImportHint(
          result.imported,
          knownFiles?.length ?? result.imported + result.skipped,
        )
      } finally {
        // Idempotent if onFirstBatchYielded already persisted for mid-import reload.
        await priorRootCleared
        await persistBoundPhotoFolder(sourceRootId, directory)
        registerBoundPhotoFolderSource(sourceRootId, directory)
      }
    } catch (error) {
      if (earlyProgress) {
        setImportRunning(false)
        options.onImportProgress(null)
      }
      throw error
    } finally {
      setPickerBusy(false)
    }
  }

  const onChoosePhotoFolder = async (): Promise<void> => {
    if (!canUseDirectoryPicker()) {
      setEditorStatus('Photo folders require Chromium with File System Access')
      return
    }
    if (photoRoot.hasPhotoFolder) {
      const ok = window.confirm(
        'Change photo folder? This replaces the current folder and removes photos imported from it.',
      )
      if (!ok) {
        return
      }
    }
    setPickerBusy(true)
    let picked: Awaited<ReturnType<typeof pickFolderWithDirectoryPicker>> = null
    try {
      picked = await pickFolderWithDirectoryPicker()
    } finally {
      setPickerBusy(false)
    }
    if (picked === null) {
      return
    }
    await importPickedFolder(picked.directory, null, photoRoot.hasPhotoFolder)
  }

  const onDropPhotoFolder = async (
    directory: FileSystemDirectoryHandle,
  ): Promise<void> => {
    if (importDisabled) {
      return
    }
    if (photoRoot.hasPhotoFolder) {
      const ok = window.confirm(
        'Change photo folder? This replaces the current folder and removes photos imported from it.',
      )
      if (!ok) {
        return
      }
    }
    await importPickedFolder(directory, null, photoRoot.hasPhotoFolder)
  }

  const onE2eFolderInputChange = async (
    input: HTMLInputElement,
  ): Promise<void> => {
    const files = filesFromInputChange(input)
    if (files === null) {
      return
    }
    if (photoRoot.hasPhotoFolder) {
      const ok = window.confirm(
        'Change photo folder? This replaces the current folder and removes photos imported from it.',
      )
      if (!ok) {
        return
      }
    }
    const directory = directoryHandleFromFiles(files)
    await importPickedFolder(directory, files, photoRoot.hasPhotoFolder)
  }

  // E2E-only: plain multi-file input (not webkitdirectory) so Playwright can
  // setInputFiles(paths). Still runs the same bind+import folder path.
  const e2eInputs = isE2eBuild() ? (
    <input
      id={e2eFolderInputId}
      ref={e2eFolderInputRef}
      data-testid="e2e-photo-folder-input"
      type="file"
      accept="image/*"
      multiple
      className="photo-file-input"
      style={{ display: 'none' }}
      disabled={importDisabled}
      onChange={(event) => {
        void onE2eFolderInputChange(event.currentTarget)
      }}
    />
  ) : null

  return {
    onChoosePhotoFolder,
    onDropPhotoFolder,
    photoFolderLabel,
    importDisabled,
    pickerBusy,
    inputs: e2eInputs,
  }
}
