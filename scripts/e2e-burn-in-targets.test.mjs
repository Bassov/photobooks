import { describe, expect, it } from 'vitest'
import {
  importsHelper,
  isE2eHelper,
  isE2eSpec,
  selectBurnInTargets,
} from './e2e-burn-in-targets.mjs'

describe('isE2eSpec / isE2eHelper', () => {
  it.each([
    ['e2e/smoke.spec.ts', true],
    ['e2e/nested/foo.spec.ts', true],
    ['e2e/helpers/wait.ts', false],
    ['src/app.ts', false],
  ])('%s → %s', (path, expected) => {
    expect(isE2eSpec(path)).toBe(expected)
  })

  it.each([
    ['e2e/helpers/wait.ts', true],
    ['e2e/helpers/nested/x.mjs', true],
    ['e2e/fixtures/wait.ts', false],
    ['e2e/smoke.spec.ts', false],
  ])('helper %s → %s', (path, expected) => {
    expect(isE2eHelper(path)).toBe(expected)
  })
})

describe('importsHelper', () => {
  it('matches relative helpers imports', () => {
    expect(
      importsHelper(
        `import { wait } from './helpers/wait'\n`,
        'e2e/helpers/wait.ts',
      ),
    ).toBe(true)
    expect(
      importsHelper(
        `import { wait } from '../helpers/wait.ts'\n`,
        'e2e/helpers/wait.ts',
      ),
    ).toBe(true)
  })

  it('ignores unrelated imports', () => {
    expect(
      importsHelper(
        `import { open } from './fixtures/open'\n`,
        'e2e/helpers/wait.ts',
      ),
    ).toBe(false)
  })
})

describe('selectBurnInTargets', () => {
  it('includes changed specs', () => {
    expect(
      selectBurnInTargets(['e2e/smoke.spec.ts', 'src/main.tsx'], {
        listSpecs: () => [],
      }),
    ).toEqual(['e2e/smoke.spec.ts'])
  })

  it('adds specs that import a changed helper', () => {
    const files = {
      'e2e/a.spec.ts': `import { wait } from './helpers/wait'\n`,
      'e2e/b.spec.ts': `import { other } from './helpers/other'\n`,
    }
    expect(
      selectBurnInTargets(['e2e/helpers/wait.ts'], {
        listSpecs: () => Object.keys(files),
        readFile: (path) => files[path],
      }),
    ).toEqual(['e2e/a.spec.ts'])
  })

  it('returns empty when nothing relevant changed', () => {
    expect(
      selectBurnInTargets(['README.md'], {
        listSpecs: () => ['e2e/a.spec.ts'],
      }),
    ).toEqual([])
  })
})
