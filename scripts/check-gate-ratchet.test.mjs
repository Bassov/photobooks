import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { stripGitKeys } from './strip-git-env.mjs'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
import {
  FIXTURE_IDS,
  RULE_IDS,
  analyzeWorkflowJobs,
  classifyGateSteps,
  compareGateTrees,
  extractCoverageExcludes,
  extractCoverageIncludes,
  extractStrykerGateBits,
  numberWeaker,
  parseArgs,
  parseExportedStringArray,
  parsePercentish,
  readTreeFromDir,
  readTreeFromGitRef,
  resolvePrPolicyBaseRef,
  runGateRatchetCli,
  runPrPolicyCheck,
  stripShellComments,
} from './check-gate-ratchet.mjs'
import { gitExec, initTmpRepo } from './git-test-helper.mjs'
import { parse as parseYaml } from 'yaml'

const tmpDirs = []

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop()
    fs.rmSync(d, { recursive: true, force: true })
  }
})

function tmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-ratchet-'))
  tmpDirs.push(d)
  return d
}

function writeTree(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
  }
}

/** Stable source text (not the Stryker-instrumented on-disk file). */
function scriptWithIds(ruleIds = RULE_IDS, fixtureIds = FIXTURE_IDS) {
  const q = (ids) => ids.map((id) => `  '${id}',`).join('\n')
  return `export const RULE_IDS = Object.freeze([\n${q(ruleIds)}\n])
export const FIXTURE_IDS = Object.freeze([\n${q(fixtureIds)}\n])
`
}

const baseGates = {
  coverage: { statements: 80, branches: 80, functions: 80, lines: 80 },
  stryker: { thresholds: { high: 80, low: 60, break: 60 } },
  lighthouse: {
    numberOfRuns: 1,
    assertions: { 'performance-budget': 'error' },
    budgets: [
      {
        path: '/*',
        resourceSizes: [{ resourceType: 'script', budget: 350 }],
        resourceCounts: [],
      },
    ],
  },
  playwright: { retries: 0, flakyRetries: 2 },
  e2e: { burnInDefault: 10, flakySpecs: [] },
  requiredCheckJobs: ['checks', 'integration', 'lighthouse', 'stryker-diff'],
}

const baseVite = `
export const coverageExcludeGlobs = ['src/**/*.d.ts'] as const
export default {
  test: {
    coverage: {
      include: ['src/**/*.{ts,tsx}', 'scripts/agent.mjs'],
      exclude: [...coverageExcludeGlobs],
    },
  },
}
`

const baseStryker = `
const config = {
  mutate: ['src/**/*.ts', '!src/**/*.test.ts'],
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
}
export default config
`

const baseCodecov = `
coverage:
  status:
    patch:
      default:
        target: 85%
        threshold: 0%
flags:
  unit:
    paths:
      - src/
ignore:
  - e2e/**
`

const basePkg = JSON.stringify(
  { name: 't', pnpm: { patchedDependencies: { 'a@1': 'patches/a.patch' } } },
  null,
  2,
)

function baseFiles(overrides = {}) {
  const ratchetScript = scriptWithIds()
  return {
    'quality/gates.json': JSON.stringify(baseGates),
    'codecov.yml': baseCodecov,
    'vite.config.ts': baseVite,
    'stryker.config.mjs': baseStryker,
    'package.json': basePkg,
    'scripts/check-gate-ratchet.mjs': ratchetScript,
    'scripts/check-gate-ratchet.test.mjs': `export const FIXTURE_IDS = Object.freeze([${FIXTURE_IDS.map((id) => `'${id}'`).join(',')}])\n`,
    '.github/workflows/integration.yml': `
jobs:
  e2e-burn-in:
    steps:
      - name: E2E burn-in
        run: pnpm exec playwright test --repeat-each=10
  e2e:
    steps:
      - name: E2E
        run: pnpm test:e2e
  integration:
    needs: [e2e, e2e-burn-in]
    steps:
      - name: Require e2e and burn-in
        run: |
          if [ "$E2E_RESULT" != "success" ]; then exit 1; fi
          if [ "$BURN_IN_RESULT" != "success" ]; then exit 1; fi
`,
    '.github/workflows/checks.yml': `
jobs:
  checks:
    steps:
      - name: Unit and property tests
        run: pnpm test:coverage
      - name: Dependency audit
        run: pnpm audit:ci
`,
    ...overrides,
  }
}

