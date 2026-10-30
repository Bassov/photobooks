import type { CSSProperties } from 'react'
import type { ResolvedItem } from '../core'

/** Kit frame style as CSS: mat ring, then stroke ring outside it, rounded corners. */
export function frameStyleCss(
  style: ResolvedItem['style'],
  pxPerMm: number,
): CSSProperties {
  if (style === undefined) {
    return {}
  }
  const rings: string[] = []
  const mat = style.matMm * pxPerMm
  const stroke = style.strokeMm * pxPerMm
  if (mat > 0) {
    rings.push(`0 0 0 ${String(mat)}px ${style.matColor ?? '#ffffff'}`)
  }
  if (stroke > 0) {
    rings.push(
      `0 0 0 ${String(mat + stroke)}px ${style.strokeColor ?? '#1c1b1a'}`,
    )
  }
  return {
    ...(rings.length === 0 ? {} : { boxShadow: rings.join(', ') }),
    ...(style.cornerRadiusMm > 0
      ? { borderRadius: style.cornerRadiusMm * pxPerMm }
      : {}),
  }
}

/** CSS `filter` for kit Adjust: each −100…100 maps to 0…2 around 1. */
export function adjustFilter(
  adjust: ResolvedItem['adjust'],
): string | undefined {
  if (adjust === undefined) {
    return undefined
  }
  const amount = (n: number): string => String(1 + n / 100)
  return `brightness(${amount(adjust.brightness)}) contrast(${amount(adjust.contrast)}) saturate(${amount(adjust.saturation)})`
}
