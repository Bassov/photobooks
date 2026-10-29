import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetBookStore } from './bookStore'
import {
  type CameraCommands,
  getCameraCommands,
  registerCameraCommands,
  resetCameraStore,
} from './cameraStore'
import { Pasteboard } from './Pasteboard'
import { CameraTestBar } from './testing/PasteboardWithCameraBar'

function makeCommands(): CameraCommands {
  return {
    fitSpread: vi.fn(),
    fitWidth: vi.fn(),
    actualSize: vi.fn(),
    zoomTo: vi.fn(),
    fitSpreadZoom: vi.fn(() => null),
  }
}

describe('camera command registry', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetCameraStore()
  })

  it('keeps the current registration when a stale one unregisters', () => {
    const first = makeCommands()
    const second = makeCommands()
    const unregisterFirst = registerCameraCommands(first)
    const unregisterSecond = registerCameraCommands(second)

    unregisterFirst()
    expect(getCameraCommands()).toBe(second)

    unregisterSecond()
    expect(getCameraCommands()).toBeNull()
  })

  it('routes each test-bar button to its own command', () => {
    const commands = makeCommands()
    const unregister = registerCameraCommands(commands)
    render(<CameraTestBar />)

    fireEvent.click(screen.getByRole('button', { name: /Fit spread/ }))
    expect(commands.fitSpread).toHaveBeenCalledTimes(1)
    expect(commands.fitWidth).not.toHaveBeenCalled()
    expect(commands.actualSize).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Fit width' }))
    expect(commands.fitWidth).toHaveBeenCalledTimes(1)
    expect(commands.actualSize).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '100%' }))
    expect(commands.actualSize).toHaveBeenCalledTimes(1)
    expect(commands.fitSpread).toHaveBeenCalledTimes(1)
    unregister()
  })

  it('ignores test-bar clicks when no commands are registered', () => {
    render(<CameraTestBar />)

    expect(getCameraCommands()).toBeNull()
    for (const name of [/Fit spread/, 'Fit width', '100%']) {
      expect(() =>
        fireEvent.click(screen.getByRole('button', { name })),
      ).not.toThrow()
    }
  })
})

describe('Pasteboard camera registration', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetCameraStore()
  })

  it('registers once on mount, survives rerender, and clears on unmount', () => {
    const { rerender, unmount } = render(<Pasteboard />)
    const registered = getCameraCommands()
    expect(registered).not.toBeNull()

    rerender(<Pasteboard />)
    expect(getCameraCommands()).toBe(registered)

    unmount()
    expect(getCameraCommands()).toBeNull()
  })
})
