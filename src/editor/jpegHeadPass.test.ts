import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAssetPool } from '../photo/assetPool'
import {
  enqueueGalleryAssets,
  getBookStoreSnapshot,
  resetBookStore,
  setAssetSessionMeta,
} from './bookStore'
import * as folderManifestWrite from './folderManifestWrite'
import { runJpegHeadPass } from './jpegHeadPass'
import {
  getThumbUrl,
  hasThumbData,
  resetThumbCache,
  setThumbUrl,
} from './thumbCache'

const parseJpegHead = vi.hoisted(() => vi.fn())

vi.mock('../photo/jpegHead', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../photo/jpegHead')>()
  return {
    ...actual,
    parseJpegHead: (
      ...args: Parameters<typeof actual.parseJpegHead>
    ): ReturnType<typeof actual.parseJpegHead> =>
      parseJpegHead(...args) as ReturnType<typeof actual.parseJpegHead>,
  }
})

function jpegFile(name: string): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], name, {
    type: 'image/jpeg',
  })
}

describe('runJpegHeadPass', () => {
  beforeEach(() => {
    resetBookStore()
    resetThumbCache()
    resetAssetPool()
    parseJpegHead.mockReset()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
  })

  it('publishes EXIF thumb and session dims from the head parse', async () => {
    const thumb = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0xaa])
    parseJpegHead.mockResolvedValue({
      thumbJpeg: thumb,
      width: 40,
      height: 20,
      orientation: 6,
      correctedWidth: 20,
      correctedHeight: 40,
    })

    await runJpegHeadPass([{ assetId: 'a1', file: jpegFile('a.jpg') }])

    expect(getThumbUrl('a1')).toMatch(/^blob:/)
    const meta = getBookStoreSnapshot().sessionMeta.get('a1')
    expect(meta?.correctedWidth).toBe(20)
    expect(meta?.correctedHeight).toBe(40)
    expect(meta?.orientation).toBe(6)
  })

  it('skips non-JPEG files', async () => {
    const png = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })
    await runJpegHeadPass([{ assetId: 'p1', file: png }])
    expect(parseJpegHead).not.toHaveBeenCalled()
  })

  it('leaves grey placeholder when thumb is absent', async () => {
    parseJpegHead.mockResolvedValue({
      thumbJpeg: null,
      width: 40,
      height: 20,
      orientation: 1,
      correctedWidth: 40,
      correctedHeight: 20,
    })

    await runJpegHeadPass([{ assetId: 'a2', file: jpegFile('b.jpg') }])

    expect(getThumbUrl('a2')).toBeUndefined()
    expect(getBookStoreSnapshot().sessionMeta.get('a2')?.correctedWidth).toBe(
      40,
    )
  })

  it('returns immediately for an empty entry list', async () => {
    await runJpegHeadPass([])
    expect(parseJpegHead).not.toHaveBeenCalled()
  })

  it('returns immediately when every entry is non-JPEG', async () => {
    const png = new File([new Uint8Array([1])], 'only.png', {
      type: 'image/png',
    })
    await runJpegHeadPass([{ assetId: 'n1', file: png }])
    expect(parseJpegHead).not.toHaveBeenCalled()
  })

  it('updates dims when only height is above the placeholder threshold', async () => {
    setAssetSessionMeta('tall', {
      name: 'tall.jpg',
      correctedWidth: 1,
      correctedHeight: 80,
      orientation: 1,
      aspect: 1,
    })
    parseJpegHead.mockResolvedValue({
      thumbJpeg: null,
      width: 40,
      height: 80,
      orientation: 1,
      correctedWidth: 40,
      correctedHeight: 80,
    })

    await runJpegHeadPass([{ assetId: 'tall', file: jpegFile('tall.jpg') }])

    expect(parseJpegHead).toHaveBeenCalled()
    expect(getBookStoreSnapshot().sessionMeta.get('tall')?.correctedWidth).toBe(
      40,
    )
  })

  it('still reads the head when placeholder dims are 1×1', async () => {
    setAssetSessionMeta('ph', {
      name: 'ph.jpg',
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      aspect: 1,
    })
    parseJpegHead.mockResolvedValue({
      thumbJpeg: null,
      width: 40,
      height: 20,
      orientation: 1,
      correctedWidth: 40,
      correctedHeight: 20,
    })

    await runJpegHeadPass([{ assetId: 'ph', file: jpegFile('ph.jpg') }])

    expect(parseJpegHead).toHaveBeenCalled()
    expect(getBookStoreSnapshot().sessionMeta.get('ph')?.correctedWidth).toBe(
      40,
    )
  })

  it('uses the file name when session meta has no prior name', async () => {
    parseJpegHead.mockResolvedValue({
      thumbJpeg: null,
      width: 10,
      height: 10,
      orientation: 1,
      correctedWidth: 10,
      correctedHeight: 10,
    })

    await runJpegHeadPass([{ assetId: 'noname', file: jpegFile('fresh.jpg') }])

    expect(getBookStoreSnapshot().sessionMeta.get('noname')?.name).toBe(
      'fresh.jpg',
    )
  })

  it('stores a copied EXIF thumb buffer', async () => {
    const thumb = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0xcc])
    parseJpegHead.mockResolvedValue({
      thumbJpeg: thumb,
      width: 10,
      height: 10,
      orientation: 1,
      correctedWidth: 10,
      correctedHeight: 10,
    })

    await runJpegHeadPass([{ assetId: 'copy', file: jpegFile('copy.jpg') }])

    expect(getThumbUrl('copy')).toMatch(/^blob:/)
    expect(parseJpegHead).toHaveBeenCalled()
  })

  it('fills only the missing thumb when real dims already exist', async () => {
    setAssetSessionMeta('dims', {
      name: 'kept.jpg',
      correctedWidth: 80,
      correctedHeight: 40,
      orientation: 1,
      aspect: 2,
    })
    const thumb = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0xbb])
    parseJpegHead.mockResolvedValue({
      thumbJpeg: thumb,
      width: 80,
      height: 40,
      orientation: 1,
      correctedWidth: 80,
      correctedHeight: 40,
    })

    await runJpegHeadPass([{ assetId: 'dims', file: jpegFile('kept.jpg') }])

    expect(getThumbUrl('dims')).toMatch(/^blob:/)
    expect(getBookStoreSnapshot().sessionMeta.get('dims')?.name).toBe(
      'kept.jpg',
    )
    expect(getBookStoreSnapshot().sessionMeta.get('dims')?.aspect).toBe(2)
  })

  it('computes aspect from corrected dimensions', async () => {
    parseJpegHead.mockResolvedValue({
      thumbJpeg: null,
      width: 300,
      height: 100,
      orientation: 1,
      correctedWidth: 300,
      correctedHeight: 100,
    })

    await runJpegHeadPass([{ assetId: 'asp', file: jpegFile('wide.jpg') }])

    expect(getBookStoreSnapshot().sessionMeta.get('asp')?.aspect).toBe(3)
  })

  it('patches folder manifest dims when the asset exists in the book', async () => {
    const patch = vi.spyOn(folderManifestWrite, 'tryPatchManifestFromAsset')
    enqueueGalleryAssets([
      {
        assetId: 'lib',
        meta: {
          name: 'lib.jpg',
          correctedWidth: 1,
          correctedHeight: 1,
          orientation: 1,
          aspect: 1,
        },
        asset: {
          sourceRootId: 'root-a',
          relativePath: 'lib.jpg',
          byteSize: 4,
          mtimeMs: 1,
        },
      },
    ])
    parseJpegHead.mockResolvedValue({
      thumbJpeg: null,
      width: 50,
      height: 25,
      orientation: 3,
      correctedWidth: 50,
      correctedHeight: 25,
    })

    await runJpegHeadPass([{ assetId: 'lib', file: jpegFile('lib.jpg') }])

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRootId: 'root-a',
        relativePath: 'lib.jpg',
      }),
      { width: 50, height: 25, orientation: 3 },
    )
    patch.mockRestore()
  })

  it('swallows parse failures without throwing', async () => {
    parseJpegHead.mockRejectedValue(new Error('head blew up'))
    await expect(
      runJpegHeadPass([{ assetId: 'bad', file: jpegFile('bad.jpg') }]),
    ).resolves.toBeUndefined()
  })

  it('skips the head read when real dims and a hot thumb already exist', async () => {
    setAssetSessionMeta('done', {
      name: 'done.jpg',
      correctedWidth: 120,
      correctedHeight: 80,
      orientation: 1,
      aspect: 1.5,
    })
    setThumbUrl(
      'done',
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer,
      'image/jpeg',
    )

    await runJpegHeadPass([{ assetId: 'done', file: jpegFile('done.jpg') }])

    expect(parseJpegHead).not.toHaveBeenCalled()
  })

  it('ignores partial corrected dimensions from the parse', async () => {
    parseJpegHead.mockResolvedValue({
      thumbJpeg: null,
      width: 10,
      height: null,
      orientation: 1,
      correctedWidth: 10,
      correctedHeight: null,
    })

    await runJpegHeadPass([
      { assetId: 'partial', file: jpegFile('partial.jpg') },
    ])

    expect(getBookStoreSnapshot().sessionMeta.get('partial')).toBeUndefined()
  })

  it('copies EXIF thumb bytes into the thumb cache', async () => {
    const setSpy = vi.spyOn(Uint8Array.prototype, 'set')
    const thumb = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0xdd])
    parseJpegHead.mockResolvedValue({
      thumbJpeg: thumb,
      width: 10,
      height: 10,
      orientation: 1,
      correctedWidth: 10,
      correctedHeight: 10,
    })

    await runJpegHeadPass([{ assetId: 'setspy', file: jpegFile('setspy.jpg') }])

    expect(setSpy).toHaveBeenCalledWith(thumb)
    setSpy.mockRestore()
  })

  it('does not write session meta when corrected dims stay null', async () => {
    parseJpegHead.mockResolvedValue({
      thumbJpeg: null,
      width: null,
      height: null,
      orientation: 1,
      correctedWidth: null,
      correctedHeight: null,
    })

    await runJpegHeadPass([{ assetId: 'nodims', file: jpegFile('nodims.jpg') }])

    expect(getBookStoreSnapshot().sessionMeta.get('nodims')).toBeUndefined()
  })

  it('does not overwrite an existing hot thumb from the head pass', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:keep')
    setThumbUrl('keep', new Uint8Array([0xaa]).buffer, 'image/jpeg')
    parseJpegHead.mockResolvedValue({
      thumbJpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0xbb]),
      width: 10,
      height: 10,
      orientation: 1,
      correctedWidth: 10,
      correctedHeight: 10,
    })

    await runJpegHeadPass([{ assetId: 'keep', file: jpegFile('keep.jpg') }])

    expect(getThumbUrl('keep')).toBe('blob:keep')
  })

  it('does not overwrite existing real dims or hot thumbs', async () => {
    setAssetSessionMeta('a3', {
      name: 'c.jpg',
      correctedWidth: 100,
      correctedHeight: 50,
      orientation: 1,
      aspect: 2,
    })
    const existing = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0x11])
    setThumbUrl('a3', existing.buffer.slice(0), 'image/jpeg')
    expect(hasThumbData('a3')).toBe(true)

    await runJpegHeadPass([{ assetId: 'a3', file: jpegFile('c.jpg') }])

    expect(parseJpegHead).not.toHaveBeenCalled()
    expect(hasThumbData('a3')).toBe(true)
  })

  it('reads only the 64KiB head via File.slice', async () => {
    const { JPEG_HEAD_BYTES } = await import('../photo/jpegHead')
    parseJpegHead.mockResolvedValue({
      thumbJpeg: null,
      width: 4,
      height: 4,
      orientation: 1,
      correctedWidth: 4,
      correctedHeight: 4,
    })
    const file = jpegFile('head.jpg')
    const slice = vi.spyOn(file, 'slice')

    await runJpegHeadPass([{ assetId: 'head', file }])

    expect(slice).toHaveBeenCalledWith(0, JPEG_HEAD_BYTES)
  })
})
