import { useState } from 'react'
import { EmptyState } from '../ui/EmptyState'
import type { PhotobooksToastQueue } from '../ui/toastQueue'
import { SpreadsPanel } from './SpreadsPanel'

type Tab = 'pages' | 'masters'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'pages', label: 'Pages' },
  { id: 'masters', label: 'Masters' },
]

/** Left panel: Pages | Masters switcher; Masters is a placeholder until masters ship. */
export function LeftPanel({
  toastQueue,
}: {
  toastQueue?: PhotobooksToastQueue | undefined
}) {
  const [tab, setTab] = useState<Tab>('pages')
  const modeSwitch = (
    <div
      role="tablist"
      aria-label="Left panel"
      className="editor-left-tabs flex h-6.5 items-center rounded-sm text-sm font-medium"
    >
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          className="editor-left-tab flex h-full flex-1 items-center justify-center rounded-sm"
          data-testid={`left-tab-${item.id}`}
          onClick={() => {
            setTab(item.id)
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
      <EmptyState
        title="No masters yet"
        description="Masters are page templates shared across spreads."
        data-testid="masters-stub"
      />
    </aside>
  ) : (
    <SpreadsPanel toastQueue={toastQueue} modeSwitch={modeSwitch} />
  )
}
