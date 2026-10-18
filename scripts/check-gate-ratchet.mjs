#!/usr/bin/env node
/**
 * Gate ratchet: head tree must not be weaker than base.
 * CI: run from base checkout; head is read as git object data only.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

export const RULE_IDS = Object.freeze([
  'gates-json-weaker',
  'codecov-weaker',
  'exclude-added',
  'include-removed',
  'stryker-weaker',
  'patched-deps-grown',
  'ignore-comment-added',
  'stryker-disable-added',
  'gate-file-gone',
  'required-job-step-moved',
  'rules-superset',
  'fixtures-superset',
])

export const FIXTURE_IDS = Object.freeze([
  'weaker-threshold',
  'new-exclude',
  'removed-agent-include',
  'new-excluded-mutations',
  'new-v8-ignore',
  'new-stryker-disable',
  'deleted-rule',
  'burn-in-moved-without-needs',
  'burn-in-moved-with-needs',
])

const GATE_FILES = Object.freeze([
  'quality/gates.json',
  'codecov.yml',
  'vite.config.ts',
  'stryker.config.mjs',
  'package.json',
  'scripts/check-gate-ratchet.mjs',
  'scripts/check-gate-ratchet.test.mjs',
])

const SOURCE_SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx'])

const IGNORE_COMMENT_RE =
  /(?:\/\*\s*)?(?:v8|istanbul|c8)\s+ignore\b|eslint-disable(?!-next-line)\b|@ts-ignore\b/i

const STRYKER_DISABLE_RE = /Stryker\s+disable\b/

const GATE_STEP_KINDS = Object.freeze([
  'burn-in',
  'e2e',
  'coverage',
  'stryker',
  'lighthouse',
  'gitleaks',
  'audit',
])

/**
 * Strip `# ...` shell comments so `exit 1` in comments cannot spoof failOnNeeds.
 * @param {string} run
 */
export function stripShellComments(run) {
  return String(run ?? '')
    .split(/\r?\n/)
    .map((line) => {
      // Drop `#` comments (good enough for Actions `run:` blocks).
      const idx = line.indexOf('#')
      if (idx === -1) return line
      return line.slice(0, idx)
    })
    .join('\n')
}

/**
 * @param {string} text
 * @param {string} exportName
 * @returns {string[]}
 */
export function parseExportedStringArray(text, exportName) {
  const re = new RegExp(
    `export\\s+const\\s+${exportName}\\s*=\\s*Object\\.freeze\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`,
  )
  const m = String(text ?? '').match(re)
  if (!m) return []
  const ids = []
  for (const part of m[1].matchAll(/['"]([^'"]+)['"]/g)) {
    ids.push(part[1])
  }
  return ids
}

/**
 * @param {Record<string, string>} files
 * @param {string} rel
 */
function getFile(files, rel) {
  const norm = rel.replaceAll('\\', '/')
  if (Object.prototype.hasOwnProperty.call(files, norm)) return files[norm]
  return undefined
}

/**
 * @param {string} content
 * @returns {string[]}
 */
