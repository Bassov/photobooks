// Stryker disable all: kit spreads list chrome JSX; selection/add covered by SpreadsPanel unit tests + editorChromePanels labels
import { useSyncExternalStore } from 'react'
import { Icon } from '../ui/Icon'
import {
  dispatchBookOp,
  getSpreadIdsSnapshot,
  subscribeBookStore,
} from './bookStore'
import { BAR, pageLabel, SUB, T } from './editorChromeTokens'
import {
  getActiveSpreadId,
  setActiveSpreadId,
  subscribeActiveSpreadId,
} from './photoRootSession'

function scrollPasteboardToSpread(spreadId: string): void {
  const slot = document.querySelector(
    `[data-pasteboard-slot][data-spread-id="${CSS.escape(spreadId)}"]`,
  )
  if (slot instanceof HTMLElement) {
    slot.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  setActiveSpreadId(spreadId)
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
  const selected = activeId ?? spreadIds[0] ?? null

  return (
    <aside
      className="flex h-full min-h-0 flex-col"
      style={{ background: BAR, color: T }}
      data-testid="spreads-panel"
    >
      <div className="shrink-0 px-3 pb-2 pt-3" data-testid="mode-seg">
        <div
          className="flex h-6.5 items-center justify-center rounded-sm text-sm font-medium"
          style={{
            background: BAR,
            color: T,
            boxShadow: '0 1px 2px rgb(35 34 35/.14)',
          }}
        >
          Pages
        </div>
      </div>
      <div
        className="e7 scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-4 pl-3 pr-1"
        data-testid="list"
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
              data-testid={`spread-list-item-${id}`}
              onClick={() => {
                scrollPasteboardToSpread(id)
              }}
            >
              <div
                className="grid w-full place-items-center rounded-2xs bg-paper shadow-sm"
                style={{
                  aspectRatio: '1.6',
                  background: '#fff',
                  boxShadow: '0 1px 2px rgb(35 34 35/.18)',
                }}
              >
                <span className="text-2xs tabular-nums" style={{ color: SUB }}>
                  {label}
                </span>
              </div>
              <div
                className="mt-1.5 flex text-2xs tabular-nums"
                style={{ paddingLeft: i === 0 ? '50%' : undefined }}
              >
                <span
                  data-label
                  className={sel ? 'font-semibold' : 'font-normal'}
                  style={{ color: sel ? T : SUB }}
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
          className="e7-ghost flex flex-1 items-center justify-start gap-2 rounded-md px-2 text-sm"
          style={{ color: SUB, height: 32 }}
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
