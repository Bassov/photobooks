import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { bookSpineWidthMm } from '../core'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  Menu,
  MenuItem,
  MenuKeyboard,
  MenuPopover,
  MenuSeparator,
  MenuTrigger,
} from '../ui/Menu'
import type { PhotobooksToastQueue } from '../ui/toastQueue'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getSpreadIdsSnapshot,
  getSpreadPaintSnapshot,
  subscribeBookStore,
  subscribeSpread,
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
import { CoverCanvas } from './CoverCanvas'
import {
  isCoverSelected,
  setCoverSelected,
  subscribeCoverSelection,
} from './coverSelection'
import { EndpaperRow } from './EndpaperRow'
import {
  getSelectedEndpaper,
  subscribeEndpaperSelection,
} from './endpaperSelection'
import { SpreadRowEmpty } from './SpreadRowEmpty'
import { SpreadRowMissing } from './SpreadRowMissing'
import { SpreadThumb } from './SpreadThumb'
import { ThumbCard } from './ThumbCard'
import './SpreadsPanel.css'
import {
  canDeleteSpread,
  coverCardRatio,
  neighbourAfterDelete,
  scrollPasteboardToSpread,
  scrollTopToReveal,
  selectedSpreadId,
  spreadsKeyAction,
  spreadsListWindow,
  spreadsRowGeometry,
} from './spreadsPanelModel'

function endpapersEnabled(): boolean {
  return getBookStoreSnapshot().book.settings.endpapers.enabled
}

function coverRatio(): number {
  const { book } = getBookStoreSnapshot()
  return coverCardRatio(book.settings.trim, bookSpineWidthMm(book))
}

type RowAction = 'add' | 'duplicate' | 'delete'

