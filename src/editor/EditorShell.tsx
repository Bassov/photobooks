import { useEffect, useState, useSyncExternalStore } from 'react'
import { Status } from '../ui/Status'
import { ToastRegion } from '../ui/Toast'
import { createToastQueue } from '../ui/toastQueue'
import { getEditorStatus, subscribeEditorStatus } from './editorStatus'
import { EditorFrame, type EditorPanels } from './EditorFrame'
import { EditorTopBar } from './EditorTopBar'
import { FilmstripDock } from './FilmstripDock'
import { ImportErrorsPanel } from './ImportErrorsPanel'
import { CoverOverlay } from './CoverOverlay'
import { Inspector } from './Inspector'
import { LeftPanel } from './LeftPanel'
import { installCropGesture } from './cropGesture'
import { installDocumentDragGesture } from './editorGesture'
import { installFrameGesture } from './frameGesture'
import { installFrameHandleGesture } from './frameHandleGesture'
import { installEditorKeys } from './galleryDrop'
import { setImportProgress } from './importProgressStore'
import { Pasteboard } from './Pasteboard'
import { PresentationMode } from './PresentationMode'
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
  useEffect(() => installFrameGesture(), [])
  useEffect(() => installFrameHandleGesture(), [])

  const [toastQueue] = useState(() => createToastQueue())
  const [panels, setPanels] = useState(INITIAL_PANELS)
  const [presenting, setPresenting] = useState(false)
  const chromeImport = useChromeImport({
    // External store: progress ticks must not re-render Pasteboard / top bar.
    onImportProgress: setImportProgress,
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
      left={<LeftPanel toastQueue={toastQueue} />}
      right={(collapse) => <Inspector onCollapse={collapse} />}
      dock={
        <FilmstripDock
          onDropPhotoFolder={chromeImport.onDropPhotoFolder}
          onChoosePhotoFolder={chromeImport.onChoosePhotoFolder}
          importDisabled={chromeImport.importDisabled}
        />
      }
      canvas={
        presenting ? null : (
          <>
            <Pasteboard fitOnOpen />
            <CoverOverlay />
            <Status
              className="editor-status-pill"
              data-testid="editor-status"
              politeness="polite"
            >
              {editorStatus}
            </Status>
          </>
        )
      }
      overlay={
        <>
          {presenting ? (
            <PresentationMode
              onExit={() => {
                setPresenting(false)
              }}
            />
          ) : null}
          <ImportErrorsPanel />
          <ToastRegion queue={toastQueue} data-testid="editor-toast-region" />
        </>
      }
    />
  )
}
