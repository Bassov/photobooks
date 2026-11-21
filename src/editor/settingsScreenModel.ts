import type { IconName } from '../ui/icons/glyphs'

export type SettingsSectionId =
  'library' | 'hosting' | 'site' | 'print' | 'interface'

/** Interface (UI scale, design interface-size D8) is the 5th section. */
export const SETTINGS_SECTIONS: readonly {
  id: SettingsSectionId
  label: string
  icon: IconName
}[] = [
  { id: 'library', label: 'Library', icon: 'hardDrive' },
  { id: 'hosting', label: 'Hosting', icon: 'keyRound' },
  { id: 'site', label: 'Site', icon: 'globe' },
  { id: 'print', label: 'Print presets', icon: 'printer' },
  { id: 'interface', label: 'Interface', icon: 'slidersHorizontal' },
]

/** Kit `bg-accent font-medium` on the current section only (r11 M71). */
export function settingsNavActiveClass(current: boolean): string {
  return current ? 'bg-accent font-medium' : ''
}

/**
 * Hosting check time: `today at 22:40`, `11 Nov at 22:40`, and the year when
 * it is not the current one (local time).
 */
export function hostingCheckedWhen(checkedAtMs: number, now: Date): string {
  const at = new Date(checkedAtMs)
  const time = at.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
  if (at.toDateString() === now.toDateString()) return `today at ${time}`
  const date = at.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(at.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
  return `${date} at ${time}`
}