function revealRow(
  list: HTMLElement,
  index: number,
  rowPx: number,
  headPx: number,
): void {
  const next = scrollTopToReveal(
    index,
    list.scrollTop,
    list.clientHeight,
    rowPx,
    headPx,
  )
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

/** Spread width / height, or the 2:1 default while the book has no spread. */
function spreadAspect(spreadId: string): number {
  const resolved = getSpreadPaintSnapshot(spreadId)?.resolved
  return resolved === undefined
    ? 2
    : resolved.spreadWidthMm / resolved.spreadHeightMm
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
  const coverSelected = useSyncExternalStore(
    subscribeCoverSelection,
    isCoverSelected,
    isCoverSelected,
  )
  const endpapersOn = useSyncExternalStore(
    subscribeBookStore,
    endpapersEnabled,
    endpapersEnabled,
  )
  const endpaperPicked = useSyncExternalStore(
    subscribeEndpaperSelection,
    getSelectedEndpaper,
    getSelectedEndpaper,
  )
  const coverCard = useSyncExternalStore(
    subscribeBookStore,
    coverRatio,
    coverRatio,
  )
  const selected =
    coverSelected || endpaperPicked !== null
      ? null
      : selectedSpreadId(activeId, spreadIds)
  // State, not a ref: the reveal effect re-runs once the list is attached.
  const [listNode, setListNode] = useState<HTMLDivElement | null>(null)
  // Quantized to whole rows so React bails out while the window is unchanged.
  const [firstRow, setFirstRow] = useState(0)
  const [viewport, setViewport] = useState(0)
  const [listWidth, setListWidth] = useState(0)
  // Cover / front Endpaper rows above the spreads, inside the same scroller.
  const [headPx, setHeadPx] = useState(0)
  const aspect = useSyncExternalStore(
    (listener) => subscribeSpread(spreadIds[0] ?? '', listener),
    () => spreadAspect(spreadIds[0] ?? ''),
    () => spreadAspect(spreadIds[0] ?? ''),
  )
  const geometry = spreadsRowGeometry(listWidth, aspect)
  const rowPx = geometry.rowPx

  const headRef = useRef<HTMLDivElement>(null)

  // React 19 ref callback: `node` is never null here; the cleanup runs on detach.
  // Child refs attach first, so the head is already in `headRef`.
  const attachList = useCallback((node: HTMLDivElement) => {
    setListNode(node)
    const head = headRef.current
    const measure = (): void => {
      setViewport(node.clientHeight)
      setListWidth(node.clientWidth)
      setHeadPx(head?.offsetHeight ?? 0)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    if (head !== null) {
      observer.observe(head)
    }
    return () => {
      observer.disconnect()
    }
  }, [])

  // Keep the selected row visible when the pasteboard changes the active spread.
  useEffect(() => {
    if (listNode === null) {
      return
    }
    revealRow(listNode, spreadIds.indexOf(selected ?? ''), rowPx, headPx)
  }, [listNode, selected, spreadIds, rowPx, headPx])

  const win = spreadsListWindow(
    spreadIds.length,
    firstRow * rowPx,
    viewport,
    rowPx,
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
      top: i * rowPx,
      height: rowPx,
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
    // Spans start at the first spread row, below the Cover / Endpaper head.
    const y =
      contentY(
        event.clientY,
        scroller.getBoundingClientRect().top,
        scroller.scrollTop,
      ) - headPx
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
    revealRow(event.currentTarget, to, rowPx, headPx)
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
    >
      <div className="shrink-0 px-3 pb-2 pt-3" data-testid="mode-seg">
        {modeSwitch ?? (
          <div className="editor-spreads-mode flex h-6.5 items-center justify-center rounded-sm text-sm font-medium">
            Pages
          </div>
        )}
      </div>
      {/* Kit chrome.tsx:272-277: Cover, Endpaper, pages, Endpaper are one scrolling list. */}
      <div
        ref={attachList}
        className="e7 scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-4 pl-3 pr-1 [contain:layout_paint]"
        data-testid="spreads-list"
        data-scrollport="spreads-list"
        onKeyDown={onKeyDown}
        onScroll={(event) => {
          setFirstRow(
            Math.floor(
              Math.max(0, event.currentTarget.scrollTop - headPx) / rowPx,
            ),
          )
        }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={() => {
          setSession(null)
        }}
      >
        <div ref={headRef} className="flex flex-col" data-testid="cover-list">
          <button
            type="button"
            aria-pressed={coverSelected}
            aria-label="Cover"
            className="e7-item relative mb-1 rounded-md p-2"
            data-cover-row=""
            data-testid="cover-list-item"
            onClick={() => {
              setCoverSelected(true)
            }}
          >
            <ThumbCard ratio={coverCard}>
              <CoverCanvas mini />
            </ThumbCard>
            <div className="mt-1.5 flex text-2xs tabular-nums">
              <span
                data-label
                className={coverSelected ? 'font-semibold' : 'font-normal'}
              >
                Cover
              </span>
            </div>
          </button>
          {endpapersOn ? <EndpaperRow side="front" /> : null}
        </div>
        <div className="relative" role="listbox" aria-label="Pages">
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
                data-selected={sel ? 'true' : undefined}
                style={{
                  height: rowPx,
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
                    setCoverSelected(false)
                    scrollPasteboardToSpread(id)
                  }}
                >
                  <div
                    className="editor-spread-thumb grid w-full place-items-center"
                    style={{ height: geometry.boxHeightPx }}
                  >
                    <SpreadThumb
                      spreadId={id}
                      boxWidthPx={geometry.boxWidthPx}
                      boxHeightPx={geometry.boxHeightPx}
                    />
                  </div>
                  <div className="mt-1.5 flex text-2xs tabular-nums">
                    <span
                      data-label
                      className={sel ? 'font-semibold' : 'font-normal'}
                    >
                      {label}
                    </span>
                    <SpreadRowEmpty spreadId={id} />
                    <SpreadRowMissing spreadId={id} />
                  </div>
                </button>
                <MenuTrigger>
                  <IconButton
                    label={`Pages ${label} actions`}
                    size="sm"
                    tooltip={false}
                    className="spread-row-menu"
                    data-testid={`spread-menu-${id}`}
                  >
                    <Icon name="moreHorizontal" size={14} />
                  </IconButton>
                  <MenuPopover placement="bottom end" className="w-44">
                    <Menu
                      className="[&_svg]:size-4 [&_svg]:text-muted-foreground"
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
                        <MenuKeyboard>Ctrl+↵</MenuKeyboard>
                      </MenuItem>
                      <MenuItem
                        id="duplicate"
                        textValue="Duplicate"
                        data-testid="spread-menu-duplicate"
                      >
                        <Icon name="duplicate" size={16} />
                        Duplicate
                        <MenuKeyboard>Ctrl+D</MenuKeyboard>
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        id="delete"
                        textValue="Delete"
                        variant="destructive"
                        isDisabled={!canDeleteSpread(spreadIds.length)}
                        data-testid="spread-menu-delete"
                      >
                        <Icon name="delete" size={16} />
                        Delete
                        <MenuKeyboard>Del</MenuKeyboard>
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
        {/* Kit chrome.tsx:268-278: the back Endpaper stacks after the pages in the one list. */}
        {endpapersOn ? (
          <div className="flex flex-col" data-testid="endpaper-back-list">
            <EndpaperRow side="back" />
          </div>
        ) : null}
      </div>
    </aside>
  )
}
