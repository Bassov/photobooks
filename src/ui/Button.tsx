import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from 'react-aria-components'
import { cx } from './className'
import './Button.css'

type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'destructive'
type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends Omit<AriaButtonProps, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

/** Primary / secondary / quiet actions — inventory: default / secondary / ghost. */
export function Button({
  variant = 'default',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={cx(
        'pb-button',
        `pb-button--${variant}`,
        `pb-button--${size}`,
        className,
      )}
    />
  )
}
