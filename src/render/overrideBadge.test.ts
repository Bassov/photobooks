import { describe, expect, it } from 'vitest'
import { overrideBadgeFit } from './overrideBadge'

describe('overrideBadgeFit', () => {
  it.each([
    [75, 24.84, 'full'],
    [200, 100, 'full'],
    [74.99, 24.84, 'icon'],
    [26, 24.84, 'icon'],
    [25.99, 100, 'none'],
    [200, 24.83, 'none'],
    [26, 24.83, 'none'],
  ] as const)('%s × %s px → %s', (width, height, fit) => {
    expect(overrideBadgeFit(width, height)).toBe(fit)
  })
})
