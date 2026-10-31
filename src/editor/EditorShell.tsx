import { useEffect, useState, useSyncExternalStore } from 'react'
import { Status } from '../ui/Status'
import { ToastRegion } from '../ui/Toast'
import { createToastQueue } from '../ui/toastQueue'
import {
  getEditorStatus,
  isStatusPillVisible,
  subscribeEditorStatus,
} from './editorStatus'
import { EditorFrame } from './EditorFrame'
import { DEFAULT_EDITOR_PANELS } from './editorChromePanels'
import { EditorTopBar } from './EditorTopBar'
import { FilmstripDock } from './FilmstripDock'
import { ImportErrorsPanel } from './ImportErrorsPanel'
import { CoverOverlay } from './CoverOverlay'
import { EndpaperOverlay } from './EndpaperOverlay'
import { Inspector } from './Inspector'
import { LeftPanel } from './LeftPanel'
import { installCropGesture } from './cropGesture'
import { installDocumentDragGesture } from './editorGesture'
import { installFrameGesture } from './frameGesture'
import { installFrameHandleGesture } from './frameHandleGesture'
import { installEditorKeys } from './galleryDrop'
import { setImportProgress } from './importProgressStore'
import { MastersCanvasStub } from './MastersCanvasStub'
import { Pasteboard } from './Pasteboard'
import { PresentationMode } from './PresentationMode'
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
  useEffect(() => installCropGesture(), [])
  useEffect(() => installFrameGesture(), [])
  useEffect(() => installFrameHandleGesture(), [])

  const [toastQueue] = useState(() => createToastQueue())
  const [panels, setPanels] = useState(DEFAULT_EDITOR_PANELS)
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
      right={<Inspector />}
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
            <EndpaperOverlay />
            <MastersCanvasStub />
            <Status
              className="editor-status-pill"
              data-testid="editor-status"
              data-pill={isStatusPillVisible(editorStatus) ? 'true' : undefined}
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