describe('FIXTURE_IDS / RULE_IDS exports', () => {
  it('lists the Done-when fixture ids', () => {
    for (const id of FIXTURE_IDS) {
      expect(typeof id).toBe('string')
    }
    expect(FIXTURE_IDS).toContain('weaker-threshold')
    expect(RULE_IDS.length).toBeGreaterThan(5)
  })

  it('parseExportedStringArray reads freeze arrays', () => {
    expect(parseExportedStringArray(scriptWithIds(), 'RULE_IDS')).toEqual([
      ...RULE_IDS,
    ])
  })
})

describe('classifyGateSteps', () => {
  it('detects burn-in', () => {
    expect(
      classifyGateSteps({
        name: 'E2E burn-in',
        run: 'pnpm exec playwright test --repeat-each=10',
      }),
    ).toContain('burn-in')
  })

  it('detects e2e, coverage, stryker, lighthouse, gitleaks, audit', () => {
    expect(classifyGateSteps({ name: 'E2E', run: 'pnpm test:e2e' })).toContain(
      'e2e',
    )
    expect(
      classifyGateSteps({ name: 'Unit', run: 'pnpm test:coverage' }),
    ).toContain('coverage')
    expect(
      classifyGateSteps({ name: 'Mutate', run: 'pnpm stryker:diff' }),
    ).toContain('stryker')
    expect(classifyGateSteps({ name: 'LH', run: 'pnpm test:lhci' })).toContain(
      'lighthouse',
    )
    expect(
      classifyGateSteps({ name: 'Secrets', run: 'gitleaks detect' }),
    ).toContain('gitleaks')
    expect(
      classifyGateSteps({ name: 'Audit', run: 'pnpm audit:ci' }),
    ).toContain('audit')
  })

  it('does not treat aggregator BURN_IN_RESULT as burn-in', () => {
    expect(
      classifyGateSteps({
        name: 'Require e2e and burn-in',
        run: 'if [ "$BURN_IN_RESULT" != "success" ]; then exit 1; fi',
      }).has('burn-in'),
    ).toBe(false)
  })
})

/**
 * Drive the real CLI (`--base-dir` / `--head-dir`) used by pr-policy proofs.
 * @param {Record<string, string>} headOverrides
 * @param {Record<string, string>} [baseOverrides]
 */
function cliRatchet(headOverrides, baseOverrides = {}) {
  const root = tmpDir()
  const baseTree = baseFiles(baseOverrides)
  const headTree = baseFiles({ ...baseOverrides, ...headOverrides })
  writeTree(path.join(root, 'base'), baseTree)
  writeTree(path.join(root, 'head'), headTree)
  const code = runGateRatchetCli([
    '--cwd',
    root,
    '--base-dir',
    'base',
    '--head-dir',
    'head',
  ])
  const result = compareGateTrees(baseTree, headTree)
  return { code, result }
}

