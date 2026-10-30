import { useId, useState, type ReactNode } from 'react'
import { FieldFrame } from './Field'
import {
  clampNumber,
  decimalsOf,
  formatNumber,
  parseNumberText,
  stepNumber,
} from './numberField'

export interface NumberFieldProps {
  value: number
  onChange: (value: number) => void
  label?: ReactNode
  /** Accessible name when `label` is omitted or not plain text. */
  ariaLabel?: string
  hint?: ReactNode
  error?: ReactNode
  min?: number
  max?: number
  /** Arrow key step. */
  step?: number
  /** Shift+Arrow step (default 10 × step). */
  shiftStep?: number
  /** Suffix shown in the field. */
  unit?: string
  isDisabled?: boolean
  className?: string
  'data-testid'?: string
}

/**
 * Numeric input with a unit suffix. Arrow Up/Down step, Shift uses the big
 * step, Home/End jump to min/max; typed text is clamped on blur or Enter.
 */
export function NumberField({
  value,
  onChange,
  label,
  ariaLabel,
  hint,
  error,
  min = -Infinity,
  max = Infinity,
  step = 1,
  shiftStep = step * 10,
  unit = 'mm',
  isDisabled = false,
  className,
  'data-testid': testId,
}: NumberFieldProps) {
  const id = useId()
  const decimals = Math.max(decimalsOf(step), decimalsOf(shiftStep))
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? formatNumber(value, decimals)

  const commit = (next: number) => {
    const clamped = clampNumber(next, min, max)
    setDraft(null)
    if (clamped !== value) {
      onChange(clamped)
    }
  }

  const commitDraft = () => {
    if (draft === null) {
      return
    }
    const parsed = parseNumberText(draft)
    if (parsed === null) {
      setDraft(null)
    } else {
      commit(parsed)
    }
  }

  const base = () =>
    draft === null ? value : (parseNumberText(draft) ?? value)
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
      className={className}
    >
      <span
        className="pb-field__unit-wrap"
        data-invalid={error ? 'true' : undefined}
        data-disabled={isDisabled ? 'true' : undefined}
      >
        <input
          type="text"
          role="spinbutton"
          inputMode="decimal"
          className="pb-field__control"
          value={shown}
          disabled={isDisabled}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-valuenow={value}
          aria-valuemin={Number.isFinite(min) ? min : undefined}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuetext={`${formatNumber(value, decimals)} ${unit}`}
          data-testid={testId}
          onChange={(e) => {
            setDraft(e.target.value)
          }}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              commit(
                stepNumber({
                  value: base(),
                  min,
                  max,
                  step,
                  shiftStep,
                  direction: e.key === 'ArrowUp' ? 1 : -1,
                  shift: e.shiftKey,
                }),
              )
            } else if (e.key === 'Home' && Number.isFinite(min) && !draft) {
              e.preventDefault()
              commit(min)
            } else if (e.key === 'End' && Number.isFinite(max) && !draft) {
              e.preventDefault()
              commit(max)
            } else if (e.key === 'Enter') {
              commitDraft()
            } else if (e.key === 'Escape') {
              setDraft(null)
            }
          }}
        />
        <span className="pb-field__unit" aria-hidden="true">
          {unit}
        </span>
      </span>
    </FieldFrame>
  )
}
