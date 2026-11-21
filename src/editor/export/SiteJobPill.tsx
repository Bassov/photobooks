import { useState, type CSSProperties, type ReactNode } from 'react'
import { ChromeButton } from '../ChromeButton'
import { FIELD, T } from '../editorChromeTokens'
import { nextAnnouncedPercent } from './exportSiteText'
import './ExportSiteButton.css'

export type SiteJobKind = 'idle' | 'running' | 'done' | 'failed'

export interface SiteJobContent {
  icon?: ReactNode
  label?: ReactNode
}

interface StatusSay {
  running: (percent: number) => string
  done: string
  failed: string
}

interface Status {
  kind: SiteJobKind
  percent: number
  /** Last running percent said; null outside a run. */
  announced: number | null
  text: string
}

/** The status after the pill moved to `kind` / `percent`. */
function nextStatus(
  status: Pick<Status, 'announced' | 'text'>,
  kind: SiteJobKind,
  percent: number,
  say: StatusSay,
): Status {
  if (kind === 'running') {
    const next = nextAnnouncedPercent(percent, status.announced)
    return next === null
      ? { ...status, kind, percent }
      : { kind, percent, announced: next, text: say.running(next) }
  }
  const text =
    kind === 'done' ? say.done : kind === 'failed' ? say.failed : status.text
  return { kind, percent, announced: null, text }
}

/**
 * Status region text: progress at most every 10 %, then the outcome. Worked
 * out while rendering, so it commits with the pill's title and fill.
 */
function useStatusText(
  kind: SiteJobKind,
  percent: number,
  say: StatusSay,
): string {
  const [status, setStatus] = useState(() =>
    nextStatus({ announced: null, text: '' }, kind, percent, say),
  )
  if (status.kind === kind && status.percent === percent) return status.text
  const next = nextStatus(status, kind, percent, say)
  setStatus(next)
  return next.text
}

/**
 * Top bar site job pill (kit `SiteJobPill`): the rest content is a hidden
 * sizer in the live content's grid cell, so every state keeps the rest
 * width; running fills a `::before` layer under the content. `narrow`: the
 * label hides below 1424 px (pdf-export D2). `wait`: the other site job runs (P7), the
 * pill is disabled with that title on a box-less wrapper.
 */
export function SiteJobPill({
  name,
  testId,
  className,
  kind,
  percent,
  rest,
  content,
  title,
  say,
  narrow = false,
  primary = false,
  wait,
  disabled,
  onClick,
}: {
  name: string
  testId: string
  className: string
  kind: SiteJobKind
  percent: number
  rest: SiteJobContent
  content: SiteJobContent
  title: string
  say: StatusSay
  narrow?: boolean
  /** The bar's one ink pill (walkthrough-polish-review P8): its look is in
   *  ExportSiteButton.css, so ChromeButton's inline ghost look is cleared. */
  primary?: boolean
  wait?: string | undefined
  disabled: boolean
  onClick: () => void
}) {
  const status = useStatusText(kind, percent, say)
  const style: CSSProperties & { '--site-job-progress'?: number } = primary
    ? { background: undefined, color: undefined, boxShadow: undefined }
    : { background: FIELD, color: T }
  if (kind === 'running') {
    style['--site-job-progress'] = percent / 100
  }
  const label = narrow
    ? 'site-job-pill__label site-job-pill__label--narrow'
    : 'site-job-pill__label'
  const shown = wait ?? title
  return (
    <>
      <span className="site-job-pill-wait" title={shown}>
        <ChromeButton
          className={`editor-top-pill site-job-pill${primary ? ' site-job-pill--primary' : ''} h-8 text-sm font-medium ${className}`}
          style={style}
          data-testid={testId}
          data-state={kind}
          aria-label={name}
          title={shown}
          disabled={disabled || wait !== undefined}
          onClick={onClick}
        >
          <span className="site-job-pill__cell">
            <span
              className="site-job-pill__content site-job-pill__sizer"
              aria-hidden="true"
              data-testid={`${testId}-sizer`}
            >
              {rest.icon}
              {rest.label === undefined ? null : (
                <span className={label}>{rest.label}</span>
              )}
            </span>
            <span className="site-job-pill__content">
              {content.icon}
              {content.label === undefined ? null : (
                <span className={label}>{content.label}</span>
              )}
            </span>
          </span>
        </ChromeButton>
      </span>
      <span role="status" className="sr-only" data-testid={`${testId}-status`}>
        {status}
      </span>
    </>
  )
}
