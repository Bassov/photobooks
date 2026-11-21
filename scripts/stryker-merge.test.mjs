import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  WORST_FILES_LIMIT,
  evaluateMerge,
  main,
  mergeReports,
  scoreOf,
  worstFiles,
} from './stryker-merge.mjs'
import { SHARDS } from './stryker-shards.mjs'

/** @type {string[]} */
const temps = []

afterEach(() => {
  for (const t of temps.splice(0)) {
    fs.rmSync(t, { recursive: true, force: true })
  }
})

/** @param {...string} statuses */
const mutants = (...statuses) => statuses.map((status) => ({ status }))

/**
 * @param {Record<string, string[]>} byFile
 */
const report = (byFile) => ({
  schemaVersion: '1',
  files: Object.fromEntries(
    Object.entries(byFile).map(([f, s]) => [f, { mutants: mutants(...s) }]),
  ),
})

function writeShards(count, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stryker-merge-'))
  temps.push(dir)
  for (let i = 0; i < count; i += 1) {
    const shard = path.join(dir, 'shards', `stryker-shard-${String(i)}`)
    fs.mkdirSync(shard, { recursive: true })
    fs.writeFileSync(
      path.join(shard, 'mutation.json'),
      JSON.stringify(report(files(i))),
    )
  }
  return dir
}

describe('scoreOf', () => {
  it('counts killed and timeout as detected, survived and no coverage as not', () => {
    expect(
      scoreOf(
        mutants(
          'Killed',
          'Timeout',
          'Survived',
          'NoCoverage',
          'Ignored',
          'CompileError',
        ),
      ),
    ).toEqual({ detected: 2, undetected: 2, score: 50 })
  })

  it('has no score without valid mutants', () => {
    expect(scoreOf(mutants('Ignored')).score).toBeNull()
  })
})

describe('mergeReports', () => {
  it('unions the file maps and keeps the first report header', () => {
    const { report: merged, duplicates } = mergeReports([
      report({ 'src/a.ts': ['Killed'] }),
      report({ 'src/b.ts': ['Survived'] }),
    ])
    expect(Object.keys(merged.files ?? {})).toEqual(['src/a.ts', 'src/b.ts'])
    expect(merged.schemaVersion).toBe('1')
    expect(duplicates).toEqual([])
  })

  it('lists a file reported by two shards', () => {
    expect(
      mergeReports([
        report({ 'src/b.ts': ['Killed'], 'src/a.ts': ['Killed'] }),
        report({ 'src/a.ts': ['Killed'] }),
      ]).duplicates,
    ).toEqual(['src/a.ts'])
  })
})

describe('worstFiles', () => {
  it('sorts by score, then most undetected, then path, and skips unscored files', () => {
    const rows = worstFiles(
      report({
        'src/c.ts': ['Killed', 'Survived'],
        'src/a.ts': ['Killed', 'Killed', 'Survived', 'Survived'],
        'src/b.ts': ['Survived', 'Killed'],
        'src/z.ts': ['Killed'],
        'src/i.ts': ['Ignored'],
      }).files,
      3,
    )
    expect(rows.map((r) => r.file)).toEqual([
      'src/a.ts',
      'src/b.ts',
      'src/c.ts',
    ])
  })
})

describe('evaluateMerge', () => {
  const base = { shards: 2, expected: 2, duplicates: [], breakAt: 60 }

  it('passes at the break and lists the worst files', () => {
    const files = report({
      'src/a.ts': ['Killed', 'Killed', 'Survived'],
      'src/b.ts': ['Killed', 'Survived', 'NoCoverage', 'Killed', 'Killed'],
    }).files
    const result = evaluateMerge({ ...base, files })
    expect(result.ok).toBe(true)
    expect(result.markdown).toContain(
      'Score **62.50%** over 2 files, 2/2 shards; break 60.',
    )
    expect(result.markdown).toContain(
      `### Worst ${String(WORST_FILES_LIMIT)} files`,
    )
    expect(result.markdown).toContain('| `src/b.ts` | 60.0 | 3 | 2 |')
    expect(result.markdown).not.toContain('**Fail:**')
  })

  it('fails below the break', () => {
    const files = report({
      'src/a.ts': ['Killed', 'Survived', 'Survived'],
    }).files
    const result = evaluateMerge({ ...base, files })
    expect(result.ok).toBe(false)
    expect(result.markdown).toContain(
      '- **Fail:** full score 33.33 is below break 60',
    )
  })

  it('does not fail on score without a break', () => {
    const files = report({ 'src/a.ts': ['Survived'] }).files
    expect(evaluateMerge({ ...base, files, breakAt: null }).ok).toBe(true)
  })

  it('fails on a missing shard or a duplicate file', () => {
    const files = report({ 'src/a.ts': ['Killed'] }).files
    const missing = evaluateMerge({ ...base, files, shards: 1 })
    expect(missing.ok).toBe(false)
    expect(missing.markdown).toContain('1 of 2 shard reports')
    const dup = evaluateMerge({ ...base, files, duplicates: ['src/a.ts'] })
    expect(dup.ok).toBe(false)
    expect(dup.markdown).toContain('files in more than one shard: src/a.ts')
  })

  it('shows n/a without scored mutants', () => {
    const result = evaluateMerge({ ...base, files: {} })
    expect(result.markdown).toContain('Score **n/a%**')
    expect(result.ok).toBe(true)
  })
})

describe('main', () => {
  it('writes the merged report and passes with every shard', () => {
    const dir = writeShards(SHARDS.length, (i) => ({
      [`src/f${String(i)}.ts`]: ['Killed'],
    }))
    const out = path.join(dir, 'out', 'mutation.json')
    let text = ''
    expect(
      main(path.join(dir, 'shards'), out, {
        breakAt: 60,
        write: (s) => (text += s),
      }),
    ).toBe(0)
    const merged = JSON.parse(fs.readFileSync(out, 'utf8'))
    expect(Object.keys(merged.files)).toHaveLength(SHARDS.length)
    expect(text).toContain('Score **100.00%**')
  })

  it('fails without writing when no shard reported', () => {
    const dir = writeShards(0, () => ({}))
    const out = path.join(dir, 'out', 'mutation.json')
    let text = ''
    expect(
      main(path.join(dir, 'missing'), out, {
        breakAt: 60,
        write: (s) => (text += s),
      }),
    ).toBe(1)
    expect(fs.existsSync(out)).toBe(false)
    expect(text).toContain(`0 of ${String(SHARDS.length)} shard reports`)
  })

  it('reads the break from quality/gates.json by default', () => {
    const dir = writeShards(SHARDS.length, (i) => ({
      [`src/f${String(i)}.ts`]: ['Survived'],
    }))
    let text = ''
    expect(
      main(path.join(dir, 'shards'), path.join(dir, 'm.json'), {
        write: (s) => (text += s),
      }),
    ).toBe(1)
    expect(text).toContain('below break 60')
  })
})
