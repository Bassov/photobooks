import { afterEach, describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { resetBookStore } from './bookStore'
import { editorHasContent } from './editorHasContent'
import { seedGallery } from './gallery.test-helpers'

describe('editorHasContent', () => {
  afterEach(() => {
    resetBookStore()
  })

  it('is false for an empty session book', () => {
    resetBookStore({
      book: makeBook({
        id: 'empty',
        gallery: [],
        spreads: [makeSpread({ id: 's0', frames: [] })],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    expect(editorHasContent()).toBe(false)
  })

  it('is true when the gallery has photos', () => {
    seedGallery(1)
    expect(editorHasContent()).toBe(true)
  })

  it('is true when a frame has a placement', () => {
    resetBookStore({
      book: makeBook({
        id: 'placed',
        gallery: [],
        spreads: [
          makeSpread({
            id: 's0',
            frames: [makeFrame({ id: 'f0', assetId: 'a1' })],
          }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    expect(editorHasContent()).toBe(true)
  })
})
