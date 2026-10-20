import { describe, expect, it, vi } from 'vitest'
import { clickIfPresent } from './clickIfPresent'

describe('clickIfPresent', () => {
  it('no-ops for null and clicks a mounted element', () => {
    clickIfPresent(null)
    const el = document.createElement('button')
    const click = vi.spyOn(el, 'click')
    clickIfPresent(el)
    expect(click).toHaveBeenCalledTimes(1)
  })
})
