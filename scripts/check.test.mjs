import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildInventory,
  extractProblemLines,
  formatCheckResult,
  main,
  runChecks,
} from './check.mjs'

const tmpDirs = []
afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop(), { recursive: true, force: true })
  }
})

function tmpRoot() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'check-cli-'))
  tmpDirs.push(d)
  return d
}

/** @param {Record<string, { code?: number, stdout?: string, stderr?: string }>} byName */
function fakeSpawnByCheckName(byName) {
  return (file, args) => {
    const ee = new EventEmitter()
    ee.stdout = new EventEmitter()
    ee.stderr = new EventEmitter()
    const key = args.includes('typecheck')
      ? 'typecheck'
      : args.includes('lint')
        ? 'lint'
        : args.includes('deps')
          ? 'deps'
          : args.includes('knip')
            ? 'knip'
            : args.includes('mutation-scope')
              ? 'mutation-scope'
              : args.includes('git-test-isolation')
                ? 'git-test-isolation'
                : args.includes('roadmap')
                  ? 'roadmap'
                  : args.includes('test:quiet')
                    ? 'unit'
                    : args.some((a) => String(a).includes('check-diff-size'))
                      ? 'diff-size'
                      : args.some((a) => String(a).includes('check-pr-body'))
                        ? 'pr-body'
                        : 'unknown'
    const res = byName[key] ?? { code: 0, stdout: '', stderr: '' }
    queueMicrotask(() => {
      if (res.stdout) ee.stdout.emit('data', res.stdout)
      if (res.stderr) ee.stderr.emit('data', res.stderr)
      ee.emit('close', res.code ?? 0)
    })
    return ee
  }
}

describe('buildInventory', () => {
  it('always schedules the core deterministic inventory', () => {
    const inv = buildInventory('/tmp/none', { existsSync: () => false })
    expect(inv.map((c) => c.name)).toEqual([
      'typecheck',
      'lint',
      'deps',
      'knip',
      'mutation-scope',
      'git-test-isolation',
      'roadmap',
      'unit',
    ])
  })

  it('includes optional policy scripts only when present', () => {
    const root = tmpRoot()
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
    fs.writeFileSync(path.join(root, 'scripts/check-diff-size.mjs'), '')
    const inv = buildInventory(root)
    expect(inv.map((c) => c.name)).toContain('diff-size')
    expect(inv.map((c) => c.name)).not.toContain('pr-body')
  })
})

describe('extractProblemLines / formatCheckResult', () => {
  it('caps failures and points at the log path', () => {
    const problems = Array.from({ length: 25 }, (_, i) => `lint: f.ts:${i} x`)
    const text = formatCheckResult(
      {
        name: 'lint',
        ok: false,
        ms: 1200,
        problems,
        logPath: '.cache/checks/lint.log',
        code: 1,
      },
      { problemCap: 20 },
    )
    const lines = text.split('\n')
    expect(lines.length).toBe(21)
    expect(lines[20]).toMatch(
      /\u2026 \+5 more, full log: \.cache\/checks\/lint\.log/,
    )
  })

  it('formats OK as one line', () => {
    expect(
      formatCheckResult({
        name: 'unit',
        ok: true,
        ms: 500,
        problems: [],
        logPath: '.cache/checks/unit.log',
        code: 0,
      }),
    ).toBe('OK unit (0, 0.5s)')
  })

  it('prefers error-like lines from tool output', () => {
    const lines = extractProblemLines(
      'banner\nsrc/a.ts:3:1 error Unexpected\nok stuff\n',
      'lint',
    )
    expect(lines).toEqual(['lint: src/a.ts:3:1 error Unexpected'])
    expect(lines.some((l) => l.includes('banner'))).toBe(false)
  })

  it('strips ANSI and falls back when no preferred lines', () => {
    const ansi = '\x1B[31mplain note\x1B[0m\n'
    expect(extractProblemLines(ansi, 'deps')).toEqual(['deps: plain note'])
  })

  it('keeps TS error and file:line forms', () => {
    expect(
      extractProblemLines('error TS2304: Cannot find name\n', 'typecheck')[0],
    ).toContain('error TS2304')
    expect(extractProblemLines('only info\n', 'knip')).toEqual([
      'knip: only info',
    ])
  })

  it('under-cap failures still include full log path', () => {
    const text = formatCheckResult({
      name: 'lint',
      ok: false,
      ms: 10,
      problems: ['lint: a.ts:1 x'],
      logPath: '.cache/checks/lint.log',
      code: 1,
    })
    expect(text).toContain('full log: .cache/checks/lint.log')
    expect(text).not.toContain('\u2026')
  })
})

