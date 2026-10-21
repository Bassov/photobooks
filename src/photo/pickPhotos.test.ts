import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canUseDirectoryPicker,
  canUseOpenFilePicker,
  isImageLikeFile,
  partitionImportFiles,
  photoInputAccept,
  pickFolderWithDirectoryPicker,
  pickPhotosWithFilePicker,
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
    expect(skipped.map((file) => file.name)).toEqual([
      'README.md',
      'notes.txt',
      '.DS_Store',
    ])
    expect(rejected.map((entry) => entry.file.name)).toEqual([
      'scan.tiff',
      'phone.heic',
    ])
    expect(rejected.map((entry) => entry.reason)).toEqual([
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

describe('pickPhotosWithFilePicker', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'showOpenFilePicker')
    vi.restoreAllMocks()
  })

  it('returns null when showOpenFilePicker is missing', async () => {
    Reflect.deleteProperty(window, 'showOpenFilePicker')
    expect(canUseOpenFilePicker()).toBe(false)
    await expect(pickPhotosWithFilePicker()).resolves.toBeNull()
  })

  it('returns files from multiple handles', async () => {
    const a = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })
    const b = new File([new Uint8Array([2])], 'b.png', { type: 'image/png' })
    const open = vi
      .fn()
      .mockResolvedValue([
        { getFile: vi.fn().mockResolvedValue(a) },
        { getFile: vi.fn().mockResolvedValue(b) },
      ])
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      writable: true,
      value: open,
    })
    await expect(pickPhotosWithFilePicker()).resolves.toEqual([a, b])
    expect(canUseOpenFilePicker()).toBe(true)
    const options = open.mock.calls[0]?.[0] as {
      types: { accept: Record<string, string[]> }[]
    }
    expect(options.types[0]?.accept['image/heic']).toEqual(['.heic'])
    expect(options.types[0]?.accept['image/heif']).toEqual(['.heif'])
  })

  it('exposes HEIC in the photo input accept attribute', () => {
    expect(photoInputAccept()).toContain('.heic')
    expect(photoInputAccept()).toContain('image/heic')
  })

  it('returns null on AbortError and rethrows other errors', async () => {
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      writable: true,
      value: vi
        .fn()
        .mockRejectedValueOnce(new DOMException('cancel', 'AbortError')),
    })
    await expect(pickPhotosWithFilePicker()).resolves.toBeNull()

    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      writable: true,
      value: vi
        .fn()
        .mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError')),
    })
    await expect(pickPhotosWithFilePicker()).rejects.toMatchObject({
      name: 'NotAllowedError',
    })
  })

  it('exposes photo input accept attribute', () => {
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
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(root),
    })
    await expect(pickFolderWithDirectoryPicker()).resolves.toEqual([
      top,
      nested,
    ])
    expect(canUseDirectoryPicker()).toBe(true)
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
