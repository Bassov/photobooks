import { describe, expect, it } from 'vitest'

import {
  hostingCheckedWhen,
  SETTINGS_SECTIONS,
  settingsNavActiveClass,
} from './settingsScreenModel'

describe('settingsScreenModel', () => {
  it('offers Library, Hosting, Site and Print presets, Site at index 2', () => {
    expect(SETTINGS_SECTIONS.map((x) => [x.id, x.label, x.icon])).toEqual([
      ['library', 'Library', 'hardDrive'],
      ['hosting', 'Hosting', 'keyRound'],
      ['site', 'Site', 'globe'],
      ['print', 'Print presets', 'printer'],
    ])
  })

  it('marks only the current section', () => {
    expect(settingsNavActiveClass(true)).toBe('bg-accent font-medium')
    expect(settingsNavActiveClass(false)).toBe('')
  })

  it('words the check time: today, another day, another year', () => {
    const now = new Date(2026, 10, 13, 23, 5)
    expect(
      hostingCheckedWhen(new Date(2026, 10, 13, 22, 40).getTime(), now),
    ).toBe('today at 22:40')
    expect(
      hostingCheckedWhen(new Date(2026, 10, 11, 9, 7).getTime(), now),
    ).toBe('11 Nov at 09:07')
    expect(
      hostingCheckedWhen(new Date(2025, 0, 2, 22, 40).getTime(), now),
    ).toBe('2 Jan 2025 at 22:40')
  })
})