describe('CLI fixture proofs (real check-gate-ratchet path)', () => {
  it('FIXTURE weaker-threshold: lowering coverage floor fails', () => {
    expect(FIXTURE_IDS).toContain('weaker-threshold')
    const headGates = {
      ...baseGates,
      coverage: { ...baseGates.coverage, lines: 70 },
    }
    const { code, result } = cliRatchet({
      'quality/gates.json': JSON.stringify(headGates),
    })
    expect(code).toBe(1)
    expect(
      result.violations.some((v) => v.ruleId === 'gates-json-weaker'),
    ).toBe(true)
  })

  it('FIXTURE new-exclude: new stryker bang fails', () => {
    expect(FIXTURE_IDS).toContain('new-exclude')
    const headStryker = `
const config = {
  mutate: ['src/**/*.ts', '!src/**/*.test.ts', '!src/secret.ts'],
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
}
export default config
`
    const { code, result } = cliRatchet({ 'stryker.config.mjs': headStryker })
    expect(code).toBe(1)
    expect(result.violations.some((v) => v.ruleId === 'exclude-added')).toBe(
      true,
    )
  })

  it('FIXTURE removed-agent-include: removing scripts/agent.mjs include fails', () => {
    expect(FIXTURE_IDS).toContain('removed-agent-include')
    const headVite = `
export const coverageExcludeGlobs = ['src/**/*.d.ts'] as const
export default {
  test: {
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: [...coverageExcludeGlobs],
    },
  },
}
`
    const { code, result } = cliRatchet({ 'vite.config.ts': headVite })
    expect(code).toBe(1)
    expect(result.violations.some((v) => v.ruleId === 'include-removed')).toBe(
      true,
    )
    expect(
      result.violations.some((v) => v.message.includes('scripts/agent.mjs')),
    ).toBe(true)
  })

  it('FIXTURE new-excluded-mutations fails', () => {
    expect(FIXTURE_IDS).toContain('new-excluded-mutations')
    const headStryker = `
const config = {
  mutate: ['src/**/*.ts', '!src/**/*.test.ts'],
  mutator: { excludedMutations: ['StringLiteral'] },
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
}
export default config
`
    const { code, result } = cliRatchet({ 'stryker.config.mjs': headStryker })
    expect(code).toBe(1)
    expect(result.violations.some((v) => v.ruleId === 'stryker-weaker')).toBe(
      true,
    )
  })

  it('FIXTURE new-v8-ignore fails', () => {
    expect(FIXTURE_IDS).toContain('new-v8-ignore')
    const { code, result } = cliRatchet(
      { 'src/app.ts': '/* v8 ignore next */\nexport const x = 1\n' },
      { 'src/app.ts': 'export const x = 1\n' },
    )
    expect(code).toBe(1)
    expect(
      result.violations.some((v) => v.ruleId === 'ignore-comment-added'),
    ).toBe(true)
  })

  it('FIXTURE new-stryker-disable fails', () => {
    expect(FIXTURE_IDS).toContain('new-stryker-disable')
    const { code, result } = cliRatchet(
      { 'src/app.ts': '// Stryker disable all\nexport const x = 1\n' },
      { 'src/app.ts': 'export const x = 1\n' },
    )
    expect(code).toBe(1)
    expect(
      result.violations.some((v) => v.ruleId === 'stryker-disable-added'),
    ).toBe(true)
  })

  it('FIXTURE deleted-rule fails when RULE_IDS shrinks', () => {
    expect(FIXTURE_IDS).toContain('deleted-rule')
    const shrunkIds = RULE_IDS.filter((id) => id !== 'fixtures-superset')
    const shrunk = scriptWithIds(shrunkIds)
    expect(parseExportedStringArray(shrunk, 'RULE_IDS')).not.toContain(
      'fixtures-superset',
    )
    const { code, result } = cliRatchet({
      'scripts/check-gate-ratchet.mjs': shrunk,
    })
    expect(code).toBe(1)
    expect(result.violations.some((v) => v.ruleId === 'rules-superset')).toBe(
      true,
    )
  })

  it('FIXTURE burn-in-moved-without-needs fails', () => {
    expect(FIXTURE_IDS).toContain('burn-in-moved-without-needs')
    const headIntegration = `
jobs:
  e2e-burn-in:
    steps:
      - name: E2E burn-in
        run: pnpm exec playwright test --repeat-each=10
  e2e:
    steps:
      - name: E2E
        run: pnpm test:e2e
  integration:
    needs: [e2e]
    steps:
      - name: Require e2e only
        run: |
          if [ "$E2E_RESULT" != "success" ]; then exit 1; fi
`
    const { code, result } = cliRatchet({
      '.github/workflows/integration.yml': headIntegration,
    })
    expect(code).toBe(1)
    expect(
      result.violations.some((v) => v.ruleId === 'required-job-step-moved'),
    ).toBe(true)
  })

  it('FIXTURE burn-in-moved-with-needs passes for that move alone', () => {
    expect(FIXTURE_IDS).toContain('burn-in-moved-with-needs')
    const headIntegration = `
jobs:
  e2e-burn-in:
    steps:
      - name: E2E burn-in
        run: pnpm exec playwright test --repeat-each=10
  e2e:
    steps:
      - name: E2E
        run: pnpm test:e2e
  integration:
    needs: [e2e, e2e-burn-in]
    if: always()
    steps:
      - name: Require e2e and burn-in
        run: |
          if [ "$E2E_RESULT" != "success" ]; then exit 1; fi
          if [ "$BURN_IN_RESULT" != "success" ]; then exit 1; fi
`
    const { code, result } = cliRatchet({
      '.github/workflows/integration.yml': headIntegration,
    })
    expect(code).toBe(0)
    expect(
      result.violations.filter((v) => v.ruleId === 'required-job-step-moved'),
    ).toEqual([])
  })

  it('comment-only exit 1 does not satisfy failOnNeeds', () => {
    const headIntegration = `
jobs:
  e2e-burn-in:
    steps:
      - name: E2E burn-in
        run: pnpm exec playwright test --repeat-each=10
  e2e:
    steps:
      - name: E2E
        run: pnpm test:e2e
  integration:
    needs: [e2e, e2e-burn-in]
    steps:
      - name: Fake aggregate
        run: |
          echo "$BURN_IN_RESULT"
          # exit 1
`
    const { code, result } = cliRatchet({
      '.github/workflows/integration.yml': headIntegration,
    })
    expect(code).toBe(1)
    expect(
      result.violations.some((v) => v.ruleId === 'required-job-step-moved'),
    ).toBe(true)
  })

  it('provider continue-on-error does not satisfy aggregation', () => {
    const headIntegration = `
jobs:
  e2e-burn-in:
    continue-on-error: true
    steps:
      - name: E2E burn-in
        run: pnpm exec playwright test --repeat-each=10
  e2e:
    steps:
      - name: E2E
        run: pnpm test:e2e
  integration:
    needs: [e2e, e2e-burn-in]
    steps:
      - name: Require e2e and burn-in
        run: |
          if [ "$E2E_RESULT" != "success" ]; then exit 1; fi
          if [ "$BURN_IN_RESULT" != "success" ]; then exit 1; fi
`
    const { code, result } = cliRatchet({
      '.github/workflows/integration.yml': headIntegration,
    })
    expect(code).toBe(1)
    expect(
      result.violations.some((v) => v.ruleId === 'required-job-step-moved'),
    ).toBe(true)
  })

  it('identical trees pass via CLI', () => {
    const { code, result } = cliRatchet({})
    expect(code).toBe(0)
    expect(result.ok).toBe(true)
  })
})

