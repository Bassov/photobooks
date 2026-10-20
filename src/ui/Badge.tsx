import type { ReactNode } from 'react'
import { cx } from './className'
import './Badge.css'

export interface BadgeProps {
  color?: 'gray' | 'brand' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
  type?: 'badge-color' | 'pill-color'
  /** Status dot — prefer for save / placed indicators. */
  dot?: boolean
  icon?: ReactNode
  className?: string
  children: ReactNode
}

/** Compact status / count chip — inventory colors × size × type. */
export function Badge({
  color = 'gray',
  size = 'sm',
  type = 'badge-color',
  dot = false,
  icon,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      data-color={color}
      data-size={size}
      data-type={type}
      data-dot={dot ? 'true' : undefined}
      className={cx(
        'pb-badge',
        `pb-badge--${color}`,
        `pb-badge--${size}`,
        type === 'pill-color' ? 'pb-badge--pill' : 'pb-badge--rect',
        className,
      )}
    >
      {dot ? <span aria-hidden className="pb-badge-dot" /> : null}
      {icon}
      {children}
    </span>
  )
}
