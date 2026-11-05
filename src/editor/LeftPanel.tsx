import { useSyncExternalStore } from 'react'
import type { PhotobooksToastQueue } from '../ui/toastQueue'
import {
  getLeftPanelTab,
  setLeftPanelTab,
  subscribeLeftPanelTab,
  type LeftPanelTab,
} from './leftPanelTabStore'
import { setBookSettingsSelected } from './bookSettingsSelection'
import { setFrameSource } from './frameSelection'
import { MastersPanel } from './MastersPanel'
import { SpreadsPanel } from './SpreadsPanel'

const TABS: readonly { id: LeftPanelTab; label: string }[] = [
  { id: 'pages', label: 'Pages' },
  { id: 'masters', label: 'Masters' },
]

/** Left panel: Pages | Masters switcher (kit `chrome.tsx:302`). */
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
            // A picked frame belongs to the other mode's canvas; Book
            // settings opened from a master hint closes with the mode.
            if (item.id !== tab) {
              setFrameSource(null)
              setBookSettingsSelected(false)
            }
            setLeftPanelTab(item.id)
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
  return tab === 'masters' ? (
    <MastersPanel modeSwitch={modeSwitch} />
  ) : (
    <SpreadsPanel toastQueue={toastQueue} modeSwitch={modeSwitch} />
  )
}
