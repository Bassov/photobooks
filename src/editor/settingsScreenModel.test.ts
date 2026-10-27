import { describe, expect, it } from 'vitest'

import {
  settingsNavActiveClass,
  settingsNavIsCurrent,
  settingsSectionLabel,
} from './settingsScreenModel'

describe('settingsScreenModel', () => {
  it('returns the label for each section id', () => {
    expect(settingsSectionLabel('library')).toBe('Library')
    expect(settingsSectionLabel('hosting')).toBe('Hosting')
    expect(settingsSectionLabel('site')).toBe('Site')
    expect(settingsSectionLabel('print')).toBe('Print presets')
    expect(settingsSectionLabel('interface')).toBe('Interface')
  })

  it('marks only the active nav id as current', () => {
    expect(settingsNavIsCurrent('library', 'library')).toBe(true)
    expect(settingsNavIsCurrent('library', 'hosting')).toBe(false)
    expect(settingsNavIsCurrent('hosting', 'hosting')).toBe(true)
  })

  it('returns active nav class only when active', () => {
    expect(settingsNavActiveClass(true)).toBe('bg-[#CACACA] font-medium')
    expect(settingsNavActiveClass(false)).toBe(false)
  })
})
