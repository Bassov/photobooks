import { describe, expect, it } from 'vitest'

import {
  SETTINGS_SECTIONS,
  settingsNavActiveClass,
} from './settingsScreenModel'

describe('settingsScreenModel', () => {
  it('offers only the Library section', () => {
    expect(SETTINGS_SECTIONS.map((x) => x.id)).toEqual(['library'])
  })

  it('returns the active nav class', () => {
    expect(settingsNavActiveClass()).toBe('bg-accent font-medium')
  })
})
