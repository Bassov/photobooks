import { describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadGates } from './load-gates.mjs'
import { gitExec, gitTestEnv, initTmpRepo } from './git-test-helper.mjs'
import { loadMutatePatterns } from './mutation-scope.mjs'
import { mutationScore } from './stryker-pr-summary.mjs'
import {
  collectChangedLineRanges,
  countFileLines,
  runStrykerDiff,
} from './stryker-diff.mjs'
import {
  DIFF_CONFIG,
  MSG_NO_COVERAGE,
  MSG_SKIP_PRODUCTION,
  MSG_UNAUTHORIZED_EXCLUDE,
  MUTATE_FILES_LIST,
  buildStrykerArgs,
  countNoCoverage,
  evaluateNoCoverageGate,
  exactBangExcludeTarget,
  filterReportToScoredRanges,
  findUnauthorizedExcludes,
  formatMutateRangeSpecs,
  isMutationRangeSpec,
  lineInRanges,
  listNoCoverageMutants,
  mergeLineRanges,
  mergeRangeMaps,
  mutateSpecPath,
  mutateSpecRange,
  parseUnifiedDiffNewSideRanges,
  planDiffMutation,
  matchesMutateInclude,
  allowEmptyForMutateSpecs,
  scoredRangesFromMutateSpecs,
  temporaryExcludePaths,
  temporaryExcludesMissingBangs,
} from './stryker-diff-gate.mjs'

/** Minimal mutate patterns mirroring product includes + bangs. */
const PATTERNS = [
  'src/**/*.ts',
  'src/**/*.tsx',
  'scripts/**/*.mjs',
  '!src/**/*.{test,spec}.{ts,tsx}',
  '!src/main.tsx',
  '!src/editor/projectSession.ts',
  '!src/project/fsa/bookLoad.worker.ts',
  '!src/editor/EditorShell.tsx',
]

const TEMP = temporaryExcludePaths([
  { path: 'src/editor/projectSession.ts', until: 'project-session-mutation' },
  { path: 'src/editor/EditorShell.tsx', until: 'editor-shell-mutation' },
])

/**
 * @param {{ killed?: number, survived?: number, noCoverage?: number, file?: string }} opts
 */
function reportWithCounts(opts) {
  const file = opts.file ?? 'src/lib/example.ts'
  /** @type {{ status: string, location: { start: { line: number } }, mutatorName: string }[]} */
  const mutants = []
  let line = 1
  for (let i = 0; i < (opts.killed ?? 0); i += 1) {
    mutants.push({
      status: 'Killed',
      location: { start: { line: line++ } },
      mutatorName: 'K',
    })
  }
  for (let i = 0; i < (opts.survived ?? 0); i += 1) {
    mutants.push({
      status: 'Survived',
      location: { start: { line: line++ } },
      mutatorName: 'S',
    })
  }
  for (let i = 0; i < (opts.noCoverage ?? 0); i += 1) {
    mutants.push({
      status: 'NoCoverage',
      location: { start: { line: line++ } },
      mutatorName: 'N',
    })
  }
  return { [file]: { mutants } }
}

