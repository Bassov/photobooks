import { describe, expect, it } from 'vitest'

import {
  missingPillStyle,
  relinkFootStyle,
  relinkListStyle,
  relinkRowStyle,
} from './relinkStyles'

describe('relinkStyles', () => {
  it('exposes list and pill layout tokens', () => {
    expect(relinkListStyle.overflow).toBe('auto')
    expect(missingPillStyle.position).toBe('absolute')
  })

  it('pins the kit RelinkDialog list, row and footer (r40 M150)', () => {
    expect(relinkListStyle.margin).toBe('0.5rem 1.5rem 0')
    expect(relinkListStyle.background).toBe('var(--field)')
    expect(relinkListStyle).not.toHaveProperty('border')
    expect(relinkRowStyle.padding).toBe('0.5rem 0.75rem')
    expect(relinkRowStyle).not.toHaveProperty('borderBottom')
    expect(relinkFootStyle.padding).toBe('0 1.5rem 1.25rem')
    expect(relinkFootStyle).not.toHaveProperty('borderTop')
  })
})
