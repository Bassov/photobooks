import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import { createFakeBrowserDirectory } from '../project/fsa/browserDirectory.test-helpers'
import {
  fileWithRelativePath,
  resolveRelativeFile,
} from './resolveRelativeFile'
import { createMemoryAssetDirectory } from './fsa/memoryDirectory'

describe('fileWithRelativePath', () => {
  it('keeps an existing matching webkitRelativePath without redefining', () => {
    const prelabeled = new File([new Uint8Array([9])], 'pre.jpg', {
      type: 'image/jpeg',
    })
    Object.defineProperty(prelabeled, 'webkitRelativePath', {
      value: 'pre.jpg',
      configurable: false,
    })
    expect(fileWithRelativePath(prelabeled, 'pre.jpg')).toBe(prelabeled)
  })

  it('copies the File when webkitRelativePath cannot be redefined', async () => {
    const bytes = new Uint8Array([3, 7, 11])
    const lastModified = 1_700_000_000_000
    const sealed = new File([bytes], 'sealed.jpg', {
      type: 'image/jpeg',
      lastModified,
    })
    Object.defineProperty(sealed, 'webkitRelativePath', {
      value: 'wrong/path.jpg',
      configurable: false,
    })
    const copy = fileWithRelativePath(sealed, 'sealed.jpg')
    expect(copy).not.toBe(sealed)
    expect(copy.name).toBe('sealed.jpg')
    expect(copy.type).toBe('image/jpeg')
    expect(copy.lastModified).toBe(lastModified)
    expect(new Uint8Array(await copy.arrayBuffer())).toEqual(bytes)
    expect(
      (copy as File & { webkitRelativePath?: string }).webkitRelativePath,
    ).toBe('sealed.jpg')
    // Copy's path property must stay redefinable for later relabeling.
    Object.defineProperty(copy, 'webkitRelativePath', {
      value: 'relabeled.jpg',
      configurable: true,
    })
    expect(
      (copy as File & { webkitRelativePath?: string }).webkitRelativePath,
    ).toBe('relabeled.jpg')
  })
})

describe('resolveRelativeFile', () => {
  it('resolves nested paths from a browser directory double', async () => {
    const root = createFakeBrowserDirectory({ name: 'album' })
    root.writeFile('a.jpg', new Uint8Array([1, 2]))
    const nested = await root.getDirectoryHandle('nested', { create: true })
    ;(
      nested as import('../project/fsa/browserDirectory.test-helpers').FakeBrowserDirectoryHandle
    ).writeFile('b.png', new Uint8Array([3]))
    const top = await resolveRelativeFile(root, 'a.jpg')
    const child = await resolveRelativeFile(root, 'nested/b.png')
    assert.ok(top)
    assert.ok(child)
    expect(top.name).toBe('a.jpg')
    expect(
      (top as File & { webkitRelativePath?: string }).webkitRelativePath,
    ).toBe('a.jpg')
    expect(
      (child as File & { webkitRelativePath?: string }).webkitRelativePath,
    ).toBe('nested/b.png')
  })

  it('resolves paths from a memory asset directory', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('album/shot.jpg', new Uint8Array([9]), 42)
    const file = await resolveRelativeFile(tree.root, 'album/shot.jpg')
    assert.ok(file)
    expect(file.lastModified).toBe(42)
    expect(
      (file as File & { webkitRelativePath?: string }).webkitRelativePath,
    ).toBe('album/shot.jpg')
  })

  it('returns null for missing paths', async () => {
    const tree = createMemoryAssetDirectory()
    await expect(
      resolveRelativeFile(tree.root, 'missing.jpg'),
    ).resolves.toBeNull()
    await expect(resolveRelativeFile(tree.root, '')).resolves.toBeNull()
    await expect(resolveRelativeFile(tree.root, '/')).resolves.toBeNull()
    await expect(
      resolveRelativeFile(tree.root, 'gone/dir/x.jpg'),
    ).resolves.toBeNull()
  })

  it('ignores empty path segments so nested files still resolve', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('album/shot.jpg', new Uint8Array([1]), 1)
    const file = await resolveRelativeFile(tree.root, 'album//shot.jpg')
    assert.ok(file)
    expect(
      (file as File & { webkitRelativePath?: string }).webkitRelativePath,
    ).toBe('album//shot.jpg')
  })
})
