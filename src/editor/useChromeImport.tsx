import {
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  canUseDirectoryPicker,
  canUseOpenFilePicker,
  photoInputAccept,
  pickFolderWithDirectoryPicker,
  pickPhotosWithFilePicker,
} from '../photo/pickPhotos'
import type { PhotobooksToastQueue } from '../ui/toastQueue'
import { clickIfPresent } from './clickIfPresent'
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
  subscribeProjectSession,
} from './projectSession'
import { runChromeImport } from './runChromeImport'

function folderSkippedStatusText(skipped: number): string {
  return skipped === 1
    ? '1 non-image file skipped'
    : `${String(skipped)} non-image files skipped`
}

export interface ChromeImportApi {
  onAddPhotos: () => Promise<void>
  onAddFolder: () => Promise<void>
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
  const filesInputId = useId()
  const folderInputId = useId()
  const filesInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [pickerBusy, setPickerBusy] = useState(false)

  const writeBlocked = project.accessPhase === 'locked-elsewhere'
  const importDisabled = isImportDisabled(pickerBusy, writeBlocked)

  const runImport = async (
    files: readonly File[],
    source: 'photos' | 'folder',
  ): Promise<void> => {
    const importSource = source === 'folder' ? 'folder' : 'files'
    const result = await runChromeImport(files, {
      source: importSource,
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
    applyChromeImportHint(source, result.imported, files.length)
  }

  const onAddPhotos = async (): Promise<void> => {
    setPickerBusy(true)
    try {
      if (canUseOpenFilePicker()) {
        const files = await pickPhotosWithFilePicker()
        if (files !== null) {
          await runImport(files, 'photos')
        }
        return
      }
      clickIfPresent(filesInputRef.current)
    } finally {
      setPickerBusy(false)
    }
  }

  const onAddFolder = async (): Promise<void> => {
    setPickerBusy(true)
    try {
      if (canUseDirectoryPicker()) {
        const files = await pickFolderWithDirectoryPicker()
        if (files !== null) {
          await runImport(files, 'folder')
        }
        return
      }
      clickIfPresent(folderInputRef.current)
    } finally {
      setPickerBusy(false)
    }
  }

  const inputs = (
    <>
      <input
        id={filesInputId}
        ref={filesInputRef}
        className="photo-file-input"
        data-testid="photo-file-input"
        type="file"
        accept={photoInputAccept()}
        multiple
        onChange={(event) => {
          const files = filesFromInputChange(event.currentTarget)
          if (files === null) {
            return
          }
          void runImport(files, 'photos')
        }}
      />
      <input
        id={folderInputId}
        ref={(element) => {
          folderInputRef.current = element
          element?.setAttribute('webkitdirectory', '')
        }}
        className="photo-file-input"
        data-testid="folder-file-input"
        type="file"
        accept={photoInputAccept()}
        multiple
        onChange={(event) => {
          const files = filesFromInputChange(event.currentTarget)
          if (files === null) {
            return
          }
          void runImport(files, 'folder')
        }}
      />
    </>
  )

  return { onAddPhotos, onAddFolder, importDisabled, pickerBusy, inputs }
}
