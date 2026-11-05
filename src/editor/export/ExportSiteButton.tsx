import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Icon } from '../../ui/Icon'
import { ChromeButton } from '../ChromeButton'
import { FIELD, T } from '../editorChromeTokens'
import { ExportSiteDialog, type ExportSiteStep } from './ExportSiteDialog'
import { CircleCheckGlyph } from './exportSiteGlyphs'
import { exportSiteStore, type ExportSiteState } from './exportSiteStore'
import {
  EXPORT_DONE_STATUS,
  EXPORT_FAILED_STATUS,
  exportRunningTitle,
  exportStatusText,
  nextAnnouncedPercent,
} from './exportSiteText'
import './ExportSiteButton.css'

const NAME = 'Export site'

function pillContent(state: ExportSiteState): {
  icon: ReactNode
  label: ReactNode
  title: string
} {
  switch (state.kind) {
    case 'idle':
      return {
        icon: <Icon name="export" size={16} />,
        label: NAME,
        title: NAME,
      }
    case 'running':
      return {
        icon: <Icon name="export" size={16} />,
        label: (
          <span className="export-site-pill__percent">{`${String(state.percent)}%`}</span>
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

/** Status region text: progress at most every 10 %, then the outcome. */
function useStatusText(state: ExportSiteState): string {
  const announced = useRef<number | null>(null)
  const [text, setText] = useState('')
  useEffect(() => {
    if (state.kind === 'running') {
      const next = nextAnnouncedPercent(state.percent, announced.current)
      if (next !== null) {
        announced.current = next
        setText(exportStatusText(next))
      }
      return
    }
    announced.current = null
    if (state.kind === 'done') {
      setText(EXPORT_DONE_STATUS)
    } else if (state.kind === 'failed') {
      setText(EXPORT_FAILED_STATUS)
    }
  }, [state])
  return text
}

/** Designer spec static-export §1: top bar "Export site" pill + its dialog. */
export function ExportSiteButton({ disabled }: { disabled: boolean }) {
  const state = useSyncExternalStore(
    exportSiteStore.subscribe,
    exportSiteStore.getSnapshot,
    exportSiteStore.getSnapshot,
  )
  const [dialog, setDialog] = useState<{
    step: ExportSiteStep
    opened: ExportSiteState
  } | null>(null)
  const status = useStatusText(state)
  const { icon, label, title } = pillContent(state)
  const style: CSSProperties & { '--export-site-progress'?: number } = {
    background: FIELD,
    color: T,
  }
  if (state.kind === 'running') {
    style['--export-site-progress'] = state.percent / 100
  }

  return (
    <>
      <ChromeButton
        className="editor-top-pill export-site-pill h-8 text-sm font-medium"
        style={style}
        data-testid="export-site"
        data-state={state.kind}
        aria-label={NAME}
        title={title}
        disabled={disabled && state.kind === 'idle'}
        onClick={() => {
          setDialog({ step: STEP_FOR[state.kind], opened: state })
          exportSiteStore.dispatch({ type: 'seen' })
        }}
      >
        <span className="export-site-pill__cell">
          <span
            className="export-site-pill__content export-site-pill__sizer"
            aria-hidden="true"
            data-testid="export-site-sizer"
          >
            <Icon name="export" size={16} />
            <span className="export-site-pill__label">{NAME}</span>
          </span>
          <span className="export-site-pill__content">
            {icon}
            <span className="export-site-pill__label">{label}</span>
          </span>
        </span>
      </ChromeButton>
      <span role="status" className="sr-only" data-testid="export-site-status">
        {status}
      </span>
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