describe('numberWeaker / parsePercentish', () => {
  it('higher-stricter and lower-stricter', () => {
    expect(numberWeaker(80, 70, 'higher-stricter')).toBe(true)
    expect(numberWeaker(80, 90, 'higher-stricter')).toBe(false)
    expect(numberWeaker(0, 2, 'lower-stricter')).toBe(true)
    expect(numberWeaker(2, 0, 'lower-stricter')).toBe(false)
    expect(numberWeaker('80', 70, 'higher-stricter')).toBe(false)
    expect(numberWeaker(80, undefined, 'higher-stricter')).toBe(false)
  })

  it('parsePercentish handles number, percent string, auto, junk', () => {
    expect(parsePercentish(85)).toBe(85)
    expect(parsePercentish('85%')).toBe(85)
    expect(parsePercentish('0.5')).toBe(0.5)
    expect(parsePercentish('auto')).toBeNull()
    expect(parsePercentish('nope')).toBeNull()
    expect(parsePercentish(NaN)).toBeNull()
    expect(parsePercentish(null)).toBeNull()
  })
})

describe('extractCoverageIncludes', () => {
  it('finds agent.mjs', () => {
    expect(extractCoverageIncludes(baseVite)).toContain('scripts/agent.mjs')
  })

  it('returns empty when include missing', () => {
    expect(extractCoverageIncludes('export default {}')).toEqual([])
  })
})

describe('extractCoverageExcludes / extractStrykerGateBits', () => {
  it('reads exclude globs and bang mutate patterns', () => {
    expect(extractCoverageExcludes(baseVite)).toContain('src/**/*.d.ts')
    const bits = extractStrykerGateBits(baseStryker)
    expect(bits.bang).toContain('!src/**/*.test.ts')
    expect(bits.weakerFlags).toEqual([])
  })

  it('flags weaker stryker options', () => {
    const bits = extractStrykerGateBits(`
      mutate: ['src/**/*.ts']
      mutator: { excludedMutations: ['Boolean'] }
      disableTypeChecks: true
      ignoreStatic: false
      coverageAnalysis: 'off'
      ignorers: [() => {}]
    `)
    expect(bits.excludedMutations).toContain('Boolean')
    expect(bits.weakerFlags).toEqual(
      expect.arrayContaining([
        'disableTypeChecks',
        'ignoreStatic:false',
        'coverageAnalysis:off',
        'ignorers',
      ]),
    )
  })
})

