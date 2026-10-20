import type { ReactNode } from 'react'
import { Button, type ButtonProps } from './Button'
import { cx } from './className'
import { Tooltip, TooltipTrigger } from './Tooltip'
import './IconButton.css'

type IconButtonSize = 'sm' | 'md'

export interface IconButtonProps extends Omit<
  ButtonProps,
  'children' | 'size' | 'variant' | 'aria-label'
> {
  /** Accessible name and tooltip text (include shortcut in the string). */
  label: string
  children: ReactNode
  size?: IconButtonSize
  /** When false, render the button without a tooltip wrapper. */
  tooltip?: boolean
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Controlled tooltip open (tests / static specimens). */
  isOpen?: boolean
}

/** Ghost icon-only control; tooltip shows `label` (shortcut included by caller). */
export function IconButton({
  label,
  children,
  size = 'md',
  tooltip = true,
  placement = 'bottom',
  isOpen,
  className,
  ...rest
}: IconButtonProps) {
  const button = (
    <Button
      {...rest}
      variant="ghost"
      size={size}
      aria-label={label}
      className={cx('pb-icon-button', `pb-icon-button--${size}`, className)}
    >
      {children}
    </Button>
  )

  if (tooltip) {
    return (
      <TooltipTrigger delay={400} {...(isOpen === undefined ? {} : { isOpen })}>
        {button}
        <Tooltip placement={placement}>{label}</Tooltip>
      </TooltipTrigger>
    )
  }

  return button
}
