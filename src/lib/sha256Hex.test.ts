import { describe, expect, it } from 'vitest'
import { sha256Hex } from './sha256Hex'

describe('sha256Hex', () => {
  it('returns the 64-char lowercase hex digest', async () => {
    const bytes = new TextEncoder().encode('abc').buffer

    await expect(sha256Hex(bytes)).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('pads bytes below 0x10 with a leading zero', async () => {
    await expect(sha256Hex(new ArrayBuffer(0))).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })
})