describe('stryker-diff-gate helpers', () => {
  it('exports diff config path and builds argv without allowEmpty for production', () => {
    expect(DIFF_CONFIG).toBe('stryker.diff.config.mjs')
    expect(buildStrykerArgs(['src/a.ts'], false)).toEqual([
      DIFF_CONFIG,
      '--mutate',
      'src/a.ts',
    ])
    expect(buildStrykerArgs(['src/a.ts'], true)).toContain('--allowEmpty')
  })

  it('diff config file spreads nightly and uses gates.diffThresholds', () => {
    const src = readFileSync('stryker.diff.config.mjs', 'utf8')
    expect(src).toContain('stryker.config.mjs')
    expect(src).toContain('diffThresholds')
    expect(src).toContain('load-gates')
  })

  it('docs-only change plans skip', () => {
    const plan = planDiffMutation(['docs/readme.md'], PATTERNS, TEMP)
    expect(plan.skip).toBe(true)
    expect(plan.errors).toEqual([])
    expect(plan.allowEmpty).toBe(true)
  })

  it('temporary-excluded-only change plans skip', () => {
    const plan = planDiffMutation(
      ['src/editor/projectSession.ts'],
      PATTERNS,
      TEMP,
    )
    expect(plan.skip).toBe(true)
    expect(plan.errors).toEqual([])
  })

  it('PR #70-like: excluded file not on temporary list fails', () => {
    const plan = planDiffMutation(
      ['src/project/fsa/bookLoad.worker.ts'],
      PATTERNS,
      TEMP,
    )
    expect(plan.skip).toBe(false)
    expect(
      plan.errors.some((e) => e.startsWith(MSG_UNAUTHORIZED_EXCLUDE)),
    ).toBe(true)
    expect(
      findUnauthorizedExcludes(
        ['src/project/fsa/bookLoad.worker.ts'],
        PATTERNS,
        TEMP,
      ),
    ).toEqual(['src/project/fsa/bookLoad.worker.ts'])
  })

  it('in-scope change mutates and drops allowEmpty', () => {
    const plan = planDiffMutation(['src/lib/foo.ts'], PATTERNS, TEMP)
    expect(plan.skip).toBe(false)
    expect(plan.mutateFiles).toEqual(['src/lib/foo.ts'])
    expect(plan.mutateSpecs).toEqual(['src/lib/foo.ts'])
    expect(plan.allowEmpty).toBe(false)
    expect(plan.errors).toEqual([])
  })

  it('ranged in-scope mutate allows empty (comment-only zero mutants)', () => {
    const ranges = new Map([['src/lib/foo.ts', [{ start: 3, end: 3 }]]])
    const plan = planDiffMutation(['src/lib/foo.ts'], PATTERNS, TEMP, ranges)
    expect(plan.skip).toBe(false)
    expect(plan.mutateSpecs).toEqual(['src/lib/foo.ts:3-3'])
    expect(plan.allowEmpty).toBe(true)
    expect(buildStrykerArgs(plan.mutateSpecs, plan.allowEmpty)).toEqual([
      DIFF_CONFIG,
      '--mutate',
      'src/lib/foo.ts:3-3',
      '--allowEmpty',
    ])
  })

  it('empty scored ranges skip even when production path changed', () => {
    const ranges = new Map([['src/lib/foo.ts', []]])
    const plan = planDiffMutation(['src/lib/foo.ts'], PATTERNS, TEMP, ranges)
    expect(plan.skip).toBe(true)
    expect(plan.mutateSpecs).toEqual([])
    expect(plan.errors).toEqual([])
  })

  it('missing map entry uses empty ranges (?? []) without mutating', () => {
    const plan = planDiffMutation(['src/lib/foo.ts'], PATTERNS, TEMP, new Map())
    expect(plan.skip).toBe(true)
    expect(plan.mutateSpecs).toEqual([])
  })

  it('structural test exclude does not fail skip', () => {
    const plan = planDiffMutation(['src/lib/foo.test.ts'], PATTERNS, TEMP)
    expect(plan.skip).toBe(true)
    expect(plan.errors).toEqual([])
  })

  it('PR #71-like: 85.4% with 18 NoCoverage fails NoCoverage gate', () => {
    const files = reportWithCounts({
      killed: 854,
      survived: 128,
      noCoverage: 18,
    })
    expect(mutationScore(854, 0, 128, 18)).toBe(85.4)
    expect(countNoCoverage(files)).toBe(18)
    const gate = evaluateNoCoverageGate(files)
    expect(gate.ok).toBe(false)
    expect(gate.error).toBe(`${MSG_NO_COVERAGE}18`)
    expect(listNoCoverageMutants(files)).toHaveLength(18)
  })

  it('PR #82 r1-like: ~72.5% with 3 NoCoverage fails NoCoverage gate', () => {
    const files = reportWithCounts({
      killed: 7249,
      survived: 2748,
      noCoverage: 3,
    })
    expect(mutationScore(7249, 0, 2748, 3)).toBe(72.5)
    expect(mutationScore(7249, 0, 2748, 3)).toBeLessThan(85)
    const gate = evaluateNoCoverageGate(files)
    expect(gate.ok).toBe(false)
    expect(gate.count).toBe(3)
  })

  it('zero NoCoverage passes the gate', () => {
    const files = reportWithCounts({ killed: 90, survived: 10, noCoverage: 0 })
    expect(evaluateNoCoverageGate(files).ok).toBe(true)
  })

  it('listNoCoverageMutants formats missing line and mutator', () => {
    const listed = listNoCoverageMutants({
      'src/a.ts': { mutants: [{ status: 'NoCoverage' }] },
    })
    expect(listed).toEqual([{ path: 'src/a.ts', line: '?', mutator: '' }])
  })

  it('countNoCoverage ignores non-array mutants', () => {
    expect(countNoCoverage({ 'src/a.ts': { mutants: null } })).toBe(0)
    expect(countNoCoverage({ 'src/a.ts': {} })).toBe(0)
  })

  it('listNoCoverageMutants treats non-array mutants as empty', () => {
    expect(listNoCoverageMutants({ 'src/a.ts': { mutants: null } })).toEqual([])
    expect(listNoCoverageMutants({ 'src/a.ts': {} })).toEqual([])
  })

  it('temporaryExcludePaths skips bad rows', () => {
    expect([
      ...temporaryExcludePaths([null, { path: 1 }, { path: 'ok.ts' }]),
    ]).toEqual(['ok.ts'])
  })

  it('exactBangExcludeTarget ignores globs and non-bangs', () => {
    expect(
      exactBangExcludeTarget('src/a.ts', ['src/**/*.ts', '!src/**/*.ts']),
    ).toBeNull()
    expect(exactBangExcludeTarget('src/a.ts', ['!src/a.ts'])).toBe('src/a.ts')
    expect(
      exactBangExcludeTarget('src/a.ts', ['!src/a.ts', '!src/{a,b}.ts']),
    ).toBe('src/a.ts')
    expect(exactBangExcludeTarget('src/a.ts', ['!src/a?ts'])).toBeNull()
  })

  it('mixed docs + in-scope still drops allowEmpty via some()', () => {
    const plan = planDiffMutation(
      ['docs/readme.md', 'src/lib/foo.ts'],
      PATTERNS,
      TEMP,
    )
    expect(plan.allowEmpty).toBe(false)
    expect(plan.mutateFiles).toEqual(['src/lib/foo.ts'])
  })

  it('temporaryExcludesMissingBangs requires exact bangs', () => {
    expect(
      temporaryExcludesMissingBangs(
        ['src/a.ts', 'src/b.ts'],
        ['src/**/*.ts', '!src/a.ts'],
      ),
    ).toEqual(['src/b.ts'])
    expect(
      temporaryExcludesMissingBangs(
        ['src/a.ts'],
        ['!src/a.ts', '!src/**/*.ts'],
      ),
    ).toEqual([])
    // Glob metacharacters must not count as exact bangs (kills &&→|| mutants).
    expect(temporaryExcludesMissingBangs(['src/a?ts'], ['!src/a?ts'])).toEqual([
      'src/a?ts',
    ])
    expect(
      temporaryExcludesMissingBangs(['src/{a}.ts'], ['!src/{a}.ts']),
    ).toEqual(['src/{a}.ts'])
    expect(
      temporaryExcludesMissingBangs(['src/x.ts'], ['src/**/*.ts', '!src/y.ts']),
    ).toEqual(['src/x.ts'])
  })

  it('matchesMutateInclude skips bang patterns via startsWith', () => {
    expect(
      matchesMutateInclude('src/lib/foo.ts', ['!src/**/*.ts', 'src/**/*.ts']),
    ).toBe(true)
    expect(matchesMutateInclude('docs/a.md', ['src/**/*.ts'])).toBe(false)
    // A pattern that merely ends with '!' must not be treated as a bang skip.
    expect(matchesMutateInclude('src/lib/foo.ts', ['src/**/*.ts!'])).toBe(false)
  })

  it('real gates temporaryExcludes all have exact bangs', () => {
    const gates = loadGates()
    const paths = gates.mutation.temporaryExcludes.map((e) => e.path)
    expect(temporaryExcludesMissingBangs(paths, loadMutatePatterns())).toEqual(
      [],
    )
  })

  it('listNoCoverageMutants prefers mutatorName then id', () => {
    expect(
      listNoCoverageMutants({
        'src/a.ts': {
          mutants: [
            { status: 'NoCoverage', id: 'id-only' },
            {
              status: 'NoCoverage',
              mutatorName: 'BooleanLiteral',
              id: 'ignored',
              location: { start: { line: 3 } },
            },
          ],
        },
      }),
    ).toEqual([
      { path: 'src/a.ts', line: '?', mutator: 'id-only' },
      { path: 'src/a.ts', line: '3', mutator: 'BooleanLiteral' },
    ])
  })
})

