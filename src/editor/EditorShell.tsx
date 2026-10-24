import { useEffect, useState, useSyncExternalStore } from 'react'
import { Status } from '../ui/Status'
import { ToastRegion } from '../ui/Toast'
import { createToastQueue } from '../ui/toastQueue'
import { getEditorStatus, subscribeEditorStatus } from './editorStatus'
import { Filmstrip } from './Filmstrip'
import { ImportErrorsPanel } from './ImportErrorsPanel'
import { installDocumentDragGesture } from './editorGesture'
import { installEditorKeys } from './galleryDrop'
import { setImportProgress } from './importProgressStore'
import { Pasteboard } from './Pasteboard'
import { EditorTopBar } from './EditorTopBar'
import { useChromeImport } from './useChromeImport'
import './EditorShell.css'

export function EditorShell() {
  const editorStatus = useSyncExternalStore(
    subscribeEditorStatus,
    getEditorStatus,
    getEditorStatus,
  )
  useEffect(() => installEditorKeys(), [])
  useEffect(() => installDocumentDragGesture(), [])

  const [toastQueue] = useState(() => createToastQueue())
  const chromeImport = useChromeImport({
    // External store: progress ticks must not re-render Pasteboard / top bar.
    onImportProgress: setImportProgress,
    toastQueue,
  })

  return (
    <div className="editor-shell" data-testid="editor-shell">
      <Status
        className="editor-live"
        data-testid="editor-status"
        politeness="polite"
      >
        {editorStatus}
      </Status>
      <EditorTopBar chromeImport={chromeImport} />

      <main className="editor-workspace" data-testid="editor-workspace">
        <Pasteboard chromeImport={chromeImport} />
      </main>

      <Filmstrip />
      <ImportErrorsPanel />
      <ToastRegion queue={toastQueue} data-testid="editor-toast-region" />
    </div>
  )
}
