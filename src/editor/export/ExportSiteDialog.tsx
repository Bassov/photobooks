import { useEffect, useState, useSyncExternalStore } from 'react'
import { displayBookTitle } from '../../project'
import { Button } from '../../ui/Button'
import { Dialog, DialogTitle } from '../../ui/Dialog'
import { Icon } from '../../ui/Icon'
import { ProgressBar } from '../../ui/ProgressBar'
import { getBookStoreSnapshot } from '../bookStore'
import { getOpenLibrary, getProjectSessionSnapshot } from '../projectSession'
import {
  loadExportFolder,
  pickExportFolder,
  saveExportFolder,
  SESSION_FOLDER_KEY,
} from './exportSiteFolder'
import { CircleCheckGlyph, FolderGlyph, LoaderGlyph } from './exportSiteGlyphs'
import { otherPublishedTitles } from './exportSiteRun'
import { exportSiteStore, type ExportSiteState } from './exportSiteStore'
import {
  exportBooksLine,
  exportFailText,
  exportPhaseLabel,
  exportSummaryText,
} from './exportSiteText'
import { startExportSite } from './startExportSite'
import './ExportSiteButton.css'

export type ExportSiteStep = 'opts' | 'run' | 'done' | 'failed'

type Outcome = Extract<ExportSiteState, { kind: 'done' | 'failed' }>

// Kit 13 px body lines: 18.85 px (1.45), not the text-sm default.
const BODY = 'text-sm leading-[1.45]'
const TEXT = `mt-1 mb-0 ${BODY} text-muted-foreground`
const LABEL = 'text-xs leading-[1.4] text-muted-foreground'
const FOOTER = 'export-site-footer mt-5 flex justify-end gap-2'

function isOutcome(state: ExportSiteState): state is Outcome {
  return state.kind === 'done' || state.kind === 'failed'
}

