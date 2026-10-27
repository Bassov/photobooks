import { describe, expect, it } from 'vitest'
import {
  isExternalFilesDrag,
  resolveDroppedFolder,
} from './filmstripDropFolder'

function items(
  handles: ({ kind: string } | null | 'unsupported')[],
): DataTransferItemList {
  return handles.map((handle) =>
    handle === 'unsupported'
      ? { kind: 'file' }
      : { kind: 'file', getAsFileSystemHandle: () => Promise.resolve(handle) },
  ) as unknown as DataTransferItemList
}

describe('desktop drop classification', () => {
  it('only treats Files drags as external', () => {
    expect(isExternalFilesDrag(['Files'])).toBe(true)
    expect(isExternalFilesDrag(['application/x-photobooks-asset'])).toBe(false)
  })

  it('picks the first directory and counts the rest as ignored', async () => {
    const dir = { kind: 'directory', name: 'trip' }
    const result = await resolveDroppedFolder(
      items([{ kind: 'file' }, dir, { kind: 'directory' }]),
    )
    expect(result).toEqual({ kind: 'folder', directory: dir, ignoredFiles: 2 })
  })

  it('skips non-file items and tolerates rejected handle reads', async () => {
    const list = [
      { kind: 'string' },
      {
        kind: 'file',
        getAsFileSystemHandle: () => Promise.reject(new Error('x')),
      },
    ] as unknown as DataTransferItemList
    expect(await resolveDroppedFolder(list)).toEqual({ kind: 'no-folder' })
    const withDir = [
      {
        kind: 'string',
        getAsFileSystemHandle: () => Promise.resolve({ kind: 'directory' }),
      },
    ] as unknown as DataTransferItemList
    expect(await resolveDroppedFolder(withDir)).toEqual({ kind: 'no-folder' })
  })

  it('reports no folder for loose files or unsupported browsers', async () => {
    expect(await resolveDroppedFolder(items([{ kind: 'file' }]))).toEqual({
      kind: 'no-folder',
    })
    expect(await resolveDroppedFolder(items(['unsupported']))).toEqual({
      kind: 'no-folder',
    })
  })
})
