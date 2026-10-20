import {
  ProgressBar as AriaProgressBar,
  type ProgressBarProps as AriaProgressBarProps,
} from 'react-aria-components'
import { cx } from './className'
import { progressFillTransform } from './progressFill'
import './ProgressBar.css'

export interface ProgressBarProps extends Omit<
  AriaProgressBarProps,
  'className'
> {
  className?: string
  /** Accessible name when no visible label child is provided. */
  label?: string
}

/**
 * Determinate (pass `value`) or indeterminate (`isIndeterminate` or omit `value`).
 */
export function ProgressBar({
  className,
  label,
  value,
  isIndeterminate,
  minValue = 0,
  maxValue = 100,
  'aria-label': ariaLabel,
  ...props
}: ProgressBarProps) {
  const name = ariaLabel ?? label
  const indeterminate = Boolean(isIndeterminate) || value === undefined
  const classNames = cx(
    'pb-progress',
    indeterminate && 'pb-progress--indeterminate',
    className,
  )
  const shared = {
    ...props,
    minValue,
    maxValue,
    className: classNames,
    ...(name === undefined ? {} : { 'aria-label': name }),
    ...(indeterminate ? { 'data-indeterminate': 'true' as const } : {}),
  }

  if (indeterminate) {
    return (
      <AriaProgressBar {...shared} isIndeterminate>
        {() => (
          <div className="pb-progress-track">
            <div className="pb-progress-fill" data-testid="progress-fill" />
          </div>
        )}
      </AriaProgressBar>
    )
  }

  return (
    <AriaProgressBar {...shared} value={value}>
      {({ percentage }) => (
        <div className="pb-progress-track">
          <div
            className="pb-progress-fill"
            data-testid="progress-fill"
            style={{ transform: progressFillTransform(percentage) }}
          />
        </div>
      )}
    </AriaProgressBar>
  )
}
