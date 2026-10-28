import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { addToGallery, placeAsset } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { resetCameraStore } from './cameraStore'
import { getEditorStatus } from './editorStatus'
import assert from 'node:assert/strict'
import {
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
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
})
