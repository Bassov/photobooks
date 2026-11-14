import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import { flushSync } from 'react-dom'
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
import { MastersCanvas } from './MastersCanvas'
import { Pasteboard } from './Pasteboard'
import { SitePreviewFrame } from './SitePreviewBar'
import { installThumbBackgroundWarm } from './thumbBackgroundWarm'
import { useChromeImport } from './useChromeImport'
import './EditorShell.css'

// Its chunk holds the site's reading room and its CSS.
const SitePreview = lazy(() => import('./SitePreview'))

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
  useEffect(() => installThumbBackgroundWarm(), [])

  const [toastQueue] = useState(() => createToastQueue())
  const [panels, setPanels] = useState(DEFAULT_EDITOR_PANELS)
  const [previewing, setPreviewing] = useState(false)
  const chromeImport = useChromeImport({
    // External store: progress ticks must not re-render Pasteboard / top bar.
    onImportProgress: setImportProgress,
  })
  // Back from the preview: commit (the editor is no longer inert), then focus
  // the Preview pill.
  const closePreview = () => {
    flushSync(() => {
      setPreviewing(false)
    })
    document.querySelector<HTMLElement>('[data-testid="present"]')?.focus()
  }

  return (
    <>
      <EditorFrame
        panels={panels}
        onPanelsChange={setPanels}
        inert={previewing}
        top={
          <EditorTopBar
            chromeImport={chromeImport}
            panels={panels}
            onPanelsChange={setPanels}
            onPresent={() => {
              setPreviewing(true)
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
          <>
            <Pasteboard fitOnOpen />
            <CoverOverlay />
            <EndpaperOverlay />
            <MastersCanvas />
            <Status
              className="editor-status-pill"
              data-testid="editor-status"
              data-pill={isStatusPillVisible(editorStatus) ? 'true' : undefined}
              politeness="polite"
            >
              {editorStatus}
            </Status>
          </>
        }
        overlay={
          <>
            <ImportErrorsPanel />
            <ToastRegion queue={toastQueue} data-testid="editor-toast-region" />
          </>
        }
      />
      {previewing && (
        <Suspense fallback={<SitePreviewFrame onExit={closePreview} />}>
          <SitePreview onExit={closePreview} />
        </Suspense>
      )}
    </>
  )
}
