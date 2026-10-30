import { describe, expect, it } from 'vitest'
import {
  applyBookOp,
  checkBookInvariants,
  removeManyFromGallery,
} from './index'
import { defaultCover, setCoverPhoto, setCoverText } from './cover'
import { makeBook, makeBookWithAsset } from './testing/fixtures'

describe('cover ops', () => {
  it('a new book cover text is its title; the back starts blank', () => {
    expect(defaultCover('Lake trip')).toEqual({
      front: { text: 'Lake trip' },
      spine: { text: 'Lake trip' },
      back: { text: '' },
    })
  })

  it('setCoverText edits one panel and keeps the others', () => {
    const book = makeBook({ cover: defaultCover('A') })
    const next = setCoverText(book, 'back', 'Thanks')
    expect(next.cover.back.text).toBe('Thanks')
    expect(next.cover.front).toBe(book.cover.front)
    expect(next.cover.spine).toBe(book.cover.spine)
  })

  it('setCoverText with the same text returns the same book', () => {
    const book = makeBook({ cover: defaultCover('A') })
    expect(setCoverText(book, 'front', 'A')).toBe(book)
  })

  it('setCoverPhoto puts a gallery photo on the front with a centered crop', () => {
    const book = makeBookWithAsset('a1', { place: false })
    const next = setCoverPhoto(book, 'a1')
    expect(next.cover.front).toMatchObject({
      assetId: 'a1',
      crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
    })
    expect(checkBookInvariants(next).ok).toBe(true)
    expect(setCoverPhoto(next, 'a1')).toBe(next)
  })

  it('setCoverPhoto ignores an asset outside the gallery', () => {
    const book = makeBook()
    expect(setCoverPhoto(book, 'ghost')).toBe(book)
  })

  it('applyBookOp routes the cover ops', () => {
    const book = makeBookWithAsset('a1', { place: false })
    const withPhoto = applyBookOp(book, {
      type: 'setCoverPhoto',
      assetId: 'a1',
    })
    const titled = applyBookOp(withPhoto, {
      type: 'setCoverText',
      panel: 'spine',
      text: 'S',
    })
    expect(titled.cover.front.assetId).toBe('a1')
    expect(titled.cover.spine.text).toBe('S')
  })

  it('removing the cover photo from the gallery clears it from the cover', () => {
    const book = setCoverPhoto(makeBookWithAsset('a1', { place: false }), 'a1')
    const next = removeManyFromGallery(book, ['a1'])
    expect(next.cover.front).toEqual({ text: book.cover.front.text })
    expect(next.cover.front).not.toHaveProperty('assetId')
    expect(next.cover.front).not.toHaveProperty('crop')
  })

  it('removing an unrelated asset leaves the cover untouched', () => {
    const base = makeBookWithAsset('a1', { place: false })
    const book = setCoverPhoto(base, 'a1')
    const other = removeManyFromGallery(
      {
        ...book,
        assets: { ...book.assets, a2: {} },
        gallery: [...book.gallery, 'a2'],
      },
      ['a2'],
    )
    expect(other.cover).toBe(book.cover)
  })

  it('removing a photo clears the endpaper that used it', () => {
    const book = makeBookWithAsset('a1', { place: false })
    const next = removeManyFromGallery(
      { ...book, endpapers: { front: { assetId: 'a1' }, back: {} } },
      ['a1'],
    )
    expect(next.endpapers.front).toEqual({})
  })

  it('setCoverPhoto needs the asset both in the gallery and in assets', () => {
    const inAssetsOnly = makeBook({ assets: { a1: {} }, gallery: [] })
    expect(setCoverPhoto(inAssetsOnly, 'a1')).toBe(inAssetsOnly)
    const inGalleryOnly = makeBook({ assets: {}, gallery: ['a1'] })
    expect(setCoverPhoto(inGalleryOnly, 'a1')).toBe(inGalleryOnly)
  })

  it('removing a photo clears every cover panel and endpaper that used it', () => {
    const base = makeBookWithAsset('a1', { place: false })
    const used = {
      assetId: 'a1',
      crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
    }
    const book = {
      ...base,
      cover: {
        front: { text: 'F', ...used },
        spine: { text: 'S', ...used },
        back: { text: 'B', ...used },
      },
      endpapers: { front: { ...used }, back: { ...used } },
    }
    const next = removeManyFromGallery(book, ['a1'])
    expect(next.cover).toEqual({
      front: { text: 'F' },
      spine: { text: 'S' },
      back: { text: 'B' },
    })
    expect(next.endpapers).toEqual({ front: {}, back: {} })
  })

  it('a panel that does not use the removed photo keeps its identity', () => {
    const base = makeBookWithAsset('a1', { place: false })
    const book = {
      ...base,
      assets: { ...base.assets, a2: {} },
      gallery: [...base.gallery, 'a2'],
      cover: {
        front: { text: 'F', assetId: 'a2' },
        spine: { text: 'S', assetId: 'a1' },
        back: { text: 'B' },
      },
    }
    const next = removeManyFromGallery(book, ['a1'])
    expect(next.cover.front).toBe(book.cover.front)
    expect(next.cover.back).toBe(book.cover.back)
    expect(next.cover.spine).toEqual({ text: 'S' })
  })
})
