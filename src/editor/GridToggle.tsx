import { useSyncExternalStore } from 'react'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  getGridVisible,
  subscribeGridVisible,
  toggleGridVisible,
} from './gridView'
import './GridSection.css'

/** TopBar "Layout grid" show / hide; pressed state is a quiet gray field. */
export function GridToggle() {
  const shown = useSyncExternalStore(
    subscribeGridVisible,
    getGridVisible,
    getGridVisible,
  )
  return (
    <IconButton
      label="Layout grid (Ctrl ')"
      size="sm"
      className="grid-eye"
      aria-pressed={shown}
      data-testid="grid-topbar-toggle"
      onPress={toggleGridVisible}
    >
      <Icon name="grid" size={16} />
    </IconButton>
  )
}
