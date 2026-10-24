import { describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { planRescanPriority, remainingScannedPaths } from './photoRootSession'

describe('planRescanPriority', () => {
  it('orders visible-spread placed before other open-book assets then other books', () => {
    const visible = makeSpread({
      id: 'spread-visible',
      frames: [makeFrame({ id: 'f1', assetId: 'vis' })],
    })
    const other = makeSpread({
      id: 'spread-other',
      frames: [makeFrame({ id: 'f2', assetId: 'hid' })],
    })
    const book = makeBook({
      spreads: [visible, other],
      gallery: ['vis', 'hid', 'gallery-only'],
      assets: {
        vis: {
          sourceRootId: 'root',
          relativePath: 'used/vis.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
        hid: {
          sourceRootId: 'root',
          relativePath: 'used/hid.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
        'gallery-only': {
          sourceRootId: 'root',
          relativePath: 'used/gallery.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    })

    const ordered = planRescanPriority({
      openBook: book,
      sourceRootId: 'root',
      visibleSpreadId: 'spread-visible',
      otherBookAssets: [
        {
          assetId: 'other-book',
          relativePath: 'used/other.jpg',
        },
      ],
    })

    expect(ordered.map((ref) => ref.assetId)).toEqual([
      'vis',
      'hid',
      'gallery-only',
      'other-book',
    ])
  })

  it('dedupes by relativePath and defaults visible to first spread', () => {
    const first = makeSpread({
      id: 's0',
      frames: [makeFrame({ id: 'f1', assetId: 'a' })],
    })
    const book = makeBook({
      spreads: [first],
      gallery: ['a', 'b'],
      assets: {
        a: { sourceRootId: 'root', relativePath: 'same.jpg' },
        b: { sourceRootId: 'root', relativePath: 'same.jpg' },
      },
    })
    const ordered = planRescanPriority({
      openBook: book,
      sourceRootId: 'root',
      visibleSpreadId: null,
      otherBookAssets: [],
    })
    expect(ordered).toHaveLength(1)
    expect(ordered[0]?.assetId).toBe('a')
  })
})

describe('remainingScannedPaths', () => {
  it('returns unused paths reversed away from directory order', () => {
    const rest = remainingScannedPaths(
      ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
      [{ assetId: 'x', relativePath: 'b.jpg' }],
    )
    expect(rest).toEqual(['d.jpg', 'c.jpg', 'a.jpg'])
  })

  it('returns empty when every scanned path is prioritized', () => {
    expect(
      remainingScannedPaths(
        ['a.jpg'],
        [{ assetId: 'a', relativePath: 'a.jpg' }],
      ),
    ).toEqual([])
  })
})

describe('planRescanPriority edge cases', () => {
  it('skips assets on other roots and empty relative paths', () => {
    const book = makeBook({
      gallery: ['ok', 'other-root', 'empty-path', 'missing'],
      assets: {
        ok: { sourceRootId: 'root', relativePath: 'ok.jpg', byteSize: 1 },
        'other-root': { sourceRootId: 'elsewhere', relativePath: 'x.jpg' },
        'empty-path': { sourceRootId: 'root', relativePath: '' },
      },
    })
    expect(
      planRescanPriority({
        openBook: book,
        sourceRootId: 'root',
        visibleSpreadId: null,
        otherBookAssets: [
          { assetId: 'ext', relativePath: '' },
          {
            assetId: 'ext2',
            relativePath: 'ext.jpg',
            contentHash: 'd'.repeat(64),
          },
        ],
      }).map((ref) => ref.assetId),
    ).toEqual(['ok', 'ext2'])
  })

  it('copies optional identity fields onto the ref', () => {
    const book = makeBook({
      gallery: ['full'],
      assets: {
        full: {
          sourceRootId: 'root',
          relativePath: 'full.jpg',
          byteSize: 9,
          mtimeMs: 8,
          contentHash: 'e'.repeat(64),
        },
      },
    })
    expect(
      planRescanPriority({
        openBook: book,
        sourceRootId: 'root',
        visibleSpreadId: null,
        otherBookAssets: [],
      })[0],
    ).toEqual({
      assetId: 'full',
      relativePath: 'full.jpg',
      byteSize: 9,
      mtimeMs: 8,
      contentHash: 'e'.repeat(64),
    })
  })
})
