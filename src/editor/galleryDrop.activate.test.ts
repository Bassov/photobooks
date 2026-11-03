import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addToGallery, placeAsset } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  STATUS_MOVED,
  STATUS_SELECTED,
  getEditorStatus,
  setEditorStatus,
} from './editorStatus'
import {
  getFrameSelection,
  getFrameSource,
  resetFrameSelection,
} from './frameSelection'
import { activateFrame } from './galleryDrop'

const ID = 'spread-1'

function load(): void {
  let book = makeBook({
    spreads: [
      makeSpread({
        frames: [
          makeFrame({ id: 'filled-a' }),
          makeFrame({ id: 'filled-b', z: 1 }),
          makeFrame({ id: 'empty-a', z: 2 }),
          makeFrame({ id: 'empty-b', z: 3 }),
        ],
      }),
    ],
  })
  book = addToGallery(book, ['a', 'b'])
  book = placeAsset(book, ID, 'filled-a', 'a')
  book = placeAsset(book, ID, 'filled-b', 'b')
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function assetOf(frameId: string): string | undefined {
  return getBookStoreSnapshot().book.spreads[0]?.frames.find(
    (f) => f.id === frameId,
  )?.assetId
}

describe('activateFrame', () => {
  beforeEach(() => {
    load()
    setEditorStatus('')
  })

  afterEach(() => {
    resetFrameSelection()
    resetBookStore()
    setEditorStatus('')
  })

  it('selects a filled frame and announces it', () => {
    activateFrame(ID, 'filled-a', true)
    expect(getFrameSource()).toEqual({ spreadId: ID, frameId: 'filled-a' })
    expect(getEditorStatus()).toBe(STATUS_SELECTED)
  })

  it('selects an empty frame quietly', () => {
    activateFrame(ID, 'empty-a', false)
    expect(getFrameSource()).toEqual({ spreadId: ID, frameId: 'empty-a' })
    expect(getEditorStatus()).toBe('')
  })

  it('clicking the selected frame again clears the selection', () => {
    activateFrame(ID, 'empty-a', false)
    activateFrame(ID, 'empty-a', false)
    expect(getFrameSource()).toBeNull()
  })

  it('an empty selected frame hands the selection on without moving a photo', () => {
    activateFrame(ID, 'empty-a', false)
    activateFrame(ID, 'filled-a', true)
    expect(getFrameSource()).toEqual({ spreadId: ID, frameId: 'filled-a' })
    expect(assetOf('filled-a')).toBe('a')
    expect(assetOf('empty-a')).toBeUndefined()
    expect(getEditorStatus()).toBe(STATUS_SELECTED)

    resetFrameSelection()
    activateFrame(ID, 'empty-a', false)
    activateFrame(ID, 'empty-b', false)
    expect(getFrameSource()).toEqual({ spreadId: ID, frameId: 'empty-b' })
  })

  it('a filled selected frame still moves its photo to an empty one', () => {
    activateFrame(ID, 'filled-a', true)
    activateFrame(ID, 'empty-a', false)
    expect(assetOf('empty-a')).toBe('a')
    expect(assetOf('filled-a')).toBeUndefined()
    expect(getFrameSource()).toBeNull()
    expect(getEditorStatus()).toBe(STATUS_MOVED)
  })

  it('Shift toggles frames into a set without swapping photos', () => {
    activateFrame(ID, 'filled-a', true, true)
    activateFrame(ID, 'filled-b', true, true, true)
    expect(assetOf('filled-a')).toBe('a')
    expect(assetOf('filled-b')).toBe('b')
    expect(getFrameSource()).toBeNull()
    expect(getFrameSelection()?.frameIds).toEqual(['filled-a', 'filled-b'])
    expect(getEditorStatus()).toBe('')

    // Shift+Enter (keyboard) toggles too; back to one is the single selection.
    activateFrame(ID, 'filled-b', true, false, true)
    expect(getFrameSource()).toEqual({ spreadId: ID, frameId: 'filled-a' })
    expect(getEditorStatus()).toBe(STATUS_SELECTED)
    activateFrame(ID, 'filled-a', true, true, true)
    expect(getFrameSelection()).toBeNull()
  })

  it('a plain click inside a set collapses it to that frame, no swap', () => {
    activateFrame(ID, 'filled-a', true, true, true)
    activateFrame(ID, 'filled-b', true, true, true)
    activateFrame(ID, 'empty-a', false, true, true)
    activateFrame(ID, 'filled-b', true, true)
    expect(getFrameSource()).toEqual({ spreadId: ID, frameId: 'filled-b' })
    expect(assetOf('filled-a')).toBe('a')
    expect(assetOf('filled-b')).toBe('b')
    expect(getEditorStatus()).toBe(STATUS_SELECTED)
  })
})
