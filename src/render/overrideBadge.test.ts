import { describe, expect, it } from 'vitest'
import { overrideBadgeFit } from './overrideBadge'

describe('overrideBadgeFit', () => {
  it.each([
    // 66.42 px badge + 4 px inset each side.
    [74.42, 24.84, 'full'],
    [200, 100, 'full'],
    [74.41, 24.84, 'icon'],
    [26, 24.84, 'icon'],
    [25.99, 100, 'none'],
    [200, 24.83, 'none'],
    [26, 24.83, 'none'],
  ] as const)('%s × %s px → %s', (width, height, fit) => {
    expect(overrideBadgeFit(width, height)).toBe(fit)
  })
})
