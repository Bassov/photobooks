import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { Menu, MenuItem, MenuPopover, MenuTrigger } from '../ui/Menu'
import type { PhotobooksToastQueue } from '../ui/toastQueue'
import {
  dispatchBookOp,
  getSpreadIdsSnapshot,
  subscribeBookStore,
  undoBook,
} from './bookStore'
import { pageLabel } from './editorChromePanels'
import { getActiveSpreadId, subscribeActiveSpreadId } from './photoRootSession'
import {
  SPREAD_DRAG_MIME,
  altArrowTarget,
  contentY,
  dropLineY,
  reorderShift,
  reorderTargetIndex,
  type ItemSpan,
} from './spreadReorder'
import { SpreadThumb } from './SpreadThumb'
import './SpreadsPanel.css'
import {
  canDeleteSpread,
  neighbourAfterDelete,
  scrollPasteboardToSpread,
  scrollTopToReveal,
  selectedSpreadId,
  SPREADS_ROW_PX,
  SPREADS_THUMB_HEIGHT_PX,
  spreadsKeyAction,
  spreadsListWindow,
} from './spreadsPanelModel'

type RowAction = 'add' | 'duplicate' | 'delete'

function revealRow(list: HTMLElement, index: number): void {
  const next = scrollTopToReveal(index, list.scrollTop, list.clientHeight)
  if (next !== null) {
    list.scrollTop = next
  }
}

function run(
  action: RowAction,
  id: string,
  toastQueue: PhotobooksToastQueue | undefined,
): void {
  const before = getSpreadIdsSnapshot()
  if (action === 'delete') {
    const next = neighbourAfterDelete(before, id)
    if (next === null) {
      return
    }
    dispatchBookOp({ type: 'removeSpread', spreadId: id })
    toastQueue?.add(
      {
        title: 'Spread deleted',
        testId: 'spread-deleted-toast',
        action: { label: 'Undo', onAction: undoBook },
      },
      { timeout: 6000 },
    )
    scrollPasteboardToSpread(next)
    return
  }
  const at = before.indexOf(id) + 1
  dispatchBookOp(
    action === 'add'
      ? { type: 'addSpread', index: at }
      : { type: 'duplicateSpread', spreadId: id },
  )
  scrollPasteboardToSpread(getSpreadIdsSnapshot()[at] ?? id)
}

interface DragState {
  from: number
  target: number
  spans: ItemSpan[]
}

