import { useMemo, useSyncExternalStore, type PointerEvent } from 'react'
import { Button } from 'react-aria-components'
import { Icon } from '../ui/Icon'
import { Tooltip, TooltipTrigger } from '../ui/Tooltip'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import {
  cycleLayout,
  layoutCycleBlocked,
  layoutCycleOf,
  subscribeLayoutCycleBlocked,
} from './layoutCycle'
import { LAYOUT_CYCLE_MIN_GAP_PX } from './pageLabelsModel'
import { getSavedTemplates, subscribeSavedTemplates } from './savedTemplates'
import './LayoutCycle.css'

const readBook = () => getBookStoreSnapshot().book

// Grey-click activation and the pasteboard's own handlers stay out of it.
const stop = (event: PointerEvent) => {
  event.stopPropagation()
}

function CycleButton({ spreadId, dir }: { spreadId: string; dir: 1 | -1 }) {
  const label = dir > 0 ? 'Next layout' : 'Previous layout'
  return (
    <TooltipTrigger>
      <Button
        className="layout-cycle-button"
        aria-label={label}
        data-testid={dir > 0 ? 'layout-cycle-next' : 'layout-cycle-prev'}
        onPress={() => {
          cycleLayout(spreadId, dir)
        }}
      >
        <Icon name={dir > 0 ? 'chevronRight' : 'chevronLeft'} size={16} />
      </Button>
      <Tooltip placement="top">{`${label} ${dir > 0 ? '⇧]' : '⇧['}`}</Tooltip>
    </TooltipTrigger>
  )
}

/**
 * Designer cycle-layouts CL3: the active spread's layout pill, centred 8 px
 * above its paper at a constant screen size (`data-camera-frame`). Slot 0
 * always has room; a stacked slot passes its gap so a live zoom hides the
 * pill in the same frame the gap drops under LAYOUT_CYCLE_MIN_GAP_PX.
 */
export function LayoutCycle({
  spreadId,
  slotIndex,
  side,
  gapPx,
}: {
  spreadId: string
  slotIndex: number
  side: 'left' | 'right' | null
  gapPx: number
}) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const mine = useSyncExternalStore(
    subscribeSavedTemplates,
    getSavedTemplates,
    getSavedTemplates,
  )
  const blocked = useSyncExternalStore(
    subscribeLayoutCycleBlocked,
    layoutCycleBlocked,
    layoutCycleBlocked,
  )
  const spread = book.spreads[slotIndex]
  // Template geometry depends on the spread, grid, trim and spread count only.
  const cycle = useMemo(
    () => layoutCycleOf(book, slotIndex, mine),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
    [
      spread,
      book.layoutGrid,
      book.settings,
      book.spreads.length,
      slotIndex,
      mine,
    ],
  )
  if (blocked || spread?.id !== spreadId || cycle.set.length < 2) {
    return null
  }
  const { set, index, name } = cycle
  const position = index < 0 ? '–' : String(index + 1)
  const total = String(set.length)
  return (
    <div
      className="layout-cycle"
      role="group"
      aria-label="Layout"
      data-testid="layout-cycle"
      data-camera-frame=""
      data-page-side={side ?? undefined}
      data-gap-px={slotIndex === 0 ? undefined : gapPx}
      data-gap-min={LAYOUT_CYCLE_MIN_GAP_PX}
      onPointerDown={stop}
    >
      <CycleButton spreadId={spreadId} dir={-1} />
      <span
        className="layout-cycle-name"
        data-custom={index < 0 ? 'true' : undefined}
        aria-hidden="true"
      >
        {set.map((item) => (
          <span key={item.id} className="layout-cycle-width">
            {item.name}
          </span>
        ))}
        <span data-testid="layout-cycle-name">{name}</span>
      </span>
      <span
        className="layout-cycle-pos"
        aria-hidden="true"
        data-testid="layout-cycle-pos"
      >
        {`${position}/${total}`}
      </span>
      <CycleButton spreadId={spreadId} dir={1} />
      <span className="sr-only" aria-live="polite">
        {`${name}, ${position} of ${total}`}
      </span>
    </div>
  )
}
