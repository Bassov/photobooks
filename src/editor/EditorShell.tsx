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
import { installCropGesture } from './cropGesture'
import { installDocumentDragGesture } from './editorGesture'
import { installEditorKeys } from './galleryDrop'
import { setImportProgress } from './importProgressStore'
import { Pasteboard } from './Pasteboard'
import { PresentationMode } from './PresentationMode'
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
  useEffect(() => installCropGesture(), [])

  const [toastQueue] = useState(() => createToastQueue())
  const [panels, setPanels] = useState(INITIAL_PANELS)
  const [presenting, setPresenting] = useState(false)
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
          onPresent={() => {
            setPresenting(true)
          }}
        />
      }
      left={<SpreadsPanel />}
      right={<InspectorStub />}
      dock={<FilmstripDock />}
      canvas={presenting ? null : <Pasteboard chromeImport={chromeImport} />}
      overlay={
        <>
          {presenting ? (
            <PresentationMode
              onExit={() => {
                setPresenting(false)
              }}
            />
          ) : null}
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