describe('stryker-diff line-range helpers', () => {
  it('parses -U0 hunks, merges adjacent, ignores delete-only', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -10,0 +11,2 @@',
      '+a',
      '+b',
      '@@ -20 +22 @@',
      '+c',
      '@@ -30,2 +32,0 @@',
      '-x',
      '-y',
      'diff --git a/src/b.ts b/src/b.ts',
      '--- a/src/b.ts',
      '+++ b/src/b.ts',
      '@@ -1 +1 @@',
      '+z',
    ].join('\n')
    const map = parseUnifiedDiffNewSideRanges(diff)
    expect(map.get('src/a.ts')).toEqual([
      { start: 11, end: 12 },
      { start: 22, end: 22 },
    ])
    expect(map.get('src/b.ts')).toEqual([{ start: 1, end: 1 }])
    expect(
      mergeLineRanges([
        { start: 1, end: 2 },
        { start: 3, end: 4 },
      ]),
    ).toEqual([{ start: 1, end: 4 }])
    expect(
      formatMutateRangeSpecs('src/a.ts', map.get('src/a.ts') ?? []),
    ).toEqual(['src/a.ts:11-12', 'src/a.ts:22-22'])
  })

  it('mutateSpecPath / isMutationRangeSpec / scoredRangesFromMutateSpecs', () => {
    expect(isMutationRangeSpec('src/a.ts:3-5')).toBe(true)
    expect(isMutationRangeSpec('src/a.ts')).toBe(false)
    expect(mutateSpecPath('src/a.ts:3-5')).toBe('src/a.ts')
    expect(mutateSpecPath('src/a.ts')).toBe('src/a.ts')
    const scored = scoredRangesFromMutateSpecs([
      'src/a.ts:1-2',
      'src/a.ts:4-4',
      'src/b.ts',
    ])
    expect(scored.get('src/a.ts')).toEqual([
      { start: 1, end: 2 },
      { start: 4, end: 4 },
    ])
    expect(scored.has('src/b.ts')).toBe(false)
  })

  it('NoCoverage outside scored ranges does not fail; inside does', () => {
    const files = {
      'src/legacy.ts': {
        mutants: [
          {
            status: 'NoCoverage',
            location: { start: { line: 10 } },
            mutatorName: 'Outside',
          },
          {
            status: 'NoCoverage',
            location: { start: { line: 42 } },
            mutatorName: 'Inside',
          },
          {
            status: 'Killed',
            location: { start: { line: 42 } },
            mutatorName: 'K',
          },
        ],
      },
    }
    const scored = new Map([['src/legacy.ts', [{ start: 40, end: 45 }]]])
    expect(countNoCoverage(files, scored)).toBe(1)
    expect(evaluateNoCoverageGate(files, scored).ok).toBe(false)
    expect(listNoCoverageMutants(files, scored)).toEqual([
      { path: 'src/legacy.ts', line: '42', mutator: 'Inside' },
    ])
    expect(
      evaluateNoCoverageGate(
        files,
        new Map([['src/legacy.ts', [{ start: 1, end: 5 }]]]),
      ).ok,
    ).toBe(true)
    expect(
      filterReportToScoredRanges(files, scored)['src/legacy.ts']?.mutants,
    ).toHaveLength(2)
  })

  it('score below break uses gates.diffThresholds via DIFF_CONFIG (unchanged 85)', () => {
    const breakAt = loadGates().stryker.diffThresholds.break
    expect(breakAt).toBe(85)
    const score = mutationScore(70, 0, 30, 0)
    expect(score).toBe(70)
    expect(score).toBeLessThan(breakAt)
    // Production fail path: Stryker loads DIFF_CONFIG → diffThresholds.break.
    expect(buildStrykerArgs(['src/a.ts:1-1'], true)[0]).toBe(DIFF_CONFIG)
    const diffCfg = readFileSync(DIFF_CONFIG, 'utf8')
    expect(diffCfg).toContain('diffThresholds')
    expect(diffCfg).toContain('load-gates')
    expect(diffCfg).toContain('thresholds: gates.stryker.diffThresholds')
  })

  it('mergeRangeMaps unions files', () => {
    const a = new Map([['f.ts', [{ start: 1, end: 1 }]]])
    const b = new Map([
      ['f.ts', [{ start: 2, end: 2 }]],
      ['g.ts', [{ start: 9, end: 9 }]],
    ])
    expect(mergeRangeMaps(a, b).get('f.ts')).toEqual([{ start: 1, end: 2 }])
    expect(mergeRangeMaps(a, b).get('g.ts')).toEqual([{ start: 9, end: 9 }])
  })

  it('countFileLines ignores trailing newline', () => {
    expect(countFileLines('')).toBe(0)
    expect(countFileLines('\n')).toBe(0)
    expect(countFileLines('a\n')).toBe(1)
    expect(countFileLines('a\nb\n')).toBe(2)
    expect(countFileLines('a\nb')).toBe(2)
  })

  it('mutateSpecRange rejects inverted / non-finite / non-matching specs', () => {
    expect(mutateSpecRange('src/a.ts')).toBeNull()
    expect(mutateSpecRange('src/a.ts:0-1')).toBeNull()
    expect(mutateSpecRange('src/a.ts:5-4')).toBeNull()
    expect(mutateSpecRange('src/a.ts:2-2')).toEqual({ start: 2, end: 2 })
    expect(mutateSpecRange('src/a.ts:1:3-2:5')).toEqual({ start: 1, end: 2 })
  })

  it('mergeLineRanges filters invalid rows and sorts before merge', () => {
    expect(mergeLineRanges(null)).toEqual([])
    expect(mergeLineRanges(undefined)).toEqual([])
    expect(mergeLineRanges('x')).toEqual([])
    // Non-empty input, all invalid → hits valid.length === 0 return [].
    expect(
      mergeLineRanges([{ start: NaN, end: 1 }, null, { start: 0, end: 0 }]),
    ).toEqual([])
    expect(
      mergeLineRanges([
        { start: 5, end: 5 },
        null,
        { start: NaN, end: 1 },
        { start: 0, end: 1 },
        { start: 3, end: 2 },
        { start: 1, end: 1 },
        { start: 2, end: 2 },
        { start: 3, end: 4 },
      ]),
    ).toEqual([{ start: 1, end: 5 }])
    expect(
      mergeLineRanges([
        { start: 10, end: 10 },
        { start: 1, end: 1 },
      ]),
    ).toEqual([
      { start: 1, end: 1 },
      { start: 10, end: 10 },
    ])
    // Tie-break on end when start equal (sort comparator second clause).
    expect(
      mergeLineRanges([
        { start: 1, end: 3 },
        { start: 1, end: 1 },
      ]),
    ).toEqual([{ start: 1, end: 3 }])
  })

  it('parseUnifiedDiff handles empty, /dev/null, +++ path, and anchors', () => {
    expect(parseUnifiedDiffNewSideRanges('')).toEqual(new Map())
    expect(parseUnifiedDiffNewSideRanges(null)).toEqual(new Map())
    expect(
      parseUnifiedDiffNewSideRanges(
        ['+++ /dev/null', '@@ -1 +0,0 @@', '-gone'].join('\n'),
      ).size,
    ).toBe(0)
    // Mid-line noise must not match startsWith('diff --git ').
    const junk = parseUnifiedDiffNewSideRanges(
      'noise diff --git a/src/a.ts b/src/a.ts\n@@ -0,0 +1,1 @@\n+x\n',
    )
    expect(junk.size).toBe(0)
    // Path with spaces after b/ is rejected.
    expect(
      parseUnifiedDiffNewSideRanges(
        'diff --git a/x b/src/a.ts TRAILING\n@@ -0,0 +1,1 @@\n+x\n',
      ).size,
    ).toBe(0)
    const multi = parseUnifiedDiffNewSideRanges(
      [
        'diff --git a/src/ab.ts b/src/ab.ts',
        '--- a/src/ab.ts',
        '+++ b/src/ab.ts',
        '@@ -0,0 +1 @@',
        '+x',
      ].join('\n'),
    )
    expect(multi.get('src/ab.ts')).toEqual([{ start: 1, end: 1 }])
    const plusOnly = parseUnifiedDiffNewSideRanges(
      ['+++ b/src/c.ts', '@@ -0,0 +2,2 @@', '+a', '+b'].join('\n'),
    )
    expect(plusOnly.get('src/c.ts')).toEqual([{ start: 2, end: 3 }])
    const zero = parseUnifiedDiffNewSideRanges(
      [
        'diff --git a/src/d.ts b/src/d.ts',
        '+++ b/src/d.ts',
        '@@ -3,1 +3,0 @@',
        '-z',
        '@@ -8 +9 @@',
        '+y',
      ].join('\n'),
    )
    expect(zero.get('src/d.ts')).toEqual([{ start: 9, end: 9 }])
    const keep = parseUnifiedDiffNewSideRanges(
      [
        'diff --git a/src/e.ts b/src/e.ts',
        '+++ b/src/e.ts',
        '@@ -0,0 +1,1 @@',
        '+a',
        '+++ b/src/e.ts',
        '@@ -0,0 +3,1 @@',
        '+b',
      ].join('\n'),
    )
    expect(keep.get('src/e.ts')).toEqual([
      { start: 1, end: 1 },
      { start: 3, end: 3 },
    ])
    expect(() => mergeLineRanges([{ start: 1, end: 1 }, 'junk'])).toThrow(
      /invalid range entry/,
    )
  })

  it('lineInRanges and filterReportToScoredRanges edge cases', () => {
    expect(lineInRanges(NaN, [{ start: 1, end: 2 }])).toBe(false)
    expect(lineInRanges(2, [{ start: 1, end: 2 }])).toBe(true)
    expect(lineInRanges(3, [{ start: 1, end: 2 }])).toBe(false)
    const files = {
      'src/a.ts': {
        mutants: [
          { status: 'Killed', location: { start: { line: 1 } } },
          { status: 'Killed', location: null },
          { status: 'Killed' },
        ],
      },
      'src/b.ts': {
        mutants: [{ status: 'Killed', location: { start: { line: 1 } } }],
      },
    }
    expect(filterReportToScoredRanges(files, null)).toBe(files)
    expect(
      filterReportToScoredRanges(files, new Map([['src/a.ts', []]])),
    ).toEqual({})
    expect(
      filterReportToScoredRanges(
        files,
        new Map([['src/a.ts', [{ start: 1, end: 1 }]]]),
      )['src/a.ts']?.mutants,
    ).toHaveLength(1)
    expect(
      filterReportToScoredRanges(
        { 'src/a.ts': { mutants: null } },
        new Map([['src/a.ts', [{ start: 1, end: 1 }]]]),
      )['src/a.ts']?.mutants,
    ).toEqual([])
  })

  it('allowEmptyForMutateSpecs requires every entry to be a range', () => {
    expect(allowEmptyForMutateSpecs([])).toBe(true)
    expect(allowEmptyForMutateSpecs(['src/a.ts:1-2'])).toBe(true)
    expect(allowEmptyForMutateSpecs(['src/a.ts:1-2', 'src/b.ts'])).toBe(false)
    expect(allowEmptyForMutateSpecs(['src/a.ts'])).toBe(false)
  })
})

