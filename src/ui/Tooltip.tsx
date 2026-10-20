import type { ComponentProps } from 'react'
import {
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
  type TooltipProps as AriaTooltipProps,
} from 'react-aria-components'
import { cx } from './className'
import './Tooltip.css'

export type TooltipTriggerProps = ComponentProps<typeof AriaTooltipTrigger>

export function TooltipTrigger({ delay = 400, ...props }: TooltipTriggerProps) {
  return <AriaTooltipTrigger delay={delay} {...props} />
}

export interface TooltipProps extends Omit<AriaTooltipProps, 'className'> {
  className?: string
}

export function Tooltip({ className, offset = 6, ...props }: TooltipProps) {
  return (
    <AriaTooltip
      {...props}
      offset={offset}
      className={cx('pb-tooltip', className)}
    />
  )
}
