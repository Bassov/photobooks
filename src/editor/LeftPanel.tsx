import { useState } from 'react'
import { AssetsPanel } from './AssetsPanel'
import { SpreadsPanel } from './SpreadsPanel'

type Tab = 'pages' | 'assets'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'pages', label: 'Pages' },
  { id: 'assets', label: 'Assets' },
]

/** Left panel: Pages | Assets tabs; the switcher replaces the panel's own header. */
export function LeftPanel() {
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
  return tab === 'assets' ? (
    <AssetsPanel modeSwitch={modeSwitch} />
  ) : (
    <SpreadsPanel modeSwitch={modeSwitch} />
  )
}
