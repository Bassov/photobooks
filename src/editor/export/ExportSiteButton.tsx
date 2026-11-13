import { useState, useSyncExternalStore } from 'react'
import { Icon } from '../../ui/Icon'
import { isPublishRunning, publishStore } from '../publish/publishStore'
import { PUBLISH_WAIT_TITLE } from '../publish/publishText'
import { ExportSiteDialog, type ExportSiteStep } from './ExportSiteDialog'
import { CircleCheckGlyph } from './exportSiteGlyphs'
import { exportSiteStore, type ExportSiteState } from './exportSiteStore'
import {
  EXPORT_DONE_STATUS,
  EXPORT_FAILED_STATUS,
  exportRunningTitle,
  exportStatusText,
} from './exportSiteText'
import { SiteJobPill, type SiteJobContent } from './SiteJobPill'

const NAME = 'Export site'

const REST: SiteJobContent = {
  icon: <Icon name="export" size={16} />,
  label: NAME,
}

const SAY = {
  running: exportStatusText,
  done: EXPORT_DONE_STATUS,
  failed: EXPORT_FAILED_STATUS,
}

function pillContent(state: ExportSiteState): SiteJobContent & {
  title: string
} {
  switch (state.kind) {
    case 'idle':
      return { ...REST, title: NAME }
    case 'running':
      return {
        icon: <Icon name="export" size={16} />,
        label: (
          <span className="site-job-pill__percent">{`${String(state.percent)}%`}</span>
        ),
        title: exportRunningTitle(state.percent),
      }
    case 'done':
      return {
        icon: <CircleCheckGlyph size={16} />,
        label: 'Exported',
        title: EXPORT_DONE_STATUS,
      }
    case 'failed':
      return {
        icon: <Icon name="warning" size={16} />,
        label: 'Failed',
        title: EXPORT_FAILED_STATUS,
      }
  }
}

const STEP_FOR: Record<ExportSiteState['kind'], ExportSiteStep> = {
  idle: 'opts',
  running: 'run',
  done: 'done',
  failed: 'failed',
}

/** Designer spec static-export §1: top bar "Export site" pill + its dialog. */
export function ExportSiteButton({ disabled }: { disabled: boolean }) {
  const state = useSyncExternalStore(
    exportSiteStore.subscribe,
    exportSiteStore.getSnapshot,
    exportSiteStore.getSnapshot,
  )
  const publishing = useSyncExternalStore(
    publishStore.subscribe,
    isPublishRunning,
    isPublishRunning,
  )
  const [dialog, setDialog] = useState<{
    step: ExportSiteStep
    opened: ExportSiteState
  } | null>(null)
  const { title, ...content } = pillContent(state)

  return (
    <>
      <SiteJobPill
        name={NAME}
        testId="export-site"
        className=""
        kind={state.kind}
        percent={state.kind === 'running' ? state.percent : 0}
        rest={REST}
        content={content}
        title={title}
        say={SAY}
        narrow
        wait={publishing ? PUBLISH_WAIT_TITLE : undefined}
        disabled={disabled && state.kind === 'idle'}
        onClick={() => {
          setDialog({ step: STEP_FOR[state.kind], opened: state })
          exportSiteStore.dispatch({ type: 'seen' })
        }}
      />
      {dialog === null ? null : (
        <ExportSiteDialog
          initialStep={dialog.step}
          opened={dialog.opened}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
    </>
  )
}
