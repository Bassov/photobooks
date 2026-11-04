import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, serializeBook, type Book } from '../core'
import { setCoverPhoto } from '../core/cover'
import { placeAsset } from '../core/ops/place'
import {
  makeBook,
  makeFrame,
  makeSpread,
  type BookOverrides,
} from '../core/testing/fixtures'
import {
  PUBLISHED_SCHEMA_VERSION,
  bookPublishStatus,
  parsePublished,
  publishBook,
  serializePublished,
  siteAssetIds,
  unpublishBook,
} from './publish'

const assetIds = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'] as const

function bookWith(overrides: BookOverrides): Book {
  return makeBook({
    assets: Object.fromEntries(assetIds.map((id) => [id, {}])),
    gallery: [...assetIds],
    ...overrides,
  })
}

function siteAssetsOf(book: Book): string[] {
  return siteAssetIds(publishBook({}, book, 1).revision)
}

describe('siteAssetIds', () => {
  it('lists an asset placed several times once', () => {
    const book = bookWith({
      spreads: [
        makeSpread({
          id: 's1',
          frames: [
            makeFrame({ id: 'f1', assetId: 'a1' }),
            makeFrame({ id: 'f2', assetId: 'a2' }),
          ],
        }),
        makeSpread({
          id: 's2',
          frames: [makeFrame({ id: 'f3', assetId: 'a1' })],
        }),
      ],
    })
    expect(siteAssetsOf(setCoverPhoto(book, 'a2'))).toEqual(['a2', 'a1'])
  })

  it('skips gallery assets placed nowhere and empty frames', () => {
    const book = bookWith({
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ id: 'f1' }),
            makeFrame({ id: 'f2', assetId: 'a3' }),
          ],
        }),
      ],
    })
    expect(siteAssetsOf(book)).toEqual(['a3'])
  })

  it('reads cover panels, then enabled endpapers, then spreads', () => {
    const book = bookWith({
      cover: {
        ...makeBook().cover,
        front: { assetId: 'a1', text: '' },
        spine: { assetId: 'a2', text: '' },
        back: { assetId: 'a3', text: '' },
      },
      endpapers: { front: { assetId: 'a4' }, back: { assetId: 'a5' } },
      spreads: [makeSpread({ frames: [makeFrame({ assetId: 'a6' })] })],
    })
    expect(siteAssetsOf(book)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])
  })

  it('leaves out endpapers when they are disabled', () => {
    const book = bookWith({
      settings: { endpapers: { enabled: false, same: false } },
      endpapers: { front: { assetId: 'a4' }, back: { assetId: 'a5' } },
      spreads: [makeSpread({ frames: [makeFrame({ assetId: 'a6' })] })],
    })
    expect(siteAssetsOf(book)).toEqual(['a6'])
  })

  it('includes parent frames, overrides and the spread own frames', () => {
    const book = bookWith({
      parents: [
        {
          id: 'p1',
          name: 'P',
          guides: [],
          frames: [
            makeFrame({ id: 'pf1', assetId: 'a1' }),
            makeFrame({ id: 'pf2', assetId: 'a2' }),
            makeFrame({ id: 'pf3', assetId: 'a3' }),
          ],
        },
      ],
      defaultParentId: 'p1',
      spreads: [
        makeSpread({
          frames: [makeFrame({ id: 'own', assetId: 'a6' })],
          parentOverrides: {
            hiddenIds: ['pf2'],
            frames: [
              { ...makeFrame({ id: 'c3', assetId: 'a4' }), overridesId: 'pf3' },
            ],
          },
        }),
      ],
    })
    expect(siteAssetsOf(book)).toEqual(['a1', 'a4', 'a6'])
  })

  it('skips parents no spread uses and ids missing from the asset map', () => {
    const book = bookWith({
      parents: [
        {
          id: 'unused',
          name: 'U',
          guides: [],
          frames: [makeFrame({ assetId: 'a1' })],
        },
      ],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ id: 'f1', assetId: 'ghost' }),
            makeFrame({ id: 'f2', assetId: 'a2' }),
          ],
        }),
      ],
    })
    expect(siteAssetsOf(book)).toEqual(['a2'])
  })

  it('reads the revision only: a later placement is not listed', () => {
    const book = bookWith({
      spreads: [
        makeSpread({
          id: 's1',
          frames: [
            makeFrame({ id: 'f1', assetId: 'a1' }),
            makeFrame({ id: 'f2' }),
          ],
        }),
      ],
    })
    const { revision } = publishBook({}, book, 1)
    const edited = placeAsset(book, 's1', 'f2', 'a2')
    expect(siteAssetsOf(edited)).toEqual(['a1', 'a2'])
    expect(siteAssetIds(revision)).toEqual(['a1'])
  })
})

describe('publish status', () => {
  it('is draft without a library entry', () => {
    expect(bookPublishStatus({}, 'book-1')).toBe('draft')
    expect(bookPublishStatus({ books: {} }, 'book-1')).toBe('draft')
  })

  it('publish then unpublish keeps other entries', () => {
    const other = { other: { status: 'published' as const } }
    const { meta } = publishBook({ books: other }, makeBook(), 5)
    expect(meta.books).toEqual({ ...other, 'book-1': { status: 'published' } })
    expect(unpublishBook(meta, 'book-1').books).toEqual({
      ...other,
      'book-1': { status: 'draft' },
    })
  })
})

describe('published.json document', () => {
  const book = bookWith({})
  const serialized = serializePublished(publishBook({}, book, 42).revision)

  it('round-trips through JSON', () => {
    expect(serialized).toMatchObject({
      schemaVersion: PUBLISHED_SCHEMA_VERSION,
      bookId: 'book-1',
      publishedAtMs: 42,
    })
    expect(parsePublished(JSON.parse(JSON.stringify(serialized)))).toEqual({
      ok: true,
      revision: { bookId: 'book-1', publishedAtMs: 42, book },
    })
  })

  it.each([
    ['not an object', []],
    ['no schemaVersion', { ...serialized, schemaVersion: undefined }],
    ['older schemaVersion', { ...serialized, schemaVersion: 0 }],
    ['text schemaVersion', { ...serialized, schemaVersion: '1' }],
    ['no publish time', { ...serialized, publishedAtMs: undefined }],
    ['infinite publish time', { ...serialized, publishedAtMs: Infinity }],
    ['invalid book', { ...serialized, book: { id: 'book-1' } }],
    ['book id mismatch', { ...serialized, bookId: 'other' }],
  ])('fails %s as corrupted', (_name, input) => {
    expect(parsePublished(input)).toEqual({ ok: false, code: 'corrupted' })
  })

  it.each([
    [
      'revision',
      { ...serialized, schemaVersion: PUBLISHED_SCHEMA_VERSION + 1 },
    ],
    [
      'book',
      {
        ...serialized,
        book: {
          ...serializedBook(book),
          schemaVersion: CURRENT_SCHEMA_VERSION + 1,
        },
      },
    ],
  ])('fails a newer %s schema as newer-schema', (_name, input) => {
    expect(parsePublished(input)).toEqual({ ok: false, code: 'newer-schema' })
  })
})

function serializedBook(book: Book): Record<string, unknown> {
  return serializeBook(book) as Record<string, unknown>
}
