import type { ReactNode } from 'react'
import { cx } from './className'
import { Icon } from './Icon'
import { IconButton } from './IconButton'
import type { PanelSide } from './panelSize'
import './Panel.css'

export interface PanelProps {
  side: PanelSide
  title: string
  children: ReactNode
  /** Shows a collapse button in the header when provided. */
  onCollapse?: () => void
  /** Shortcut hint appended to the collapse label, e.g. `[`. */
  shortcut?: string
  className?: string
  'data-testid'?: string
}

/** Side panel with a titled header and a body; the host owns width and scrolling. */
export function Panel({
  side,
  title,
  children,
  onCollapse,
  shortcut,
  className,
  'data-testid': testId,
}: PanelProps) {
  const label = `Collapse ${title.toLowerCase()}${shortcut ? ` ${shortcut}` : ''}`
  return (
    <section
      className={cx('pb-panel', `pb-panel--${side}`, className)}
      aria-label={title}
      data-testid={testId}
    >
      <header className="pb-panel__header">
        <h2 className="pb-panel__title">{title}</h2>
        {onCollapse ? (
          <IconButton
            label={label}
            size="sm"
            placement={side === 'left' ? 'right' : 'left'}
            onPress={onCollapse}
            data-testid={`panel-collapse-${side}`}
          >
            <Icon name={side === 'left' ? 'panelLeft' : 'panelRight'} />
          </IconButton>
        ) : null}
      </header>
      <div className="pb-panel__body">{children}</div>
    </section>
  )
}
