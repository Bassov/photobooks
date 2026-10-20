import { describe, expect, it } from 'vitest'
import {
  checkPlanSize,
  computeDiffSize,
  isExcludedDiffPath,
  parseNumstat,
  parsePlanSizeEstimate,
} from './check-diff-size.mjs'

describe('check-diff-size', () => {
  it('excludes lockfile, openspec/changes, uikit, binaries', () => {
    expect(isExcludedDiffPath('pnpm-lock.yaml')).toBe(true)
    expect(isExcludedDiffPath('openspec/changes/foo/tasks.md')).toBe(true)
    expect(isExcludedDiffPath('uikit/src/a.ts')).toBe(true)
    expect(isExcludedDiffPath('src/x.png')).toBe(true)
    expect(isExcludedDiffPath('scripts/a.mjs')).toBe(false)
  })

  it('counts numstat lines and enforces max', () => {
    const text = [
      '10\t2\tscripts/a.mjs',
      '100\t0\tpnpm-lock.yaml',
      '5\t5\tuikit/x.ts',
      '-\t-\tsrc/photo.png',
    ].join('\n')
    const r = computeDiffSize({
      numstatText: text,
      max: 20,
      warnOnly: false,
    })
    expect(r.lines).toBe(12)
    expect(r.ok).toBe(true)
    const over = computeDiffSize({ numstatText: text, max: 10 })
    expect(over.ok).toBe(false)
    expect(parseNumstat('3\t1\told => new.mjs\n')).toEqual([
      { file: 'new.mjs', added: 3, deleted: 1 },
    ])
  })

  it('parses plan size estimate', () => {
    expect(
      parsePlanSizeEstimate('**Size estimate:** 400 prod + 600 tests = 1000\n'),
    ).toBe(1000)
    expect(
      checkPlanSize({
        proposalText: '**Size estimate:** 900 prod + 800 tests = 1700\n',
      }).ok,
    ).toBe(false)
    expect(
      checkPlanSize({
        proposalText: '**Size estimate:** 400 prod + 400 tests = 800\n',
      }).ok,
    ).toBe(true)
  })
})
