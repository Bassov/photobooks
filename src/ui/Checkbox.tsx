import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from './className'
import { Icon } from './Icon'
import './Field.css'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  /** Mixed state; shown as a bar. A click resolves it to checked. */
  isIndeterminate?: boolean
  isDisabled?: boolean
  isInvalid?: boolean
  className?: string
  'data-testid'?: string
}

/** Checkbox on the `--sel` tone; selected fills with ink. */
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
          <span className="pb-check__bar" />
        ) : checked ? (
          <Icon name="check" size={14} />
        ) : null}
      </span>
      {children}
    </label>
  )
}
