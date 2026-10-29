import type { ComponentProps } from 'react'
import {
  Keyboard as AriaKeyboard,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger as AriaMenuTrigger,
  Popover as AriaPopover,
  Separator as AriaSeparator,
  type MenuItemProps as AriaMenuItemProps,
  type MenuProps as AriaMenuProps,
  type MenuTriggerProps as AriaMenuTriggerProps,
  type PopoverProps,
  type SeparatorProps as AriaSeparatorProps,
} from 'react-aria-components'
import { cx } from './className'
import './Menu.css'

export function MenuTrigger(props: AriaMenuTriggerProps) {
  return <AriaMenuTrigger {...props} />
}

export interface MenuPopoverProps extends Omit<PopoverProps, 'className'> {
  className?: string
}

export function MenuPopover({
  className,
  offset = 6,
  ...props
}: MenuPopoverProps) {
  return (
    <AriaPopover
      {...props}
      offset={offset}
      className={cx('pb-menu-popover', className)}
    />
  )
}

export function Menu<T extends object>({
  className,
  ...props
}: AriaMenuProps<T> & { className?: string }) {
  return <AriaMenu {...props} className={cx('pb-menu', className)} />
}

export interface MenuItemProps extends Omit<AriaMenuItemProps, 'className'> {
  className?: string
  variant?: 'default' | 'destructive'
}

export function MenuItem({
  className,
  variant = 'default',
  ...props
}: MenuItemProps) {
  return (
    <AriaMenuItem
      {...props}
      data-variant={variant}
      className={cx('pb-menu-item', className)}
    />
  )
}

export function MenuKeyboard({
  className,
  ...props
}: Omit<ComponentProps<typeof AriaKeyboard>, 'className'> & {
  className?: string
}) {
  return (
    <AriaKeyboard {...props} className={cx('pb-menu-keyboard', className)} />
  )
}

export function MenuSeparator({
  className,
  ...props
}: AriaSeparatorProps & { className?: string }) {
  return (
    <AriaSeparator {...props} className={cx('pb-menu-separator', className)} />
  )
}