describe('collectChangedLineRanges / git failure', () => {
  it('exits when git diff fails', () => {
    const errs = []
    const orig = console.error
    console.error = (m) => errs.push(String(m))
    let exited = /** @type {number | null} */ (null)
    expect(() =>
      collectChangedLineRanges('main', gitTestEnv(), '/tmp', {
        spawnSync: () => ({ status: 2, stderr: 'git boom', stdout: '' }),
        exit: (code) => {
          exited = code
        },
      }),
    ).toThrow(/git boom/)
    expect(exited).toBe(2)
    expect(errs.some((e) => e.includes('git boom'))).toBe(true)
    console.error = orig
  })

  it('uses default process.exit when io.exit omitted', () => {
    const errs = []
    const origErr = console.error
    const origExit = process.exit
    console.error = (m) => errs.push(String(m))
    /** @type {number | null} */
    let code = null
    process.exit = /** @type {never} */ (
      (c) => {
        code = Number(c)
        throw new Error(`exit ${c}`)
      }
    )
    try {
      expect(() =>
        collectChangedLineRanges('main', gitTestEnv(), '/tmp', {
          spawnSync: () => ({ status: 3, stderr: '', stdout: null }),
        }),
      ).toThrow(/exit 3/)
      expect(code).toBe(3)
      expect(errs.some((e) => e.includes('git '))).toBe(true)
    } finally {
      console.error = origErr
      process.exit = origExit
    }
  })

  it('treats non-string git stdout as empty', () => {
    const { changed, rangesByFile } = collectChangedLineRanges(
      'main',
      gitTestEnv(),
      '/tmp',
      {
        spawnSync: () => ({ status: 0, stdout: null }),
        existsSync: () => false,
      },
    )
    expect(changed).toEqual([])
    expect(rangesByFile.size).toBe(0)
  })

  it('skips missing untracked files and empty untracked content', () => {
    const cwd = '/tmp/fake-repo'
    const { rangesByFile, changed } = collectChangedLineRanges(
      'main',
      gitTestEnv(),
      cwd,
      {
        spawnSync: (cmd, args) => {
          if (cmd === 'git' && args[0] === 'ls-files') {
            return { status: 0, stdout: 'src/missing.ts\nsrc/empty.ts\n' }
          }
          if (cmd === 'git' && args.includes('--name-only')) {
            return { status: 0, stdout: '' }
          }
          if (cmd === 'git' && args.includes('-U0')) {
            return { status: 0, stdout: '' }
          }
          return { status: 0, stdout: '' }
        },
        existsSync: (p) => String(p).endsWith('src/empty.ts'),
        readFileSync: () => '',
      },
    )
    expect(changed).toContain('src/empty.ts')
    expect(rangesByFile.has('src/empty.ts')).toBe(false)
    expect(rangesByFile.has('src/missing.ts')).toBe(false)
  })
})

