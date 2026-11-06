import type { IconName } from '../ui/icons/glyphs'

export type SettingsSectionId = 'library' | 'print'

/** Hosting / Site / Interface have no backing behavior yet (D2): hidden, not stubbed. */
export const SETTINGS_SECTIONS: readonly {
  id: SettingsSectionId
  label: string
  icon: IconName
}[] = [
  { id: 'library', label: 'Library', icon: 'hardDrive' },
  { id: 'print', label: 'Print presets', icon: 'printer' },
]

/** Kit `bg-accent font-medium` on the current section only (r11 M71). */
export function settingsNavActiveClass(current: boolean): string {
  return current ? 'bg-accent font-medium' : ''
}
