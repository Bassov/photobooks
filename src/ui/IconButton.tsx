import { useId, type ReactNode } from 'react'
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
  /**
   * Kit Button v4.2: why the button is disabled. With `isDisabled` it stays
   * focusable (`aria-disabled`), ignores presses, and the tooltip and the
   * description give the reason.
   */
  disabledReason?: string | undefined
}

const ignorePress = () => undefined

/** Ghost icon-only control; tooltip shows `label` (shortcut included by caller). */
export function IconButton({
  label,
  children,
  size = 'md',
  tooltip = true,
  placement = 'bottom',
  isOpen,
  className,
  disabledReason,
  ...rest
}: IconButtonProps) {
  const reasonId = useId()
  const reason = rest.isDisabled === true ? disabledReason : undefined
  const button = (
    <Button
      {...(reason === undefined
        ? rest
        : {
            ...rest,
            isDisabled: false,
            onPress: ignorePress,
            'aria-disabled': true,
            'aria-describedby': reasonId,
            'data-disabled-reason': '',
          })}
      variant="ghost"
      size={size}
      aria-label={label}
      className={cx('pb-icon-button', `pb-icon-button--${size}`, className)}
    >
      {children}
    </Button>
  )
  // The reason lives outside the button: the name stays the label and the
  // reason is announced once, as the description.
  const described =
    reason === undefined ? (
      button
    ) : (
      <>
        {button}
        <span id={reasonId} hidden>
          {reason}
        </span>
      </>
    )

  if (tooltip) {
    return (
      <TooltipTrigger delay={400} {...(isOpen === undefined ? {} : { isOpen })}>
        {described}
        <Tooltip placement={placement}>{reason ?? label}</Tooltip>
      </TooltipTrigger>
    )
  }

  return described
}