describe('parseUnifiedDiff table fixtures', () => {
  it('rejects diff --git without b/ marker', () => {
    expect(
      parseUnifiedDiffNewSideRanges('diff --git a/x a/x\n@@ -0,0 +1,1 @@\n+x\n')
        .size,
    ).toBe(0)
  })

  it('rejects empty path after b/', () => {
    expect(
      parseUnifiedDiffNewSideRanges('diff --git a/x b/\n@@ -0,0 +1,1 @@\n+x\n')
        .size,
    ).toBe(0)
  })

  it('skips hunk without + section', () => {
    expect(
      parseUnifiedDiffNewSideRanges(
        'diff --git a/f b/f\n@@ -1,1 -1,1 @@\n',
      ).get('f') ?? [],
    ).toEqual([])
  })

  it('rejects +++ b/ empty path', () => {
    expect(
      parseUnifiedDiffNewSideRanges('+++ b/\n@@ -0,0 +1,1 @@\n+x\n').size,
    ).toBe(0)
  })

  it('defaults count to 1 when no comma', () => {
    expect(
      parseUnifiedDiffNewSideRanges(
        'diff --git a/f b/f\n@@ -0,0 +5 @@\n+x\n',
      ).get('f'),
    ).toEqual([{ start: 5, end: 5 }])
  })

  it('skips non-finite start', () => {
    expect(
      parseUnifiedDiffNewSideRanges(
        'diff --git a/f b/f\n@@ -0,0 +NaN,1 @@\n+x\n',
      ).get('f') ?? [],
    ).toEqual([])
  })

  it('mergeLineRanges covers overlap without extending end', () => {
    expect(
      mergeLineRanges([
        { start: 1, end: 5 },
        { start: 2, end: 4 },
      ]),
    ).toEqual([{ start: 1, end: 5 }])
  })

  it('mergeLineRanges rejects non-number start/end types', () => {
    expect(
      mergeLineRanges([
        { start: '1', end: 2 },
        { start: 3, end: 3 },
      ]),
    ).toEqual([{ start: 3, end: 3 }])
  })
})

