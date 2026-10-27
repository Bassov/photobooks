import type { IconName } from '../ui/icons/glyphs'

export type SettingsSectionId =
  'library' | 'hosting' | 'site' | 'print' | 'interface'

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

export const SETTINGS_DEFERRED_COPY: Record<
  Exclude<SettingsSectionId, 'library'>,
  string
> = {
  hosting:
    'Hosting tokens and Cloudflare account wiring come later. Nothing is stored here yet.',
  site: 'Site title, author, and About copy come later. This section is read-only for now.',
  print:
    'Print profiles and home-printer presets come later. No editable values here yet.',
  interface:
    'Units, thumbnail size, and density preferences come later. Defaults stay as they are.',
}

const SECTION_LABELS: Record<SettingsSectionId, string> = {
  library: 'Library',
  hosting: 'Hosting',
  site: 'Site',
  print: 'Print presets',
  interface: 'Interface',
}

export function settingsSectionLabel(sec: SettingsSectionId): string {
  return SECTION_LABELS[sec]
}

export function settingsNavIsCurrent(
  sec: SettingsSectionId,
  id: SettingsSectionId,
): boolean {
  return sec === id
}

export function settingsNavActiveClass(active: boolean): string | false {
  return active && 'bg-[#CACACA] font-medium'
}
