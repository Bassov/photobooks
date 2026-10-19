import { describe, expect, it } from 'vitest'

import { createMemoryAssetDirectory } from './fsa/memoryDirectory'
import { finalizeMemoryScanEntries, walkAssetDirectory } from './scanWalk'

describe('scanWalk', () => {
  it('walks nested directories and skips unreadable files', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('root.jpg', new Uint8Array([1]), 1)
    tree.putFile('album/nested.jpg', new Uint8Array([1, 2, 3]), 2)
    tree.putCorrupted('broken.jpg')

    await expect(walkAssetDirectory(tree.root)).resolves.toEqual([
      { relativePath: 'album/nested.jpg', byteSize: 3, mtimeMs: 2 },
      { relativePath: 'root.jpg', byteSize: 1, mtimeMs: 1 },
    ])
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
