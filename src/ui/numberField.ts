/** Pure value helpers for NumberField: parse, clamp, step, format. */

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Number of decimals needed to show `n` exactly (capped at 6). */
export function decimalsOf(n: number): number {
  if (!Number.isFinite(n)) {
    return 0
  }
  const text = String(n)
  const dot = text.indexOf('.')
  return dot < 0 ? 0 : Math.min(6, text.length - dot - 1)
}

/** Accepts `12`, `12.5`, `12,5`, surrounding space; null when not a number. */
export function parseNumberText(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) {
    return null
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals)
}

export interface StepInput {
  value: number
  min: number
  max: number
  step: number
  shiftStep: number
  direction: 1 | -1
  shift: boolean
}

/** One keyboard step, clamped and rounded to the step's precision. */
export function stepNumber({
  value,
  min,
  max,
  step,
  shiftStep,
  direction,
  shift,
}: StepInput): number {
  const delta = shift ? shiftStep : step
  const decimals = Math.max(decimalsOf(delta), decimalsOf(value))
  const next = Number((value + direction * delta).toFixed(decimals))
  return clampNumber(next, min, max)
}
