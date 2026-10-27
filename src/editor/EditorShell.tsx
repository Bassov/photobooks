import { useEffect, useState, useSyncExternalStore } from 'react'
import { Status } from '../ui/Status'
import { ToastRegion } from '../ui/Toast'
import { createToastQueue } from '../ui/toastQueue'
import { getEditorStatus, subscribeEditorStatus } from './editorStatus'
import { EditorFrame, type EditorPanels } from './EditorFrame'
import { EditorTopBar } from './EditorTopBar'
import { FilmstripDock } from './FilmstripDock'
import { ImportErrorsPanel } from './ImportErrorsPanel'
import { InspectorStub } from './InspectorStub'
import { installDocumentDragGesture } from './editorGesture'
import { installEditorKeys } from './galleryDrop'
import { setImportProgress } from './importProgressStore'
import { Pasteboard } from './Pasteboard'
import { SpreadsPanel } from './SpreadsPanel'
import { useChromeImport } from './useChromeImport'
import './EditorShell.css'

const INITIAL_PANELS: EditorPanels = { l: true, b: true, r: false }

export function EditorShell() {
  const editorStatus = useSyncExternalStore(
    subscribeEditorStatus,
    getEditorStatus,
    getEditorStatus,
  )
  useEffect(() => installEditorKeys(), [])
  useEffect(() => installDocumentDragGesture(), [])

  const [toastQueue] = useState(() => createToastQueue())
  const [panels, setPanels] = useState(INITIAL_PANELS)
  const chromeImport = useChromeImport({
    // External store: progress ticks must not re-render Pasteboard / top bar.
    onImportProgress: setImportProgress,
    toastQueue,
  })

  return (
    <EditorFrame
      panels={panels}
      onPanelsChange={setPanels}
      top={
        <EditorTopBar
          chromeImport={chromeImport}
          panels={panels}
          onPanelsChange={setPanels}
        />
      }
      left={<SpreadsPanel />}
      right={<InspectorStub />}
      dock={
        <FilmstripDock onDropPhotoFolder={chromeImport.onDropPhotoFolder} />
      }
      canvas={<Pasteboard chromeImport={chromeImport} />}
      overlay={
        <>
          <Status
            className="editor-live"
            data-testid="editor-status"
            politeness="polite"
          >
            {editorStatus}
          </Status>
          <ImportErrorsPanel />
          <ToastRegion queue={toastQueue} data-testid="editor-toast-region" />
        </>
      }
    />
  )
}
