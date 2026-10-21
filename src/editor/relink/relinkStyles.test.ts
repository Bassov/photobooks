import { describe, expect, it } from 'vitest'

import { missingPillStyle, relinkListStyle } from './relinkStyles'

describe('relinkStyles', () => {
  it('exposes list and pill layout tokens', () => {
    expect(relinkListStyle.overflow).toBe('auto')
    expect(missingPillStyle.position).toBe('absolute')
  })
})
