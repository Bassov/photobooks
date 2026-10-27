import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBookWithAsset } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { enterCropMode, exitCropMode } from './cropMode'
import { InspectorStub } from './InspectorStub'

function crop() {
  return getBookStoreSnapshot().book.spreads[0]?.frames[0]?.crop
}

describe('InspectorStub', () => {
  afterEach(() => {
    cleanup()
    exitCropMode()
    resetBookStore()
  })

  it('shows the hint and no crop section outside crop mode', () => {
    render(<InspectorStub />)
    expect(screen.getByTestId('inspector-stub')).toBeTruthy()
    expect(screen.getByText('Inspector')).toBeTruthy()
    expect(screen.getByText(/Double-click a photo to crop it/)).toBeTruthy()
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it('zooms via the slider and resets to cover', () => {
    resetBookStore({
      book: makeBookWithAsset('a'),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<InspectorStub />)
    act(() => {
      enterCropMode('spread-1', 'frame-1')
    })
    const reset = screen.getByTestId<HTMLButtonElement>('crop-reset')
    expect(reset.disabled).toBe(true)

    fireEvent.change(screen.getByTestId('crop-zoom'), {
      target: { value: '2' },
    })
    expect(crop()?.zoom).toBe(2)
    expect(reset.disabled).toBe(false)

    fireEvent.click(reset)
    expect(crop()).toEqual({ zoom: 1, center: { x: 0.5, y: 0.5 } })
  })

  it('drops the section when crop mode ends', () => {
    resetBookStore({
      book: makeBookWithAsset('a'),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<InspectorStub />)
    act(() => {
      enterCropMode('spread-1', 'frame-1')
    })
    expect(screen.getByTestId('inspector-fit-crop')).toBeTruthy()
    act(() => {
      exitCropMode()
    })
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })
})
