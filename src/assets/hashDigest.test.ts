import { describe, expect, it } from 'vitest'

import { computeSha256Hex } from './hashDigest'

describe('computeSha256Hex', () => {
  it('returns lowercase 64-hex for empty input', async () => {
    const hash = await computeSha256Hex(new ArrayBuffer(0))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('pads single-digit hex bytes so length stays 64', async () => {
    const hash = await computeSha256Hex(new Uint8Array([0]).buffer)
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
