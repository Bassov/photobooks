import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { formatZoomPercent, physicalZoom } from './camera'
import {
  commitZoom,
  getCameraCommands,
  getCommittedZoom,
  resetCameraStore,
  setLiveZoom,
} from './cameraStore'
import { resetBookStore } from './bookStore'
import { PasteboardWithCameraBar as Pasteboard } from './testing/PasteboardWithCameraBar'

const editorShellCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'EditorShell.css'),
  'utf8',
)

describe('pasteboard camera', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetCameraStore()
  })

  it('shows fit controls and keeps the mounted window when only live zoom changes', () => {
    render(<Pasteboard />)

    expect(
      screen.getByRole('button', { name: 'Fit spread (Ctrl+0)' }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fit width' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '100%' })).toBeTruthy()
    expect(screen.getByTestId('zoom-indicator').textContent).toBe('13%')
    expect(editorShellCss).not.toMatch(/\.camera-bar|\.zoom-indicator/)
    expect(screen.queryByRole('toolbar', { name: 'Camera' })).toBeNull()

    const before = screen.getAllByTestId('pasteboard-slot').length
    act(() => {
      setLiveZoom(3)
    })

    expect(screen.getAllByTestId('pasteboard-slot')).toHaveLength(before)
    expect(screen.getByTestId('zoom-indicator').textContent).toBe(
      formatZoomPercent(3),
    )
    expect(screen.getAllByTestId('spread-view')[0]?.style.width).toBe('150px')
  })

  it('exposes camera commands to the top bar and clears them on unmount', () => {
    const view = render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    Object.defineProperty(scroll, 'clientWidth', {
      configurable: true,
      get: () => 640,
    })
    Object.defineProperty(scroll, 'clientHeight', {
      configurable: true,
      get: () => 400,
    })
    const commands = getCameraCommands()
    expect(commands).not.toBeNull()

    act(() => {
      commands?.zoomTo(physicalZoom() * 2)
    })
    expect(screen.getByTestId('zoom-indicator').textContent).toBe('200%')

    act(() => {
      commands?.fitWidth()
    })
    const width = Number.parseFloat(
      screen.getAllByTestId('spread-view')[0]?.style.width ?? '',
    )
    expect(width).toBeCloseTo(640, 0)

    const fit = commands?.fitSpreadZoom() ?? 0
    expect(fit).toBeGreaterThan(0)
    expect(fit).toBeLessThanOrEqual(getCommittedZoom())

    view.unmount()
    expect(getCameraCommands()).toBeNull()
  })

  it('sets physical size when 100% is chosen', () => {
    render(<Pasteboard />)
    fireEvent.click(screen.getByRole('button', { name: '100%' }))

    expect(screen.getByTestId('zoom-indicator').textContent).toBe('100%')
    const width = Number.parseFloat(
      screen.getAllByTestId('spread-view')[0]?.style.width ?? '',
    )
    expect(width).toBeCloseTo(300 * (96 / 25.4), 2)
  })

  it('mounts the window at the committed scroll in the same commit', () => {
    const spreads = Array.from({ length: 20 }, (_, index) =>
      makeSpread({ id: `spread-${String(index)}`, frames: [] }),
    )
    resetBookStore({
      book: makeBook({ id: 'camera-window', spreads }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const clientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientHeight',
    )
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return 300
      },
    })

    try {
      render(<Pasteboard />)
      expect(
        screen.getAllByTestId('pasteboard-slot')[0]?.dataset.slotIndex,
      ).toBe('0')

      act(() => {
        commitZoom(2, 0, 4000)
      })

      expect(
        Number(
          screen.getAllByTestId('pasteboard-slot')[0]?.dataset.slotIndex ?? 0,
        ),
      ).toBeGreaterThan(0)
      expect(screen.getByTestId('pasteboard-lead')).toBeTruthy()
    } finally {
      if (clientHeight !== undefined) {
        Object.defineProperty(
          HTMLElement.prototype,
          'clientHeight',
          clientHeight,
        )
      }
    }
  })
})
