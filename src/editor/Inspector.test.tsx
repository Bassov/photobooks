import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBookWithAsset } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { enterCropMode, exitCropMode } from './cropMode'
import { resetFrameSelection, setFrameSource } from './frameSelection'
import { Inspector } from './Inspector'
import { setActiveSpreadId } from './photoRootSession'

function crop() {
  return getBookStoreSnapshot().book.spreads[0]?.frames[0]?.crop
}

function seed() {
  resetBookStore({
    book: makeBookWithAsset('a'),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('Inspector', () => {
  afterEach(() => {
    cleanup()
    exitCropMode()
    resetFrameSelection()
    setActiveSpreadId(null)
    resetBookStore()
  })

  it('shows the empty hint and no crop section with nothing selected', () => {
    render(<Inspector />)
    const panel = screen.getByTestId('inspector-panel')
    expect(panel.getAttribute('data-inspector-view')).toBe('empty')
    expect(screen.getByTestId('inspector-empty').textContent).toMatch(
      /Select a spread or a photo/,
    )
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it('shows spread properties for the active spread, Esc returns to empty', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setActiveSpreadId('spread-1')
    })
    const panel = screen.getByTestId('inspector-panel')
    expect(panel.getAttribute('data-inspector-view')).toBe('spread')
    expect(screen.getByTestId('inspector-name').textContent).toBe('Cover')
    expect(screen.getByText('Frames')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel.getAttribute('data-inspector-view')).toBe('empty')
  })

  it('shows photo identity for a selected frame', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    expect(
      screen.getByTestId('inspector-panel').getAttribute('data-inspector-view'),
    ).toBe('frame')
    expect(screen.getByTestId('inspector-name').textContent).toBe('a')
    expect(screen.getByText('Used')).toBeTruthy()
  })

  it('collapses through the header button', () => {
    const onCollapse = vi.fn()
    render(<Inspector onCollapse={onCollapse} />)
    fireEvent.click(screen.getByTestId('panel-collapse-right'))
    expect(onCollapse).toHaveBeenCalled()
  })

  it('zooms via the slider and resets to cover', () => {
    seed()
    render(<Inspector />)
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

  it('shows no crop section when the target frame has no photo', () => {
    seed()
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-1', 'missing')
    })
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it('drops the section when crop mode ends', () => {
    seed()
    render(<Inspector />)
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
