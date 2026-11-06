import { describe, expect, it } from 'vitest'

import {
  SETTINGS_SECTIONS,
  settingsNavActiveClass,
} from './settingsScreenModel'

describe('settingsScreenModel', () => {
  it('offers the Library and Print presets sections', () => {
    expect(SETTINGS_SECTIONS.map((x) => [x.id, x.label, x.icon])).toEqual([
      ['library', 'Library', 'hardDrive'],
      ['print', 'Print presets', 'printer'],
    ])
  })

  it('marks only the current section', () => {
    expect(settingsNavActiveClass(true)).toBe('bg-accent font-medium')
    expect(settingsNavActiveClass(false)).toBe('')
  })
})
