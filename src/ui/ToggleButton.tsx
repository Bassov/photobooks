import {
  ToggleButton as AriaToggleButton,
  type ToggleButtonProps as AriaToggleButtonProps,
} from 'react-aria-components'
import { cx } from './className'
import './ToggleButton.css'

type ToggleButtonSize = 'sm' | 'md'
type ToggleButtonVariant = 'default' | 'outline'

export interface ToggleButtonProps extends Omit<
  AriaToggleButtonProps,
  'className'
> {
  size?: ToggleButtonSize
  variant?: ToggleButtonVariant
  className?: string
}

export function ToggleButton({
  variant = 'default',
  size = 'md',
  className,
  ...props
}: ToggleButtonProps) {
  return (
    <AriaToggleButton
      {...props}
      className={cx(
        'pb-toggle',
        `pb-toggle--${variant}`,
        `pb-toggle--${size}`,
        className,
      )}
    />
  )
}
