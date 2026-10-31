import { useRef, useState, type ReactNode } from 'react'
import {
  Label,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  type SliderState,
} from 'react-aria-components'
import { FIELD, SUB, T } from './editorChromeTokens'
import './FitCropSection.css'
import './InspectorControls.css'

/** Kit `Row`: muted label left, control right. */
export function InspectorRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span style={{ color: SUB }}>{label}</span>
      {children}
    </div>
  )
}

/** Kit `Val` (uikit/src/sandbox/v7.tsx:149): FIELD pill, optional muted note beside it. */
export function ReadOnlyPill({
  value,
  note,
  testId,
  noteTestId,
}: {
  value: string
  note?: string
  testId?: string
  noteTestId?: string
}) {
  return (
    <span className="flex items-center">
      <span
        className="rounded-sm px-2 py-1 text-sm"
        style={{ background: FIELD, color: T }}
        data-testid={testId}
      >
        {value}
      </span>
      {note === undefined ? null : (
        <span
          className="ml-1.5 text-2xs text-muted-foreground"
          style={{ color: SUB }}
          data-testid={noteTestId}
        >
          {note}
        </span>
      )}
    </span>
  )
}

/** Kit `Toggle`: a switch (role=switch). */
export function ToggleSwitch({
  label,
  on,
  onChange,
  testId,
}: {
  label: string
  on: boolean
  onChange: (next: boolean) => void
  testId?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="insp-toggle"
      data-testid={testId}
      onClick={() => {
        onChange(!on)
      }}
    >
      <span className="insp-toggle-knob" />
    </button>
  )
}

export interface SwatchOption {
  value: string
  name: string
}

/** Kit `Swatches`: round colour chips, the selected one ringed. */
export function Swatches({
  label,
  options,
  value,
  onChange,
  testId,
}: {
  label: string
  options: readonly SwatchOption[]
  value: string | undefined
  onChange: (value: string) => void
  testId?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-1.5"
      data-testid={testId}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="insp-swatch"
          aria-label={option.name}
          aria-pressed={option.value === value}
          data-swatch={option.value}
          style={{ background: option.value }}
          onClick={() => {
            onChange(option.value)
          }}
        />
      ))}
    </div>
  )
}

/**
 * Kit `SliderValueField` (uikit components/ui/slider.tsx): the slider value as
 * a text field. Focus shows the bare number; Enter / blur commits it clamped to
 * the range, Escape restores the formatted value.
 */
function SliderValueField({
  label,
  state,
}: {
  label: string
  state: SliderState
}) {
  const [draft, setDraftState] = useState<string | null>(null)
  // Enter / Escape blur synchronously: the blur handler must see the cleared
  // draft, not this render's copy, or Escape would commit the typed value.
  const draftRef = useRef<string | null>(null)
  const setDraft = (next: string | null) => {
    draftRef.current = next
    setDraftState(next)
  }
  const commit = () => {
    const current = draftRef.current
    if (current === null) return
    const n = parseFloat(current.replace(',', '.'))
    if (Number.isFinite(n)) {
      state.setThumbValue(
        0,
        Math.min(
          state.getThumbMaxValue(0),
          Math.max(state.getThumbMinValue(0), n),
        ),
      )
    }
    setDraft(null)
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={`${label} value`}
      data-testid="slider-value"
      className="insp-slider-value font-medium tabular-nums"
      value={draft ?? state.getThumbValueLabel(0)}
      onFocus={(event) => {
        setDraft(String(state.getThumbValue(0)))
        event.target.select()
      }}
      onChange={(event) => {
        setDraft(event.target.value)
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit()
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          setDraft(null)
          event.currentTarget.blur()
        }
      }}
    />
  )
}

/**
 * Kit `SliderRow` on slider B (fit-crop-*): label, value readout, track.
 * `editableValue`: the kit SliderValueField instead of a read-only output.
 */
export function InspectorSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  testId,
  editableValue = false,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: Intl.NumberFormatOptions['unit']
  onChange: (value: number) => void
  testId?: string
  editableValue?: boolean
}) {
  return (
    <Slider
      className="fit-crop-slider"
      data-testid={testId}
      minValue={min}
      maxValue={max}
      step={step}
      value={value}
      onChange={onChange}
      {...(unit === undefined
        ? {}
        : {
            formatOptions: {
              style: 'unit',
              unit,
              unitDisplay: 'short',
            } satisfies Intl.NumberFormatOptions,
          })}
    >
      {({ state }) => (
        <>
          <div className="flex items-center justify-between text-xs">
            <Label className="fit-crop-label">{label}</Label>
            {editableValue ? (
              <SliderValueField label={label} state={state} />
            ) : (
              <SliderOutput className="font-medium tabular-nums" />
            )}
          </div>
          <SliderTrack
            className="fit-crop-track"
            onDoubleClick={() => {
              onChange(0)
            }}
          >
            <div
              className="fit-crop-fill"
              style={{ width: `${String(state.getThumbPercent(0) * 100)}%` }}
            />
            <SliderThumb className="fit-crop-thumb" />
          </SliderTrack>
        </>
      )}
    </Slider>
  )
}
