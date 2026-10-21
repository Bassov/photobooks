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

describe('PasteboardEmptyGuidance', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetNoPhotosFoundHint()
    setEditorStatus('')
  })

  it('shows the empty card with both import actions when gallery is empty', () => {
    const onAddFolder = vi.fn()
    const onAddPhotos = vi.fn()
    render(
      <PasteboardEmptyGuidance
        onAddFolder={onAddFolder}
        onAddPhotos={onAddPhotos}
        importDisabled={false}
      />,
    )

    expect(screen.getByTestId('pasteboard-empty-card')).toBeTruthy()
    expect(screen.getByText('Start with your photos')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add folder…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add photos…' }))
    expect(onAddFolder).toHaveBeenCalledTimes(1)
    expect(onAddPhotos).toHaveBeenCalledTimes(1)
  })

  const noopImport = (): Promise<void> => Promise.resolve()

  it('shows No photos found after a zero-photo folder import', () => {
    setNoPhotosFoundHint(true)
    render(
      <PasteboardEmptyGuidance
        onAddFolder={noopImport}
        onAddPhotos={noopImport}
        importDisabled={false}
      />,
    )
    expect(screen.getByText('No photos found in that folder')).toBeTruthy()
  })

  it('shows the placement hint when photos exist and nothing is placed', () => {
    seedGallery(1)
    render(
      <PasteboardEmptyGuidance
        onAddFolder={noopImport}
        onAddPhotos={noopImport}
        importDisabled={false}
      />,
    )
    expect(screen.getByTestId('pasteboard-placement-hint')).toBeTruthy()
    expect(screen.queryByTestId('pasteboard-empty-card')).toBeNull()
    expect(getEditorStatus()).toBe(STATUS_PLACEMENT_HINT)
  })

  it('hides the hint after the first placement and when placements already exist', () => {
    const ids = seedGallery(1)
    const { rerender } = render(
      <PasteboardEmptyGuidance
        onAddFolder={noopImport}
        onAddPhotos={noopImport}
        importDisabled={false}
      />,
    )
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
    rerender(
      <PasteboardEmptyGuidance
        onAddFolder={noopImport}
        onAddPhotos={noopImport}
        importDisabled={false}
      />,
    )
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
    rerender(
      <PasteboardEmptyGuidance
        onAddFolder={noopImport}
        onAddPhotos={noopImport}
        importDisabled={false}
      />,
    )
    expect(screen.queryByTestId('pasteboard-placement-hint')).toBeNull()
  })

  it('announces the placement hint once per visibility, not per re-render', () => {
    seedGallery(1)
    const { rerender } = render(
      <PasteboardEmptyGuidance
        onAddFolder={noopImport}
        onAddPhotos={noopImport}
        importDisabled={false}
      />,
    )
    expect(getEditorStatus()).toBe(STATUS_PLACEMENT_HINT)
    setEditorStatus('other')
    rerender(
      <PasteboardEmptyGuidance
        onAddFolder={noopImport}
        onAddPhotos={noopImport}
        importDisabled={false}
      />,
    )
    expect(getEditorStatus()).toBe('other')
  })

  it('clears the no-photos line when the gallery gains photos', () => {
    setNoPhotosFoundHint(true)
    const { rerender } = render(
      <PasteboardEmptyGuidance
        onAddFolder={noopImport}
        onAddPhotos={noopImport}
        importDisabled={false}
      />,
    )
    expect(screen.getByText('No photos found in that folder')).toBeTruthy()
    act(() => {
      seedGallery(1)
    })
    rerender(
      <PasteboardEmptyGuidance
        onAddFolder={noopImport}
        onAddPhotos={noopImport}
        importDisabled={false}
      />,
    )
    expect(getNoPhotosFoundHint()).toBe(false)
    expect(screen.queryByText('No photos found in that folder')).toBeNull()
  })
})
