import { useEffect, useState, useSyncExternalStore } from 'react'
import { displayBookTitle } from '../../project'
import type { HostingSummary } from '../../publish/credentials'
import { Button } from '../../ui/Button'
import { Dialog, DialogTitle } from '../../ui/Dialog'
import { Icon } from '../../ui/Icon'
import { ProgressBar } from '../../ui/ProgressBar'
import { getBookStoreSnapshot } from '../bookStore'
import { CircleCheckGlyph, LoaderGlyph } from '../export/exportSiteGlyphs'
import { otherPublishedTitles } from '../export/exportSiteRun'
import { getOpenLibrary } from '../projectSession'
import { publishStore, type PublishState } from './publishStore'
import {
  PUBLISH_FAILED_STATUS,
  publishFailAction,
  publishFailText,
  publishHostLine,
  publishPhaseLabel,
  publishSummaryText,
} from './publishText'
import { startPublish } from './startPublish'
import '../export/ExportSiteButton.css'

type Outcome = Extract<PublishState, { kind: 'done' | 'failed' }>

/** The dialog step; Done / Failed carry the run they show. */
export type PublishView = { kind: 'connect' | 'opts' | 'run' } | Outcome

// Kit 13 px body lines: 18.85 px (1.45), not the text-sm default.
const BODY = 'text-sm leading-[1.45]'
const TEXT = `mt-1 mb-0 ${BODY} text-muted-foreground`
const HINT = 'text-xs leading-[1.4] text-muted-foreground'
const FOOTER = 'mt-5 flex justify-end gap-2'

function isOutcome(state: PublishState): state is Outcome {
  return state.kind === 'done' || state.kind === 'failed'
}

function hostOf(hosting: HostingSummary | null): string {
  if (hosting === null) return ''
  try {
    return new URL(hosting.publicBaseUrl).host
  } catch {
    return hosting.publicBaseUrl
  }
}

function SecondaryButton({
  label,
  onPress,
  testId,
}: {
  label: string
  onPress: () => void
  testId?: string
}) {
  return (
    <Button
      variant="ghost"
      size="md"
      className="px-4"
      onPress={onPress}
      data-testid={testId}
    >
      {label}
    </Button>
  )
}

function PrimaryButton({
  label,
  onPress,
  testId,
}: {
  label: string
  onPress: () => void
  testId: string
}) {
  return (
    <Button
      size="md"
      className="px-4"
      onPress={onPress}
      autoFocus
      data-testid={testId}
    >
      {label}
    </Button>
  )
}

/**
 * Designer spec in-app-publish §2: connect (no stored hosting) | options →
 * running (Hide keeps it running in the pill) → done / failed. Every step
 * closes on Esc / outside click; the run step only hides.
 */
