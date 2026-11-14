import { useState, useSyncExternalStore } from 'react'
import { Icon } from '../../ui/Icon'
import { CircleCheckGlyph } from '../export/exportSiteGlyphs'
import { SiteJobPill, type SiteJobContent } from '../export/SiteJobPill'
import { PrintDialog, type PrintStep } from './PrintDialog'
import { printStore, type PrintState } from './printStore'
import {
  PRINT_DONE_STATUS,
  PRINT_FAILED_STATUS,
  PRINT_NAME,
  printRunningTitle,
  printStatusText,
} from './printText'

const REST: SiteJobContent = { icon: <Icon name="printer" size={16} /> }

const SAY = {
  running: printStatusText,
  done: PRINT_DONE_STATUS,
  failed: PRINT_FAILED_STATUS,
}

/** D1: icon only in every state; the Printer stays over the running fill. */
function pillContent(state: PrintState): SiteJobContent & { title: string } {
  switch (state.kind) {
    case 'idle':
      return { ...REST, title: PRINT_NAME }
    case 'running':
      return { ...REST, title: printRunningTitle(state.percent) }
    case 'done':
      return { icon: <CircleCheckGlyph size={16} />, title: PRINT_DONE_STATUS }
    case 'failed':
      return {
        icon: <Icon name="warning" size={16} />,
        title: PRINT_FAILED_STATUS,
      }
  }
}

const STEP_FOR: Record<PrintState['kind'], PrintStep> = {
  idle: 'opts',
  running: 'run',
  done: 'done',
  failed: 'failed',
}

/** Designer pdf-export D1: top bar Print job pill + its dialog. */
export function PrintButton({ disabled }: { disabled: boolean }) {
  const state = useSyncExternalStore(
    printStore.subscribe,
    printStore.getSnapshot,
    printStore.getSnapshot,
  )
  const [dialog, setDialog] = useState<{
    step: PrintStep
    opened: PrintState
  } | null>(null)
  const { title, ...content } = pillContent(state)

  return (
    <>
      <SiteJobPill
        name={PRINT_NAME}
        testId="print"
        className=""
        kind={state.kind}
        percent={state.kind === 'running' ? state.percent : 0}
        rest={REST}
        content={content}
        title={title}
        say={SAY}
        disabled={disabled && state.kind === 'idle'}
        onClick={() => {
          setDialog({ step: STEP_FOR[state.kind], opened: state })
          printStore.dispatch({ type: 'seen' })
        }}
      />
      {dialog === null ? null : (
        <PrintDialog
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
