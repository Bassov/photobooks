import { getSpreadIdsSnapshot, getSpreadPaintSnapshot } from './bookStore'
import { spreadsRowGeometry } from './spreadsPanelModel'

/** Row stride the panel uses for the seeded book (unmeasured width → default). */
export function spreadsRowPx(): number {
  const first = getSpreadIdsSnapshot()[0] ?? ''
  const resolved = getSpreadPaintSnapshot(first)?.resolved
  return spreadsRowGeometry(
    0,
    resolved === undefined
      ? 2
      : resolved.spreadWidthMm / resolved.spreadHeightMm,
  ).rowPx
}