/** Kit left spreads list wired to product bookStore (pages only — no masters). */
export function SpreadsPanel({
  toastQueue,
  modeSwitch,
}: {
  toastQueue?: PhotobooksToastQueue | undefined
  modeSwitch?: ReactNode
}) {
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
  // State, not a ref: the reveal effect re-runs once the list is attached.
  const [listNode, setListNode] = useState<HTMLDivElement | null>(null)
  // Quantized to whole rows so React bails out while the window is unchanged.
  const [firstRow, setFirstRow] = useState(0)
  const [viewport, setViewport] = useState(0)

  // React 19 ref callback: `node` is never null here; the cleanup runs on detach.
  const attachList = useCallback((node: HTMLDivElement) => {
    setListNode(node)
    const measure = (): void => {
      setViewport(node.clientHeight)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

  // Keep the selected row visible when the pasteboard changes the active spread.
  useEffect(() => {
    if (listNode === null) {
      return
    }
    revealRow(listNode, spreadIds.indexOf(selected ?? ''))
  }, [listNode, selected, spreadIds])

  const win = spreadsListWindow(
    spreadIds.length,
    firstRow * SPREADS_ROW_PX,
    viewport,
  )
  const visible = spreadIds.slice(win.start, win.end)
  // Roving tab stop must live on a mounted row even when the selection is windowed out.
  const tabStop =
    selected !== null && visible.includes(selected) ? selected : visible[0]

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const id =
      event.target instanceof HTMLElement
        ? event.target.dataset.item
        : undefined
    if (id === undefined) {
      return
    }
    if (reorderByKey(event, id)) {
      return
    }
    const action = spreadsKeyAction(event)
    if (action.kind === 'none') {
      return
    }
    event.preventDefault()
    if (action.kind !== 'move') {
      run(action.kind, id, toastQueue)
      return
    }
    const next = spreadIds[spreadIds.indexOf(id) + action.delta]
    if (next !== undefined) {
      scrollPasteboardToSpread(next)
      listNode
        ?.querySelector<HTMLElement>(`[data-item="${CSS.escape(next)}"]`)
        ?.focus()
    }
  }

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
    const id =
      event.target instanceof HTMLElement
        ? event.target.dataset.item
        : undefined
    const from = id === undefined ? -1 : spreadIds.indexOf(id)
    if (from < 0) {
      return
    }
    // Rows have a fixed stride, so spans are exact even for windowed-out rows.
    const spans: ItemSpan[] = spreadIds.map((_, i) => ({
      top: i * SPREADS_ROW_PX,
      height: SPREADS_ROW_PX,
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

  // Alt+↑/↓ reorders; returns true when the key was a reorder attempt.
  const reorderByKey = (
    event: KeyboardEvent<HTMLElement>,
    id: string,
  ): boolean => {
    if (!event.altKey || !event.key.startsWith('Arrow')) {
      return false
    }
    const to = altArrowTarget(
      event.key,
      event.altKey,
      spreadIds.indexOf(id),
      spreadIds.length,
    )
    if (to === null) {
      return true
    }
    event.preventDefault()
    // A keyed reorder re-inserts the node and drops focus; restore it after a sync commit.
    flushSync(() => {
      dispatchBookOp({ type: 'moveSpread', spreadId: id, toIndex: to })
    })
    revealRow(event.currentTarget, to)
    event.currentTarget
      .querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"]`)
      ?.focus()
    return true
  }

  const lineY =
    drag === null ? null : dropLineY(drag.spans, drag.from, drag.target)

  return (
    <aside
      className="editor-spreads flex h-full min-h-0 flex-col"
      data-testid="spreads-panel"
      style={
        {
          '--spreads-thumb-h': `${String(SPREADS_THUMB_HEIGHT_PX)}px`,
        } as CSSProperties
      }
    >
      <div className="shrink-0 px-3 pb-2 pt-3" data-testid="mode-seg">
        {modeSwitch ?? (
          <div className="editor-spreads-mode flex h-6.5 items-center justify-center rounded-sm text-sm font-medium">
            Pages
          </div>
        )}
      </div>
      <div
        ref={attachList}
        className="e7 scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-4 pl-3 pr-1"
        data-testid="spreads-list"
        data-scrollport="spreads-list"
        role="listbox"
        aria-label="Pages"
        onKeyDown={onKeyDown}
        onScroll={(event) => {
          setFirstRow(
            Math.floor(event.currentTarget.scrollTop / SPREADS_ROW_PX),
          )
        }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={() => {
          setSession(null)
        }}
      >
        <div className="relative">
          {lineY === null ? null : (
            <div
              aria-hidden="true"
              data-testid="spread-drop-line"
              className="editor-spread-drop-line pointer-events-none absolute left-0 right-0 top-0 z-10 h-0.5 rounded-full"
              style={{ transform: `translateY(${String(lineY)}px)` }}
            />
          )}
          <div
            style={{ height: win.leadPx }}
            data-testid="spreads-lead"
            aria-hidden
          />
          {visible.map((id, offset) => {
            const i = win.start + offset
            const sel = id === selected
            const label = pageLabel(i)
            const shift =
              drag === null
                ? 0
                : reorderShift(drag.spans, drag.from, drag.target, i)
            return (
              <div
                key={id}
                role="presentation"
                className="group/sp relative"
                style={{
                  height: SPREADS_ROW_PX,
                  transform:
                    drag === null
                      ? undefined
                      : `translateY(${String(shift)}px)`,
                }}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={sel}
                  tabIndex={id === tabStop ? 0 : -1}
                  className="e7-item rounded-md p-2 data-[dragging]:opacity-40"
                  data-item={id}
                  data-dragging={drag?.from === i ? 'true' : undefined}
                  data-first={i === 0 ? 'true' : 'false'}
                  data-testid={`spread-list-item-${id}`}
                  draggable={canReorder}
                  aria-keyshortcuts={
                    canReorder ? 'Alt+ArrowUp Alt+ArrowDown' : undefined
                  }
                  onClick={() => {
                    scrollPasteboardToSpread(id)
                  }}
                >
                  <div className="editor-spread-thumb grid w-full place-items-center rounded-2xs">
                    <SpreadThumb
                      spreadId={id}
                      heightPx={SPREADS_THUMB_HEIGHT_PX}
                    />
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
                <MenuTrigger>
                  <IconButton
                    label="Spread actions"
                    size="sm"
                    tooltip={false}
                    className="absolute right-3 top-3"
                    data-testid={`spread-menu-${id}`}
                  >
                    <Icon name="moreHorizontal" size={14} />
                  </IconButton>
                  <MenuPopover placement="bottom end" className="w-44">
                    <Menu
                      className="[&_svg]:size-4"
                      onAction={(key) => {
                        run(String(key) as RowAction, id, toastQueue)
                      }}
                    >
                      <MenuItem
                        id="add"
                        textValue="Add after"
                        data-testid="spread-menu-add"
                      >
                        <Icon name="addSpread" size={16} />
                        Add after
                      </MenuItem>
                      <MenuItem
                        id="duplicate"
                        textValue="Duplicate"
                        data-testid="spread-menu-duplicate"
                      >
                        <Icon name="duplicate" size={16} />
                        Duplicate
                      </MenuItem>
                      <MenuItem
                        id="delete"
                        textValue="Delete"
                        variant="destructive"
                        isDisabled={!canDeleteSpread(spreadIds.length)}
                        data-testid="spread-menu-delete"
                      >
                        <Icon name="delete" size={16} />
                        Delete
                      </MenuItem>
                    </Menu>
                  </MenuPopover>
                </MenuTrigger>
              </div>
            )
          })}
          <div
            style={{ height: win.tailPx }}
            data-testid="spreads-tail"
            aria-hidden
          />
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
