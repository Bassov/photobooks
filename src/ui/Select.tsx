import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cx } from './className'
import { FieldFrame } from './Field'

export interface SelectOption {
  value: string
  label: string
  isDisabled?: boolean
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value'
> {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

/** Native single-select (keyboard and menu come from the platform). */
export function Select({
  value,
  onChange,
  options,
  label,
  hint,
  error,
  className,
  ...rest
}: SelectProps) {
  const id = useId()
  const describedBy =
    [hint ? `${id}-hint` : '', error ? `${id}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined
  return (
    <FieldFrame
      label={label}
      hint={hint}
      error={error}
      hintId={`${id}-hint`}
      errorId={`${id}-error`}
    >
      <select
        {...rest}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx('pb-field__control', 'pb-select', className)}
        onChange={(e) => {
          onChange(e.target.value)
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.isDisabled}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  )
}
