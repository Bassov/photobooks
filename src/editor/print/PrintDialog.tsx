import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { bookPrintProfile, coverGeometry, type PreflightRow } from '../../core'
import { printBleedMm } from '../../core/pdf/pdfGeometry'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Checkbox'
import { Dialog, DialogTitle } from '../../ui/Dialog'
import { Icon } from '../../ui/Icon'
import { ProgressBar } from '../../ui/ProgressBar'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { getBookPrintProfiles, getBookStoreSnapshot } from '../bookStore'
import {
  CircleAlertGlyph,
  CircleCheckGlyph,
  ExternalLinkGlyph,
  LoaderGlyph,
} from '../export/exportSiteGlyphs'
import { printStore, type PrintState } from './printStore'
import {
  printBleedLabel,
  printCheckLabel,
  printCoverText,
  PRINT_LAYOUTS,
  printDoneCoverText,
  printDoneText,
  printDuplexText,
  printFailText,
  printRunText,
  printSavedText,
  printSizeText,
  printSkippedPages,
  printSkippedText,
  printSummary,
  type PrintLayout,
} from './printText'
import {
  checkOpenBook,
  openPrintedPdf,
  printCounts,
  retryPrint,
  startPrint,
} from './startPrint'
import '../export/ExportSiteButton.css'
import './PrintDialog.css'

export type PrintStep = 'opts' | 'run' | 'done' | 'failed'

type Outcome = Extract<PrintState, { kind: 'done' | 'failed' }>

// Kit 13 px body lines: 18.85 px (1.45), not the text-sm default.
const BODY = 'text-sm leading-[1.45]'
const TEXT = `mt-1 mb-0 ${BODY} text-muted-foreground`
const LABEL = 'text-xs leading-[1.4] text-muted-foreground'
const FOOTER = 'export-site-footer mt-5 flex justify-end gap-2'
const ROW = `flex items-center justify-between ${BODY}`

function isOutcome(state: PrintState): state is Outcome {
  return state.kind === 'done' || state.kind === 'failed'
}

const SEVERITY_ICON: Record<PreflightRow['severity'], ReactNode> = {
  error: <CircleAlertGlyph />,
  warning: <Icon name="warning" size={16} />,
  info: <Icon name="info" size={16} />,
}

/** §2.1 check row: icon 16 centred on the first line, page list muted. */
function CheckLine({
  icon,
  tone,
  rule,
  pages = '',
  children,
}: {
  icon: ReactNode
  tone: string
  rule?: string
  pages?: string
  children: ReactNode
}) {
  return (
    <li
      className={`print-check-row print-check-row--${tone} flex items-start gap-2 ${BODY}`}
      data-testid="print-check-row"
      data-rule={rule}
    >
      {icon}
      <span>
        {children}
        {pages === '' ? null : (
          <span className="font-normal text-muted-foreground">{pages}</span>
        )}
      </span>
    </li>
  )
}

function CheckBlock({ rows }: { rows: readonly PreflightRow[] | null }) {
  const state =
    rows === null ? 'checking' : rows.length > 0 ? 'issues' : 'clean'
  const errors = rows?.some((row) => row.severity === 'error') === true
  return (
    <div
      className="flex flex-col gap-1.5"
      data-testid="print-check"
      data-state={state}
    >
      <span className={LABEL}>
        {rows === null ? 'Check' : printCheckLabel(rows)}
      </span>
      <ul
        className="print-check-list m-0 flex list-none flex-col gap-1.5 p-0"
        data-testid="print-check-list"
      >
        {rows === null ? (
          <CheckLine icon={<LoaderGlyph size={16} />} tone="checking">
            Checking the book…
          </CheckLine>
        ) : rows.length === 0 ? (
          <CheckLine icon={<CircleCheckGlyph size={16} />} tone="clean">
            No problems found
          </CheckLine>
        ) : (
          rows.map((row) => (
            <CheckLine
              key={row.id}
              icon={SEVERITY_ICON[row.severity]}
              tone={row.severity}
              rule={row.id}
              pages={row.pageList}
            >
              {row.text}
            </CheckLine>
          ))
        )}
      </ul>
      {errors ? (
        <p className={`m-0 ${LABEL}`} data-testid="print-check-note">
          Print shops may refuse a PDF with errors. You can still export it, for
          example to proof it.
        </p>
      ) : null}
    </div>
  )
}

