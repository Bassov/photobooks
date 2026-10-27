import type { DragEvent, KeyboardEvent } from 'react'
import { useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { Icon } from '../ui/Icon'
import {
  dispatchBookOp,
  getSpreadIdsSnapshot,
  subscribeBookStore,
} from './bookStore'
import { pageLabel } from './editorChromePanels'
import { getActiveSpreadId, subscribeActiveSpreadId } from './photoRootSession'
import {
  SPREAD_DRAG_MIME,
  SPREAD_ITEM_GAP_PX,
  altArrowTarget,
  contentY,
  dropLineY,
  reorderShift,
  reorderTargetIndex,
  type ItemSpan,
} from './spreadReorder'
import { scrollPasteboardToSpread, selectedSpreadId } from './spreadsPanelModel'

interface DragState {
  from: number
  target: number
  spans: ItemSpan[]
}

/** Kit left spreads list wired to product bookStore (pages only — no masters). */
export function SpreadsPanel() {
  const spreadIds = useSyncExternalStore(
    subscribeBookStore,
    getSpreadIdsSnapshot,
    getSpreadIdsSnapshot,
  )
  const activeId = useSyncExternalStore(
    subscribeActiveSpreadId,
    getActiveSpreadId,
    getActiveSpreadId,
  )
  const selected = selectedSpreadId(activeId, spreadIds)
  const [drag, setDrag] = useState<DragState | null>(null)
  // The ref is the synchronous truth for handlers; state only drives render.
  const dragRef = useRef<DragState | null>(null)
  const setSession = (next: DragState | null): void => {
    dragRef.current = next
    setDrag(next)
  }
  const canReorder = spreadIds.length > 1

  // dragstart bubbles from the draggable item to the list.
  const onDragStart = (event: DragEvent<HTMLElement>): void => {
    const nodes = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-item]'),
    )
    const from = nodes.findIndex((el) => el === event.target)
    if (from < 0) {
      return
    }
    // Rects are content-relative (offsetTop), so list scroll mid-drag is safe.
    const spans = nodes.map((el) => ({
      top: el.offsetTop,
      height: el.offsetHeight + SPREAD_ITEM_GAP_PX,
    }))
    setSession({ from, target: from, spans })
    event.dataTransfer.setData(SPREAD_DRAG_MIME, String(from))
    event.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    const session = dragRef.current
    if (
      session === null ||
      !event.dataTransfer.types.includes(SPREAD_DRAG_MIME)
    ) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const scroller = event.currentTarget
    const y = contentY(
      event.clientY,
      scroller.getBoundingClientRect().top,
      scroller.scrollTop,
    )
    const target = reorderTargetIndex(session.spans, session.from, y)
    setSession({ ...session, target })
  }

  const onDrop = (event: DragEvent<HTMLElement>): void => {
    const session = dragRef.current
    if (session === null) {
      return
    }
    event.preventDefault()
    setSession(null)
    dispatchBookOp({
      type: 'moveSpread',
      spreadId: spreadIds[session.from] ?? '',
      toIndex: session.target,
    })
  }

  const onItemKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    id: string,
    index: number,
  ): void => {
    const to = altArrowTarget(event.key, event.altKey, index, spreadIds.length)
    if (to === null) {
      return
    }
    event.preventDefault()
    // A keyed reorder re-inserts the node and drops focus; restore it after a sync commit.
    const node = event.currentTarget
    flushSync(() => {
      dispatchBookOp({ type: 'moveSpread', spreadId: id, toIndex: to })
    })
    node.focus()
  }

  const lineY =
    drag === null ? null : dropLineY(drag.spans, drag.from, drag.target)

  return (
    <aside
      className="editor-spreads flex h-full min-h-0 flex-col"
      data-testid="spreads-panel"
    >
      <div className="shrink-0 px-3 pb-2 pt-3" data-testid="mode-seg">
        <div className="editor-spreads-mode flex h-6.5 items-center justify-center rounded-sm text-sm font-medium">
          Pages
        </div>
      </div>
      <div
        className="e7 scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-4 pl-3 pr-1"
        data-testid="spreads-list"
        data-scrollport="spreads-list"
        role="listbox"
        aria-label="Pages"
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={() => {
          setSession(null)
        }}
      >
        <div className="relative flex flex-col">
          {lineY === null ? null : (
            <div
              aria-hidden="true"
              data-testid="spread-drop-line"
              className="editor-spread-drop-line pointer-events-none absolute left-0 right-0 top-0 z-10 h-0.5 rounded-full"
              style={{ transform: `translateY(${String(lineY)}px)` }}
            />
          )}
          {spreadIds.map((id, i) => {
            const sel = id === selected
            const label = pageLabel(i)
            const shift =
              drag === null
                ? 0
                : reorderShift(drag.spans, drag.from, drag.target, i)
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={sel}
                className="e7-item group/sp relative mb-1 rounded-md p-2 data-[dragging]:opacity-40"
                data-item={id}
                data-dragging={drag?.from === i ? 'true' : undefined}
                data-first={i === 0 ? 'true' : 'false'}
                data-testid={`spread-list-item-${id}`}
                draggable={canReorder}
                aria-keyshortcuts={
                  canReorder ? 'Alt+ArrowUp Alt+ArrowDown' : undefined
                }
                style={
                  drag === null
                    ? undefined
                    : { transform: `translateY(${String(shift)}px)` }
                }
                onKeyDown={(event) => {
                  onItemKeyDown(event, id, i)
                }}
                onClick={() => {
                  scrollPasteboardToSpread(id)
                }}
              >
                <div className="editor-spread-thumb grid w-full place-items-center rounded-2xs">
                  <span className="text-2xs tabular-nums">{label}</span>
                </div>
                <div className="mt-1.5 flex text-2xs tabular-nums">
                  <span
                    data-label
                    className={sel ? 'font-semibold' : 'font-normal'}
                  >
                    {label}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-1 p-1">
        <button
          type="button"
          className="e7-ghost editor-add-spread flex flex-1 items-center justify-start gap-2 rounded-md px-2 text-sm"
          data-testid="add-spread"
          onClick={() => {
            dispatchBookOp({ type: 'addSpread' })
          }}
        >
          <Icon name="addSpread" size={14} />
          Add spread
        </button>
      </div>
    </aside>
  )
}
