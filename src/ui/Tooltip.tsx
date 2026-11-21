import type { ComponentProps } from 'react'
import {
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
  type TooltipProps as AriaTooltipProps,
} from 'react-aria-components'
import { cx } from './className'
import { overlayBox, useScaledGaps } from './scaledOverlay'
import './Tooltip.css'

export type TooltipTriggerProps = ComponentProps<typeof AriaTooltipTrigger>

export function TooltipTrigger({ delay = 400, ...props }: TooltipTriggerProps) {
  return <AriaTooltipTrigger delay={delay} {...props} />
}

export interface TooltipProps extends Omit<AriaTooltipProps, 'className'> {
  className?: string
}

export function Tooltip({
  className,
  offset = 6,
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