/** Designer pdf-export §2.1–2.4: Options + Check → Exporting (Hide) → PDF ready / failed. */
export function PrintDialog({
  initialStep,
  opened,
  onClose,
}: {
  initialStep: PrintStep
  /** Run state when the pill was clicked (PDF ready / failed show it). */
  opened: PrintState
  onClose: () => void
}) {
  const run = useSyncExternalStore(
    printStore.subscribe,
    printStore.getSnapshot,
    printStore.getSnapshot,
  )
  const [step, setStep] = useState(initialStep)
  const [outcome, setOutcome] = useState<Outcome | null>(
    isOutcome(opened) ? opened : null,
  )
  const [bleed, setBleed] = useState(true)
  const [layout, setLayout] = useState<PrintLayout>('single')
  const [rows, setRows] = useState<PreflightRow[] | null>(null)
  const [book] = useState(() => {
    const { book: open } = getBookStoreSnapshot()
    const printProfiles = getBookPrintProfiles()
    const profile = bookPrintProfile(open, printProfiles)
    return {
      size: printSizeText(open.settings.trim),
      profile: profile.name,
      bleedMm: printBleedMm(open.settings.bleedMm, profile),
      // cover-pdf C2/C3: the cover sheet and its bleed as the painter has them.
      cover: printCoverText(coverGeometry(profile, open)),
      coverBleedMm: profile.coverBleedMm,
      counts: Object.fromEntries(
        PRINT_LAYOUTS.map(({ id }) => [
          id,
          printCounts(open, printProfiles, id),
        ]),
      ) as Record<PrintLayout, { pages: number; sheets: number }>,
    }
  })
  const counts = book.counts[layout]
  // C1/C9: only 1 per sheet writes a cover file, so only it shows cover rows.
  const single = layout === 'single'
  const coverBleedMm = single ? book.coverBleedMm : null
  const shown =
    rows === null || single ? rows : rows.filter((row) => row.scope !== 'cover')

  // D6: the check runs when the dialog opens on Options; C9: and per layout.
  useEffect(() => {
    if (initialStep !== 'opts') return
    let live = true
    void checkOpenBook(layout).then((checked) => {
      if (live) setRows(checked)
    })
    return () => {
      live = false
    }
  }, [initialStep, layout])

  // The run ends while the dialog shows it: move to PDF ready / failed in place.
  if (step === 'run' && isOutcome(run)) {
    setOutcome(run)
    setStep(run.kind)
  }

  const close = () => {
    if (step === 'failed') {
      printStore.dispatch({ type: 'seen' })
    }
    onClose()
  }

  const exportNow = () => {
    startPrint(bleed, layout)
    setStep('run')
  }

  const retry = () => {
    printStore.dispatch({ type: 'seen' })
    retryPrint(bleed, layout)
    setStep('run')
  }

  const running = run.kind === 'running' ? run : null

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
      className="export-site-dialog print-dialog"
      aria-label="Print"
    >
      <div data-testid="print-dialog" data-step={step}>
        {step === 'opts' ? (
          <>
            <DialogTitle>Print</DialogTitle>
            <p className={TEXT}>
              A PDF for a print shop or a home duplex printer.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <div className={ROW} data-testid="print-size">
                <span className="text-muted-foreground">Page size</span>
                <span className="tabular-nums">{book.size}</span>
              </div>
              <div className={ROW} data-testid="print-profile">
                <span className="text-muted-foreground">Printer</span>
                <span>{book.profile}</span>
              </div>
              {/* C8: always present, so switching the imposition moves nothing below. */}
              <div className={ROW} data-testid="print-cover">
                <span className="text-muted-foreground">Cover</span>
                <span className="tabular-nums">
                  {single ? book.cover : printCoverText(null)}
                </span>
              </div>
              <div
                className="flex flex-col gap-1.5"
                data-testid="print-imposition"
              >
                <span className={LABEL}>Imposition (duplex)</span>
                <SegmentedControl
                  label="Imposition"
                  items={PRINT_LAYOUTS}
                  value={layout}
                  onChange={setLayout}
                />
              </div>
              <Checkbox
                checked={bleed}
                onChange={setBleed}
                data-testid="print-bleed"
              >
                {printBleedLabel(book.bleedMm, coverBleedMm)}
              </Checkbox>
              <div className={LABEL} data-testid="print-summary">
                {printSummary(
                  counts.pages,
                  counts.sheets,
                  bleed ? book.bleedMm : null,
                  coverBleedMm,
                )}
              </div>
              <CheckBlock rows={shown} />
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
                onPress={exportNow}
                data-testid="print-go"
              >
                Export PDF
              </Button>
            </div>
          </>
        ) : null}
        {step === 'run' ? (
          <>
            <DialogTitle>
              <LoaderGlyph size={20} />
              Exporting PDF…
            </DialogTitle>
            <p className={`${TEXT} tabular-nums`} data-testid="print-run-text">
              {running === null ? '' : printRunText(running)}
            </p>
            <ProgressBar
              aria-label="Exporting PDF"
              value={running?.percent ?? 100}
              className="export-site-progress mt-4"
              data-testid="print-progress"
            />
            <p className={`mt-3 mb-0 ${LABEL}`}>
              You can keep editing. Changes from now on aren’t in this PDF.
            </p>
            <div className={FOOTER}>
              <Button
                variant="ghost"
                size="md"
                className="px-4"
                onPress={close}
                autoFocus
                data-testid="print-hide"
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
              PDF ready
            </DialogTitle>
            <p className={TEXT} data-testid="print-done">
              {printDoneText(
                outcome.file,
                outcome.sheets,
                outcome.bytes,
                outcome.layout,
              )}
            </p>
            {outcome.cover === null ? null : (
              <p
                className={`m-0 ${BODY} text-muted-foreground`}
                data-testid="print-done-cover"
              >
                {printDoneCoverText(outcome.cover.file, outcome.cover.bytes)}
              </p>
            )}
            <p className={`mt-1.5 mb-0 ${LABEL}`} data-testid="print-saved">
              {printSavedText(outcome.library)}
            </p>
            {outcome.layout === 'single' ? null : (
              <p className={`mt-3 mb-0 ${BODY}`} data-testid="print-duplex">
                {printDuplexText(outcome.layout)}
              </p>
            )}
            {outcome.skipped.count > 0 ? (
              <ul
                className="mt-3 mb-0 list-none p-0"
                data-testid="print-skipped"
              >
                <CheckLine
                  icon={SEVERITY_ICON.warning}
                  tone="warning"
                  pages={printSkippedPages(
                    outcome.skipped.pages,
                    outcome.skipped.cover,
                  )}
                >
                  {printSkippedText(outcome.skipped.count)}
                </CheckLine>
              </ul>
            ) : null}
            <div className={FOOTER}>
              <Button
                variant="ghost"
                size="md"
                className="print-open px-4"
                onPress={() => void openPrintedPdf(outcome.handle)}
                data-testid="print-open"
              >
                <ExternalLinkGlyph />
                {outcome.cover === null ? 'Open PDF' : 'Open pages'}
              </Button>
              {outcome.cover === null ? null : (
                <Button
                  variant="ghost"
                  size="md"
                  className="print-open px-4"
                  onPress={() => {
                    if (outcome.cover !== null) {
                      void openPrintedPdf(outcome.cover.handle)
                    }
                  }}
                  data-testid="print-open-cover"
                >
                  <ExternalLinkGlyph />
                  Open cover
                </Button>
              )}
              <Button
                size="md"
                className="px-4"
                onPress={close}
                autoFocus
                data-testid="print-close"
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
              PDF not exported
            </DialogTitle>
            <p className={TEXT} data-testid="print-error">
              {printFailText(outcome.code, outcome.library)}
            </p>
            <div className={FOOTER}>
              <Button
                variant="ghost"
                size="md"
                className="px-4"
                onPress={close}
              >
                Close
              </Button>
              <Button
                size="md"
                className="px-4"
                onPress={retry}
                autoFocus
                data-testid="print-retry"
              >
                Try again
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  )
}
