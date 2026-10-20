import {
  Toolbar as AriaToolbar,
  type ToolbarProps as AriaToolbarProps,
} from 'react-aria-components'
import { cx } from './className'
import './Toolbar.css'

export interface ToolbarProps extends Omit<AriaToolbarProps, 'className'> {
  className?: string
}

/** Roving-focus toolbar container for action clusters. */
export function Toolbar({ className, ...props }: ToolbarProps) {
  return <AriaToolbar {...props} className={cx('pb-toolbar', className)} />
}
