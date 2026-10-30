import type { ReactNode } from 'react'
import {
  Button as AriaButton,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
  SelectValue,
} from 'react-aria-components'
import { cx } from './className'
import { Icon } from './Icon'
import './Field.css'
import './ListSelect.css'

interface ListSelectOption {
  value: string
  label: string
}

export interface ListSelectProps {
  value: string
  onChange: (value: string) => void
  options: ListSelectOption[]
  label?: ReactNode
  /** Accessible name when `label` is omitted. */
  'aria-label'?: string
  className?: string
  /** Goes on the trigger button. */
  'data-testid'?: string
}

/**
 * Kit Select: gray trigger, ListBox popover with ✓ on the current item. Opens
 * below the trigger (never flips over the field above it).
 */
export function ListSelect({
  value,
  onChange,
  options,
  label,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: ListSelectProps) {
  return (
    <AriaSelect
      value={value}
      onChange={(key) => {
        if (key !== null) {
          onChange(String(key))
        }
      }}
      {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
      className={cx('pb-list-select', className)}
    >
      {label ? <Label className="pb-field__label">{label}</Label> : null}
      <AriaButton className="pb-list-select__trigger" data-testid={testId}>
        <SelectValue />
        <Icon name="chevronDown" size={16} className="pb-list-select__chev" />
      </AriaButton>
      <Popover
        placement="bottom start"
        shouldFlip={false}
        offset={4}
        className="pb-list-select__popover"
      >
        <ListBox className="pb-list-select__list">
          {options.map((option) => (
            <ListBoxItem
              key={option.value}
              id={option.value}
              textValue={option.label}
              className="pb-list-select__item"
            >
              {({ isSelected }) => (
                <>
                  <span className="pb-list-select__check" aria-hidden="true">
                    {isSelected ? <Icon name="check" size={16} /> : null}
                  </span>
                  {option.label}
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  )
}