describe('stripShellComments / parseArgs / analyzeWorkflowJobs', () => {
  it('strips hash comments so comment exit 1 is ignored', () => {
    expect(stripShellComments('echo ok\n# exit 1\n')).not.toMatch(/exit 1/)
    expect(stripShellComments('exit 1')).toMatch(/exit 1/)
  })

  it('parseArgs reads known flags', () => {
    expect(
      parseArgs(['--base-dir', 'a', '--head-dir', 'b', '--cwd', '/tmp']),
    ).toEqual({ 'base-dir': 'a', 'head-dir': 'b', cwd: '/tmp' })
  })

  it('analyzeWorkflowJobs detects needs fail and continue-on-error', () => {
    const jobs = analyzeWorkflowJobs(
      parseYaml(`
jobs:
  burn:
    continue-on-error: true
    steps:
      - name: E2E burn-in
        run: pnpm exec playwright test --repeat-each=3
  integration:
    needs: [burn]
    steps:
      - run: |
          if [ "$BURN_IN_RESULT" != "success" ]; then exit 1; fi
`),
    )
    expect(jobs.get('burn')?.continueOnErrorKinds.has('burn-in')).toBe(true)
    expect(jobs.get('integration')?.failOnNeeds).toBe(true)
    expect(jobs.get('integration')?.needs).toEqual(['burn'])
  })
})

