import type { ReactNode } from 'react'
import { cx } from './className'
import './Field.css'

/** Shared chrome for form controls: label, hint, error. */
export function FieldFrame({
  label,
  hint,
  error,
  hintId,
  errorId,
  className,
  children,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  hintId?: string
  errorId?: string
  className?: string | undefined
  children: ReactNode
}) {
  return (
    <label className={cx('pb-field', className)}>
      {label ? <span className="pb-field__label">{label}</span> : null}
      {children}
      {hint ? (
        <span id={hintId} className="pb-field__hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="pb-field__error">
          {error}
        </span>
      ) : null}
    </label>
  )
}

/** Groups related fields under a legend (column, or `row` to wrap). */
export function FieldGroup({
  legend,
  row = false,
  className,
  children,
  ...rest
}: {
  legend?: ReactNode
  row?: boolean
  className?: string
  children: ReactNode
  'data-testid'?: string
}) {
  return (
    <fieldset
      {...rest}
      className={cx('pb-field-group', row && 'pb-field-group--row', className)}
    >
      {legend ? (
        <legend className="pb-field-group__legend">{legend}</legend>
      ) : null}
      {children}
    </fieldset>
  )
}
