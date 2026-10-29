import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPainterFixtureQuery } from './painterFixtureQuery'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isPainterFixtureQuery', () => {
  it('matches ?fixture=painter in dev and fixture builds', () => {
    expect(isPainterFixtureQuery('?fixture=painter')).toBe(true)
    expect(isPainterFixtureQuery('?fixture=other')).toBe(false)
    expect(isPainterFixtureQuery('')).toBe(false)
  })

  it('is always false in a deploy build', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_TEST_FIXTURES', '')
    expect(isPainterFixtureQuery('?fixture=painter')).toBe(false)
  })

  it('is true in a non-dev fixtures build', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_TEST_FIXTURES', '1')
    expect(isPainterFixtureQuery('?fixture=painter')).toBe(true)
  })
})