describe('compareGateTrees additional weakenings', () => {
  it('fails when gate file deleted', () => {
    const head = baseFiles()
    delete head['codecov.yml']
    const r = compareGateTrees(baseFiles(), head)
    expect(r.violations.some((v) => v.ruleId === 'gate-file-gone')).toBe(true)
  })

  it('fails when codecov patch target lowers or threshold rises', () => {
    const headCodecov = `
coverage:
  status:
    patch:
      default:
        target: 50%
        threshold: 0%
flags:
  unit:
    paths:
      - src/
ignore:
  - e2e/**
`
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'codecov.yml': headCodecov }),
      ).violations.some((v) => v.ruleId === 'codecov-weaker'),
    ).toBe(true)

    const higherThreshold = `
coverage:
  status:
    patch:
      default:
        target: 85%
        threshold: 5%
flags:
  unit:
    paths:
      - src/
ignore:
  - e2e/**
`
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'codecov.yml': higherThreshold }),
      ).violations.some((v) => /threshold/.test(v.message)),
    ).toBe(true)

    const infoOn = `
coverage:
  status:
    patch:
      default:
        target: 85%
        threshold: 0%
        informational: true
flags:
  unit:
    paths:
      - src/
ignore:
  - e2e/**
`
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'codecov.yml': infoOn }),
      ).violations.some((v) => /informational/.test(v.message)),
    ).toBe(true)
  })

  it('fails when codecov ignore grows or flag path removed', () => {
    const headCodecov = `
coverage:
  status:
    patch:
      default:
        target: 85%
        threshold: 0%
flags:
  unit:
    paths: []
ignore:
  - e2e/**
  - extra/**
`
    const r = compareGateTrees(
      baseFiles(),
      baseFiles({ 'codecov.yml': headCodecov }),
    )
    expect(r.violations.some((v) => v.ruleId === 'codecov-weaker')).toBe(true)
  })

  it('fails when patchedDependencies grows', () => {
    const headPkg = JSON.stringify({
      name: 't',
      pnpm: {
        patchedDependencies: {
          'a@1': 'patches/a.patch',
          'b@1': 'patches/b.patch',
        },
      },
    })
    const r = compareGateTrees(
      baseFiles(),
      baseFiles({ 'package.json': headPkg }),
    )
    expect(r.violations.some((v) => v.ruleId === 'patched-deps-grown')).toBe(
      true,
    )
  })

  it('fails when playwright retries rise or flakySpecs grow', () => {
    const headGates = {
      ...baseGates,
      playwright: { retries: 2, flakyRetries: 2 },
      e2e: { burnInDefault: 10, flakySpecs: ['e2e/x.spec.ts'] },
    }
    const r = compareGateTrees(
      baseFiles(),
      baseFiles({ 'quality/gates.json': JSON.stringify(headGates) }),
    )
    expect(r.violations.some((v) => v.ruleId === 'gates-json-weaker')).toBe(
      true,
    )
  })

  it('fails when requiredCheckJobs drops a job', () => {
    const headGates = {
      ...baseGates,
      requiredCheckJobs: ['checks'],
    }
    const r = compareGateTrees(
      baseFiles(),
      baseFiles({ 'quality/gates.json': JSON.stringify(headGates) }),
    )
    expect(r.violations.some((v) => v.ruleId === 'gates-json-weaker')).toBe(
      true,
    )
  })

  it('fails when coverage exclude glob is added', () => {
    const headVite = `
export const coverageExcludeGlobs = ['src/**/*.d.ts', 'src/secret.ts'] as const
export default {
  test: {
    coverage: {
      include: ['src/**/*.{ts,tsx}', 'scripts/agent.mjs'],
      exclude: [...coverageExcludeGlobs],
    },
  },
}
`
    const r = compareGateTrees(
      baseFiles(),
      baseFiles({ 'vite.config.ts': headVite }),
    )
    expect(r.violations.some((v) => v.ruleId === 'exclude-added')).toBe(true)
  })

  it('fails when FIXTURE_IDS shrink on head', () => {
    const shrunkFix = FIXTURE_IDS.filter((id) => id !== 'weaker-threshold')
    const r = compareGateTrees(
      baseFiles(),
      baseFiles({
        'scripts/check-gate-ratchet.mjs': scriptWithIds(RULE_IDS, shrunkFix),
      }),
    )
    expect(r.violations.some((v) => v.ruleId === 'fixtures-superset')).toBe(
      true,
    )
  })

  it('fails when lighthouse budget path/type missing or budget rises', () => {
    const headMissingPath = {
      ...baseGates,
      lighthouse: {
        ...baseGates.lighthouse,
        budgets: [{ path: '/other', resourceSizes: [], resourceCounts: [] }],
      },
    }
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'quality/gates.json': JSON.stringify(headMissingPath) }),
      ).violations.some((v) => /budgets path missing/.test(v.message)),
    ).toBe(true)

    const headMissingType = {
      ...baseGates,
      lighthouse: {
        ...baseGates.lighthouse,
        budgets: [
          {
            path: '/*',
            resourceSizes: [{ resourceType: 'document', budget: 20 }],
            resourceCounts: [],
          },
        ],
      },
    }
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'quality/gates.json': JSON.stringify(headMissingType) }),
      ).violations.some((v) => /resourceType missing/.test(v.message)),
    ).toBe(true)

    const headHigher = {
      ...baseGates,
      lighthouse: {
        ...baseGates.lighthouse,
        budgets: [
          {
            path: '/*',
            resourceSizes: [{ resourceType: 'script', budget: 999 }],
            resourceCounts: [],
          },
        ],
      },
    }
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'quality/gates.json': JSON.stringify(headHigher) }),
      ).violations.some((v) => /lighthouse budget script/.test(v.message)),
    ).toBe(true)
  })

  it('fails when requiredCheckJobs removed or lighthouse assertion weakens', () => {
    const noJobs = { ...baseGates }
    delete noJobs.requiredCheckJobs
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'quality/gates.json': JSON.stringify(noJobs) }),
      ).violations.some((v) => /requiredCheckJobs removed/.test(v.message)),
    ).toBe(true)

    const softAssert = {
      ...baseGates,
      lighthouse: {
        ...baseGates.lighthouse,
        assertions: { 'performance-budget': 'warn' },
      },
    }
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'quality/gates.json': JSON.stringify(softAssert) }),
      ).violations.some((v) => /no longer error/.test(v.message)),
    ).toBe(true)

    const dropAssert = {
      ...baseGates,
      lighthouse: { ...baseGates.lighthouse, assertions: {} },
    }
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'quality/gates.json': JSON.stringify(dropAssert) }),
      ).violations.some((v) => /assertions missing/.test(v.message)),
    ).toBe(true)
  })

  it('fails when burnInDefault or stryker thresholds drop', () => {
    const burn = {
      ...baseGates,
      e2e: { ...baseGates.e2e, burnInDefault: 1 },
    }
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'quality/gates.json': JSON.stringify(burn) }),
      ).violations.some((v) => /burnInDefault/.test(v.message)),
    ).toBe(true)
    const thr = {
      ...baseGates,
      stryker: { thresholds: { high: 10, low: 5, break: 5 } },
    }
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'quality/gates.json': JSON.stringify(thr) }),
      ).violations.some((v) => /stryker.thresholds/.test(v.message)),
    ).toBe(true)
  })

  it('fails on codecov component removal, status removal, informational', () => {
    const withComp = `
coverage:
  status:
    patch:
      default:
        target: 85%
        threshold: 0%
bundle_analysis:
  status: error
component_management:
  individual_components:
    - component_id: core
      paths: [src/core/**]
flags:
  unit:
    paths: [src/]
ignore: []
`
    const dropComp = `
coverage:
  status:
    patch:
      default:
        target: 85%
        threshold: 0%
bundle_analysis:
  status: informational
component_management:
  individual_components: []
flags:
  unit:
    paths: [src/]
ignore: []
`
    const r = compareGateTrees(
      baseFiles({ 'codecov.yml': withComp }),
      baseFiles({ 'codecov.yml': dropComp }),
    )
    expect(r.violations.some((v) => v.ruleId === 'codecov-weaker')).toBe(true)

    const dropStatus = `
coverage:
  status: {}
flags:
  unit:
    paths: [src/]
ignore: []
`
    expect(
      compareGateTrees(
        baseFiles({ 'codecov.yml': withComp }),
        baseFiles({ 'codecov.yml': dropStatus }),
      ).violations.some((v) => /status/.test(v.message)),
    ).toBe(true)
  })

  it('fails when gates.json or codecov.yml is invalid JSON/YAML', () => {
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'quality/gates.json': '{not-json' }),
      ).violations.some((v) =>
        /failed to parse quality\/gates/.test(v.message),
      ),
    ).toBe(true)
    expect(
      compareGateTrees(
        baseFiles(),
        baseFiles({ 'codecov.yml': ':\n  - bad' }),
      ).violations.some((v) => v.ruleId === 'codecov-weaker'),
    ).toBe(true)
  })

  it('fails when quality/gates.json alone is deleted', () => {
    const head = baseFiles()
    delete head['quality/gates.json']
    expect(
      compareGateTrees(baseFiles(), head).violations.some((v) =>
        /quality\/gates\.json deleted/.test(v.message),
      ),
    ).toBe(true)
  })
})