export function extractCoverageIncludes(content) {
  const m = String(content ?? '').match(
    /coverage\s*:\s*\{[\s\S]*?include\s*:\s*\[([\s\S]*?)\]/,
  )
  if (!m) return []
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
}

/**
 * @param {string} content
 * @returns {string[]}
 */
export function extractCoverageExcludes(content) {
  const fromExport = String(content ?? '').match(
    /coverageExcludeGlobs\s*=\s*\[([\s\S]*?)\]\s*as\s+const/,
  )
  const fromInline = String(content ?? '').match(
    /coverage\s*:\s*\{[\s\S]*?exclude\s*:\s*\[([\s\S]*?)\]/,
  )
  const out = new Set()
  for (const block of [fromExport?.[1], fromInline?.[1]]) {
    if (!block) continue
    for (const m of block.matchAll(/['"]([^'"]+)['"]/g)) out.add(m[1])
  }
  return [...out]
}

/**
 * @param {string} content
 * @returns {{ bang: string[], excludedMutations: string[], weakerFlags: string[] }}
 */
export function extractStrykerGateBits(content) {
  const text = String(content ?? '')
  const mutate = text.match(/mutate\s*:\s*\[([\s\S]*?)\]/)
  const bang = []
  if (mutate) {
    for (const m of mutate[1].matchAll(/['"](![^'"]+)['"]/g)) bang.push(m[1])
  }
  const excludedMutations = []
  const excl = text.match(/excludedMutations\s*:\s*\[([\s\S]*?)\]/)
  if (excl) {
    for (const m of excl[1].matchAll(/['"]([^'"]+)['"]/g)) {
      excludedMutations.push(m[1])
    }
  }
  const weakerFlags = []
  if (/disableTypeChecks\s*:\s*true/.test(text))
    weakerFlags.push('disableTypeChecks')
  if (/ignoreStatic\s*:\s*false/.test(text))
    weakerFlags.push('ignoreStatic:false')
  if (/coverageAnalysis\s*:\s*['"]off['"]/.test(text)) {
    weakerFlags.push('coverageAnalysis:off')
  }
  if (/ignorers\s*:\s*\[/.test(text) && !/ignorers\s*:\s*\[\s*\]/.test(text)) {
    weakerFlags.push('ignorers')
  }
  return { bang, excludedMutations, weakerFlags }
}

/**
 * @param {number} base
 * @param {number} head
 * @param {'higher-stricter' | 'lower-stricter'} dir
 */
function numberWeaker(base, head, dir) {
  if (typeof base !== 'number' || typeof head !== 'number') return false
  if (dir === 'higher-stricter') return head < base
  return head > base
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parsePercentish(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const t = value.trim()
    if (t === 'auto') return null
    const m = t.match(/^(\d+(?:\.\d+)?)%?$/)
    if (m) return Number(m[1])
  }
  return null
}

/**
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} head
 * @param {string} pathLabel
 * @param {(msg: string) => void} fail
 */
function compareGatesJson(base, head, pathLabel, fail) {
  for (const key of ['statements', 'branches', 'functions', 'lines']) {
    const b = /** @type {any} */ (base).coverage?.[key]
    const h = /** @type {any} */ (head).coverage?.[key]
    if (typeof b === 'number' && numberWeaker(b, h, 'higher-stricter')) {
      fail(`${pathLabel} coverage.${key}: ${b} → ${h} (weaker)`)
    }
  }
  for (const key of ['high', 'low', 'break']) {
    const b = /** @type {any} */ (base).stryker?.thresholds?.[key]
    const h = /** @type {any} */ (head).stryker?.thresholds?.[key]
    if (typeof b === 'number' && numberWeaker(b, h, 'higher-stricter')) {
      fail(`${pathLabel} stryker.thresholds.${key}: ${b} → ${h} (weaker)`)
    }
  }
  {
    const b = /** @type {any} */ (base).lighthouse?.numberOfRuns
    const h = /** @type {any} */ (head).lighthouse?.numberOfRuns
    if (typeof b === 'number' && numberWeaker(b, h, 'higher-stricter')) {
      fail(`${pathLabel} lighthouse.numberOfRuns: ${b} → ${h} (weaker)`)
    }
  }
  {
    const bAssert = /** @type {any} */ (base).lighthouse?.assertions
    const hAssert = /** @type {any} */ (head).lighthouse?.assertions
    if (bAssert && typeof bAssert === 'object') {
      for (const k of Object.keys(bAssert)) {
        if (!hAssert || !Object.prototype.hasOwnProperty.call(hAssert, k)) {
          fail(`${pathLabel} lighthouse.assertions missing ${k}`)
        } else if (bAssert[k] === 'error' && hAssert[k] !== 'error') {
          fail(`${pathLabel} lighthouse.assertions.${k} no longer error`)
        }
      }
    }
  }
  {
    const b = /** @type {any} */ (base).playwright?.retries
    const h = /** @type {any} */ (head).playwright?.retries
    if (typeof b === 'number' && numberWeaker(b, h, 'lower-stricter')) {
      fail(`${pathLabel} playwright.retries: ${b} → ${h} (weaker)`)
    }
  }
  {
    const b = /** @type {any} */ (base).playwright?.flakyRetries
    const h = /** @type {any} */ (head).playwright?.flakyRetries
    if (typeof b === 'number' && numberWeaker(b, h, 'lower-stricter')) {
      fail(`${pathLabel} playwright.flakyRetries: ${b} → ${h} (weaker)`)
    }
  }
  {
    const b = /** @type {any} */ (base).e2e?.burnInDefault
    const h = /** @type {any} */ (head).e2e?.burnInDefault
    if (typeof b === 'number' && numberWeaker(b, h, 'higher-stricter')) {
      fail(`${pathLabel} e2e.burnInDefault: ${b} → ${h} (weaker)`)
    }
  }
  {
    const bList = /** @type {any} */ (base).e2e?.flakySpecs
    const hList = /** @type {any} */ (head).e2e?.flakySpecs
    if (Array.isArray(bList) && Array.isArray(hList)) {
      for (const spec of bList) {
        if (!hList.includes(spec)) continue
      }
      for (const spec of hList) {
        if (!bList.includes(spec)) {
          fail(`${pathLabel} e2e.flakySpecs grew: ${spec}`)
        }
      }
    }
  }
  {
    const bJobs = /** @type {any} */ (base).requiredCheckJobs
    const hJobs = /** @type {any} */ (head).requiredCheckJobs
    if (Array.isArray(bJobs)) {
      if (!Array.isArray(hJobs)) {
        fail(`${pathLabel} requiredCheckJobs removed`)
      } else {
        for (const job of bJobs) {
          if (!hJobs.includes(job)) {
            fail(`${pathLabel} requiredCheckJobs missing ${job}`)
          }
        }
      }
    }
  }
  // Budget numeric ceilings: higher budget is weaker
  const bBudgets = /** @type {any} */ (base).lighthouse?.budgets
  const hBudgets = /** @type {any} */ (head).lighthouse?.budgets
  if (Array.isArray(bBudgets) && Array.isArray(hBudgets)) {
    const hJson = JSON.stringify(hBudgets)
    const bJson = JSON.stringify(bBudgets)
    if (hJson !== bJson) {
      // Compare resourceSizes budgets by path+type when possible
      for (const bb of bBudgets) {
        if (!bb || typeof bb !== 'object') continue
        const hb = hBudgets.find(
          (x) => x && typeof x === 'object' && x.path === bb.path,
        )
        if (!hb) {
          fail(`${pathLabel} lighthouse.budgets path missing: ${bb.path}`)
          continue
        }
        for (const rs of bb.resourceSizes ?? []) {
          const hrs = (hb.resourceSizes ?? []).find(
            (x) => x.resourceType === rs.resourceType,
          )
          if (!hrs) {
            fail(
              `${pathLabel} lighthouse budget resourceType missing: ${rs.resourceType}`,
            )
          } else if (
            typeof rs.budget === 'number' &&
            numberWeaker(rs.budget, hrs.budget, 'lower-stricter')
          ) {
            fail(
              `${pathLabel} lighthouse budget ${rs.resourceType}: ${rs.budget} → ${hrs.budget}`,
            )
          }
        }
      }
    }
  }
}

/**
 * @param {unknown} baseRaw
 * @param {unknown} headRaw
 * @param {(msg: string) => void} fail
 */
function compareCodecov(baseRaw, headRaw, fail) {
  const base = /** @type {any} */ (baseRaw) ?? {}
  const head = /** @type {any} */ (headRaw) ?? {}

  const walkStatus = (bNode, hNode, label) => {
    if (!bNode || typeof bNode !== 'object') return
    if (!hNode || typeof hNode !== 'object') {
      fail(`codecov.yml ${label} removed`)
      return
    }
    for (const key of Object.keys(bNode)) {
      if (!Object.prototype.hasOwnProperty.call(hNode, key)) {
        fail(`codecov.yml ${label}.${key} removed`)
        continue
      }
      const bv = bNode[key]
      const hv = hNode[key]
      if (bv && typeof bv === 'object' && !Array.isArray(bv)) {
        if ('target' in bv || 'threshold' in bv || 'informational' in bv) {
          const bt = parsePercentish(bv.target)
          const ht = parsePercentish(hv?.target)
          if (bt !== null && ht !== null && ht < bt) {
            fail(
              `codecov.yml ${label}.${key}.target: ${bv.target} → ${hv.target}`,
            )
          }
          const bth = parsePercentish(bv.threshold)
          const hth = parsePercentish(hv?.threshold)
          if (bth !== null && hth !== null && hth > bth) {
            fail(
              `codecov.yml ${label}.${key}.threshold: ${bv.threshold} → ${hv.threshold}`,
            )
          }
          if (bv.informational !== true && hv?.informational === true) {
            fail(`codecov.yml ${label}.${key} informational turned on`)
          }
        } else {
          walkStatus(bv, hv, `${label}.${key}`)
        }
      }
    }
  }

  walkStatus(base.coverage?.status, head.coverage?.status, 'coverage.status')

  if (
    base.bundle_analysis &&
    base.bundle_analysis.status !== 'informational' &&
    head.bundle_analysis?.status === 'informational'
  ) {
    fail('codecov.yml bundle_analysis informational turned on')
  }

  const bFlags = base.flags ?? {}
  const hFlags = head.flags ?? {}
  for (const flag of Object.keys(bFlags)) {
    if (!Object.prototype.hasOwnProperty.call(hFlags, flag)) {
      fail(`codecov.yml flags.${flag} removed`)
      continue
    }
    const bPaths = bFlags[flag]?.paths ?? []
    const hPaths = hFlags[flag]?.paths ?? []
    if (Array.isArray(bPaths)) {
      for (const p of bPaths) {
        if (!hPaths.includes(p)) {
          fail(`codecov.yml flags.${flag}.paths removed ${p}`)
        }
      }
    }
  }

  const bIgnore = new Set(base.ignore ?? [])
  const hIgnore = new Set(head.ignore ?? [])
  for (const p of hIgnore) {
    if (!bIgnore.has(p)) fail(`codecov.yml ignore added ${p}`)
  }

  const bComp = base.component_management?.individual_components
  const hComp = head.component_management?.individual_components
  if (Array.isArray(bComp)) {
    if (!Array.isArray(hComp)) {
      fail('codecov.yml component_management.individual_components removed')
    } else {
      for (const c of bComp) {
        const id = c?.component_id
        if (id && !hComp.some((x) => x?.component_id === id)) {
          fail(`codecov.yml component ${id} removed`)
        }
      }
    }
  }
}

/**
 * @param {unknown} step
 * @returns {Set<string>}
 */
export function classifyGateSteps(step) {
  const name = String(/** @type {any} */ (step)?.name ?? '')
  const run = String(/** @type {any} */ (step)?.run ?? '')
  const uses = String(/** @type {any} */ (step)?.uses ?? '')
  const blob = `${name}\n${run}\n${uses}`.toLowerCase()
  const kinds = new Set()
  // Real burn-in invocation only (run evidence). Do not use step names alone —
  // aggregators are often named "Require … burn-in".
  if (
    /e2e-burn-in|burn-in-targets|burn-in-count|--repeat-each/.test(
      run.toLowerCase(),
    )
  ) {
    kinds.add('burn-in')
  }
  if (
    (/\btest:e2e\b|\bplaywright test\b/.test(blob) ||
      /pnpm test:e2e/.test(blob)) &&
    !kinds.has('burn-in')
  ) {
    kinds.add('e2e')
  }
  if (/\btest:coverage\b|vitest run --coverage|vitest.*--coverage/.test(blob)) {
    kinds.add('coverage')
  }
  if (/\bstryker\b/.test(blob)) kinds.add('stryker')
  if (/\blhci\b|\blighthouse\b/.test(blob)) kinds.add('lighthouse')
  if (/\bgitleaks\b/.test(blob)) kinds.add('gitleaks')
  if (/\baudit:ci\b|pnpm audit\b/.test(blob)) kinds.add('audit')
  return kinds
}

/**
 * @param {unknown} workflow
 * @returns {Map<string, { kinds: Set<string>, needs: string[], continueOnErrorKinds: Set<string>, failOnNeeds: boolean }>}
 */
export function analyzeWorkflowJobs(workflow) {
  const jobs = /** @type {any} */ (workflow)?.jobs
  /** @type {Map<string, { kinds: Set<string>, needs: string[], continueOnErrorKinds: Set<string>, failOnNeeds: boolean }>} */
  const out = new Map()
  if (!jobs || typeof jobs !== 'object') return out
  for (const [name, job] of Object.entries(jobs)) {
    const kinds = new Set()
    const continueOnErrorKinds = new Set()
    const needsRaw = job?.needs
    const needs = Array.isArray(needsRaw)
      ? needsRaw.map(String)
      : needsRaw
        ? [String(needsRaw)]
        : []
    let failOnNeeds = false
    const steps = Array.isArray(job?.steps) ? job.steps : []
    for (const step of steps) {
      const stepKinds = classifyGateSteps(step)
      for (const k of stepKinds) kinds.add(k)
      if (step?.['continue-on-error'] === true) {
        for (const k of stepKinds) continueOnErrorKinds.add(k)
      }
      const run = stripShellComments(String(step?.run ?? ''))
      if (/needs\.[a-z0-9_-]+\.result/i.test(run) && /\bexit\s+1\b/.test(run)) {
        failOnNeeds = true
      }
      // Common pattern: shell checks BURN_IN_RESULT / E2E_RESULT without needs.* expression
      if (
        /_RESULT"/.test(run) &&
        /\bexit\s+1\b/.test(run) &&
        needs.length > 0
      ) {
        failOnNeeds = true
      }
    }
    // Job-level continue-on-error
    if (job?.['continue-on-error'] === true) {
      for (const k of kinds) continueOnErrorKinds.add(k)
    }
    out.set(name, { kinds, needs, continueOnErrorKinds, failOnNeeds })
  }
  return out
}

/**
 * @param {Map<string, { kinds: Set<string>, needs: string[], continueOnErrorKinds: Set<string>, failOnNeeds: boolean }>} jobs
 * @param {string} jobName
 * @returns {Set<string>}
 */
function coveredKindsForJob(jobs, jobName) {
  const info = jobs.get(jobName)
  /** @type {Set<string>} */
  const kinds = new Set()
  if (!info) return kinds
  for (const k of info.kinds) kinds.add(k)
  for (const dep of info.needs) {
    const d = jobs.get(dep)
    if (!d) continue
    for (const k of d.kinds) kinds.add(k)
  }
  return kinds
}

/**
 * @param {Map<string, { kinds: Set<string>, needs: string[], continueOnErrorKinds: Set<string>, failOnNeeds: boolean }>} jobs
 * @param {string} kind
 */
function jobsProvidingKind(jobs, kind) {
  /** @type {string[]} */
  const names = []
  for (const [name, info] of jobs) {
    if (info.kinds.has(kind)) names.push(name)
  }
  return names
}

/**
 * @param {Record<string, string>} baseFiles
 * @param {Record<string, string>} headFiles
 * @param {string[]} requiredJobs
 * @param {(msg: string) => void} fail
 */
function compareRequiredJobGates(baseFiles, headFiles, requiredJobs, fail) {
  const workflowPaths = new Set([
    ...Object.keys(baseFiles).filter(
      (p) => p.startsWith('.github/workflows/') && p.endsWith('.yml'),
    ),
    ...Object.keys(headFiles).filter(
      (p) => p.startsWith('.github/workflows/') && p.endsWith('.yml'),
    ),
  ])

  /** @type {Map<string, { kinds: Set<string>, needs: string[], continueOnErrorKinds: Set<string>, failOnNeeds: boolean }>} */
  const baseJobs = new Map()
  /** @type {Map<string, { kinds: Set<string>, needs: string[], continueOnErrorKinds: Set<string>, failOnNeeds: boolean }>} */
  const headJobs = new Map()

  for (const wp of workflowPaths) {
    const b = getFile(baseFiles, wp)
    const h = getFile(headFiles, wp)
    if (b) {
      for (const [n, info] of analyzeWorkflowJobs(parseYaml(b))) {
        baseJobs.set(n, info)
      }
    }
    if (h) {
      for (const [n, info] of analyzeWorkflowJobs(parseYaml(h))) {
        headJobs.set(n, info)
      }
    }
  }

  for (const req of requiredJobs) {
    const bJob = baseJobs.get(req)
    if (!bJob) continue
    const hJob = headJobs.get(req)
    if (!hJob) {
      fail(`required job ${req} removed`)
      continue
    }
    const baseCovered = coveredKindsForJob(baseJobs, req)
    for (const kind of GATE_STEP_KINDS) {
      if (!baseCovered.has(kind)) continue
      if (hJob.continueOnErrorKinds.has(kind)) {
        fail(`required job ${req} gate ${kind} has continue-on-error`)
      }
      if (hJob.kinds.has(kind)) continue
      const providers = jobsProvidingKind(headJobs, kind).filter(
        (n) => n !== req,
      )
      const neededOk = providers.some((p) => {
        const pJob = headJobs.get(p)
        if (!pJob) return false
        if (pJob.continueOnErrorKinds.has(kind)) return false
        if (pJob.continueOnErrorKinds.size > 0 && pJob.kinds.has(kind)) {
          // job-level continue-on-error already folded into continueOnErrorKinds
        }
        return hJob.needs.includes(p) && hJob.failOnNeeds
      })
      if (!neededOk) {
        fail(
          `required job ${req} lost gate ${kind} without needs:+fail aggregation`,
        )
      }
    }
  }
}

/**
 * @param {Record<string, string>} files
 * @returns {string[]}
 */
function listSourcePaths(files) {
  return Object.keys(files).filter((p) => {
    const ext = path.posix.extname(p)
    if (!SOURCE_SCAN_EXT.has(ext)) return false
    if (p.includes('node_modules/')) return false
    if (p.startsWith('openspec/')) return false
    if (p.includes('.test.')) return false
    return true
  })
}

/**
 * Compare two file maps (path → utf8 content).
 * @param {Record<string, string>} baseFiles
 * @param {Record<string, string>} headFiles
 * @returns {{ ok: boolean, violations: { ruleId: string, message: string }[] }}
 */
export function compareGateTrees(baseFiles, headFiles) {
  /** @type {{ ruleId: string, message: string }[] } */
  const violations = []
  const fail = (ruleId, message) => {
    violations.push({ ruleId, message })
  }

  for (const gf of GATE_FILES) {
    if (
      getFile(baseFiles, gf) !== undefined &&
      getFile(headFiles, gf) === undefined
    ) {
      fail('gate-file-gone', `gate file missing on head: ${gf}`)
    }
  }

  // gates.json
  try {
    const bRaw = getFile(baseFiles, 'quality/gates.json')
    const hRaw = getFile(headFiles, 'quality/gates.json')
    if (bRaw !== undefined && hRaw !== undefined) {
      compareGatesJson(
        JSON.parse(bRaw),
        JSON.parse(hRaw),
        'quality/gates.json',
        (m) => fail('gates-json-weaker', m),
      )
    } else if (bRaw !== undefined && hRaw === undefined) {
      fail('gate-file-gone', 'quality/gates.json deleted')
    }
  } catch (e) {
    fail(
      'gates-json-weaker',
      `failed to parse quality/gates.json: ${e instanceof Error ? e.message : e}`,
    )
  }

  // codecov.yml
  try {
    const bRaw = getFile(baseFiles, 'codecov.yml')
    const hRaw = getFile(headFiles, 'codecov.yml')
    if (bRaw !== undefined && hRaw !== undefined) {
      compareCodecov(parseYaml(bRaw), parseYaml(hRaw), (m) =>
        fail('codecov-weaker', m),
      )
    } else if (bRaw !== undefined && hRaw === undefined) {
      fail('gate-file-gone', 'codecov.yml deleted')
    }
  } catch (e) {
    fail(
      'codecov-weaker',
      `failed to parse codecov.yml: ${e instanceof Error ? e.message : e}`,
    )
  }

  // vite include/exclude
  {
    const bVite = getFile(baseFiles, 'vite.config.ts') ?? ''
    const hVite = getFile(headFiles, 'vite.config.ts') ?? ''
    const bInc = new Set(extractCoverageIncludes(bVite))
    const hInc = new Set(extractCoverageIncludes(hVite))
    for (const p of bInc) {
      if (!hInc.has(p))
        fail('include-removed', `coverage include removed: ${p}`)
    }
    const bExc = new Set(extractCoverageExcludes(bVite))
    const hExc = new Set(extractCoverageExcludes(hVite))
    for (const p of hExc) {
      if (!bExc.has(p)) fail('exclude-added', `coverage exclude added: ${p}`)
    }
  }

  // stryker
  {
    const bS = extractStrykerGateBits(
      getFile(baseFiles, 'stryker.config.mjs') ?? '',
    )
    const hS = extractStrykerGateBits(
      getFile(headFiles, 'stryker.config.mjs') ?? '',
    )
    for (const p of hS.bang) {
      if (!bS.bang.includes(p))
        fail('exclude-added', `stryker mutate bang added: ${p}`)
    }
    for (const p of hS.excludedMutations) {
      if (!bS.excludedMutations.includes(p)) {
        fail('stryker-weaker', `excludedMutations added: ${p}`)
      }
    }
    for (const f of hS.weakerFlags) {
      if (!bS.weakerFlags.includes(f))
        fail('stryker-weaker', `stryker weaker: ${f}`)
    }
  }

  // patchedDependencies
  try {
    const bPkg = JSON.parse(getFile(baseFiles, 'package.json') ?? '{}')
    const hPkg = JSON.parse(getFile(headFiles, 'package.json') ?? '{}')
    const bPatched = bPkg?.pnpm?.patchedDependencies ?? {}
    const hPatched = hPkg?.pnpm?.patchedDependencies ?? {}
    for (const k of Object.keys(hPatched)) {
      if (!Object.prototype.hasOwnProperty.call(bPatched, k)) {
        fail('patched-deps-grown', `pnpm.patchedDependencies grew: ${k}`)
      }
    }
  } catch (e) {
    fail(
      'patched-deps-grown',
      `package.json parse failed: ${e instanceof Error ? e.message : e}`,
    )
  }

  // source scan for ignore / Stryker disable (changed or new files)
  {
    const paths = new Set([
      ...listSourcePaths(baseFiles),
      ...listSourcePaths(headFiles),
    ])
    for (const p of paths) {
      const b = getFile(baseFiles, p) ?? ''
      const h = getFile(headFiles, p) ?? ''
      if (b === h) continue
      const bIgnores = [...b.matchAll(new RegExp(IGNORE_COMMENT_RE, 'gi'))]
        .length
      const hIgnores = [...h.matchAll(new RegExp(IGNORE_COMMENT_RE, 'gi'))]
        .length
      if (hIgnores > bIgnores) {
        fail('ignore-comment-added', `ignore/disable comment added in ${p}`)
      }
      const bSd = [...b.matchAll(new RegExp(STRYKER_DISABLE_RE, 'g'))].length
      const hSd = [...h.matchAll(new RegExp(STRYKER_DISABLE_RE, 'g'))].length
      if (hSd > bSd) {
        fail('stryker-disable-added', `Stryker disable added in ${p}`)
      }
    }
  }

  // required jobs
  try {
    const bGates = JSON.parse(getFile(baseFiles, 'quality/gates.json') ?? '{}')
    const required = Array.isArray(bGates.requiredCheckJobs)
      ? bGates.requiredCheckJobs.map(String)
      : []
    compareRequiredJobGates(baseFiles, headFiles, required, (m) =>
      fail('required-job-step-moved', m),
    )
  } catch (e) {
    fail(
      'required-job-step-moved',
      `required-job check failed: ${e instanceof Error ? e.message : e}`,
    )
  }

  // self-protection
  {
    const bScript = getFile(baseFiles, 'scripts/check-gate-ratchet.mjs') ?? ''
    const hScript = getFile(headFiles, 'scripts/check-gate-ratchet.mjs') ?? ''
    const bRules = parseExportedStringArray(bScript, 'RULE_IDS')
    const hRules = parseExportedStringArray(hScript, 'RULE_IDS')
    for (const id of bRules) {
      if (!hRules.includes(id)) {
        fail('rules-superset', `RULE_IDS missing on head: ${id}`)
      }
    }
    const bTest =
      getFile(baseFiles, 'scripts/check-gate-ratchet.test.mjs') ?? ''
    const hTest =
      getFile(headFiles, 'scripts/check-gate-ratchet.test.mjs') ?? ''
    // Prefer FIXTURE_IDS from script (canonical), fall back to test file export
    const bFix = parseExportedStringArray(bScript, 'FIXTURE_IDS').length
      ? parseExportedStringArray(bScript, 'FIXTURE_IDS')
      : parseExportedStringArray(bTest, 'FIXTURE_IDS')
    const hFix = parseExportedStringArray(hScript, 'FIXTURE_IDS').length
      ? parseExportedStringArray(hScript, 'FIXTURE_IDS')
      : parseExportedStringArray(hTest, 'FIXTURE_IDS')
    for (const id of bFix) {
      if (!hFix.includes(id)) {
        fail('fixtures-superset', `FIXTURE_IDS missing on head: ${id}`)
      }
    }
  }

  return { ok: violations.length === 0, violations }
}

/**
 * @param {string} root
 * @returns {Record<string, string>}
 */
export function readTreeFromDir(root) {
  /** @type {Record<string, string>} */
  const files = {}
  const walk = (dir, relBase = '') => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (
        ent.name === 'node_modules' ||
        ent.name === '.git' ||
        ent.name === 'dist'
      ) {
        continue
      }
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name
      const abs = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(abs, rel)
      else if (ent.isFile()) {
        try {
          files[rel.replaceAll('\\', '/')] = fs.readFileSync(abs, 'utf8')
        } catch {
          /* skip unreadable */
        }
      }
    }
  }
  walk(root)
  return files
}

/**
 * @param {string} cwd
 * @param {string} ref
 * @param {string[]} [paths]
 * @returns {Record<string, string>}
 */
export function readTreeFromGitRef(cwd, ref, paths) {
  const env = { ...process.env }
  for (const k of Object.keys(env)) {
    if (k.startsWith('GIT_')) delete env[k]
  }
  /** @type {Record<string, string>} */
  const files = {}
  let list = paths
  if (!list) {
    const ls = spawnSync('git', ['ls-tree', '-r', '--name-only', ref], {
      cwd,
      encoding: 'utf8',
      env,
    })
    if (ls.status !== 0) {
      throw new Error(
        `git ls-tree failed for ${ref}: ${ls.stderr || ls.stdout}`,
      )
    }
    list = ls.stdout
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  for (const p of list) {
    const show = spawnSync('git', ['show', `${ref}:${p}`], {
      cwd,
      encoding: 'utf8',
      env,
      maxBuffer: 20 * 1024 * 1024,
    })
    if (show.status !== 0) continue
    files[p.replaceAll('\\', '/')] = show.stdout
  }
  return files
}

/**
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (
      a === '--base-ref' ||
      a === '--head-ref' ||
      a === '--base-dir' ||
      a === '--head-dir' ||
      a === '--cwd'
    ) {
      out[a.slice(2)] = argv[++i] ?? ''
    }
  }
  return out
}

/**
 * @param {string[]} argv
 * @param {{ cwd?: string }} [opts]
 */
export function runGateRatchetCli(argv = process.argv.slice(2), opts = {}) {
  const args = parseArgs(argv)
  const cwd = args.cwd || opts.cwd || process.cwd()
  let baseFiles
  let headFiles
  if (args['base-dir'] && args['head-dir']) {
    baseFiles = readTreeFromDir(path.resolve(cwd, args['base-dir']))
    headFiles = readTreeFromDir(path.resolve(cwd, args['head-dir']))
  } else if (args['base-ref'] && args['head-ref']) {
    baseFiles = readTreeFromGitRef(cwd, args['base-ref'])
    headFiles = readTreeFromGitRef(cwd, args['head-ref'])
  } else {
    console.error(
      'Usage: check-gate-ratchet.mjs --base-ref <sha> --head-ref <sha> | --base-dir <dir> --head-dir <dir>',
    )
    return 2
  }
  const result = compareGateTrees(baseFiles, headFiles)
  if (result.ok) {
    console.log('Gate ratchet: OK (head not weaker than base)')
    return 0
  }
  console.error('Gate ratchet: FAIL')
  for (const v of result.violations) {
    console.error(`- [${v.ruleId}] ${v.message}`)
  }
  return 1
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  process.exitCode = runGateRatchetCli()
}
