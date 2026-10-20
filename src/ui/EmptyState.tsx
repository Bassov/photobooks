import type { ReactNode } from 'react'
import { cx } from './className'
import './EmptyState.css'

export interface EmptyStateProps {
  /** Decorative or labelled icon (e.g. `<Icon name="folder" />`). */
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Primary / secondary action buttons. */
  actions?: ReactNode
  className?: string
  'data-testid'?: string
}

/** Empty / onboarding card: icon, title, one sentence, action slot. */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
  'data-testid': dataTestId = 'empty-state',
}: EmptyStateProps) {
  return (
    <div className={cx('pb-empty', className)} data-testid={dataTestId}>
      {icon ? <div className="pb-empty-icon">{icon}</div> : null}
      <div className="pb-empty-title">{title}</div>
      {description ? (
        <div className="pb-empty-description">{description}</div>
      ) : null}
      {actions ? <div className="pb-empty-actions">{actions}</div> : null}
    </div>
  )
}
