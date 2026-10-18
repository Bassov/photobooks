import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  checkCodecovYml,
  findUnknownTopLevelKeys,
  isNetworkError,
  validateCodecovYml,
} from './check-codecov-yml.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const mainYml = fs.readFileSync(path.join(ROOT, 'codecov.yml'), 'utf8')

describe('findUnknownTopLevelKeys', () => {
  it('flags root notify instead of codecov.notify', () => {
    const bad = 'notify:\n  after_n_builds: 2\ncoverage:\n  status: {}\n'
    expect(findUnknownTopLevelKeys(bad)).toContain('notify')
  })

  it('accepts main codecov.yml keys', () => {
    expect(findUnknownTopLevelKeys(mainYml)).toEqual([])
  })
})

describe('isNetworkError', () => {
  it('detects fetch TypeError', () => {
    const err = new TypeError('fetch failed')
    expect(isNetworkError(err)).toBe(true)
  })

  it('rejects ordinary errors', () => {
    expect(isNetworkError(new Error('Valid! missing'))).toBe(false)
  })
})

describe('validateCodecovYml', () => {
  it('passes when API returns Valid!', async () => {
    const fetchImpl = async () =>
      /** @type {Response} */ ({
        status: 200,
        text: async () => 'Valid!\n\n{"coverage":{}}',
      })
    const r = await validateCodecovYml(mainYml, { fetchImpl })
    expect(r).toEqual({ ok: true, mode: 'api', detail: 'Valid!' })
  })

  it('fails on unknown top-level key via API rejection', async () => {
    const bad = 'notify:\n  after_n_builds: 2\n'
    const fetchImpl = async () =>
      /** @type {Response} */ ({
        status: 400,
        text: async () => 'Error: unknown field notify',
      })
    const r = await validateCodecovYml(bad, { fetchImpl })
    expect(r.ok).toBe(false)
    expect(r.mode).toBe('api')
  })

  it('network error uses pinned key fallback and fails unknown keys', async () => {
    const bad = 'notify:\n  after_n_builds: 2\ncoverage:\n  status: {}\n'
    const fetchImpl = async () => {
      throw new TypeError('fetch failed')
    }
    const r = await validateCodecovYml(bad, { fetchImpl })
    expect(r.ok).toBe(false)
    expect(r.mode).toBe('fallback')
    expect(r.detail).toMatch(/notify/)
  })

  it('network error accepts main file via fallback', async () => {
    const fetchImpl = async () => {
      throw new TypeError('fetch failed')
    }
    const r = await validateCodecovYml(mainYml, { fetchImpl })
    expect(r.ok).toBe(true)
    expect(r.mode).toBe('fallback')
  })

  it('validation failure does not fall back', async () => {
    const fetchImpl = async () =>
      /** @type {Response} */ ({
        status: 400,
        text: async () => 'Invalid config',
      })
    const r = await validateCodecovYml(mainYml, { fetchImpl })
    expect(r.ok).toBe(false)
    expect(r.mode).toBe('api')
  })
})

describe('checkCodecovYml against repo file', () => {
  it('main codecov.yml passes (live API or fallback)', async () => {
    const r = await checkCodecovYml({ root: ROOT })
    expect(r.ok).toBe(true)
  })
})
