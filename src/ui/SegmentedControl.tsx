import { useId, useState, type ReactNode } from 'react'
import { cx } from './className'
import './SegmentedControl.css'

type SegmentedControlSize = 'sm' | 'md'

interface SegmentedControlItem<T extends string> {
  id: T
  label: ReactNode
  /** Accessible name when `label` is not plain text. */
  ariaLabel?: string
}

export interface SegmentedControlProps<T extends string = string> {
  items: SegmentedControlItem<T>[]
  /** Accessible name for the group. */
  label: string
  value?: T
  defaultValue?: T
  onChange?: (value: T) => void
  size?: SegmentedControlSize
  className?: string
  isDisabled?: boolean
}

/** Single-select segmented control (muted track, raised selected pill). */
export function SegmentedControl<T extends string = string>({
  items,
  label,
  value,
  defaultValue,
  onChange,
  size = 'md',
  className,
  isDisabled = false,
}: SegmentedControlProps<T>) {
  if (items.length === 0) {
    throw new Error('SegmentedControl requires at least one item')
  }

  const name = useId()
  const firstId = items[0]?.id ?? ''
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? firstId)
  const selected = value ?? uncontrolled

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('pb-segmented', `pb-segmented--${size}`, className)}
    >
      {items.map((item) => {
        const isSelected = selected === item.id
        return (
          <label
            key={item.id}
            className={cx(
              'pb-segmented__segment',
              isSelected && 'pb-segmented__segment--selected',
            )}
          >
            <input
              type="radio"
              name={name}
              value={item.id}
              checked={isSelected}
              disabled={isDisabled}
              aria-label={item.ariaLabel}
              data-selected={isSelected ? 'true' : undefined}
              data-disabled={isDisabled ? 'true' : undefined}
              onChange={() => {
                if (value === undefined) {
                  setUncontrolled(item.id)
                }
                onChange?.(item.id)
              }}
            />
            {item.label}
          </label>
        )
      })}
    </div>
  )
}
