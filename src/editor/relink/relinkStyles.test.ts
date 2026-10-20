import { describe, expect, it } from 'vitest'

import { badgeStyle, missingPillStyle, relinkDialogStyle } from './relinkStyles'

describe('relinkStyles', () => {
  it('exposes dialog and pill layout tokens', () => {
    expect(relinkDialogStyle.background).toBe('var(--card)')
    expect(missingPillStyle.position).toBe('absolute')
  })

  it('badgeStyle maps status to badge token colors', () => {
    expect(badgeStyle(true, 'missing').color).toBe('var(--badge-success-fg)')
    expect(badgeStyle(false, 'modified').color).toBe('var(--badge-warning-fg)')
    expect(badgeStyle(false, 'missing').color).toBe('var(--badge-error-fg)')
    expect(badgeStyle(false, 'ok').color).toBe('var(--badge-success-fg)')
  })
})
