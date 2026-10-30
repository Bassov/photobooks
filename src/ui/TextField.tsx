import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from './className'
import { FieldFrame } from './Field'

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> {
  value: string
  onChange: (value: string) => void
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** Called on Enter (not while composing). */
  onSubmit?: () => void
}

/** Single-line text input. Grayscale field, ink focus ring. */
export function TextField({
  value,
  onChange,
  label,
  hint,
  error,
  onSubmit,
  onKeyDown,
  className,
  ...rest
}: TextFieldProps) {
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
      <input
        type="text"
        {...rest}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx('pb-field__control', className)}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            onSubmit?.()
          }
        }}
      />
    </FieldFrame>
  )
}