describe('runStrykerDiff with injected io', () => {
  const patterns = PATTERNS
  const gates = {
    mutation: { temporaryExcludes: [...TEMP].map((path) => ({ path })) },
    stryker: { diffThresholds: { high: 90, low: 85, break: 85 } },
  }

  it('skips when scored ranges empty', () => {
    const logs = []
    const orig = console.log
    console.log = (m) => logs.push(String(m))
    try {
      const code = runStrykerDiff(
        [],
        { STRYKER_DIFF_BASE: 'main' },
        {
          loadMutatePatterns: () => patterns,
          loadGates: () => gates,
          spawnSync: (cmd, args) => {
            if (
              cmd === 'git' &&
              args[0] === 'diff' &&
              args.includes('--name-only')
            ) {
              return { status: 0, stdout: 'src/lib/foo.ts\n' }
            }
            if (cmd === 'git' && args.includes('-U0')) {
              // delete-only: no new-side lines
              return {
                status: 0,
                stdout:
                  'diff --git a/src/lib/foo.ts b/src/lib/foo.ts\n+++ b/src/lib/foo.ts\n@@ -1,1 +0,0 @@\n-x\n',
              }
            }
            if (cmd === 'git' && args[0] === 'ls-files') {
              return { status: 0, stdout: '' }
            }
            return { status: 0, stdout: '' }
          },
        },
      )
      expect(code).toBe(0)
      expect(logs.some((l) => l.includes('skipping Stryker'))).toBe(true)
    } finally {
      console.log = orig
    }
  })

  it('fails unauthorized exclude before mutate', () => {
    const errs = []
    const orig = console.error
    console.error = (m) => errs.push(String(m))
    try {
      const code = runStrykerDiff(
        [],
        { STRYKER_DIFF_BASE: 'main' },
        {
          loadMutatePatterns: () => patterns,
          loadGates: () => ({ mutation: { temporaryExcludes: [] } }),
          spawnSync: (cmd, args) => {
            if (cmd === 'git' && args.includes('--name-only')) {
              return {
                status: 0,
                stdout: 'src/project/fsa/bookLoad.worker.ts\n',
              }
            }
            if (cmd === 'git' && args.includes('-U0')) {
              return {
                status: 0,
                stdout:
                  'diff --git a/src/project/fsa/bookLoad.worker.ts b/src/project/fsa/bookLoad.worker.ts\n+++ b/src/project/fsa/bookLoad.worker.ts\n@@ -0,0 +1,1 @@\n+x\n',
              }
            }
            if (cmd === 'git' && args[0] === 'ls-files') {
              return { status: 0, stdout: '' }
            }
            return { status: 0, stdout: '' }
          },
        },
      )
      expect(code).toBe(1)
      expect(errs.some((e) => e.startsWith(MSG_UNAUTHORIZED_EXCLUDE))).toBe(
        true,
      )
    } finally {
      console.error = orig
    }
  })

  it('writes mutate list, runs stryker, applies ranged NoCoverage gate', () => {
    const writes = []
    const logs = []
    const origLog = console.log
    const origErr = console.error
    console.log = (m) => logs.push(String(m))
    console.error = (m) => logs.push(`ERR:${m}`)
    try {
      const report = {
        files: {
          'src/lib/foo.ts': {
            mutants: [
              {
                status: 'NoCoverage',
                location: { start: { line: 99 } },
                mutatorName: 'Outside',
              },
              {
                status: 'Killed',
                location: { start: { line: 3 } },
                mutatorName: 'K',
              },
            ],
          },
        },
      }
      const code = runStrykerDiff(
        [],
        { STRYKER_DIFF_BASE: 'main', STRYKER_DIFF_REPORT: '/tmp/mut.json' },
        {
          loadMutatePatterns: () => patterns,
          loadGates: () => gates,
          existsSync: (p) =>
            p === 'src/lib/foo.ts' ||
            p === '/tmp/mut.json' ||
            p === MUTATE_FILES_LIST,
          mkdirSync: () => {},
          writeFileSync: (p, data) => {
            writes.push({ p, data: String(data) })
          },
          readFileSync: (p) => {
            if (p === '/tmp/mut.json') return JSON.stringify(report)
            return ''
          },
          spawnSync: (cmd, args) => {
            if (cmd === 'pnpm') {
              expect(args).toContain('--allowEmpty')
              expect(
                args.some((a) => String(a).includes('src/lib/foo.ts:3-3')),
              ).toBe(true)
              return { status: 0 }
            }
            if (cmd === 'git' && args.includes('--name-only')) {
              return { status: 0, stdout: 'src/lib/foo.ts\n' }
            }
            if (cmd === 'git' && args.includes('-U0')) {
              return {
                status: 0,
                stdout:
                  'diff --git a/src/lib/foo.ts b/src/lib/foo.ts\n+++ b/src/lib/foo.ts\n@@ -0,0 +3,1 @@\n+x\n',
              }
            }
            if (cmd === 'git' && args[0] === 'ls-files') {
              return { status: 0, stdout: '' }
            }
            return { status: 0, stdout: '' }
          },
        },
      )
      expect(code).toBe(0)
      expect(writes.some((w) => w.data.includes('src/lib/foo.ts:3-3'))).toBe(
        true,
      )
      expect(logs.some((l) => l.includes('scored ranges'))).toBe(true)
    } finally {
      console.log = origLog
      console.error = origErr
    }
  })

  it('fails when mutation report is missing after stryker', () => {
    const errs = []
    const orig = console.error
    console.error = (m) => errs.push(String(m))
    try {
      const code = runStrykerDiff(
        [],
        {
          STRYKER_DIFF_BASE: 'main',
          STRYKER_DIFF_REPORT: '/tmp/missing-mut.json',
        },
        {
          loadMutatePatterns: () => patterns,
          loadGates: () => gates,
          existsSync: (p) => p === 'src/lib/foo.ts',
          mkdirSync: () => {},
          writeFileSync: () => {},
          spawnSync: (cmd, args) => {
            if (cmd === 'pnpm') return { status: 0 }
            if (cmd === 'git' && args.includes('--name-only')) {
              return { status: 0, stdout: 'src/lib/foo.ts\n' }
            }
            if (cmd === 'git' && args.includes('-U0')) {
              return {
                status: 0,
                stdout:
                  'diff --git a/src/lib/foo.ts b/src/lib/foo.ts\n+++ b/src/lib/foo.ts\n@@ -0,0 +1,1 @@\n+x\n',
              }
            }
            if (cmd === 'git' && args[0] === 'ls-files') {
              return { status: 0, stdout: '' }
            }
            return { status: 0, stdout: '' }
          },
        },
      )
      expect(code).toBe(1)
      expect(errs.some((e) => e.includes('No mutation report'))).toBe(true)
    } finally {
      console.error = orig
    }
  })

  it('fails when mutate paths missing on disk', () => {
    const errs = []
    const orig = console.error
    console.error = (m) => errs.push(String(m))
    try {
      const code = runStrykerDiff(
        [],
        { STRYKER_DIFF_BASE: 'main' },
        {
          loadMutatePatterns: () => patterns,
          loadGates: () => gates,
          existsSync: () => false,
          spawnSync: (cmd, args) => {
            if (cmd === 'git' && args.includes('--name-only')) {
              return { status: 0, stdout: 'src/lib/foo.ts\n' }
            }
            if (cmd === 'git' && args.includes('-U0')) {
              return {
                status: 0,
                stdout:
                  'diff --git a/src/lib/foo.ts b/src/lib/foo.ts\n+++ b/src/lib/foo.ts\n@@ -0,0 +1,1 @@\n+x\n',
              }
            }
            if (cmd === 'git' && args[0] === 'ls-files') {
              return { status: 0, stdout: '' }
            }
            return { status: 0, stdout: '' }
          },
        },
      )
      expect(code).toBe(1)
      expect(errs.some((e) => e.startsWith(MSG_SKIP_PRODUCTION))).toBe(true)
    } finally {
      console.error = orig
    }
  })

  it('fails NoCoverage on scored line after stryker success', () => {
    const errs = []
    const orig = console.error
    console.error = (m) => errs.push(String(m))
    try {
      const report = {
        files: {
          'src/lib/foo.ts': {
            mutants: [
              {
                status: 'NoCoverage',
                location: { start: { line: 3 } },
                mutatorName: 'N',
              },
            ],
          },
        },
      }
      const code = runStrykerDiff(
        [],
        { STRYKER_DIFF_BASE: 'main', STRYKER_DIFF_REPORT: '/tmp/mut.json' },
        {
          loadMutatePatterns: () => patterns,
          loadGates: () => gates,
          existsSync: (p) => p === 'src/lib/foo.ts' || p === '/tmp/mut.json',
          mkdirSync: () => {},
          writeFileSync: () => {},
          readFileSync: () => JSON.stringify(report),
          spawnSync: (cmd, args) => {
            if (cmd === 'pnpm') return { status: 0 }
            if (cmd === 'git' && args.includes('--name-only')) {
              return { status: 0, stdout: 'src/lib/foo.ts\n' }
            }
            if (cmd === 'git' && args.includes('-U0')) {
              return {
                status: 0,
                stdout:
                  'diff --git a/src/lib/foo.ts b/src/lib/foo.ts\n+++ b/src/lib/foo.ts\n@@ -0,0 +3,1 @@\n+x\n',
              }
            }
            if (cmd === 'git' && args[0] === 'ls-files') {
              return { status: 0, stdout: '' }
            }
            return { status: 0, stdout: '' }
          },
        },
      )
      expect(code).toBe(1)
      expect(errs.some((e) => e.startsWith(MSG_NO_COVERAGE))).toBe(true)
    } finally {
      console.error = orig
    }
  })

  it('propagates non-zero stryker status', () => {
    const code = runStrykerDiff(
      [],
      { STRYKER_DIFF_BASE: 'main' },
      {
        loadMutatePatterns: () => patterns,
        loadGates: () => gates,
        existsSync: (p) => p === 'src/lib/foo.ts',
        mkdirSync: () => {},
        writeFileSync: () => {},
        spawnSync: (cmd, args) => {
          if (cmd === 'pnpm') return { status: 7 }
          if (cmd === 'git' && args.includes('--name-only')) {
            return { status: 0, stdout: 'src/lib/foo.ts\n' }
          }
          if (cmd === 'git' && args.includes('-U0')) {
            return {
              status: 0,
              stdout:
                'diff --git a/src/lib/foo.ts b/src/lib/foo.ts\n+++ b/src/lib/foo.ts\n@@ -0,0 +1,1 @@\n+x\n',
            }
          }
          if (cmd === 'git' && args[0] === 'ls-files') {
            return { status: 0, stdout: '' }
          }
          return { status: 0, stdout: '' }
        },
      },
    )
    expect(code).toBe(7)
  })
})

