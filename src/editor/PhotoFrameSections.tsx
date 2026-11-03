import { useSyncExternalStore } from 'react'
import { editableSpread } from '../core'
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
import {
  frameSectionSummaries,
  type FrameSectionSummaries,
} from './frameSectionSummaries'

function readBook() {
  return getBookStoreSnapshot().book
}

function useSummaries(target: CropTarget): FrameSectionSummaries | undefined {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  // A master item (Masters canvas) resolves through its parent's spread view.
  const spread = editableSpread(book, target.spreadId)?.spread
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
