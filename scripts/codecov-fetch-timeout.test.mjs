import { describe, expect, it, vi } from 'vitest'
import {
  CODECOV_VALIDATE_TIMEOUT_MS,
  fetchWithTimeout,
} from './codecov-fetch-timeout.mjs'

describe('fetchWithTimeout', () => {
  it('exports a positive default timeout', () => {
    expect(CODECOV_VALIDATE_TIMEOUT_MS).toBeGreaterThan(0)
  })

  it('attaches AbortSignal.timeout to the request init', async () => {
    /** @type {RequestInit | undefined} */
    let seen
    const fetchImpl = vi.fn(async (_url, init) => {
      seen = init
      return /** @type {Response} */ ({
        status: 200,
        text: async () => 'Valid!',
      })
    })
    await fetchWithTimeout(fetchImpl, 'https://example.test', {
      method: 'POST',
      body: 'x',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(seen?.method).toBe('POST')
    expect(seen?.body).toBe('x')
    expect(seen?.signal).toBeInstanceOf(AbortSignal)
  })
})