describe('stryker-diff line-scope tmp-repo fixtures', () => {
  /** @type {string[]} */
  const track = []
  const cleanup = () => {
    for (const d of track.splice(0)) {
      rmSync(d, { recursive: true, force: true })
    }
  }

  it('comment-only and deleted-only yield empty or ranged plan without whole-file fail', () => {
    try {
      const repo = initTmpRepo(track, {
        prefix: 'stryker-line-',
        seedFiles: {
          'src/legacy.ts': [
            'export function legacy(a: number) {',
            '  if (a > 0) return a + 1',
            '  return a - 1',
            '}',
            '',
          ].join('\n'),
        },
      })
      gitExec(['checkout', '-b', 'feature'], repo, { stdio: 'ignore' })

      // Comment-only edit on line 1.
      writeFileSync(
        path.join(repo, 'src/legacy.ts'),
        [
          '// touch',
          'export function legacy(a: number) {',
          '  if (a > 0) return a + 1',
          '  return a - 1',
          '}',
          '',
        ].join('\n'),
      )
      const env = gitTestEnv()
      const comment = collectChangedLineRanges('main', env, repo)
      expect(comment.rangesByFile.get('src/legacy.ts')).toEqual([
        { start: 1, end: 1 },
      ])
      const commentPlan = planDiffMutation(
        comment.changed,
        PATTERNS,
        TEMP,
        comment.rangesByFile,
      )
      expect(commentPlan.skip).toBe(false)
      expect(commentPlan.mutateSpecs).toEqual(['src/legacy.ts:1-1'])
      expect(commentPlan.allowEmpty).toBe(true)
      // Zero mutants on scored range → NoCoverage gate passes.
      expect(
        evaluateNoCoverageGate(
          { 'src/legacy.ts': { mutants: [] } },
          scoredRangesFromMutateSpecs(commentPlan.mutateSpecs),
        ).ok,
      ).toBe(true)
      // Outside-range NoCoverage (legacy whole-file pain) must not fail.
      expect(
        evaluateNoCoverageGate(
          {
            'src/legacy.ts': {
              mutants: [
                {
                  status: 'NoCoverage',
                  location: { start: { line: 3 } },
                  mutatorName: 'Legacy',
                },
              ],
            },
          },
          scoredRangesFromMutateSpecs(commentPlan.mutateSpecs),
        ).ok,
      ).toBe(true)

      // Reset and deleted-only hunk (remove middle line; -U0 new-side count 0).
      gitExec(['checkout', '--', 'src/legacy.ts'], repo, { stdio: 'ignore' })
      writeFileSync(
        path.join(repo, 'src/legacy.ts'),
        ['export function legacy(a: number) {', '  return a - 1', '}', ''].join(
          '\n',
        ),
      )
      const deleted = collectChangedLineRanges('main', env, repo)
      expect(deleted.rangesByFile.get('src/legacy.ts') ?? []).toEqual([])
      const delPlan = planDiffMutation(
        deleted.changed,
        PATTERNS,
        TEMP,
        deleted.rangesByFile,
      )
      expect(delPlan.skip).toBe(true)
      expect(delPlan.mutateSpecs).toEqual([])
    } finally {
      cleanup()
    }
  })

  it('untracked whole-file gets 1..N range', () => {
    try {
      const repo = initTmpRepo(track, { prefix: 'stryker-untracked-' })
      mkdirSync(path.join(repo, 'src'), { recursive: true })
      writeFileSync(path.join(repo, 'src/new.ts'), 'export const x = 1\n')
      const collected = collectChangedLineRanges('main', gitTestEnv(), repo)
      expect(collected.changed).toContain('src/new.ts')
      expect(collected.rangesByFile.get('src/new.ts')).toEqual([
        { start: 1, end: 1 },
      ])
    } finally {
      cleanup()
    }
  })
})
