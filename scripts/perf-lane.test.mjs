import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collectScenarios,
  isPerfPath,
  isPerfScope,
  judge,
  main,
  scopeCommand,
  worstBlockingMs,
} from './perf-lane.mjs'

const LOAF = (ms) =>
  `LoAF entries 1 exceed max 0 (worst blockingDuration ${String(ms)}ms)`

function report(...tests) {
  return {
    suites: [
      {
        title: 'a.spec.ts',
        suites: [
          {
            title: 'frame-budget gates',
            specs: tests.map(([title, status, message]) => ({
              title,
              tests: [
                {
                  results: [
                    {
                      status,
                      errors: message ? [{ message }] : [],
                    },
                  ],
                },
              ],
            })),
          },
        ],
      },
    ],
  }
}

describe('isPerfPath', () => {
  it.each([
    'src/render/SpreadView.tsx',
    'src/perf/loafObserver.ts',
    'src/photo/pool.ts',
    'src/assets/cache.ts',
    'src/derivatives/pool.ts',
    'src/editor/filmstrip/Filmstrip.tsx',
    'src/editor/Pasteboard.tsx',
    'e2e/perf/perfFixture.ts',
    'e2e/some-frame-pacing.spec.ts',
    'playwright.config.ts',
  ])('is in scope: %s', (file) => {
    expect(isPerfPath(file)).toBe(true)
  })

  it.each(['src/core/book.ts', 'docs/roadmap.md', 'e2e/book-titles.spec.ts'])(
    'is out of scope: %s',
    (file) => {
      expect(isPerfPath(file)).toBe(false)
    },
  )

  it('pulls in a spec that declares a frame-budget describe', () => {
    expect(isPerfPath('e2e/book-titles.spec.ts', () => true)).toBe(true)
    expect(isPerfScope(['docs/a.md', 'src/render/x.ts'])).toBe(true)
    expect(isPerfScope(['docs/a.md'])).toBe(false)
  })
})

describe('worstBlockingMs', () => {
  it('reads the worst value, ignoring ANSI colour codes', () => {
    expect(worstBlockingMs(`\u001b[31m${LOAF(37.5)}\u001b[0m`)).toBe(37.5)
    expect(worstBlockingMs('timeout')).toBe(0)
  })
})

describe('collectScenarios', () => {
  it('keys scenarios by suite path and marks failures', () => {
    const rows = collectScenarios(
      report(['ok', 'passed'], ['bad', 'failed', LOAF(30)]),
    )
    expect(rows.map((r) => [r.key, r.failed])).toEqual([
      ['a.spec.ts › frame-budget gates › ok', false],
      ['a.spec.ts › frame-budget gates › bad', true],
    ])
    expect(rows[0].spec).toBe('e2e/a.spec.ts')
  })

  it('accepts a legacy single `error` field', () => {
    const rows = collectScenarios({
      suites: [
        {
          specs: [
            {
              title: 't',
              tests: [
                { results: [{ status: 'timedOut', error: { message: 'x' } }] },
              ],
            },
          ],
        },
      ],
    })
    expect(rows).toEqual([
      { key: 't', spec: '', failed: true, messages: ['x'] },
    ])
  })
})

describe('judge', () => {
  const pass = report(['s', 'passed'])

  it('is green when every run passes', () => {
    expect(judge([pass, pass, pass])).toMatchObject({ pass: true, notes: [] })
  })

  it('tolerates one failing run of three, with a note', () => {
    const bad = report(['s', 'failed', LOAF(30)])
    const v = judge([pass, bad, pass])
    expect(v.pass).toBe(true)
    expect(v.notes).toHaveLength(1)
  })

  it('is red when two runs fail', () => {
    const bad = report(['s', 'failed', LOAF(30)])
    const v = judge([bad, pass, bad])
    expect(v.pass).toBe(false)
    expect(v.problems[0]).toContain('failed in runs 1, 3 of 3')
  })

  it('is red when any run blocks longer than 50 ms', () => {
    const bad = report(['s', 'failed', LOAF(80)])
    const v = judge([pass, pass, bad])
    expect(v.pass).toBe(false)
    expect(v.problems[0]).toContain('80ms')
  })

  it('is red without any scenarios', () => {
    expect(judge([]).pass).toBe(false)
  })
})

describe('main', () => {
  it('prints usage and exits 2 for unknown commands', () => {
    expect(main(['nope'])).toBe(2)
  })

  it('scope exits 1 on a ref git cannot resolve', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(main(['scope', 'refs/perf-lane/missing'])).toBe(1)
    expect(error.mock.calls[0][0]).toContain(
      'cannot diff refs/perf-lane/missing...HEAD',
    )
    error.mockRestore()
  })

  it('verdict forgives nothing when the base ref cannot be diffed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-lane-verdict-'))
    const key = 'a.spec.ts › frame-budget gates › s'
    const base = path.join(dir, 'base.json')
    const run = path.join(dir, 'run.json')
    fs.writeFileSync(base, JSON.stringify({ red: [key] }))
    fs.writeFileSync(run, JSON.stringify(report(['s', 'failed', LOAF(80)])))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const status = main([
      'verdict',
      '--base',
      base,
      '--base-ref',
      'refs/perf-lane/missing',
      run,
    ])
    const lines = log.mock.calls.map((c) => c[0])
    log.mockRestore()
    error.mockRestore()
    fs.rmSync(dir, { recursive: true, force: true })
    expect(status).toBe(1)
    expect(lines).toContain(
      `perf: red (no-baseline): ${key}: blocking 80ms > 50ms in run 1`,
    )
  })

  it('verdict is red when no report files exist', () => {
    expect(main(['verdict', '/nonexistent/report.json'])).toBe(1)
  })
})

