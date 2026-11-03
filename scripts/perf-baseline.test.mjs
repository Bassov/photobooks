import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classify,
  readBaseVerdict,
  scenarioSources,
  touchesScenario,
} from './perf-baseline.mjs'
import { main } from './perf-lane.mjs'

const WARM = {
  key: 'thumb-warm-slice.spec.ts › frame-budget gates › fling',
  spec: 'e2e/thumb-warm-slice.spec.ts',
}
const BASE_RED = { red: [WARM.key] }
const UNRELATED = ['src/editor/FrameLookSections.tsx', 'e2e/arrange.spec.ts']

describe('classify', () => {
  it('forgives a scenario red on base and untouched by the PR', () => {
    expect(classify(WARM, BASE_RED, UNRELATED)).toBe('pre-existing')
  })

  it.each([
    ['its spec', WARM.spec],
    ['its sources', 'src/photo/assetPool.ts'],
    ['a shared perf source', 'src/perf/loafObserver.ts'],
    ['the gate itself', 'scripts/perf-lane.mjs'],
  ])('fails when the PR touches %s', (_, file) => {
    expect(classify(WARM, BASE_RED, [...UNRELATED, file])).toBe('touched')
  })

  it('fails when the scenario is green on base', () => {
    expect(classify(WARM, { red: ['other › s'] }, UNRELATED)).toBe('new')
  })

  it.each([
    ['base verdict', null, UNRELATED],
    ['changed files', BASE_RED, null],
  ])('fails when the %s is unknown', (_, base, changed) => {
    expect(classify(WARM, base, changed)).toBe('no-baseline')
  })
})

describe('touchesScenario', () => {
  it('maps thumb and filmstrip specs to their asset / photo sources', () => {
    expect(touchesScenario(WARM.spec, ['src/editor/Filmstrip.tsx'])).toBe(true)
    expect(touchesScenario(WARM.spec, ['src/render/SpreadView.tsx'])).toBe(
      false,
    )
  })

  it('counts every app source for specs without a list', () => {
    expect(scenarioSources('e2e/drag-place.spec.ts')).toEqual([/^src\//])
    expect(touchesScenario('e2e/drag-place.spec.ts', ['src/lib/ids.ts'])).toBe(
      true,
    )
    expect(touchesScenario('e2e/drag-place.spec.ts', ['docs/x.md'])).toBe(false)
  })
})

describe('verdict with a base run (dry run)', () => {
  let dir
  const file = (name, data) => {
    const p = path.join(dir, name)
    fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data))
    return p
  }
  const report = (status) => ({
    suites: [
      {
        title: 'thumb-warm-slice.spec.ts',
        file: 'thumb-warm-slice.spec.ts',
        suites: [
          {
            title: 'frame-budget gates',
            specs: [{ title: 'fling', tests: [{ results: [{ status }] }] }],
          },
        ],
      },
    ],
  })
  const redRuns = () =>
    [1, 2, 3].map((n) => file(`run-${n}.json`, report('failed')))
  const summary = () => fs.readFileSync(path.join(dir, 'summary.md'), 'utf8')

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-baseline-'))
    vi.stubEnv('GITHUB_STEP_SUMMARY', path.join(dir, 'summary.md'))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('writes the red scenario keys with --out', () => {
    const out = path.join(dir, 'verdict.json')
    expect(main(['verdict', '--out', out, ...redRuns()])).toBe(1)
    expect(readBaseVerdict(out)).toEqual(BASE_RED)
  })

  it('reports a scenario red on main as pre-existing and passes', () => {
    const base = file('verdict.json', BASE_RED)
    const url = 'https://github.com/o/r/actions/runs/1'
    // HEAD...HEAD: the PR changes nothing, so the scenario is untouched.
    const args = ['--base', base, '--base-url', url, '--base-ref', 'HEAD']
    expect(main(['verdict', ...args, ...redRuns()])).toBe(0)
    expect(summary()).toContain(`pre-existing on main (${url}): ${WARM.key}`)
  })

  it.each([
    ['unreadable', () => file('verdict.json', '{not json')],
    ['missing', () => path.join(dir, 'none.json')],
    ['malformed', () => file('verdict.json', { red: [1] })],
  ])('fails as today when the base verdict is %s', (_, base) => {
    const args = ['--base', base(), '--base-ref', 'HEAD']
    expect(main(['verdict', ...args, ...redRuns()])).toBe(1)
    expect(summary()).toContain(`red (no-baseline): ${WARM.key}`)
  })

  it('fails as today without --base-ref', () => {
    const base = file('verdict.json', BASE_RED)
    expect(main(['verdict', '--base', base, ...redRuns()])).toBe(1)
  })

  it('fails as today when the base ref cannot be diffed', () => {
    const base = file('verdict.json', BASE_RED)
    const args = ['--base', base, '--base-ref', 'no-such-ref-xyz']
    expect(main(['verdict', ...args, ...redRuns()])).toBe(1)
  })
})
