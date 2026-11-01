import { useSyncExternalStore } from 'react'
import type { PhotobooksToastQueue } from '../ui/toastQueue'
import {
  getLeftPanelTab,
  setLeftPanelTab,
  subscribeLeftPanelTab,
  type LeftPanelTab,
} from './leftPanelTabStore'
import { SpreadsPanel } from './SpreadsPanel'

const TABS: readonly { id: LeftPanelTab; label: string }[] = [
  { id: 'pages', label: 'Pages' },
  { id: 'masters', label: 'Masters' },
]

/** Left panel: Pages | Masters switcher; Masters is a placeholder until masters ship. */
export function LeftPanel({
  toastQueue,
}: {
  toastQueue?: PhotobooksToastQueue | undefined
}) {
  const tab = useSyncExternalStore(
    subscribeLeftPanelTab,
    getLeftPanelTab,
    getLeftPanelTab,
  )
  const modeSwitch = (
    <div
      role="tablist"
      aria-label="Left panel"
      className="editor-left-tabs flex items-center rounded-md text-sm font-medium"
    >
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          className="editor-left-tab flex h-6.5 flex-1 items-center justify-center rounded-sm"
          data-testid={`left-tab-${item.id}`}
          onClick={() => {
            setLeftPanelTab(item.id)
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
  return tab === 'masters' ? (
    <aside
      className="editor-spreads flex h-full min-h-0 flex-col"
      data-testid="masters-panel"
    >
      <div className="shrink-0 px-3 pb-2 pt-3" data-testid="mode-seg">
        {modeSwitch}
      </div>
      <div className="editor-masters-empty" data-testid="masters-stub">
        <div className="editor-masters-empty-title">No masters yet</div>
        <div className="editor-masters-empty-description">
          Masters are page templates shared across spreads.
        </div>
      </div>
    </aside>
  ) : (
    <SpreadsPanel toastQueue={toastQueue} modeSwitch={modeSwitch} />
  )
}