describe('scope (CLI in a git repo)', () => {
  const BIN = path.resolve('scripts/perf-lane.mjs')
  let repo = ''

  const git = (...args) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@t',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { cwd: repo, stdio: 'pipe' },
    )

  function commit(file) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
    fs.writeFileSync(path.join(repo, file), file)
    git('add', '-A')
    git('commit', '-q', '-m', file)
  }

  /** A repo with one commit on `main`, checked out on `pr`. */
  function makeRepo() {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-lane-scope-'))
    git('init', '-q', '-b', 'main')
    commit('README.md')
    git('checkout', '-q', '-b', 'pr')
  }

  const scope = (base) =>
    spawnSync(process.execPath, [BIN, 'scope', base], {
      cwd: repo,
      encoding: 'utf8',
    })

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true })
  })

  it('is in scope when the PR touches a perf path', () => {
    makeRepo()
    commit('src/render/paint.ts')
    const r = scope('main')
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('in_scope=true\n')
  })

  it('is out of scope when the PR touches no perf path', () => {
    makeRepo()
    commit('docs/notes.md')
    const r = scope('main')
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('in_scope=false\n')
  })

  it('fails loudly without a merge base, never "not in scope"', () => {
    makeRepo()
    git('checkout', '-q', '--orphan', 'unrelated')
    commit('src/render/paint.ts')
    const r = scope('main')
    expect(r.status).toBe(1)
    expect(r.stdout).toBe('')
    expect(r.stderr).toContain('perf-lane scope: cannot diff main...HEAD')
    expect(r.stderr).toContain('no merge base')
  })

  it('fails loudly on a missing base ref', () => {
    makeRepo()
    const r = scope('origin/nope')
    expect(r.status).toBe(1)
    expect(r.stdout).toBe('')
    expect(r.stderr).toContain('cannot diff origin/nope...HEAD')
  })

  describe('scopeCommand (in process)', () => {
    function run(base) {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const status = scopeCommand(base, repo)
      const out = {
        status,
        stdout: log.mock.calls.map((c) => c.join(' ')).join('\n'),
        stderr: error.mock.calls.map((c) => c.join(' ')).join('\n'),
      }
      log.mockRestore()
      error.mockRestore()
      return out
    }

    it('is in scope for a perf path', () => {
      makeRepo()
      commit('src/render/paint.ts')
      expect(run('main')).toEqual({
        status: 0,
        stdout: 'in_scope=true',
        stderr: '',
      })
    })

    it('is in scope for a spec that declares the gate', () => {
      makeRepo()
      const spec = path.join(repo, 'e2e/book.spec.ts')
      fs.mkdirSync(path.dirname(spec), { recursive: true })
      fs.writeFileSync(spec, "test.describe('frame-budget gates', () => {})")
      git('add', '-A')
      git('commit', '-q', '-m', 'gate spec')
      expect(run('main').stdout).toBe('in_scope=true')
    })

    it('is out of scope for a non-perf path', () => {
      makeRepo()
      commit('e2e/book.spec.ts')
      expect(run('main')).toEqual({
        status: 0,
        stdout: 'in_scope=false',
        stderr: '',
      })
    })

    it('is out of scope for a spec the PR deletes', () => {
      makeRepo()
      commit('e2e/book.spec.ts')
      git('checkout', '-q', 'main')
      git('merge', '-q', '--ff-only', 'pr')
      git('checkout', '-q', 'pr')
      git('rm', '-q', 'e2e/book.spec.ts')
      git('commit', '-q', '-m', 'drop spec')
      expect(run('main').stdout).toBe('in_scope=false')
    })

    it('returns 1 without a merge base', () => {
      makeRepo()
      git('checkout', '-q', '--orphan', 'unrelated')
      commit('src/render/paint.ts')
      const r = run('main')
      expect(r.status).toBe(1)
      expect(r.stdout).toBe('')
      expect(r.stderr).toContain('perf-lane scope: cannot diff main...HEAD')
      expect(r.stderr).toContain('no merge base')
    })

    it('returns 1 on a missing base ref', () => {
      makeRepo()
      const r = run('origin/nope')
      expect(r.status).toBe(1)
      expect(r.stdout).toBe('')
      expect(r.stderr).toContain('cannot diff origin/nope...HEAD')
    })

    it('diffs against origin/main by default', () => {
      makeRepo()
      git('update-ref', 'refs/remotes/origin/main', 'main')
      commit('src/render/paint.ts')
      expect(run(undefined)).toEqual({
        status: 0,
        stdout: 'in_scope=true',
        stderr: '',
      })
    })

    it('returns 1 when git cannot even start in the work tree', () => {
      makeRepo()
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const missing = path.join(os.tmpdir(), 'perf-lane-missing-dir')
      const status = scopeCommand('main', missing)
      const stderr = error.mock.calls.map((c) => c.join(' ')).join('\n')
      error.mockRestore()
      expect(status).toBe(1)
      expect(stderr).toContain('cannot diff main...HEAD')
    })
  })
})
