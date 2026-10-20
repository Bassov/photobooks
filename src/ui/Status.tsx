import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './className'
import './Status.css'

export interface StatusProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'className'
> {
  /** Live-region politeness. Assertive uses `role="alert"`. */
  politeness?: 'polite' | 'assertive'
  className?: string
  children?: ReactNode
}

/** Polite / assertive status live region for chrome announcements. */
export function Status({
  politeness = 'polite',
  className,
  children,
  ...props
}: StatusProps) {
  const assertive = politeness === 'assertive'
  return (
    <div
      {...props}
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cx('pb-status', className)}
      data-politeness={politeness}
    >
      {children}
    </div>
  )
}
