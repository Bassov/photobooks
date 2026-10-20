import { afterEach, describe, expect, it } from 'vitest'

import {
  assetShowsMissingHatch,
  getProblemRevisionSnapshot,
  missingAssetChecker,
  problemRevisionFromIds,
} from './hatch'
import { replaceRelinkStatuses, resetRelinkStore } from './statusStore'

describe('hatch', () => {
  afterEach(() => {
    resetRelinkStore()
  })

  it('shows hatch only for missing assets in the problem revision', () => {
    const rev = problemRevisionFromIds(['a', 'b'])
    expect(assetShowsMissingHatch('a', rev, 'missing')).toBe(true)
    expect(assetShowsMissingHatch('b', rev, 'modified')).toBe(false)
    expect(assetShowsMissingHatch('c', rev, 'missing')).toBe(false)
    expect(assetShowsMissingHatch('a', '', 'missing')).toBe(false)
    // Empty asset id must not hatch on an empty revision (early-return guard).
    expect(assetShowsMissingHatch('', '', 'missing')).toBe(false)
    expect(assetShowsMissingHatch('a', rev, undefined)).toBe(false)
    expect(assetShowsMissingHatch('a', rev, 'ok')).toBe(false)
  })

  it('problemRevisionFromIds joins with null separators', () => {
    expect(problemRevisionFromIds([])).toBe('')
    expect(problemRevisionFromIds(['x'])).toBe('x')
    expect(problemRevisionFromIds(['x', 'y'])).toBe('x\0y')
  })

  it('getProblemRevisionSnapshot reads live problem ids', () => {
    replaceRelinkStatuses(
      new Map([
        ['a', 'missing'],
        ['b', 'ok'],
        ['c', 'modified'],
      ]),
    )
    expect(getProblemRevisionSnapshot()).toBe('a\0c')
  })

  it('missingAssetChecker uses store status + revision', () => {
    replaceRelinkStatuses(new Map([['a', 'missing']]))
    const check = missingAssetChecker(getProblemRevisionSnapshot())
    expect(check('a')).toBe(true)
    expect(check('b')).toBe(false)
  })
})
