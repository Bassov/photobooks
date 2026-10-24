import assert from 'node:assert/strict'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeBrowserDirectory } from '../project/fsa/browserDirectory.test-helpers'
import {
  canUseDirectoryPicker,
  isImageLikeFile,
  partitionImportFiles,
  photoInputAccept,
  pickFolderWithDirectoryPicker,
} from './pickPhotos'

describe('isImageLikeFile', () => {
  it('matches image MIME and known extensions including heic/tiff', () => {
    expect(isImageLikeFile({ name: 'x.bin', type: 'image/jpeg' })).toBe(true)
    expect(isImageLikeFile({ name: 'scan.HEIC', type: '' })).toBe(true)
    expect(isImageLikeFile({ name: 'scan.tiff', type: '' })).toBe(true)
    expect(isImageLikeFile({ name: 'README.md', type: 'text/markdown' })).toBe(
      false,
    )
  })
})

describe('partitionImportFiles', () => {
  it('keeps jpeg/png/webp and rejects tiff without dropping accepted', () => {
    const jpeg = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const tiff = new File([new Uint8Array([1])], 'scan.tiff', {
      type: 'image/tiff',
    })
    const png = new File([new Uint8Array([1])], 'b.png', { type: 'image/png' })
    const { accepted, rejected, skipped } = partitionImportFiles([
      jpeg,
      tiff,
      png,
    ])
    expect(accepted).toEqual([jpeg, png])
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.file).toBe(tiff)
    expect(rejected[0]?.message).toMatch(/Unsupported/i)
    expect(rejected[0]?.reason).toBe('unsupported-type')
    expect(skipped).toEqual([])
  })

  it('treats empty mime as unsupported octet-stream', () => {
    const bare = new File([new Uint8Array([1])], 'no-ext')
    const { accepted, rejected, skipped } = partitionImportFiles([bare])
    expect(accepted).toHaveLength(0)
    expect(rejected[0]?.message).toMatch(/octet-stream|Unsupported/i)
    expect(rejected[0]?.reason).toBe('unsupported-type')
    expect(skipped).toEqual([])
  })

  it('tags HEIC-like rejects with heic reason', () => {
    const heic = new File([new Uint8Array([1])], 'scan.heic', {
      type: 'image/heic',
    })
    const heifMime = new File([new Uint8Array([1])], 'scan.heif', {
      type: 'image/heif',
    })
    const heifExt = new File([new Uint8Array([1])], 'scan.heif', {
      type: '',
    })
    const octet = new File([new Uint8Array([1])], 'phone.heic', {
      type: 'application/octet-stream',
    })
    const emptyMime = new File([new Uint8Array([1])], 'cam.HEIC', {
      type: '',
    })
    const { rejected, skipped } = partitionImportFiles([
      heic,
      heifMime,
      heifExt,
      octet,
      emptyMime,
    ])
    expect(rejected.map((entry) => entry.reason)).toEqual([
      'heic',
      'heic',
      'heic',
      'heic',
      'heic',
    ])
    expect(
      rejected.every((entry) =>
        entry.message.includes("HEIC isn't supported yet"),
      ),
    ).toBe(true)
    expect(skipped).toEqual([])
  })

  it('folder source skips non-image-like files but still rejects tiff/heic', () => {
    const jpeg = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const readme = new File(['# hi'], 'README.md', { type: 'text/markdown' })
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' })
    const ds = new File([], '.DS_Store', { type: '' })
    const tiff = new File([new Uint8Array([1])], 'scan.tiff', {
      type: 'image/tiff',
    })
    const heic = new File([new Uint8Array([1])], 'phone.heic', { type: '' })
    const { accepted, rejected, skipped } = partitionImportFiles(
      [jpeg, readme, txt, ds, tiff, heic],
      { source: 'folder' },
    )
    expect(accepted).toEqual([jpeg])
    expect(skipped.map((file) => file.name)).toEqual(['README.md', 'notes.txt'])
    // Bare octet-stream (.DS_Store) stays in reject path for HEIC sniff.
    expect(rejected.map((entry) => entry.file.name)).toEqual([
      '.DS_Store',
      'scan.tiff',
      'phone.heic',
    ])
    expect(rejected.map((entry) => entry.reason)).toEqual([
      'unsupported-type',
      'unsupported-type',
      'heic',
    ])
  })

  it('files source still rejects README as unsupported', () => {
    const readme = new File(['# hi'], 'README.md', { type: 'text/markdown' })
    const { rejected, skipped } = partitionImportFiles([readme], {
      source: 'files',
    })
    expect(skipped).toEqual([])
    expect(rejected[0]?.reason).toBe('unsupported-type')
  })

  it('returns empty partitions for an empty list', () => {
    expect(partitionImportFiles([])).toEqual({
      accepted: [],
      rejected: [],
      skipped: [],
    })
  })
})

