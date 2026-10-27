import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
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
import { SpreadThumb } from './SpreadThumb'
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

/** Kit left spreads list wired to product bookStore (pages only — no masters). */
export function SpreadsPanel({
  toastQueue,
}: {
  toastQueue?: PhotobooksToastQueue
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
  const listRef = useRef<HTMLDivElement>(null)
  // Quantized to whole rows so React bails out while the window is unchanged.
  const [firstRow, setFirstRow] = useState(0)
  const [viewport, setViewport] = useState(0)

  useEffect(() => {
    const node = listRef.current
    // Stryker disable next-line ConditionalExpression,BlockStatement: ref is set once mounted
    if (node === null) {
      return
    }
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
    const node = listRef.current
    const index = spreadIds.indexOf(selected ?? '')
    // Stryker disable next-line ConditionalExpression,LogicalOperator,BlockStatement: ref is set once mounted; no selection only when the list is empty
    if (node === null || index < 0) {
      return
    }
    const next = scrollTopToReveal(index, node.scrollTop, node.clientHeight)
    if (next !== null) {
      node.scrollTop = next
    }
  }, [selected, spreadIds])

  const win = spreadsListWindow(
    spreadIds.length,
    firstRow * SPREADS_ROW_PX,
    viewport,
  )
  const visible = spreadIds.slice(win.start, win.end)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const id =
      event.target instanceof HTMLElement
        ? event.target.dataset.item
        : undefined
    if (id === undefined) {
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
      listRef.current
        ?.querySelector<HTMLElement>(`[data-item="${CSS.escape(next)}"]`)
        ?.focus()
    }
  }

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
        <div className="editor-spreads-mode flex h-6.5 items-center justify-center rounded-sm text-sm font-medium">
          Pages
        </div>
      </div>
      <div
        ref={listRef}
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
      >
        <div
          style={{ height: win.leadPx }}
          data-testid="spreads-lead"
          aria-hidden
        />
        {visible.map((id, offset) => {
          const i = win.start + offset
          const sel = id === selected
          const label = pageLabel(i)
          return (
            <div
              key={id}
              role="presentation"
              className="group/sp relative"
              style={{ height: SPREADS_ROW_PX }}
            >
              <button
                type="button"
                role="option"
                aria-selected={sel}
                tabIndex={sel ? 0 : -1}
                className="e7-item rounded-md p-2"
                data-item={id}
                data-first={i === 0 ? 'true' : 'false'}
                data-testid={`spread-list-item-${id}`}
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
