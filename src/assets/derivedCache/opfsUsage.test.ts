import { describe, expect, it, vi } from 'vitest'
import { measureDerivedCacheBytes } from './opfsUsage'

function fakeDir(
  entries: readonly { kind: 'file' | 'directory'; size: number }[],
): FileSystemDirectoryHandle {
  const handles = entries.map((entry) => ({
    kind: entry.kind,
    getFile: () => Promise.resolve({ size: entry.size }),
  }))
  return {
    values: () => ({
      [Symbol.asyncIterator]: () => {
        let index = 0
        return {
          next: () =>
            Promise.resolve(
              index < handles.length
                ? { done: false, value: handles[index++] }
                : { done: true, value: undefined },
            ),
        }
      },
    }),
  } as unknown as FileSystemDirectoryHandle
}

describe('measureDerivedCacheBytes', () => {
  it('sums file sizes and ignores subdirectories', async () => {
    const root = fakeDir([
      { kind: 'file', size: 100 },
      { kind: 'directory', size: 999 },
      { kind: 'file', size: 24 },
    ])
    expect(await measureDerivedCacheBytes({ root })).toBe(124)
  })

  it('is 0 for an empty cache', async () => {
    expect(await measureDerivedCacheBytes({ root: fakeDir([]) })).toBe(0)
  })

  it('opens the OPFS derived-cache root (creating it) by default', async () => {
    const root = fakeDir([{ kind: 'file', size: 7 }])
    const getDirectoryHandle = vi.fn(() => Promise.resolve(root))
    vi.stubGlobal('navigator', {
      storage: { getDirectory: () => Promise.resolve({ getDirectoryHandle }) },
    })
    expect(await measureDerivedCacheBytes()).toBe(7)
    expect(getDirectoryHandle).toHaveBeenCalledWith('photobooks-derived', {
      create: true,
    })
    vi.unstubAllGlobals()
  })

  it('is null without OPFS support', async () => {
    vi.stubGlobal('navigator', { storage: {} })
    expect(await measureDerivedCacheBytes()).toBeNull()
    vi.unstubAllGlobals()
  })

  it('is null when the directory cannot be read', async () => {
    const root = {
      values: () => {
        throw new Error('denied')
      },
    } as unknown as FileSystemDirectoryHandle
    expect(await measureDerivedCacheBytes({ root })).toBeNull()
  })
})
