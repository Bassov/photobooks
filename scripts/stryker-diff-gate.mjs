/**
 * Pure helpers for honest diff mutation (thresholds / excludes / NoCoverage).
 * Kept separate from the thin CLI in stryker-diff.mjs for mutation testing.
 */
import {
  classifyMutationFile,
  selectMutableChanges,
} from './mutation-scope.mjs'

export const DIFF_CONFIG = 'stryker.diff.config.mjs'
export const MUTATE_FILES_LIST = 'reports/mutation/mutate-files.txt'
export const MSG_UNAUTHORIZED_EXCLUDE =
  'changed excluded production file not in mutation.temporaryExcludes: '
export const MSG_SKIP_PRODUCTION =
  'diff mutation skipped while production files changed: '
export const MSG_NO_COVERAGE = 'NoCoverage mutants in diff mutation report: '

/** Stryker mutation-range spec: path:startLine[:startCol]-endLine[:endCol]. */
const MUTATE_RANGE_RE = /^(.+?):(\d+)(?::\d+)?-(\d+)(?::\d+)?$/

/**
 * @typedef {{ start: number, end: number }} LineRange inclusive 1-based
 */

/**
 * @param {string} spec
 */
export function isMutationRangeSpec(spec) {
  return MUTATE_RANGE_RE.test(spec)
}

/**
 * @param {string} spec
 * @returns {string}
 */
export function mutateSpecPath(spec) {
  const m = MUTATE_RANGE_RE.exec(spec)
  return m ? m[1] : spec
}

/**
 * @param {string} spec
 * @returns {LineRange | null}
 */
export function mutateSpecRange(spec) {
  const m = MUTATE_RANGE_RE.exec(spec)
  if (!m) return null
  const start = Number(m[2])
  const end = Number(m[3])
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 1 ||
    end < start
  ) {
    return null
  }
  return { start, end }
}

/**
 * @param {LineRange[]} ranges
 * @returns {LineRange[]}
 */
export function mergeLineRanges(ranges) {
  if (!Array.isArray(ranges)) return []
  if (ranges.length === 0) return []
  /** @type {LineRange[]} */
  const valid = []
  for (const r of ranges) {
    if (r == null) continue
    if (typeof r !== 'object') {
      throw new Error('mergeLineRanges: invalid range entry')
    }
    const start = r.start
    const end = r.end
    if (
      typeof start !== 'number' ||
      typeof end !== 'number' ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 1 ||
      end < start
    ) {
      continue
    }
    valid.push({ start, end })
  }
  if (valid.length === 0) return []
  valid.sort((a, b) => a.start - b.start || a.end - b.end)
  /** @type {LineRange[]} */
  const out = [{ start: valid[0].start, end: valid[0].end }]
  for (let i = 1; i < valid.length; i += 1) {
    const cur = valid[i]
    const last = out[out.length - 1]
    if (cur.start <= last.end + 1) {
      if (cur.end > last.end) last.end = cur.end
    } else {
      out.push({ start: cur.start, end: cur.end })
    }
  }
  return out
}

/**
 * Parse unified diff (`git diff -U0`) new-side line ranges per file.
 * @param {string} diffText
 * @returns {Map<string, LineRange[]>}
 */
export function parseUnifiedDiffNewSideRanges(diffText) {
  /** @type {Map<string, LineRange[]>} */
  const byFile = new Map()
  if (typeof diffText !== 'string') return byFile
  if (diffText.length === 0) return byFile
  let current = /** @type {string | null} */ (null)
  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      // diff --git a/<path> b/<path>
      const marker = ' b/'
      const b = raw.indexOf(marker)
      if (b < 0) continue
      const pathPart = raw.slice(b + marker.length)
      if (pathPart.length === 0 || pathPart.includes(' ')) continue
      current = pathPart
      if (!byFile.has(current)) byFile.set(current, [])
      continue
    }
    if (raw.startsWith('+++ /dev/null')) {
      current = null
      continue
    }
    if (raw.startsWith('+++ b/')) {
      current = raw.slice('+++ b/'.length)
      if (current.length === 0) continue
      if (!byFile.has(current)) byFile.set(current, [])
      continue
    }
    if (!raw.startsWith('@@ ') || !current) continue
    // @@ -old[,oldCount] +new[,newCount] @@
    const plus = raw.indexOf(' +')
    if (plus < 0) continue
    const afterPlus = raw.slice(plus + 2)
    const space = afterPlus.indexOf(' ')
    const newPart = space < 0 ? afterPlus : afterPlus.slice(0, space)
    const comma = newPart.indexOf(',')
    const startStr = comma < 0 ? newPart : newPart.slice(0, comma)
    const countStr = comma < 0 ? '' : newPart.slice(comma + 1)
    const start = Number(startStr)
    const count = countStr === '' ? 1 : Number(countStr)
    if (!Number.isFinite(start) || !Number.isFinite(count)) continue
    if (count <= 0) continue
    const ranges = byFile.get(current)
    if (!ranges) continue
    ranges.push({ start, end: start + count - 1 })
  }
  for (const [file, ranges] of byFile) {
    byFile.set(file, mergeLineRanges(ranges))
  }
  return byFile
}

