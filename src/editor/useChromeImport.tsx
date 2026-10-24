import {
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { directoryHandleFromFiles } from '../photo/directoryHandleFromFiles'
import {
  canUseDirectoryPicker,
  pickFolderWithDirectoryPicker,
} from '../photo/pickPhotos'
import type { PhotobooksToastQueue } from '../ui/toastQueue'
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
import { runChromeImport } from './runChromeImport'
import {
  bindPhotoFolder,
  getPhotoRootSessionSnapshot,
  persistBoundPhotoFolder,
  photoFolderActionLabel,
  registerBoundPhotoFolderSource,
  subscribePhotoRootSession,
} from './photoRootSession'

function isE2eBuild(): boolean {
  const env = import.meta.env as { VITE_E2E?: string }
  return env.VITE_E2E === '1' || env.VITE_E2E === 'true'
}

function folderSkippedStatusText(skipped: number): string {
  return skipped === 1
    ? '1 non-image file skipped'
    : `${String(skipped)} non-image files skipped`
}

export interface ChromeImportApi {
  onChoosePhotoFolder: () => Promise<void>
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

  const runFolderImport = async (
    files: readonly File[],
    sourceRootId: string,
  ): Promise<void> => {
    const result = await runChromeImport(files, {
      source: 'folder',
      sourceRootId,
      libraryBacked: isLibraryBacked(),
      onProgress: options.onImportProgress,
      onErrors: (next) => {
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
      },
    })
    if (result.skipped > 0 && result.errors.length === 0) {
      setEditorStatus(folderSkippedStatusText(result.skipped))
    }
    applyChromeImportHint(result.imported, files.length)
  }

  const importPickedFolder = async (
    directory: FileSystemDirectoryHandle,
    files: readonly File[],
    replace: boolean,
  ): Promise<void> => {
    const { sourceRootId } = await bindPhotoFolder({
      directory,
      replace,
      // Import first; persist IDB + register FSA after so library seed/scroll
      // matches the prior setInputFiles frame-budget path.
      persist: false,
      registerSource: false,
    })
    try {
      await runFolderImport(files, sourceRootId)
    } finally {
      await persistBoundPhotoFolder(sourceRootId, directory)
      registerBoundPhotoFolderSource(sourceRootId, directory)
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
    try {
      const picked = await pickFolderWithDirectoryPicker()
      if (picked === null) {
        return
      }
      await importPickedFolder(
        picked.directory,
        picked.files,
        photoRoot.hasPhotoFolder,
      )
    } finally {
      setPickerBusy(false)
    }
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
    setPickerBusy(true)
    try {
      const directory = directoryHandleFromFiles(files)
      await importPickedFolder(directory, files, photoRoot.hasPhotoFolder)
    } finally {
      setPickerBusy(false)
    }
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
    photoFolderLabel,
    importDisabled,
    pickerBusy,
    inputs: e2eInputs,
  }
}
