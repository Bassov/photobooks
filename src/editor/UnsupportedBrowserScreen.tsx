import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { UNSUPPORTED_BROWSER_MESSAGE } from './browserSupport'
import './screenPlaceholders.css'

export function UnsupportedBrowserScreen() {
  return (
    <main
      className="pb-screen pb-screen--unsupported"
      data-testid="unsupported-browser"
    >
      <EmptyState
        icon={<Icon name="folder" size={20} />}
        title="Browser not supported"
        description={UNSUPPORTED_BROWSER_MESSAGE}
      />
    </main>
  )
}