describe('gate-ratchet-cli entry', () => {
  it('runs via node on fixture dirs', () => {
    const root = tmpDir()
    writeTree(path.join(root, 'base'), baseFiles())
    writeTree(
      path.join(root, 'head'),
      baseFiles({
        'quality/gates.json': JSON.stringify({
          ...baseGates,
          coverage: { ...baseGates.coverage, lines: 1 },
        }),
      }),
    )
    const r = spawnSync(
      process.execPath,
      [
        path.join(REPO_ROOT, 'scripts/gate-ratchet-cli.mjs'),
        '--cwd',
        root,
        '--base-dir',
        'base',
        '--head-dir',
        'head',
      ],
      { encoding: 'utf8', env: stripGitKeys({ ...process.env }) },
    )
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Gate ratchet: FAIL/)
  })
})

describe('runGateRatchetCli argv', () => {
  it('returns 2 when refs/dirs missing', () => {
    expect(runGateRatchetCli([])).toBe(2)
  })
})

describe('readTreeFromDir / readTreeFromGitRef / pr-policy', () => {
  it('readTreeFromDir skips node_modules and reads files', () => {
    const root = tmpDir()
    fs.mkdirSync(path.join(root, 'node_modules/x'), { recursive: true })
    fs.writeFileSync(path.join(root, 'node_modules/x/a.js'), 'nope')
    fs.writeFileSync(path.join(root, 'ok.txt'), 'yes')
    const files = readTreeFromDir(root)
    expect(files['ok.txt']).toBe('yes')
    expect(files['node_modules/x/a.js']).toBeUndefined()
  })

  it('readTreeFromGitRef reads blobs from a tmp repo', () => {
    const repo = initTmpRepo(tmpDirs, {
      prefix: 'ratchet-git-',
      seedFiles: { 'hello.txt': 'hi\n', 'quality/gates.json': '{}\n' },
    })
    const head = String(gitExec(['rev-parse', 'HEAD'], repo)).trim()
    const files = readTreeFromGitRef(repo, head)
    expect(files['hello.txt']).toBe('hi\n')
    expect(files['quality/gates.json']).toBe('{}\n')
  })

  it('readTreeFromGitRef throws when ls-tree fails', () => {
    const repo = initTmpRepo(tmpDirs, { prefix: 'ratchet-bad-' })
    expect(() => readTreeFromGitRef(repo, 'missing-ref-zzz')).toThrow(
      /ls-tree failed/,
    )
  })

  it('resolvePrPolicyBaseRef prefers GATE_RATCHET_BASE then origin/main then main', () => {
    expect(
      resolvePrPolicyBaseRef({
        root: '/tmp',
        env: { GATE_RATCHET_BASE: ' abc ' },
        git: () => ({ status: 1, stdout: '', stderr: '' }),
      }),
    ).toBe('abc')
    const calls = []
    expect(
      resolvePrPolicyBaseRef({
        root: '/tmp',
        env: {},
        git: (args) => {
          calls.push(args.join(' '))
          if (args.includes('origin/main')) {
            return { status: 0, stdout: 'originsha\n', stderr: '' }
          }
          return { status: 1, stdout: '', stderr: '' }
        },
      }),
    ).toBe('originsha')
    expect(calls[0]).toContain('origin/main')
    expect(
      resolvePrPolicyBaseRef({
        root: '/tmp',
        env: {},
        git: (args) => {
          if (args.includes('origin/main')) {
            return { status: 1, stdout: '', stderr: '' }
          }
          return { status: 0, stdout: 'mainsha\n', stderr: '' }
        },
      }),
    ).toBe('mainsha')
    expect(
      resolvePrPolicyBaseRef({
        root: '/tmp',
        env: {},
        git: () => ({ status: 1, stdout: '', stderr: '' }),
      }),
    ).toBeNull()
  })

  it('runPrPolicyCheck skips, fails HEAD, or delegates to CLI', () => {
    const logs = []
    expect(
      runPrPolicyCheck({
        root: '/tmp',
        env: {},
        git: () => ({ status: 1, stdout: '', stderr: '' }),
        log: (m) => logs.push(m),
      }),
    ).toBe(0)
    expect(logs.join('\n')).toMatch(/skip/)

    const errs = []
    expect(
      runPrPolicyCheck({
        root: '/tmp',
        env: { GATE_RATCHET_BASE: 'base' },
        git: (args) => {
          if (args.includes('HEAD')) {
            return { status: 1, stdout: '', stderr: 'no head' }
          }
          return { status: 0, stdout: 'ok\n', stderr: '' }
        },
        error: (m) => errs.push(m),
      }),
    ).toBe(1)
    expect(errs.join('\n')).toMatch(/cannot resolve HEAD/)

    let seen
    expect(
      runPrPolicyCheck({
        root: '/repo',
        env: { GATE_RATCHET_BASE: 'basesha' },
        git: () => ({ status: 0, stdout: 'headsha\n', stderr: '' }),
        runCli: (argv) => {
          seen = argv
          return 0
        },
      }),
    ).toBe(0)
    expect(seen).toEqual([
      '--cwd',
      '/repo',
      '--base-ref',
      'basesha',
      '--head-ref',
      'headsha',
    ])
  })

  it('runPrPolicyCheck against twin commits in a tmp repo', () => {
    const repo = initTmpRepo(tmpDirs, {
      prefix: 'pr-policy-',
      seedFiles: baseFiles(),
    })
    const base = String(gitExec(['rev-parse', 'HEAD'], repo)).trim()
    fs.writeFileSync(
      path.join(repo, 'quality/gates.json'),
      JSON.stringify({
        ...baseGates,
        coverage: { ...baseGates.coverage, lines: 10 },
      }),
    )
    gitExec(['add', '.'], repo, { stdio: 'ignore' })
    gitExec(['commit', '-m', 'weaker'], repo, { stdio: 'ignore' })
    const code = runPrPolicyCheck({
      root: repo,
      env: { GATE_RATCHET_BASE: base },
    })
    expect(code).toBe(1)
  })
})
