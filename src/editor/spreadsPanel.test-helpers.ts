import { getSpreadIdsSnapshot, getSpreadPaintSnapshot } from './bookStore'
import { firstSlotAspect, spreadsRowGeometry } from './spreadsPanelModel'

/** Row stride the panel uses for the seeded book (unmeasured width → default). */
export function spreadsRowPx(): number {
  const ids = getSpreadIdsSnapshot()
  return spreadsRowGeometry(
    0,
    firstSlotAspect(getSpreadPaintSnapshot(ids[0] ?? '')?.resolved, ids.length),
  ).rowPx
}
