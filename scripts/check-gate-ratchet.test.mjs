import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  FIXTURE_IDS,
  RULE_IDS,
  classifyGateSteps,
  compareGateTrees,
  extractCoverageIncludes,
  parseExportedStringArray,
  runGateRatchetCli,
} from './check-gate-ratchet.mjs'

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

describe('extractCoverageIncludes', () => {
  it('finds agent.mjs', () => {
    expect(extractCoverageIncludes(baseVite)).toContain('scripts/agent.mjs')
  })
})
