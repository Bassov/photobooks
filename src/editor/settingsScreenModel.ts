import type { IconName } from '../ui/icons/glyphs'

/** Hosting / Site / Print presets / Interface have no backing behavior yet (D2): hidden, not stubbed. */
export const SETTINGS_SECTIONS: readonly {
  id: 'library'
  label: string
  icon: IconName
}[] = [{ id: 'library', label: 'Library', icon: 'hardDrive' }]

/** The single visible section is always the current one (kit `bg-accent`, r11 M71). */
export function settingsNavActiveClass(): string {
  return 'bg-accent font-medium'
}
