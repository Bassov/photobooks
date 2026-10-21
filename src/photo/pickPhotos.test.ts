import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canUseDirectoryPicker,
  canUseOpenFilePicker,
  partitionImportFiles,
  photoInputAccept,
  pickFolderWithDirectoryPicker,
  pickPhotosWithFilePicker,
} from './pickPhotos'

describe('partitionImportFiles', () => {
  it('keeps jpeg/png/webp and rejects tiff without dropping accepted', () => {
    const jpeg = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const tiff = new File([new Uint8Array([1])], 'scan.tiff', {
      type: 'image/tiff',
    })
    const png = new File([new Uint8Array([1])], 'b.png', { type: 'image/png' })
    const { accepted, rejected } = partitionImportFiles([jpeg, tiff, png])
    expect(accepted).toEqual([jpeg, png])
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.file).toBe(tiff)
    expect(rejected[0]?.message).toMatch(/Unsupported/i)
    expect(rejected[0]?.reason).toBe('unsupported-type')
  })

  it('treats empty mime as unsupported octet-stream', () => {
    const bare = new File([new Uint8Array([1])], 'no-ext')
    const { accepted, rejected } = partitionImportFiles([bare])
    expect(accepted).toHaveLength(0)
    expect(rejected[0]?.message).toMatch(/octet-stream|Unsupported/i)
    expect(rejected[0]?.reason).toBe('unsupported-type')
  })

  it('tags HEIC-like rejects with heic reason', () => {
    const heic = new File([new Uint8Array([1])], 'scan.heic', {
      type: 'image/heic',
    })
    const heifExt = new File([new Uint8Array([1])], 'scan.heif', {
      type: '',
    })
    const { rejected } = partitionImportFiles([heic, heifExt])
    expect(rejected.map((entry) => entry.reason)).toEqual(['heic', 'heic'])
    expect(rejected[0]?.message).toMatch(/Unsupported/i)
  })

  it('returns empty partitions for an empty list', () => {
    expect(partitionImportFiles([])).toEqual({ accepted: [], rejected: [] })
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
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      writable: true,
      value: vi
        .fn()
        .mockResolvedValue([
          { getFile: vi.fn().mockResolvedValue(a) },
          { getFile: vi.fn().mockResolvedValue(b) },
        ]),
    })
    await expect(pickPhotosWithFilePicker()).resolves.toEqual([a, b])
    expect(canUseOpenFilePicker()).toBe(true)
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
