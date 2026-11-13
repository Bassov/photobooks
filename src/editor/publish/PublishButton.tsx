import { useState, useSyncExternalStore } from 'react'
import {
  loadHostingSummary,
  type HostingSummary,
} from '../../publish/credentials'
import { Icon } from '../../ui/Icon'
import { CircleCheckGlyph } from '../export/exportSiteGlyphs'
import { exportSiteStore } from '../export/exportSiteStore'
import { SiteJobPill, type SiteJobContent } from '../export/SiteJobPill'
import { PublishDialog, type PublishStep } from './PublishDialog'
import { publishStore, type PublishState } from './publishStore'
import {
  EXPORT_WAIT_TITLE,
  PUBLISH_DONE_STATUS,
  PUBLISH_FAILED_STATUS,
  PUBLISH_NAME,
  publishRunningTitle,
  publishStatusText,
} from './publishText'

const REST: SiteJobContent = { label: PUBLISH_NAME }

const SAY = {
  running: publishStatusText,
  done: PUBLISH_DONE_STATUS,
  failed: PUBLISH_FAILED_STATUS,
}

const isExportRunning = () => exportSiteStore.getSnapshot().kind === 'running'

/** §1: no icon at rest or running; done / failed are the icon alone. */
function pillContent(state: PublishState): SiteJobContent & { title: string } {
  switch (state.kind) {
    case 'idle':
      return { ...REST, title: PUBLISH_NAME }
    case 'running':
      return {
        label: (
          <span className="site-job-pill__percent">{`${String(state.percent)}%`}</span>
        ),
        title: publishRunningTitle(state.percent),
      }
    case 'done':
      return {
        icon: <CircleCheckGlyph size={16} />,
        title: PUBLISH_DONE_STATUS,
      }
    case 'failed':
      return {
        icon: <Icon name="warning" size={16} />,
        title: PUBLISH_FAILED_STATUS,
      }
  }
}

function stepFor(
  state: PublishState,
  hosting: HostingSummary | null,
): PublishStep {
  if (state.kind === 'idle') {
    return hosting === null ? 'connect' : 'opts'
  }
  return state.kind === 'running' ? 'run' : state.kind
}

/** Designer spec in-app-publish §1: top bar "Publish" pill + its dialog. */
export function PublishButton({
  disabled,
  onOpenHosting,
}: {
  disabled: boolean
  /** Open the editor's Settings on the Hosting section. */
  onOpenHosting: () => void
}) {
  const state = useSyncExternalStore(
    publishStore.subscribe,
    publishStore.getSnapshot,
    publishStore.getSnapshot,
  )
  const exporting = useSyncExternalStore(
    exportSiteStore.subscribe,
    isExportRunning,
    isExportRunning,
  )
  const [dialog, setDialog] = useState<{
    step: PublishStep
    opened: PublishState
    hosting: HostingSummary | null
  } | null>(null)
  const { title, ...content } = pillContent(state)

  const open = async () => {
    const opened = state
    // A failure is seen once opened: the pill goes back to idle.
    publishStore.dispatch({ type: 'seen' })
    const hosting = await loadHostingSummary()
    setDialog({ step: stepFor(opened, hosting), opened, hosting })
  }

  return (
    <>
      <SiteJobPill
        name={PUBLISH_NAME}
        testId="publish"
        className="publish-pill"
        kind={state.kind}
        percent={state.kind === 'running' ? state.percent : 0}
        rest={REST}
        content={content}
        title={title}
        say={SAY}
        wait={exporting ? EXPORT_WAIT_TITLE : undefined}
        disabled={disabled && state.kind === 'idle'}
        onClick={() => {
          void open()
        }}
      />
      {dialog === null ? null : (
        <PublishDialog
          initialStep={dialog.step}
          opened={dialog.opened}
          hosting={dialog.hosting}
          onClose={() => {
            setDialog(null)
          }}
          onOpenHosting={() => {
            setDialog(null)
            onOpenHosting()
          }}
        />
      )}
    </>
  )
}