describe('runChecks', () => {
  it('reports lint, unit, and roadmap failures in one pass', async () => {
    const root = tmpRoot()
    let out = ''
    const summary = await runChecks({
      root,
      now: (() => {
        let t = 0
        return () => {
          t += 100
          return t
        }
      })(),
      spawnImpl: fakeSpawnByCheckName({
        typecheck: { code: 0 },
        lint: {
          code: 1,
          stdout: 'src/a.ts:1:1 error lint-fail\n',
        },
        deps: { code: 0 },
        knip: { code: 0 },
        'mutation-scope': { code: 0 },
        'git-test-isolation': { code: 0 },
        roadmap: { code: 1, stderr: 'roadmap: docs/roadmap.md:1 bad\n' },
        unit: { code: 1, stdout: 'FAIL src/b.test.ts:2 unit-fail\n' },
      }),
      write: (t) => {
        out += t
      },
    })
    expect(summary.ok).toBe(false)
    const failedNames = summary.failed.map((r) => r.name).sort()
    expect(failedNames).toEqual(['lint', 'roadmap', 'unit'])
    expect(out).toMatch(/lint:.*lint-fail/)
    expect(out).toMatch(/unit:.*unit-fail/)
    expect(out).toMatch(/roadmap:.*bad/)
    expect(fs.existsSync(path.join(root, '.cache/checks/lint.log'))).toBe(true)
    for (const name of failedNames) {
      const block = out
        .split('\n')
        .filter((l) => l.startsWith(`${name}:`) || l.startsWith('…'))
      expect(block.length).toBeLessThanOrEqual(21)
    }
  })

  it('prints at most one OK line per check when green', async () => {
    const root = tmpRoot()
    let out = ''
    const summary = await runChecks({
      root,
      spawnImpl: fakeSpawnByCheckName({
        typecheck: { code: 0 },
        lint: { code: 0 },
        deps: { code: 0 },
        knip: { code: 0 },
        'mutation-scope': { code: 0 },
        'git-test-isolation': { code: 0 },
        roadmap: { code: 0 },
        unit: { code: 0 },
      }),
      write: (t) => {
        out += t
      },
    })
    expect(summary.ok).toBe(true)
    const okLines = out.split('\n').filter((l) => l.startsWith('OK '))
    expect(okLines.length).toBe(8)
    expect(out).not.toMatch(/PASS|✓|passed/i)
  })

  it('does not schedule Playwright/e2e argv', async () => {
    const root = tmpRoot()
    /** @type {string[][]} */
    const calls = []
    await runChecks({
      root,
      spawnImpl: (file, args) => {
        calls.push([file, ...args])
        return fakeSpawnByCheckName({})(file, args)
      },
      write: () => {},
    })
    expect(
      calls.some((c) => c.some((a) => String(a).includes('playwright'))),
    ).toBe(false)
    expect(
      calls.some((c) => c.some((a) => String(a).includes('test:e2e'))),
    ).toBe(false)
  })
})

describe('main', () => {
  it('exits 1 when any check fails', async () => {
    const root = tmpRoot()
    const code = await main(['--verbose'], {
      root,
      spawnImpl: fakeSpawnByCheckName({
        lint: { code: 1, stdout: 'x.ts:1 error\n' },
      }),
      write: () => {},
    })
    expect(code).toBe(1)
  })

  it('honors --verbose and -v with full tool output', async () => {
    const root = tmpRoot()
    let out = ''
    await main(['--verbose'], {
      root,
      spawnImpl: fakeSpawnByCheckName({
        lint: { code: 1, stdout: '  padded error line  \n' },
      }),
      write: (t) => {
        out += t
      },
    })
    expect(out).toContain('--- lint ---')
    expect(out).toContain('  padded error line  ')

    out = ''
    await main(['-v'], {
      root,
      spawnImpl: fakeSpawnByCheckName({
        lint: { code: 1, stdout: 'verbose-via-v\n' },
      }),
      write: (t) => {
        out += t
      },
    })
    expect(out).toContain('--- lint ---')
    expect(out).toContain('verbose-via-v')

    out = ''
    await main([], {
      root,
      spawnImpl: fakeSpawnByCheckName({
        lint: { code: 1, stdout: 'quiet-fail\n' },
      }),
      write: (t) => {
        out += t
      },
    })
    expect(out).not.toContain('--- lint ---')
    expect(out).toContain('lint:')
  })

  it('honors --skip-unit', async () => {
    const root = tmpRoot()
    const summary = await runChecks({
      root,
      skipUnit: true,
      spawnImpl: fakeSpawnByCheckName({}),
      write: () => {},
    })
    expect(summary.results.map((r) => r.name)).not.toContain('unit')
    expect(summary.results.map((r) => r.name)).toContain('lint')

    /** @type {string[][]} */
    const calls = []
    await main(['--skip-unit'], {
      root,
      spawnImpl: (file, args) => {
        calls.push([file, ...args])
        return fakeSpawnByCheckName({})(file, args)
      },
      write: () => {},
    })
    expect(calls.some((c) => c.includes('test:quiet'))).toBe(false)
  })

  it('exits 0 when all green', async () => {
    const root = tmpRoot()
    const code = await main([], {
      root,
      spawnImpl: fakeSpawnByCheckName({}),
      write: () => {},
    })
    expect(code).toBe(0)
  })

  it('surfaces spawn errors as failed checks', async () => {
    const root = tmpRoot()
    const spawnImpl = () => {
      const ee = new EventEmitter()
      ee.stdout = new EventEmitter()
      ee.stderr = new EventEmitter()
      queueMicrotask(() => {
        ee.emit('error', new Error('spawn ENOENT'))
      })
      return ee
    }
    const summary = await runChecks({
      root,
      inventory: [{ name: 'lint', argv: ['missing-bin'] }],
      spawnImpl,
      write: () => {},
    })
    expect(summary.ok).toBe(false)
    expect(summary.failed[0].problems.some((p) => p.includes('ENOENT'))).toBe(
      true,
    )
  })

  it('treats null exit code as failure and clamps negative duration', async () => {
    const root = tmpRoot()
    const spawnImpl = () => {
      const ee = new EventEmitter()
      ee.stdout = new EventEmitter()
      ee.stderr = new EventEmitter()
      queueMicrotask(() => ee.emit('close', null))
      return ee
    }
    let t = 1000
    const summary = await runChecks({
      root,
      inventory: [{ name: 'lint', argv: ['x'] }],
      spawnImpl,
      now: () => {
        t -= 500
        return t
      },
      write: () => {},
    })
    expect(summary.ok).toBe(false)
    expect(summary.results[0].code).toBe(1)
    expect(summary.results[0].ms).toBe(0)
  })
})
