import { useSyncExternalStore } from 'react'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  getRulersVisible,
  subscribeRulersVisible,
  toggleRulersVisible,
} from './rulersView'
import './GridSection.css'

/** TopBar "Rulers" show / hide; pressed state is a quiet gray field. */
export function RulersToggle() {
  const shown = useSyncExternalStore(
    subscribeRulersVisible,
    getRulersVisible,
    getRulersVisible,
  )
  return (
    <IconButton
      label="Rulers (Shift+R)"
      size="sm"
      className="grid-eye"
      aria-pressed={shown}
      data-testid="rulers-topbar-toggle"
      onPress={toggleRulersVisible}
    >
      <Icon name="rulers" size={16} />
    </IconButton>
  )
}
