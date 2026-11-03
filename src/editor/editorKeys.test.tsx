import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { addToGallery, placeAsset } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { resetCameraStore } from './cameraStore'
import { getEditorStatus } from './editorStatus'
import assert from 'node:assert/strict'
import {
  getFrameSelection,
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
  toggleFrameSelection,
} from './frameSelection'
import { installEditorKeys } from './galleryDrop'
import {
  getSelectedAssetId,
  resetGallerySelection,
  setSelectedAssetId,
} from './gallerySelection'
import { Pasteboard } from './Pasteboard'

describe('editor keys', () => {
  afterEach(() => {
    cleanup()
    resetFrameSelection()
    resetGallerySelection()
    resetBookStore()
    resetCameraStore()
  })

  it('clears the move source and the gallery selection on Escape', () => {
    const stop = installEditorKeys()
    try {
      setSelectedAssetId('a')
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(getSelectedAssetId()).toBeNull()

      setFrameSource({ spreadId: 's', frameId: 'f' })
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(getFrameSource()).toBeNull()
      expect(getEditorStatus()).toBe('')
    } finally {
      stop()
    }
  })

  it('unplaces a focused filled frame on Delete and ignores Backspace in a field', () => {
    resetBookStore()
    const snap = getBookStoreSnapshot()
    const spread = snap.book.spreads[0]
    const frameId = spread?.frames[0]?.id
    assert(spread !== undefined && frameId !== undefined, 'expected a frame')
    const book = placeAsset(
      addToGallery(snap.book, ['a']),
      spread.id,
      frameId,
      'a',
    )
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const stop = installEditorKeys()
    try {
      render(
        <>
          <Pasteboard />
          <input aria-label="Note" />
        </>,
      )
      const note = screen.getByRole('textbox', { name: 'Note' })
      note.focus()
      fireEvent.keyDown(note, { key: 'Backspace' })
      expect(getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId).toBe(
        'a',
      )

      const frame = screen.getByRole('button', { name: 'Select photo to move' })
      frame.focus()
      fireEvent.keyDown(frame, { key: 'Delete' })
      expect(
        getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId,
      ).toBeUndefined()
      expect(getEditorStatus()).toBe('Photo unplaced')
      expect(document.activeElement).toBe(frame)
    } finally {
      stop()
    }
  })

  it('removes the selected empty frame on Delete / Backspace and detaches the template', () => {
    resetBookStore({
      book: makeBook({
        spreads: [
          makeSpread({
            templateId: 'one-per-page',
            frames: [
              makeFrame({ id: 'f1' }),
              makeFrame({ id: 'f2' }),
              makeFrame({ id: 'f3' }),
            ],
          }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const spread = getBookStoreSnapshot().book.spreads[0]
    assert(spread !== undefined, 'expected a spread')
    const count = spread.frames.length
    const stop = installEditorKeys()
    try {
      const note = document.createElement('input')
      document.body.append(note)
      for (const key of ['Delete', 'Backspace']) {
        const before = getBookStoreSnapshot().book.spreads[0]
        const target = before?.frames[0]?.id
        assert(target !== undefined, 'expected a frame')
        setFrameSource({ spreadId: spread.id, frameId: target })
        // Typing in a field never deletes frames.
        fireEvent.keyDown(note, { key })
        expect(getBookStoreSnapshot().book.spreads[0]?.frames).toHaveLength(
          before?.frames.length ?? 0,
        )
        fireEvent.keyDown(document.body, { key })
        const after = getBookStoreSnapshot().book.spreads[0]
        expect(after?.frames.some((f) => f.id === target)).toBe(false)
        expect(after?.templateId).toBeUndefined()
        expect(getFrameSource()).toBeNull()
      }
      expect(getBookStoreSnapshot().book.spreads[0]?.frames.length).toBe(
        count - 2,
      )
      // Nothing selected: Delete leaves the rest alone.
      fireEvent.keyDown(document.body, { key: 'Delete' })
      expect(getBookStoreSnapshot().book.spreads[0]?.frames.length).toBe(
        count - 2,
      )
      note.remove()
    } finally {
      stop()
    }
  })

  it('deletes a set of 2+ frames, locked ones too, in one undo step; Esc clears a set', () => {
    resetBookStore({
      book: makeBook({
        gallery: ['a'],
        spreads: [
          makeSpread({
            frames: [
              makeFrame({ id: 'f1', assetId: 'a' }),
              makeFrame({ id: 'f2', locked: true }),
              makeFrame({ id: 'f3' }),
              makeFrame({ id: 'f4' }),
            ],
          }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id ?? ''
    const ids = () =>
      getBookStoreSnapshot().book.spreads[0]?.frames.map((f) => f.id)
    const stop = installEditorKeys()
    try {
      toggleFrameSelection({ spreadId, frameId: 'f1' })
      toggleFrameSelection({ spreadId, frameId: 'f2' })
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(getFrameSelection()).toBeNull()

      for (const frameId of ['f1', 'f2', 'f3']) {
        toggleFrameSelection({ spreadId, frameId })
      }
      // Focus on a filled frame does not turn the set's Delete into unplace.
      const focused = document.createElement('button')
      focused.className = 'spread-frame'
      focused.setAttribute('data-filled', 'true')
      document.body.append(focused)
      const event = fireEvent.keyDown(focused, { key: 'Delete' })
      expect(event).toBe(false)
      expect(ids()).toEqual(['f4'])
      expect(getFrameSelection()).toBeNull()
      expect(getHistorySnapshot().undoLabel).toBe('Delete 3 frames')

      undoBook()
      expect(ids()).toEqual(['f1', 'f2', 'f3', 'f4'])
      focused.remove()
    } finally {
      stop()
    }
  })

  it('handles Delete on a focused empty frame and leaves a filled selection to unplace', () => {
    let book = addToGallery(
      makeBook({
        spreads: [
          makeSpread({
            templateId: 'one-per-page',
            frames: [
              makeFrame({ id: 'filled' }),
              makeFrame({ id: 'empty', z: 1 }),
            ],
          }),
        ],
      }),
      ['a'],
    )
    book = placeAsset(book, 'spread-1', 'filled', 'a')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const stop = installEditorKeys()
    try {
      render(<Pasteboard />)
      const empty = screen.getByRole('button', { name: 'Place photo' })
      setFrameSource({ spreadId: 'spread-1', frameId: 'empty' })
      empty.focus()
      // fireEvent returns false when the handler called preventDefault.
      expect(fireEvent.keyDown(empty, { key: 'Delete' })).toBe(false)
      expect(
        getBookStoreSnapshot().book.spreads[0]?.frames.map((f) => f.id),
      ).toEqual(['filled'])

      // A selected photo is not deleted from the page by an unfocused Delete.
      setFrameSource({ spreadId: 'spread-1', frameId: 'filled' })
      expect(fireEvent.keyDown(document.body, { key: 'Delete' })).toBe(true)
      expect(getBookStoreSnapshot().book.spreads[0]?.frames).toHaveLength(1)
    } finally {
      stop()
    }
  })
})