describe('photoInputAccept', () => {
  it('exposes HEIC and common image types in the accept attribute', () => {
    expect(photoInputAccept()).toContain('.heic')
    expect(photoInputAccept()).toContain('image/heic')
    expect(photoInputAccept()).toContain('image/jpeg')
  })
})

describe('pickFolderWithDirectoryPicker', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'showDirectoryPicker')
    vi.restoreAllMocks()
  })

  it('returns null when showDirectoryPicker is missing', async () => {
    Reflect.deleteProperty(window, 'showDirectoryPicker')
    expect(canUseDirectoryPicker()).toBe(false)
    await expect(pickFolderWithDirectoryPicker()).resolves.toBeNull()
  })

  it('collects nested files from directory handles', async () => {
    const nested = new File([new Uint8Array([1])], 'nested.jpg', {
      type: 'image/jpeg',
    })
    const top = new File([new Uint8Array([2])], 'top.png', {
      type: 'image/png',
    })
    const nestedDir = {
      kind: 'directory' as const,
      entries: (): AsyncGenerator<
        readonly [string, { kind: 'file'; getFile: () => Promise<File> }],
        void
      > =>
        (async function* () {
          await Promise.resolve()
          yield [
            'nested.jpg',
            {
              kind: 'file' as const,
              getFile: vi.fn().mockResolvedValue(nested),
            },
          ] as const
        })(),
    }
    const root = {
      kind: 'directory' as const,
      entries: (): AsyncGenerator<
        | readonly [string, { kind: 'file'; getFile: () => Promise<File> }]
        | readonly [string, typeof nestedDir],
        void
      > =>
        (async function* () {
          await Promise.resolve()
          yield [
            'top.png',
            { kind: 'file' as const, getFile: vi.fn().mockResolvedValue(top) },
          ] as const
          yield ['sub', nestedDir] as const
        })(),
    }
    const picker = vi.fn().mockResolvedValue(root)
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      writable: true,
      value: picker,
    })
    const picked = await pickFolderWithDirectoryPicker()
    expect(picker).toHaveBeenCalledWith({
      id: 'photobooks-photos',
      mode: 'read',
      startIn: 'pictures',
    })
    expect(picked?.directory).toBe(root)
    expect(picked?.files).toHaveLength(2)
    expect(picked?.files[0]).toMatchObject({
      name: 'top.png',
      webkitRelativePath: 'top.png',
    })
    expect(picked?.files[1]).toMatchObject({
      name: 'nested.jpg',
      webkitRelativePath: 'sub/nested.jpg',
    })
    expect(canUseDirectoryPicker()).toBe(true)
  })

  it('keeps an existing matching webkitRelativePath without redefining', async () => {
    const prelabeled = new File([new Uint8Array([9])], 'pre.jpg', {
      type: 'image/jpeg',
    })
    // Non-configurable match: skipping the early return would throw on redefine
    // and fall through to a File copy — identity must stay the original.
    Object.defineProperty(prelabeled, 'webkitRelativePath', {
      value: 'pre.jpg',
      configurable: false,
    })
    const root = {
      kind: 'directory' as const,
      entries: (): AsyncGenerator<
        readonly [string, { kind: 'file'; getFile: () => Promise<File> }],
        void
      > =>
        (async function* () {
          await Promise.resolve()
          yield [
            'pre.jpg',
            {
              kind: 'file' as const,
              getFile: vi.fn().mockResolvedValue(prelabeled),
            },
          ] as const
        })(),
    }
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(root),
    })
    const picked = await pickFolderWithDirectoryPicker()
    expect(picked?.files).toHaveLength(1)
    expect(picked?.files[0]).toBe(prelabeled)
    expect(
      (picked?.files[0] as File & { webkitRelativePath?: string })
        .webkitRelativePath,
    ).toBe('pre.jpg')
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
    const root = {
      kind: 'directory' as const,
      entries: (): AsyncGenerator<
        readonly [string, { kind: 'file'; getFile: () => Promise<File> }],
        void
      > =>
        (async function* () {
          await Promise.resolve()
          yield [
            'sealed.jpg',
            {
              kind: 'file' as const,
              getFile: vi.fn().mockResolvedValue(sealed),
            },
          ] as const
        })(),
    }
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(root),
    })
    const picked = await pickFolderWithDirectoryPicker()
    expect(picked?.files).toHaveLength(1)
    const copy = picked?.files[0]
    expect(copy).not.toBe(sealed)
    expect(copy?.name).toBe('sealed.jpg')
    expect(copy?.type).toBe('image/jpeg')
    expect(copy?.lastModified).toBe(lastModified)
    expect(copy).toBeDefined()
    assert.ok(copy)
    expect(copy.size).toBe(bytes.byteLength)
    expect(new Uint8Array(await copy.arrayBuffer())).toEqual(bytes)
    expect(
      (copy as File & { webkitRelativePath?: string }).webkitRelativePath,
    ).toBe('sealed.jpg')
    expect(
      Object.getOwnPropertyDescriptor(copy, 'webkitRelativePath')?.configurable,
    ).toBe(true)
  })

  it('defines a configurable webkitRelativePath on a plain File', async () => {
    const plain = new File([new Uint8Array([1, 2])], 'plain.png', {
      type: 'image/png',
    })
    const root = {
      kind: 'directory' as const,
      entries: (): AsyncGenerator<
        readonly [string, { kind: 'file'; getFile: () => Promise<File> }],
        void
      > =>
        (async function* () {
          await Promise.resolve()
          yield [
            'plain.png',
            {
              kind: 'file' as const,
              getFile: vi.fn().mockResolvedValue(plain),
            },
          ] as const
        })(),
    }
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(root),
    })
    const picked = await pickFolderWithDirectoryPicker()
    const file = picked?.files[0]
    expect(file).toBe(plain)
    expect(
      (file as File & { webkitRelativePath?: string }).webkitRelativePath,
    ).toBe('plain.png')
    expect(
      Object.getOwnPropertyDescriptor(file, 'webkitRelativePath')?.configurable,
    ).toBe(true)
  })

  it('walks fake browser directories via entries()', async () => {
    const root = createFakeBrowserDirectory({ name: 'album' })
    root.writeFile('a.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))
    const nested = await root.getDirectoryHandle('nested', { create: true })
    assertFakeDir(nested).writeFile('b.png', new Uint8Array([1, 2, 3]))
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(root),
    })
    const picked = await pickFolderWithDirectoryPicker()
    expect(picked?.directory).toBe(root)
    expect(
      picked?.files
        .map((file) => ({
          name: file.name,
          path: (file as File & { webkitRelativePath?: string })
            .webkitRelativePath,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual([
      { name: 'a.jpg', path: 'a.jpg' },
      { name: 'b.png', path: 'nested/b.png' },
    ])
  })

  it('returns null on AbortError and rethrows other errors', async () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      writable: true,
      value: vi
        .fn()
        .mockRejectedValueOnce(new DOMException('cancel', 'AbortError')),
    })
    await expect(pickFolderWithDirectoryPicker()).resolves.toBeNull()

    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      writable: true,
      value: vi
        .fn()
        .mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError')),
    })
    await expect(pickFolderWithDirectoryPicker()).rejects.toMatchObject({
      name: 'NotAllowedError',
    })
  })
})

function assertFakeDir(
  handle: FileSystemDirectoryHandle,
): import('../project/fsa/browserDirectory.test-helpers').FakeBrowserDirectoryHandle {
  return handle as import('../project/fsa/browserDirectory.test-helpers').FakeBrowserDirectoryHandle
}
