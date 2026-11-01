import { useSyncExternalStore } from 'react'
import {
  frameStyleName,
  isAdjusted,
  layerOf,
  type Frame,
  type Spread,
} from '../core'
import { Disclosure } from '../ui/Disclosure'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import type { CropTarget } from './cropMode'
import {
  AdjustSection,
  CaptionSection,
  FrameStyleSection,
} from './FrameLookSections'
import {
  ArrangeSection,
  DeleteFrameButton,
  FrameLockButton,
  GeometrySection,
} from './FrameSections'

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

function readBook() {
  return getBookStoreSnapshot().book
}

function useSummaries(target: CropTarget): FrameSectionSummaries | undefined {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const spread = book.spreads.find((item) => item.id === target.spreadId)
  const frame = spread?.frames.find((item) => item.id === target.frameId)
  return spread === undefined || frame === undefined
    ? undefined
    : frameSectionSummaries(spread, frame)
}

/** Kit photo-frame sections below Rotate & flip, collapsed by default. */
export function PhotoFrameSections({ target }: { target: CropTarget }) {
  const summaries = useSummaries(target)
  return (
    <>
      <Disclosure
        title="Adjust"
        summary={summaries?.adjust}
        data-testid="inspector-adjust-disclosure"
      >
        <AdjustSection target={target} />
      </Disclosure>
      <Disclosure title="Caption" data-testid="inspector-caption-disclosure">
        <CaptionSection target={target} />
      </Disclosure>
      <Disclosure
        title="Position & size"
        right={<FrameLockButton target={target} />}
        data-testid="inspector-geometry-disclosure"
      >
        <GeometrySection target={target} />
      </Disclosure>
      <Disclosure
        title="Frame style"
        summary={summaries?.style}
        data-testid="inspector-style-disclosure"
      >
        <FrameStyleSection target={target} />
      </Disclosure>
      <Disclosure
        title="Arrange"
        summary={summaries?.arrange}
        data-testid="inspector-arrange-disclosure"
      >
        <ArrangeSection target={target} />
      </Disclosure>
      <DeleteFrameButton target={target} />
    </>
  )
}