/** Designer spec static-export §2: Options → Running → Done / Failed. */
export function ExportSiteDialog({
  initialStep,
  opened,
  onClose,
}: {
  initialStep: ExportSiteStep
  /** Run state when the pill was clicked (Done / Failed show it). */
  opened: ExportSiteState
  onClose: () => void
}) {
  const run = useSyncExternalStore(
    exportSiteStore.subscribe,
    exportSiteStore.getSnapshot,
    exportSiteStore.getSnapshot,
  )
  const [step, setStep] = useState(initialStep)
  const [outcome, setOutcome] = useState<Outcome | null>(
    isOutcome(opened) ? opened : null,
  )
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null)
  const [others, setOthers] = useState<readonly string[]>([])
  const [{ title, bookId, folderKey }] = useState(() => {
    const { book } = getBookStoreSnapshot()
    return {
      title: displayBookTitle(book.title),
      bookId: book.id,
      folderKey: getProjectSessionSnapshot().libraryId ?? SESSION_FOLDER_KEY,
    }
  })

  useEffect(() => {
    let live = true
    void loadExportFolder(folderKey).then((handle) => {
      if (live && handle !== null) {
        setFolder((picked) => picked ?? handle)
      }
    })
    void otherPublishedTitles(getOpenLibrary()?.storage ?? null, bookId).then(
      (titles) => {
        if (live) {
          setOthers(titles)
        }
      },
    )
    return () => {
      live = false
    }
  }, [folderKey, bookId])

  // The run ends while the dialog shows it: move to Done / Failed in place.
  if (step === 'run' && isOutcome(run)) {
    setOutcome(run)
    setStep(run.kind)
  }

  const close = () => {
    if (step === 'failed') {
      exportSiteStore.dispatch({ type: 'seen' })
    }
    onClose()
  }

  const choose = async () => {
    const picked = await pickExportFolder()
    if (picked !== null) {
      setFolder(picked)
      await saveExportFolder(folderKey, picked)
    }
  }

  const exportNow = () => {
    if (folder === null) {
      setStep('opts')
      return
    }
    exportSiteStore.dispatch({ type: 'seen' })
    startExportSite(folder)
    setStep('run')
  }

  const percent = run.kind === 'running' ? run.percent : 100
  const phase = run.kind === 'running' ? run.phase : 'write'
  const folderName = outcome?.folder ?? folder?.name ?? ''

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
      className="export-site-dialog"
      aria-label="Export site"
    >
      <div data-testid="export-site-dialog" data-step={step}>
        {step === 'opts' ? (
          <>
            <DialogTitle>Export site</DialogTitle>
            <p className={TEXT}>
              Writes a website of your books to a folder on this computer.
              Nothing is uploaded.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className={LABEL}>Folder</span>
                {folder === null ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start px-3"
                    onPress={() => void choose()}
                    data-testid="export-site-choose"
                  >
                    <FolderGlyph />
                    Choose folder…
                  </Button>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md bg-field px-3 shadow-xs ${BODY}`}
                        data-testid="export-site-folder"
                      >
                        <FolderGlyph />
                        <span className="truncate">{folder.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-3"
                        onPress={() => void choose()}
                        data-testid="export-site-change"
                      >
                        Change…
                      </Button>
                    </div>
                    <p className={`m-0 ${LABEL}`}>
                      The site goes into {folder.name}/dist. An earlier export
                      there is replaced.
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={LABEL}>Books</span>
                <p className={`m-0 ${BODY}`} data-testid="export-site-books">
                  {exportBooksLine(title, others)}
                </p>
              </div>
            </div>
            <div className={FOOTER}>
              <Button
                variant="ghost"
                size="md"
                className="px-4"
                onPress={close}
              >
                Cancel
              </Button>
              <Button
                size="md"
                className="px-4"
                isDisabled={folder === null}
                onPress={exportNow}
                data-testid="export-site-go"
              >
                Export
              </Button>
            </div>
          </>
        ) : null}
        {step === 'run' ? (
          <>
            <DialogTitle>
              <LoaderGlyph size={20} />
              Exporting…
            </DialogTitle>
            <p className={TEXT} data-testid="export-site-phase">
              {exportPhaseLabel(phase)} · {percent}%
            </p>
            <ProgressBar
              aria-label="Exporting site"
              value={percent}
              className="export-site-progress mt-4"
            />
            <p className={`mt-3 mb-0 ${LABEL}`}>
              You can keep editing. Changes from now on go into the next export.
            </p>
            <div className={FOOTER}>
              <Button
                variant="ghost"
                size="md"
                className="px-4"
                onPress={close}
                data-testid="export-site-hide"
              >
                Hide
              </Button>
            </div>
          </>
        ) : null}
        {step === 'done' && outcome?.kind === 'done' ? (
          <>
            <DialogTitle>
              <CircleCheckGlyph size={20} />
              Site exported
            </DialogTitle>
            <p className={TEXT} data-testid="export-site-summary">
              {exportSummaryText(outcome.summary, outcome.folder)}
            </p>
            <div className="mt-4 flex flex-col gap-1.5">
              <span className={LABEL}>
                To open it, serve the folder with a local web server, for
                example:
              </span>
              <div
                className={`rounded-md bg-field px-3 py-2 font-mono ${BODY}`}
              >
                npx serve dist
              </div>
            </div>
            <div className={FOOTER}>
              <Button
                size="md"
                className="px-4"
                onPress={close}
                data-testid="export-site-close"
              >
                Done
              </Button>
            </div>
          </>
        ) : null}
        {step === 'failed' && outcome?.kind === 'failed' ? (
          <>
            <DialogTitle>
              <Icon name="warning" size={20} />
              Export failed
            </DialogTitle>
            <p className={TEXT} data-testid="export-site-error">
              {exportFailText(outcome.code, folderName)}
            </p>
            <div className={FOOTER}>
              <Button
                variant="ghost"
                size="md"
                className="px-4"
                onPress={close}
                data-testid="export-site-close"
              >
                Close
              </Button>
              {outcome.code === 'not-our-export' ? (
                <Button
                  size="md"
                  className="px-4"
                  onPress={() => {
                    exportSiteStore.dispatch({ type: 'seen' })
                    setFolder(null)
                    setStep('opts')
                  }}
                  data-testid="export-site-rechoose"
                >
                  Choose folder…
                </Button>
              ) : (
                <Button
                  size="md"
                  className="px-4"
                  onPress={exportNow}
                  data-testid="export-site-retry"
                >
                  Try again
                </Button>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  )
}
