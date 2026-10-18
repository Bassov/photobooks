import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  checkCodecovYml,
  findUnknownTopLevelKeys,
  isNetworkError,
  runCodecovYmlCli,
  validateCodecovYml,
} from './check-codecov-yml.mjs'
import { stripGitKeys } from './strip-git-env.mjs'

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

  it('detects errno codes and nested cause', () => {
    expect(isNetworkError({ code: 'ENOTFOUND' })).toBe(true)
    expect(isNetworkError({ code: 'ECONNRESET' })).toBe(true)
    expect(
      isNetworkError({ message: 'wrap', cause: new TypeError('fetch failed') }),
    ).toBe(true)
  })

  it('rejects ordinary errors and non-objects', () => {
    expect(isNetworkError(new Error('Valid! missing'))).toBe(false)
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError('fetch failed')).toBe(false)
  })
})

describe('findUnknownTopLevelKeys edge cases', () => {
  it('rejects non-object roots', () => {
    expect(findUnknownTopLevelKeys('[]')).toEqual(['<root-not-object>'])
    expect(findUnknownTopLevelKeys('null')).toEqual(['<root-not-object>'])
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

  it('non-network throw stays api failure without fallback', async () => {
    const fetchImpl = async () => {
      throw new Error('boom')
    }
    const r = await validateCodecovYml(mainYml, { fetchImpl })
    expect(r.ok).toBe(false)
    expect(r.mode).toBe('api')
    expect(r.detail).toMatch(/boom/)
  })

  it('rejects when first line is not exactly Valid!', async () => {
    const fetchImpl = async () =>
      /** @type {Response} */ ({
        status: 200,
        text: async () => 'Almost Valid!\n',
      })
    const r = await validateCodecovYml(mainYml, { fetchImpl })
    expect(r.ok).toBe(false)
  })
})

describe('checkCodecovYml against repo file', () => {
  it('main codecov.yml passes (live API or fallback)', async () => {
    const r = await checkCodecovYml({ root: ROOT })
    expect(r.ok).toBe(true)
  })

  it('missing file fails', async () => {
    const r = await checkCodecovYml({
      root: ROOT,
      readFile: () => {
        throw new Error('ENOENT')
      },
    })
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/missing|ENOENT/)
  })

  it('uses injected fetchImpl for the file path', async () => {
    const r = await checkCodecovYml({
      root: ROOT,
      fetchImpl: async () =>
        /** @type {Response} */ ({
          status: 200,
          text: async () => 'Valid!',
        }),
    })
    expect(r).toEqual({ ok: true, mode: 'api', detail: 'Valid!' })
  })
})

describe('runCodecovYmlCli', () => {
  it('logs OK and returns 0', async () => {
    const lines = []
    const code = await runCodecovYmlCli({
      root: ROOT,
      fetchImpl: async () =>
        /** @type {Response} */ ({
          status: 200,
          text: async () => 'Valid!',
        }),
      log: (m) => lines.push(m),
    })
    expect(code).toBe(0)
    expect(lines.join('\n')).toMatch(/OK \(api\)/)
  })

  it('logs FAIL and returns 1', async () => {
    const lines = []
    const code = await runCodecovYmlCli({
      root: ROOT,
      readFile: () => {
        throw new Error('gone')
      },
      error: (m) => lines.push(m),
    })
    expect(code).toBe(1)
    expect(lines.join('\n')).toMatch(/FAIL/)
  })
})

describe('codecov-yml-cli entry', () => {
  it('exits 0 for the repo codecov.yml', () => {
    const r = spawnSync(process.execPath, ['scripts/codecov-yml-cli.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: stripGitKeys({ ...process.env }),
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/Codecov YAML: OK/)
  })
})

describe('isNetworkError conditionals', () => {
  it('requires TypeError name with network-ish message', () => {
    expect(isNetworkError({ name: 'TypeError', message: 'fetch failed' })).toBe(
      true,
    )
    expect(isNetworkError({ name: 'TypeError', message: 'other' })).toBe(false)
    expect(isNetworkError({ name: 'Error', message: 'fetch failed' })).toBe(
      false,
    )
  })

  it('requires string code matching network errno pattern', () => {
    expect(isNetworkError({ code: 'ETIMEDOUT' })).toBe(true)
    expect(isNetworkError({ code: 123 })).toBe(false)
    expect(isNetworkError({ code: 'ENOENT' })).toBe(false)
  })

  it('walks cause only when present', () => {
    expect(isNetworkError({ message: 'x', cause: null })).toBe(false)
    expect(
      isNetworkError({
        message: 'x',
        cause: { name: 'TypeError', message: 'network down' },
      }),
    ).toBe(true)
  })
})
