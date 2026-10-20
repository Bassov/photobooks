import { describe, expect, it } from 'vitest'
import { cx } from './className'

describe('cx', () => {
  it('joins defined class tokens and drops empties', () => {
    expect(cx('a', undefined, false, 'b', '')).toBe('a b')
    expect(cx('pb-button', 'pb-button--md')).toBe('pb-button pb-button--md')
  })
})
