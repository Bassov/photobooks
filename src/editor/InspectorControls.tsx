import type { ReactNode } from 'react'
import {
  Label,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components'
import { SUB } from './editorChromeTokens'
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

/** Kit `SliderRow` on slider B (fit-crop-*): label, value readout, track. */
export function InspectorSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  testId,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: Intl.NumberFormatOptions['unit']
  onChange: (value: number) => void
  testId?: string
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
      <div className="flex items-center justify-between text-xs">
        <Label className="fit-crop-label">{label}</Label>
        <SliderOutput className="font-medium tabular-nums" />
      </div>
      <SliderTrack
        className="fit-crop-track"
        onDoubleClick={() => {
          onChange(0)
        }}
      >
        {({ state }) => (
          <>
            <div
              className="fit-crop-fill"
              style={{ width: `${String(state.getThumbPercent(0) * 100)}%` }}
            />
            <SliderThumb className="fit-crop-thumb" />
          </>
        )}
      </SliderTrack>
    </Slider>
  )
}
