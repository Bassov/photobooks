import { useSyncExternalStore } from 'react'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { getDpiView, subscribeDpiView, toggleDpiView } from './dpiView'
import './GridSection.css'

/** TopBar "DPI badges" show / hide (kit view toggle); off by default. */
export function DpiToggle() {
  const shown = useSyncExternalStore(subscribeDpiView, getDpiView, getDpiView)
  return (
    <IconButton
      label="DPI badges"
      size="sm"
      className="grid-eye"
      aria-pressed={shown}
      data-testid="dpi-topbar-toggle"
      onPress={toggleDpiView}
    >
      <Icon name="warning" size={16} />
    </IconButton>
  )
}
