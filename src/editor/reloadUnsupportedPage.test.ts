import { describe, expect, it, vi } from 'vitest'

import { reloadUnsupportedPage } from './reloadUnsupportedPage'

describe('reloadUnsupportedPage', () => {
  it('calls location.reload', () => {
    const reload = vi.fn()
    reloadUnsupportedPage({ reload })
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
