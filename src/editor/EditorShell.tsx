import { useEffect, useState, useSyncExternalStore } from 'react'
import { Status } from '../ui/Status'
import { ToastRegion } from '../ui/Toast'
import { createToastQueue } from '../ui/toastQueue'
import { getEditorStatus, subscribeEditorStatus } from './editorStatus'
import { Filmstrip } from './Filmstrip'
import { installDocumentDragGesture } from './editorGesture'
import { installEditorKeys } from './galleryDrop'
import type { ImportProgress } from './importPhotos'
import { Pasteboard } from './Pasteboard'
import { EditorTopBar } from './EditorTopBar'
import './EditorShell.css'

export function EditorShell() {
  const editorStatus = useSyncExternalStore(
    subscribeEditorStatus,
    getEditorStatus,
    getEditorStatus,
  )
  useEffect(() => installEditorKeys(), [])
  useEffect(() => installDocumentDragGesture(), [])

  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [toastQueue] = useState(() => createToastQueue())

  return (
    <div className="editor-shell" data-testid="editor-shell">
      <Status
        className="editor-live"
        data-testid="editor-status"
        politeness="polite"
      >
        {editorStatus}
      </Status>
      <EditorTopBar onImportProgress={setProgress} toastQueue={toastQueue} />

      <main className="editor-workspace" data-testid="editor-workspace">
        <Pasteboard />
      </main>

      <Filmstrip progress={progress} />
      <ToastRegion queue={toastQueue} data-testid="editor-toast-region" />
    </div>
  )
}
