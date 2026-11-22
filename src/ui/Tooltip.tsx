import type { ComponentProps } from 'react'
import {
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
  type TooltipProps as AriaTooltipProps,
} from 'react-aria-components'
import { cx } from './className'
import { overlayBox, useScaledGaps } from './scaledOverlay'
import './Tooltip.css'

type AriaTooltipTriggerProps = ComponentProps<typeof AriaTooltipTrigger>

/** `isOpen` may be passed as `undefined`: React Aria reads that as uncontrolled. */
export type TooltipTriggerProps = Omit<AriaTooltipTriggerProps, 'isOpen'> & {
  isOpen?: boolean | undefined
}

/** Kit top-bar tooltip timing: opens 300 ms after the pointer comes in. */
export function TooltipTrigger({ delay = 300, ...props }: TooltipTriggerProps) {
  return (
    <AriaTooltipTrigger delay={delay} {...(props as AriaTooltipTriggerProps)} />
  )
}

export interface TooltipProps extends Omit<AriaTooltipProps, 'className'> {
  className?: string
}

export function Tooltip({
  className,
  offset = 4,
  crossOffset,
  containerPadding,
  children,
  ...props
}: TooltipProps) {
  return (
    <AriaTooltip
      {...props}
      {...useScaledGaps({ offset, crossOffset, containerPadding })}
      className={cx('pb-tooltip', className)}
    >
      {overlayBox(children, cx('pb-tooltip__box', className))}
    </AriaTooltip>
  )
}
