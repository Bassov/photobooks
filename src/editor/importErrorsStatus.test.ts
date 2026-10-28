import { describe, expect, it } from 'vitest'
import { makeImportFileError } from './importFileError.test-helpers'
import { importErrorsStatusText } from './importErrorsStatus'

describe('importErrorsStatusText', () => {
  it('joins each failed file with its own message', () => {
    expect(
      importErrorsStatusText([
        makeImportFileError({
          name: 'a.tif',
          message: 'Unsupported',
          reason: 'unsupported-type',
        }),
        makeImportFileError({
          name: 'b.jpg',
          message: 'decode failed',
          reason: 'decode-failed',
        }),
      ]),
    ).toBe('a.tif: Unsupported; b.jpg: decode failed')
  })
})
