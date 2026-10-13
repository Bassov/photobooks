import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('formats KB at threshold', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats MB', () => {
    expect(formatBytes(23.4 * 1024 * 1024)).toBe('23.4 MB')
  })

  it('formats GB and TB boundaries', () => {
    expect(formatBytes(1024 ** 3)).toBe('1 GB')
    expect(formatBytes(1024 ** 4)).toBe('1 TB')
    expect(formatBytes(1024 ** 5)).toBe('1024 TB')
  })

  it('throws on negative or non-finite', () => {
    expect(() => formatBytes(-1)).toThrow(
      new RangeError('bytes must be a non-negative finite number'),
    )
    expect(() => formatBytes(Number.NaN)).toThrow(RangeError)
  })

  test.prop([fc.integer({ min: 0, max: 1024 ** 4 })])(
    'non-negative finite inputs yield non-empty unit labels',
    (bytes) => {
      const label = formatBytes(bytes)
      expect(label.length).toBeGreaterThan(0)
      expect(label).toMatch(/\s(B|KB|MB|GB|TB)$/)
    },
  )
})
