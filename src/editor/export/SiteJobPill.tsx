import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { ChromeButton } from '../ChromeButton'
import { FIELD, T } from '../editorChromeTokens'
import { nextAnnouncedPercent } from './exportSiteText'
import './ExportSiteButton.css'

export type SiteJobKind = 'idle' | 'running' | 'done' | 'failed'

export interface SiteJobContent {
  icon?: ReactNode
  label?: ReactNode
}

/** Status region text: progress at most every 10 %, then the outcome. */
function useStatusText(
  kind: SiteJobKind,
  percent: number,
  say: {
    running: (percent: number) => string
    done: string
    failed: string
  },
): string {
  const announced = useRef<number | null>(null)
  const [text, setText] = useState('')
  useEffect(() => {
    if (kind === 'running') {
      const next = nextAnnouncedPercent(percent, announced.current)
      if (next !== null) {
        announced.current = next
        setText(say.running(next))
      }
      return
    }
    announced.current = null
    if (kind === 'done') {
      setText(say.done)
    } else if (kind === 'failed') {
      setText(say.failed)
    }
  }, [kind, percent, say])
  return text
}

/**
 * Top bar site job pill (kit `SiteJobPill`): the rest content is a hidden
 * sizer in the live content's grid cell, so every state keeps the rest
 * width; running fills a `::before` layer under the content. `narrow`: the
 * label hides below 1360 px (P11). `wait`: the other site job runs (P7), the
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
  say: Parameters<typeof useStatusText>[2]
  narrow?: boolean
  wait?: string | undefined
  disabled: boolean
  onClick: () => void
}) {
  const status = useStatusText(kind, percent, say)
  const style: CSSProperties & { '--site-job-progress'?: number } = {
    background: FIELD,
    color: T,
  }
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
          className={`editor-top-pill site-job-pill h-8 text-sm font-medium ${className}`}
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
              <span className={label}>{rest.label}</span>
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
