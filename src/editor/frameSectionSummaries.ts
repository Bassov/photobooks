import {
  frameStyleName,
  isAdjusted,
  layerOf,
  type Frame,
  type Spread,
} from '../core'

export interface FrameSectionSummaries {
  adjust: string | undefined
  style: string
  arrange: string
}

/**
 * Collapsed-row summaries of the kit frame sections: Adjust "Edited",
 * Frame style name (`cur.name`), Arrange `z <layer>` (bottom = 1).
 */
export function frameSectionSummaries(
  spread: Spread,
  frame: Frame,
): FrameSectionSummaries {
  return {
    adjust: isAdjusted(frame.adjust) ? 'Edited' : undefined,
    style:
      frame.frameStyleId === undefined
        ? 'None'
        : frameStyleName(frame.frameStyleId),
    arrange: `z ${String(layerOf(spread, frame.id)?.layer)}`,
  }
}
