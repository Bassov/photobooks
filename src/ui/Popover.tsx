import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Popover as AriaPopover,
  type DialogProps as AriaDialogProps,
  type PopoverProps as AriaPopoverProps,
} from 'react-aria-components'
import { cx } from './className'
import './Popover.css'

export const PopoverTrigger = AriaDialogTrigger

export interface PopoverProps extends Omit<AriaPopoverProps, 'className'> {
  className?: string
}

export function Popover({ className, offset = 6, ...props }: PopoverProps) {
  return (
    <AriaPopover
      {...props}
      offset={offset}
      className={cx('pb-popover', className)}
    />
  )
}

export interface PopoverDialogProps extends Omit<AriaDialogProps, 'className'> {
  className?: string
}

export function PopoverDialog({ className, ...props }: PopoverDialogProps) {
  return (
    <AriaDialog {...props} className={cx('pb-popover-dialog', className)} />
  )
}
