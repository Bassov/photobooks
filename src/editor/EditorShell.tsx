import { useEffect, useState, useSyncExternalStore } from 'react'
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

  return (
    <div className="editor-shell" data-testid="editor-shell">
      <p className="editor-live" data-testid="editor-status" aria-live="polite">
        {editorStatus}
      </p>
      <EditorTopBar onImportProgress={setProgress} />

      <main className="editor-workspace" data-testid="editor-workspace">
        <Pasteboard />
      </main>

      <Filmstrip progress={progress} />
    </div>
  )
}