/**
 * Merge range maps (later entries extend earlier).
 * @param {...Map<string, LineRange[]>} maps
 * @returns {Map<string, LineRange[]>}
 */
export function mergeRangeMaps(...maps) {
  /** @type {Map<string, LineRange[]>} */
  const out = new Map()
  for (const map of maps) {
    if (!map) continue
    for (const [file, ranges] of map) {
      const prev = out.get(file) ?? []
      out.set(file, mergeLineRanges([...prev, ...ranges]))
    }
  }
  return out
}

/**
 * @param {string} file
 * @param {LineRange[]} ranges
 * @returns {string[]}
 */
export function formatMutateRangeSpecs(file, ranges) {
  return mergeLineRanges(ranges).map((r) => `${file}:${r.start}-${r.end}`)
}

/**
 * @param {string[]} mutateSpecs
 * @returns {Map<string, LineRange[]>}
 */
export function scoredRangesFromMutateSpecs(mutateSpecs) {
  /** @type {Map<string, LineRange[]>} */
  const out = new Map()
  for (const spec of mutateSpecs) {
    const range = mutateSpecRange(spec)
    if (!range) continue
    const file = mutateSpecPath(spec)
    const prev = out.get(file) ?? []
    prev.push(range)
    out.set(file, prev)
  }
  for (const [file, ranges] of out) {
    out.set(file, mergeLineRanges(ranges))
  }
  return out
}

/**
 * @param {number} line
 * @param {LineRange[]} ranges
 */
export function lineInRanges(line, ranges) {
  if (!Number.isFinite(line)) return false
  for (const r of ranges) {
    if (line >= r.start && line <= r.end) return true
  }
  return false
}

/**
 * Keep only mutants whose start line falls in scored ranges.
 * @param {Record<string, { mutants?: { status?: string, location?: { start?: { line?: number } } }[] }>} fileMap
 * @param {Map<string, LineRange[]> | null | undefined} scoredRanges
 */
export function filterReportToScoredRanges(fileMap, scoredRanges) {
  if (!scoredRanges) return fileMap
  /** @type {Record<string, { mutants: typeof fileMap[string]['mutants'] }>} */
  const out = {}
  for (const [filePath, file] of Object.entries(fileMap)) {
    const ranges = scoredRanges.get(filePath)
    if (!ranges || ranges.length === 0) continue
    const mutants = Array.isArray(file?.mutants) ? file.mutants : []
    out[filePath] = {
      mutants: mutants.filter((m) =>
        lineInRanges(m?.location?.start?.line ?? NaN, ranges),
      ),
    }
  }
  return out
}

/**
 * @param {string} file
 * @param {string[]} patterns
 */
export function matchesMutateInclude(file, patterns) {
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) continue
    if (classifyMutationFile(file, [pattern]) === 'in-scope') return true
  }
  return false
}

/**
 * Exact-file bang (`!path` without glob metacharacters).
 * @param {string} file
 * @param {string[]} patterns
 */
export function exactBangExcludeTarget(file, patterns) {
  for (const pattern of patterns) {
    if (!pattern.startsWith('!')) continue
    const target = pattern.slice(1)
    if (
      !target.includes('*') &&
      !target.includes('?') &&
      !target.includes('{') &&
      target === file
    ) {
      return target
    }
  }
  return null
}

/**
 * @param {{ path?: unknown }[]} temporaryExcludes
 * @returns {Set<string>}
 */
export function temporaryExcludePaths(temporaryExcludes) {
  const out = new Set()
  for (const row of temporaryExcludes) {
    if (row && typeof row.path === 'string') out.add(row.path)
  }
  return out
}

/**
 * @param {string} file
 * @param {string[]} patterns
 * @param {Set<string>} tempPaths
 */
export function isUnauthorizedExclude(file, patterns, tempPaths) {
  if (!matchesMutateInclude(file, patterns)) return false
  if (classifyMutationFile(file, patterns) !== 'excluded') return false
  if (tempPaths.has(file)) return false
  return exactBangExcludeTarget(file, patterns) !== null
}

/**
 * @param {string[]} changed
 * @param {string[]} patterns
 * @param {Set<string>} tempPaths
 */
export function findUnauthorizedExcludes(changed, patterns, tempPaths) {
  return changed
    .filter((file) => isUnauthorizedExclude(file, patterns, tempPaths))
    .sort()
}

/**
 * @param {string[]} changed
 * @param {string[]} patterns
 * @param {Set<string>} tempPaths
 * @param {Map<string, LineRange[]> | null} [rangesByFile]
 *   When provided, mutate specs are `path:start-end` for in-scope files only.
 *   Empty scored ranges → skip (even if production paths appear in `changed`).
 */
