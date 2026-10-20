import type { ReactNode } from 'react'
import {
  ToggleButtonGroup,
  type ToggleButtonGroupProps,
} from 'react-aria-components'
import { cx } from './className'
import { ToggleButton } from './ToggleButton'
import './SegmentedControl.css'

type SegmentedControlSize = 'sm' | 'md'

interface SegmentedControlItem {
  id: string
  label: ReactNode
  /** Accessible name when `label` is not plain text. */
  ariaLabel?: string
}

export interface SegmentedControlProps extends Omit<
  ToggleButtonGroupProps,
  | 'children'
  | 'className'
  | 'selectionMode'
  | 'selectedKeys'
  | 'defaultSelectedKeys'
  | 'onSelectionChange'
> {
  items: SegmentedControlItem[]
  /** Accessible name for the group. */
  label: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  size?: SegmentedControlSize
  className?: string
}

function keysProp(
  key: 'selectedKeys' | 'defaultSelectedKeys',
  value: string | undefined,
): Partial<Record<'selectedKeys' | 'defaultSelectedKeys', string[]>> {
  if (value === undefined) return {}
  return { [key]: [value] }
}

/** Single-select segmented control (muted track, raised selected pill). */
export function SegmentedControl({
  items,
  label,
  value,
  defaultValue,
  onChange,
  size = 'md',
  className,
  ...props
}: SegmentedControlProps) {
  if (items.length === 0) {
    throw new Error('SegmentedControl requires at least one item')
  }

  return (
    <ToggleButtonGroup
      {...props}
      selectionMode="single"
      disallowEmptySelection
      aria-label={label}
      {...keysProp('defaultSelectedKeys', defaultValue)}
      {...keysProp('selectedKeys', value)}
      onSelectionChange={(keys) => {
        const next = [...keys][0]
        if (next === undefined) return
        onChange?.(String(next))
      }}
      className={cx('pb-segmented', `pb-segmented--${size}`, className)}
      style={{
        gridTemplateColumns: `repeat(${String(items.length)}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item) => {
        const aria =
          item.ariaLabel === undefined ? {} : { 'aria-label': item.ariaLabel }
        return (
          <ToggleButton
            key={item.id}
            id={item.id}
            size="sm"
            {...aria}
            className="pb-segmented__segment"
          >
            {item.label}
          </ToggleButton>
        )
      })}
    </ToggleButtonGroup>
  )
}
