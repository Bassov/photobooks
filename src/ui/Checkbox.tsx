import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from './className'
import { Icon } from './Icon'
import './Field.css'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  /** Mixed state; shown as a minus. A click resolves it to checked. */
  isIndeterminate?: boolean
  isDisabled?: boolean
  isInvalid?: boolean
  className?: string
  'data-testid'?: string
}

/** Kit Checkbox: `--sel` box; selected / mixed fill with `--color-mark`. */
export function Checkbox({
  checked,
  onChange,
  children,
  isIndeterminate = false,
  isDisabled = false,
  isInvalid = false,
  className,
  'data-testid': testId,
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = isIndeterminate
    }
  }, [isIndeterminate])

  return (
    <label
      className={cx('pb-check', className)}
      data-disabled={isDisabled ? 'true' : undefined}
    >
      <input
        ref={ref}
        type="checkbox"
        className="pb-check__input"
        checked={checked}
        disabled={isDisabled}
        aria-invalid={isInvalid ? true : undefined}
        data-testid={testId}
        onChange={(e) => {
          onChange(e.target.checked)
        }}
      />
      <span className="pb-check__box" aria-hidden="true">
        {isIndeterminate ? (
          <Icon name="minus" size={16} />
        ) : checked ? (
          <Icon name="check" size={16} />
        ) : null}
      </span>
      {children}
    </label>
  )
}
