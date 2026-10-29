import { useSyncExternalStore } from 'react'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { getSnapOn, subscribeSnapOn, toggleSnapOn } from './gridView'
import './GridSection.css'

/** TopBar "Snap" on / off; pressed state is a quiet gray field. */
export function SnapToggle() {
  const on = useSyncExternalStore(subscribeSnapOn, getSnapOn, getSnapOn)
  return (
    <IconButton
      label="Snap (Shift+S)"
      size="sm"
      className="grid-eye"
      aria-pressed={on}
      data-testid="snap-topbar-toggle"
      onPress={toggleSnapOn}
    >
      <Icon name="magnet" size={16} />
    </IconButton>
  )
}
