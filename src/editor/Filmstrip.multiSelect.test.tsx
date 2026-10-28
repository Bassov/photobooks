import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetAssetPool } from '../photo/assetPool'
import { resetBookStore } from './bookStore'
import { clearDropHover } from './dropHover'
import {
  ASSET_DRAG_MIME,
  ASSET_MULTI_MIME,
  decodeAssetIds,
} from './dropTargets'
import { Filmstrip } from './Filmstrip'
import { seedGallery } from './gallery.test-helpers'
import {
  getSelectedAssetIds,
  resetGallerySelection,
  setSelectedAssetIds,
} from './gallerySelection'
import { resetCameraStore } from './cameraStore'
import { resetThumbCache } from './thumbCache'

function dragHandle(item: HTMLElement | undefined): HTMLElement {
  const handle = item?.querySelector<HTMLElement>('.filmstrip-drag')
  if (!handle) {
    throw new Error('filmstrip-drag not found')
  }
  return handle
}

function dragStartData(element: HTMLElement): Map<string, string> {
  const data = new Map<string, string>()
  const dataTransfer = {
    effectAllowed: 'none',
    setData: (type: string, value: string) => {
      data.set(type, value)
    },
  }
  fireEvent.dragStart(element, { dataTransfer })
  return data
}

describe('Filmstrip multi-selection', () => {
  afterEach(() => {
    cleanup()
    clearDropHover()
    resetCameraStore()
    resetBookStore()
    resetThumbCache()
    resetAssetPool()
    resetGallerySelection()
  })

  it('drags the whole selection when the grabbed card is part of it', () => {
    seedGallery(3)
    setSelectedAssetIds(['seed-0', 'seed-1'])
    render(<Filmstrip />)

    const items = screen.getAllByTestId('filmstrip-item')
    const data = dragStartData(dragHandle(items[0]))

    expect(data.get(ASSET_DRAG_MIME)).toBe('seed-0')
    expect(decodeAssetIds(data.get(ASSET_MULTI_MIME) ?? '')).toEqual([
      'seed-0',
      'seed-1',
    ])
    expect(getSelectedAssetIds()).toEqual(['seed-0', 'seed-1'])
  })

  it('collapses the selection to the grabbed card when it is outside it', () => {
    seedGallery(3)
    setSelectedAssetIds(['seed-0', 'seed-1'])
    render(<Filmstrip />)

    const items = screen.getAllByTestId('filmstrip-item')
    const data = dragStartData(dragHandle(items[2]))

    expect(data.has(ASSET_MULTI_MIME)).toBe(false)
    expect(getSelectedAssetIds()).toEqual(['seed-2'])
  })

  it('treats a single selected card as a plain drag', () => {
    seedGallery(3)
    setSelectedAssetIds(['seed-0'])
    render(<Filmstrip />)

    const items = screen.getAllByTestId('filmstrip-item')
    const data = dragStartData(dragHandle(items[0]))

    expect(data.get(ASSET_DRAG_MIME)).toBe('seed-0')
    expect(data.has(ASSET_MULTI_MIME)).toBe(false)
    expect(getSelectedAssetIds()).toEqual(['seed-0'])
  })

  it('extends the selection with ctrl-click', () => {
    seedGallery(3)
    render(<Filmstrip />)

    const items = screen.getAllByTestId('filmstrip-item')
    fireEvent.click(dragHandle(items[0]))
    fireEvent.click(dragHandle(items[1]), { ctrlKey: true })

    expect(getSelectedAssetIds()).toEqual(['seed-0', 'seed-1'])
  })
})
