import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMemoryAssetDirectory } from './fsa/memoryDirectory'
import {
  finalizeMemoryScanEntries,
  SCAN_GET_FILE_CONCURRENCY,
  walkAssetDirectory,
} from './scanWalk'

/** Counts concurrent `getFile()` calls; each settles after a macrotask. */
function createInFlightProbe(): {
  slow: (getFile: () => Promise<File>) => Promise<File>
  peak: () => number
} {
  let inFlight = 0
  let peak = 0
  return {
    slow: async (getFile) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1)
      })
      inFlight -= 1
      return getFile()
    },
    peak: () => peak,
  }
}

function browserFileHandle(getFile: () => Promise<File>) {
  return { kind: 'file' as const, getFile }
}

function browserDirectory(
  children: readonly (readonly [string, unknown])[],
): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    getDirectoryHandle: () => Promise.reject(new Error('unused')),
    async *entries() {
      for (const child of children) {
        await Promise.resolve()
        yield child
      }
    },
  } as unknown as FileSystemDirectoryHandle
}

describe('scanWalk', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('walks nested directories, keeps the live File and skips unreadable files', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('root.jpg', new Uint8Array([1]), 1)
    tree.putFile('album/nested.jpg', new Uint8Array([1, 2, 3]), 2)
    tree.putCorrupted('broken.jpg')

    const entries = await walkAssetDirectory(tree.root)

    expect(entries).toEqual([
      {
        relativePath: 'album/nested.jpg',
        byteSize: 3,
        mtimeMs: 2,
        file: expect.any(File),
      },
      {
        relativePath: 'root.jpg',
        byteSize: 1,
        mtimeMs: 1,
        file: expect.any(File),
      },
    ])
    expect(entries.map((entry) => entry.file.name)).toEqual([
      'nested.jpg',
      'root.jpg',
    ])
  })

  it('runs memory-handle getFile with bounded parallelism per directory', async () => {
    const tree = createMemoryAssetDirectory()
    for (let i = 0; i < 40; i += 1) {
      tree.putFile(`f-${String(i)}.jpg`, new Uint8Array([i]), i)
    }
    const sample = await tree.root.getFile('f-0.jpg')
    const proto = Object.getPrototypeOf(sample) as {
      getFile: () => Promise<File>
    }
    const realGetFile = proto.getFile
    const probe = createInFlightProbe()
    vi.spyOn(proto, 'getFile').mockImplementation(function (this: unknown) {
      return probe.slow(() => realGetFile.call(this))
    })

    const entries = await walkAssetDirectory(tree.root)

    expect(SCAN_GET_FILE_CONCURRENCY).toBe(16)
    expect(probe.peak()).toBe(SCAN_GET_FILE_CONCURRENCY)
    expect(entries).toHaveLength(40)
  })

  it('walks browser handles with bounded parallel getFile and nested dirs', async () => {
    const probe = createInFlightProbe()
    const files = Array.from(
      { length: 20 },
      (_, i) =>
        new File([new Uint8Array(i + 1)], `b-${String(i)}.jpg`, {
          lastModified: 100 + i,
        }),
    )
    const deep = new File([new Uint8Array(2)], 'deep.jpg', { lastModified: 5 })
    const root = browserDirectory([
      ...files.map(
        (file) =>
          [
            file.name,
            browserFileHandle(() => probe.slow(() => Promise.resolve(file))),
          ] as const,
      ),
      [
        'sub',
        browserDirectory([
          ['deep.jpg', browserFileHandle(() => Promise.resolve(deep))],
        ]),
      ],
      [
        'broken.jpg',
        browserFileHandle(() =>
          Promise.reject(new DOMException('gone', 'NotFoundError')),
        ),
      ],
    ])

    const entries = await walkAssetDirectory(root)

    expect(probe.peak()).toBe(SCAN_GET_FILE_CONCURRENCY)
    expect(entries).toHaveLength(21)
    expect(
      entries.find((entry) => entry.relativePath === 'sub/deep.jpg'),
    ).toEqual({
      relativePath: 'sub/deep.jpg',
      byteSize: 2,
      mtimeMs: 5,
      file: deep,
    })
    expect(entries.find((entry) => entry.relativePath === 'b-3.jpg')).toEqual({
      relativePath: 'b-3.jpg',
      byteSize: 4,
      mtimeMs: 103,
      file: files[3],
    })
  })

  it('sorts memory file tables by relative path', () => {
    expect(
      finalizeMemoryScanEntries([
        { relativePath: 'b.jpg', byteSize: 2, mtimeMs: 2 },
        { relativePath: 'a.jpg', byteSize: 1, mtimeMs: 1 },
      ]),
    ).toEqual([
      { relativePath: 'a.jpg', byteSize: 1, mtimeMs: 1 },
      { relativePath: 'b.jpg', byteSize: 2, mtimeMs: 2 },
    ])
  })
})
