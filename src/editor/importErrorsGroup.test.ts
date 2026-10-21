import { describe, expect, it } from 'vitest'
import { makeImportFileError } from './importFileError.test-helpers'
import { groupImportErrorsByReason } from './importErrorsGroup'

describe('groupImportErrorsByReason', () => {
  it('orders unsupported, heic, then decode and skips empty buckets', () => {
    const groups = groupImportErrorsByReason([
      makeImportFileError({
        name: 'd.jpg',
        message: 'decode',
        reason: 'decode-failed',
      }),
      makeImportFileError({
        name: 'h.heic',
        message: 'heic',
        reason: 'heic',
      }),
      makeImportFileError({
        name: 'a.tif',
        message: 'bad',
        reason: 'unsupported-type',
      }),
      makeImportFileError({
        name: 'b.tif',
        message: 'bad',
        reason: 'unsupported-type',
      }),
    ])
    expect(groups.map((group) => group.reason)).toEqual([
      'unsupported-type',
      'heic',
      'decode-failed',
    ])
    expect(groups[0]?.label).toBe('Unsupported format (2): a.tif, b.tif')
    expect(groups[1]?.label).toBe('HEIC not supported (1): h.heic')
    expect(groups[2]?.label).toBe("Couldn't decode (1): d.jpg")
  })

  it('returns an empty list for no errors', () => {
    expect(groupImportErrorsByReason([])).toEqual([])
  })
})
