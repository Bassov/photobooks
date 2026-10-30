import { useSyncExternalStore } from 'react'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  getGuidesVisible,
  subscribeGuidesVisible,
  toggleGuidesVisible,
} from './guidesView'
import './GridSection.css'

/** TopBar "Guides" show / hide; pressed state is a quiet gray field. */
export function GuidesToggle() {
  const shown = useSyncExternalStore(
    subscribeGuidesVisible,
    getGuidesVisible,
    getGuidesVisible,
  )
  return (
    <IconButton
      label="Guides (Ctrl+;)"
      size="sm"
      className="grid-eye"
      aria-pressed={shown}
      data-testid="guides-topbar-toggle"
      onPress={toggleGuidesVisible}
    >
      <Icon name="guides" size={16} />
    </IconButton>
  )
}
