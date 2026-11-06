import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cx } from './className'
import { FieldFrame } from './Field'

interface SelectOption {
  value: string
  label: string
  isDisabled?: boolean
  /** Consecutive options sharing a group render in one `<optgroup>`. */
  group?: string
}

function renderOption(o: SelectOption) {
  return (
    <option key={o.value} value={o.value} disabled={o.isDisabled}>
      {o.label}
    </option>
  )
}

/** Consecutive runs of the same group (ungrouped options stay as they are). */
function groupsOf(
  options: readonly SelectOption[],
): [string | undefined, SelectOption[]][] {
  const runs: [string | undefined, SelectOption[]][] = []
  for (const option of options) {
    const last = runs.at(-1)
    if (last !== undefined && last[0] === option.group) {
      last[1].push(option)
    } else {
      runs.push([option.group, [option]])
    }
  }
  return runs
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
        {groupsOf(options).map(([group, items]) =>
          group === undefined ? (
            items.map(renderOption)
          ) : (
            <optgroup key={group} label={group}>
              {items.map(renderOption)}
            </optgroup>
          ),
        )}
      </select>
    </FieldFrame>
  )
}
