import assert from 'node:assert/strict'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetBookStore } from './bookStore'
import { resetFilmstripJumpForTests } from './filmstripJump'
import { seedGallery } from './gallery.test-helpers'
import { getSelectedAssetId } from './gallerySelection'
import { makeImportFileError } from './importFileError.test-helpers'
import {
  appendImportErrors,
  getImportErrors,
  isImportErrorsPanelOpen,
  openImportErrorsPanel,
  resetImportErrorsStoreForTests,
} from './importErrorsStore'
import { ImportErrorsPanel } from './ImportErrorsPanel'

afterEach(() => {
  cleanup()
  resetImportErrorsStoreForTests()
  resetFilmstripJumpForTests()
  resetBookStore()
})

describe('ImportErrorsPanel', () => {
  it('groups by reason, dismisses one entry, and clears all', () => {
    appendImportErrors([
      makeImportFileError({
        name: 'a.tif',
        message: 'Unsupported',
        reason: 'unsupported-type',
      }),
      makeImportFileError({
        name: 'b.tif',
        message: 'Unsupported',
        reason: 'unsupported-type',
      }),
      makeImportFileError({
        name: 'c.jpg',
        message: 'decode failed',
        reason: 'decode-failed',
        assetId: 'asset-c',
      }),
    ])
    openImportErrorsPanel()
    render(<ImportErrorsPanel />)
    expect(screen.getByTestId('import-errors-panel')).toBeTruthy()
    expect(screen.getByText(/Unsupported format \(2\)/)).toBeTruthy()
    expect(screen.getByText(/Couldn't decode \(1\)/)).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss error for a.tif' }),
    )
    expect(getImportErrors()).toHaveLength(2)
    expect(screen.getByText(/Unsupported format \(1\)/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(getImportErrors()).toHaveLength(0)
    expect(isImportErrorsPanelOpen()).toBe(false)
  })

  it('shows empty copy and keeps Clear all inert when there are no errors', () => {
    openImportErrorsPanel()
    render(<ImportErrorsPanel />)
    expect(screen.getByText('No import errors.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(isImportErrorsPanelOpen()).toBe(true)
    expect(getImportErrors()).toHaveLength(0)
  })

  it('jumps to a gallery tile and marks missing tiles as not imported', () => {
    const [assetId] = seedGallery(1)
    assert(assetId !== undefined, 'expected seeded asset')
    appendImportErrors([
      makeImportFileError({
        name: 'missing.tif',
        message: 'Unsupported',
        reason: 'unsupported-type',
      }),
      makeImportFileError({
        name: 'kept.jpg',
        message: 'decode failed',
        reason: 'decode-failed',
        assetId,
      }),
      makeImportFileError({
        name: 'stale.jpg',
        message: 'decode failed',
        reason: 'decode-failed',
        assetId: 'gone',
      }),
    ])
    openImportErrorsPanel()
    render(<ImportErrorsPanel />)
    expect(screen.getAllByText(/Not imported/)).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'missing.tif' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'stale.jpg' })).toBeNull()
    expect(screen.getByRole('button', { name: 'kept.jpg' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'kept.jpg' }))
    expect(getSelectedAssetId()).toBe(assetId)
    expect(isImportErrorsPanelOpen()).toBe(false)
  })
})