export function PublishDialog({
  initial,
  hosting,
  onClose,
  onOpenHosting,
}: {
  initial: PublishView
  /** The stored hosting (no secret), `null` when none. */
  hosting: HostingSummary | null
  onClose: () => void
  /** Close and open Settings on the Hosting section. */
  onOpenHosting: () => void
}) {
  const run = useSyncExternalStore(
    publishStore.subscribe,
    publishStore.getSnapshot,
    publishStore.getSnapshot,
  )
  const [view, setView] = useState(initial)
  const [hasOthers, setHasOthers] = useState(false)
  const [{ title, bookId }] = useState(() => {
    const { book } = getBookStoreSnapshot()
    return { title: displayBookTitle(book.title), bookId: book.id }
  })

  useEffect(() => {
    let live = true
    void otherPublishedTitles(getOpenLibrary()?.storage ?? null, bookId).then(
      (titles) => {
        if (live) {
          setHasOthers(titles.length > 0)
        }
      },
    )
    return () => {
      live = false
    }
  }, [bookId])

  // The run ends while the dialog shows it: move to Done / Failed in place.
  if (view.kind === 'run' && isOutcome(run)) {
    setView(run)
  }

  // A shown failure is seen (the pill rests); other states ignore `seen`.
  const close = () => {
    publishStore.dispatch({ type: 'seen' })
    onClose()
  }

  const openHosting = () => {
    publishStore.dispatch({ type: 'seen' })
    onOpenHosting()
  }

  const publishNow = (retry: boolean) => {
    publishStore.dispatch({ type: 'seen' })
    startPublish(retry)
    setView({ kind: 'run' })
  }

  const percent = run.kind === 'running' ? run.percent : 100
  const line = publishHostLine(title, hostOf(hosting), hasOthers)
  const hostingButton = (
    <PrimaryButton
      label="Open Settings → Hosting"
      onPress={openHosting}
      testId="publish-open-hosting"
    />
  )

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
      className="export-site-dialog"
      aria-label="Publish"
    >
      <div data-testid="publish-dialog" data-step={view.kind}>
        {view.kind === 'connect' ? (
          <>
            <DialogTitle>Publish to your site</DialogTitle>
            <p className={TEXT}>
              Connect your hosting first. Publish uploads your books to your own
              Cloudflare R2 bucket, which you connect once in Settings.
            </p>
            <div className={FOOTER}>
              <SecondaryButton label="Cancel" onPress={close} />
              {hostingButton}
            </div>
          </>
        ) : null}
        {view.kind === 'opts' ? (
          <>
            <DialogTitle>Publish to your site</DialogTitle>
            <p className={TEXT} data-testid="publish-host-line">
              {line.before}
              <span className="font-medium text-foreground">{line.host}</span>
              {line.after}
            </p>
            <div className={FOOTER}>
              <SecondaryButton label="Cancel" onPress={close} />
              <PrimaryButton
                label="Publish"
                onPress={() => {
                  publishNow(false)
                }}
                testId="publish-go"
              />
            </div>
          </>
        ) : null}
        {view.kind === 'run' ? (
          <>
            <DialogTitle>
              <LoaderGlyph size={20} />
              Publishing…
            </DialogTitle>
            <p className={TEXT} data-testid="publish-phase">
              {publishPhaseLabel(percent)} · {percent}%
            </p>
            <ProgressBar
              aria-label="Publishing"
              value={percent}
              className="export-site-progress mt-4"
            />
            <p className={`mt-3 mb-0 ${HINT}`}>
              You can keep editing. Changes from now on go into the next
              publish.
            </p>
            <div className={FOOTER}>
              <SecondaryButton
                label="Hide"
                onPress={close}
                testId="publish-hide"
              />
            </div>
          </>
        ) : null}
        {view.kind === 'done' ? (
          <>
            <DialogTitle>
              <CircleCheckGlyph size={20} />
              Published
            </DialogTitle>
            <p className={TEXT}>
              The book is live. Anyone with the link can see it.
            </p>
            <div
              className={`mt-4 truncate rounded-md bg-field px-3 py-2 font-mono select-all ${BODY}`}
              data-testid="publish-link"
            >
              {view.bookUrl}
            </div>
            <p className={`mt-2 mb-0 ${HINT}`} data-testid="publish-summary">
              {publishSummaryText(view.summary)}
            </p>
            <div className={FOOTER}>
              <SecondaryButton label="Done" onPress={close} />
              <PrimaryButton
                label="Open site"
                onPress={() => {
                  window.open(view.homeUrl, '_blank', 'noopener,noreferrer')
                }}
                testId="publish-open-site"
              />
            </div>
          </>
        ) : null}
        {view.kind === 'failed' ? (
          <>
            <DialogTitle>
              <Icon name="warning" size={20} />
              {PUBLISH_FAILED_STATUS}
            </DialogTitle>
            <p className={TEXT} data-testid="publish-error">
              {publishFailText(view.failure, hosting?.bucket ?? '')}
            </p>
            <div className={FOOTER}>
              <SecondaryButton label="Close" onPress={close} />
              {publishFailAction(view.failure.code) === 'retry' ? (
                <PrimaryButton
                  label="Try again"
                  onPress={() => {
                    publishNow(true)
                  }}
                  testId="publish-retry"
                />
              ) : (
                hostingButton
              )}
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  )
}
