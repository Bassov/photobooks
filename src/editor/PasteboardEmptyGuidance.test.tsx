import assert from 'node:assert/strict'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { placeAsset } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  getBookStoreSnapshot,
  getHasAnyPlacementSnapshot,
  resetBookStore,
} from './bookStore'
import {
  STATUS_PLACEMENT_HINT,
  getEditorStatus,
  setEditorStatus,
} from './editorStatus'
import {
  getNoPhotosFoundHint,
  resetNoPhotosFoundHint,
  setNoPhotosFoundHint,
} from './emptyGalleryHint'
import { seedGallery } from './gallery.test-helpers'
import { PasteboardEmptyGuidance } from './PasteboardEmptyGuidance'

const CHOOSE_LABEL = 'Choose photo folder…'

describe('PasteboardEmptyGuidance', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetNoPhotosFoundHint()
    setEditorStatus('')
  })

  it('shows the empty card with choose-folder action when gallery is empty', () => {
    const onChoosePhotoFolder = vi.fn()
    render(
      <PasteboardEmptyGuidance
        onChoosePhotoFolder={onChoosePhotoFolder}
        photoFolderLabel={CHOOSE_LABEL}
        importDisabled={false}
      />,
    )

    expect(screen.getByTestId('pasteboard-empty-card')).toBeTruthy()
    expect(screen.getByText('Start with your photos')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: CHOOSE_LABEL }))
    expect(onChoosePhotoFolder).toHaveBeenCalledTimes(1)
  })

  const noopImport = (): Promise<void> => Promise.resolve()

  const defaultProps = {
    onChoosePhotoFolder: noopImport,
    photoFolderLabel: CHOOSE_LABEL,
    importDisabled: false,
  }

  it('shows No photos found after a zero-photo folder import', () => {
    setNoPhotosFoundHint(true)
    render(<PasteboardEmptyGuidance {...defaultProps} />)
    expect(screen.getByText('No photos found in that folder')).toBeTruthy()
  })

  it('shows the placement hint when photos exist and nothing is placed', () => {
    seedGallery(1)
    render(<PasteboardEmptyGuidance {...defaultProps} />)
    const hint = screen.getByTestId('pasteboard-placement-hint')
    expect(hint).toBeTruthy()
    expect(hint.getAttribute('role')).toBe('status')
    expect(hint.textContent).toBe(STATUS_PLACEMENT_HINT)
    expect(screen.queryByTestId('pasteboard-empty-card')).toBeNull()
  })

  it('hides the hint after the first placement and when placements already exist', () => {
    const ids = seedGallery(1)
    const { rerender } = render(<PasteboardEmptyGuidance {...defaultProps} />)
    expect(screen.getByTestId('pasteboard-placement-hint')).toBeTruthy()

    const snap = getBookStoreSnapshot()
    const spread = snap.book.spreads[0]
    const frameId = spread?.frames[0]?.id
    const assetId = ids[0]
    assert(
      spread !== undefined && frameId !== undefined && assetId !== undefined,
    )
    act(() => {
      resetBookStore({
        book: placeAsset(snap.book, spread.id, frameId, assetId),
        sessionMeta: snap.sessionMeta,
        importRunning: false,
        importExpectedCount: 0,
      })
    })
    rerender(<PasteboardEmptyGuidance {...defaultProps} />)
    expect(getHasAnyPlacementSnapshot()).toBe(true)
    expect(screen.queryByTestId('pasteboard-placement-hint')).toBeNull()

    resetBookStore({
      book: makeBook({
        id: 'placed',
        gallery: ['a1'],
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
    rerender(<PasteboardEmptyGuidance {...defaultProps} />)
    expect(screen.queryByTestId('pasteboard-placement-hint')).toBeNull()
  })

  it('does not overwrite the shared editor-status line with the placement hint', () => {
    setEditorStatus('Book restored')
    seedGallery(1)
    const { rerender } = render(<PasteboardEmptyGuidance {...defaultProps} />)
    expect(screen.getByTestId('pasteboard-placement-hint').textContent).toBe(
      STATUS_PLACEMENT_HINT,
    )
    expect(
      screen.getByTestId('pasteboard-placement-hint').getAttribute('aria-live'),
    ).toBe('polite')
    rerender(<PasteboardEmptyGuidance {...defaultProps} />)
    expect(getEditorStatus()).toBe('Book restored')
  })

  it('clears the no-photos line when the gallery gains photos', () => {
    setNoPhotosFoundHint(true)
    const { rerender } = render(<PasteboardEmptyGuidance {...defaultProps} />)
    expect(screen.getByText('No photos found in that folder')).toBeTruthy()
    act(() => {
      seedGallery(1)
    })
    rerender(<PasteboardEmptyGuidance {...defaultProps} />)
    expect(getNoPhotosFoundHint()).toBe(false)
    expect(screen.queryByText('No photos found in that folder')).toBeNull()
  })
})