export function planDiffMutation(
  changed,
  patterns,
  tempPaths,
  rangesByFile = null,
) {
  const unauthorized = findUnauthorizedExcludes(changed, patterns, tempPaths)
  const mutateFiles = selectMutableChanges(changed, patterns)
  /** @type {string[]} */
  const errors = []
  for (const file of unauthorized) {
    errors.push(`${MSG_UNAUTHORIZED_EXCLUDE}${file}`)
  }
  if (errors.length > 0) {
    return {
      mutateFiles,
      mutateSpecs: /** @type {string[]} */ ([]),
      unauthorized,
      skip: false,
      allowEmpty: false,
      errors,
    }
  }

  /** @type {string[]} */
  let mutateSpecs
  if (rangesByFile) {
    mutateSpecs = []
    for (const file of mutateFiles) {
      const ranges = rangesByFile.get(file) ?? []
      mutateSpecs.push(...formatMutateRangeSpecs(file, ranges))
    }
  } else {
    mutateSpecs = [...mutateFiles]
  }

  // Empty mutate set: docs / structural bangs / temporaryExcludes / empty scored ranges.
  if (mutateSpecs.length === 0) {
    return {
      mutateFiles: [],
      mutateSpecs,
      unauthorized,
      skip: true,
      allowEmpty: true,
      errors,
    }
  }

  const productionChanged = changed.some((file) =>
    matchesMutateInclude(file, patterns),
  )
  return {
    mutateFiles: [...new Set(mutateSpecs.map((s) => mutateSpecPath(s)))],
    mutateSpecs,
    unauthorized,
    skip: false,
    // Ranged mutate: allowEmpty so comment-only / zero-mutant ranges pass.
    // Whole-file mutate: keep prior honest rule (no allowEmpty when production changed).
    allowEmpty: allowEmptyForMutateSpecs(mutateSpecs)
      ? true
      : !productionChanged,
    errors,
  }
}

/**
 * `--allowEmpty` only when every mutate entry is a Stryker line range.
 * @param {string[]} mutateSpecs
 */
export function allowEmptyForMutateSpecs(mutateSpecs) {
  if (!Array.isArray(mutateSpecs) || mutateSpecs.length === 0) return true
  for (const spec of mutateSpecs) {
    if (!isMutationRangeSpec(spec)) return false
  }
  return true
}

/**
 * @param {Record<string, { mutants?: { status?: string }[] }>} fileMap
 * @param {Map<string, LineRange[]> | null} [scoredRanges]
 */
export function countNoCoverage(fileMap, scoredRanges = null) {
  const scoped = filterReportToScoredRanges(fileMap, scoredRanges)
  let n = 0
  for (const file of Object.values(scoped)) {
    const mutants = Array.isArray(file.mutants) ? file.mutants : []
    for (const mutant of mutants) {
      if (mutant.status === 'NoCoverage') n += 1
    }
  }
  return n
}

/**
 * @param {Record<string, { mutants?: { status?: string, location?: { start?: { line?: number } }, mutatorName?: string, id?: string }[] }>} fileMap
 * @param {Map<string, LineRange[]> | null} [scoredRanges]
 */
export function listNoCoverageMutants(fileMap, scoredRanges = null) {
  const scoped = filterReportToScoredRanges(fileMap, scoredRanges)
  /** @type {{ path: string, line: string, mutator: string }[]} */
  const out = []
  for (const [filePath, file] of Object.entries(scoped)) {
    const mutants = Array.isArray(file.mutants) ? file.mutants : []
    for (const mutant of mutants) {
      if (mutant.status !== 'NoCoverage') continue
      const line = mutant.location?.start?.line
      out.push({
        path: filePath,
        line: typeof line === 'number' ? String(line) : '?',
        mutator: mutant.mutatorName || mutant.id || '',
      })
    }
  }
  return out
}

/**
 * @param {Record<string, { mutants?: { status?: string }[] }>} fileMap
 * @param {Map<string, LineRange[]> | null} [scoredRanges]
 */
export function evaluateNoCoverageGate(fileMap, scoredRanges = null) {
  const n = countNoCoverage(fileMap, scoredRanges)
  if (n === 0) return { ok: true, count: 0, error: null }
  return {
    ok: false,
    count: n,
    error: `${MSG_NO_COVERAGE}${n}`,
  }
}

/**
 * Build Stryker argv for a planned diff run.
 * @param {string[]} mutateSpecs paths or `path:start-end` specs
 * @param {boolean} allowEmpty
 */
export function buildStrykerArgs(mutateSpecs, allowEmpty) {
  const args = [DIFF_CONFIG, '--mutate', mutateSpecs.join(',')]
  if (allowEmpty) args.push('--allowEmpty')
  return args
}

/**
 * temporaryExcludes paths that lack an exact `!path` mutate bang.
 * @param {string[]} paths
 * @param {string[]} patterns
 */
export function temporaryExcludesMissingBangs(paths, patterns) {
  const bangs = new Set()
  for (const pattern of patterns) {
    if (!pattern.startsWith('!')) continue
    const target = pattern.slice(1)
    if (
      !target.includes('*') &&
      !target.includes('?') &&
      !target.includes('{')
    ) {
      bangs.add(target)
    }
  }
  return paths.filter((p) => !bangs.has(p)).sort()
}
