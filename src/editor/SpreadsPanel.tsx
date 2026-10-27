import { useSyncExternalStore, type ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import {
  dispatchBookOp,
  getSpreadIdsSnapshot,
  subscribeBookStore,
} from './bookStore'
import { pageLabel } from './editorChromePanels'
import { getActiveSpreadId, subscribeActiveSpreadId } from './photoRootSession'
import { scrollPasteboardToSpread, selectedSpreadId } from './spreadsPanelModel'

/** Kit left spreads list wired to product bookStore (pages only — no masters). */
export function SpreadsPanel({ modeSwitch }: { modeSwitch?: ReactNode }) {
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
      <div
        className="e7 scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-4 pl-3 pr-1"
        data-testid="spreads-list"
        data-scrollport="spreads-list"
        role="listbox"
        aria-label="Pages"
      >
        {spreadIds.map((id, i) => {
          const sel = id === selected
          const label = pageLabel(i)
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={sel}
              className="e7-item group/sp relative mb-1 rounded-md p-2"
              data-item={id}
              data-first={i === 0 ? 'true' : 'false'}
              data-testid={`spread-list-item-${id}`}
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
