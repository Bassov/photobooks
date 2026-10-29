import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadFlag(): Promise<boolean> {
  vi.resetModules()
  return (await import('./testFixturesBuild')).TEST_FIXTURES_FLAG
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('TEST_FIXTURES_FLAG', () => {
  it('is off in a deploy build without VITE_TEST_FIXTURES', async () => {
    vi.stubEnv('VITE_TEST_FIXTURES', '')
    expect(await loadFlag()).toBe(false)
  })

  it('is on in a build with VITE_TEST_FIXTURES=1', async () => {
    vi.stubEnv('VITE_TEST_FIXTURES', '1')
    expect(await loadFlag()).toBe(true)
  })
})
