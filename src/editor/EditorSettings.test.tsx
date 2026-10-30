import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { resetBookStore } from './bookStore'
import { resetCameraStore } from './cameraStore'
import { EditorShell } from './EditorShell'
import { resetProjectSessionForTests } from './projectSession'

describe('editor top bar Settings', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetCameraStore()
    resetProjectSessionForTests()
  })

  it('opens Settings from the gear and returns with Back', () => {
    render(<EditorShell />)
    expect(screen.queryByTestId('editor-settings')).toBeNull()
    fireEvent.click(screen.getByTestId('editor-settings-open'))
    expect(screen.getByTestId('editor-settings')).toBeTruthy()
    expect(screen.getByTestId('settings-section-title').textContent).toBe(
      'Library',
    )
    // No vertical rule between the nav and content (borders are banned).
    expect(
      screen.getByTestId('settings-nav-library').parentElement?.className,
    ).not.toContain('border')
    fireEvent.click(screen.getByTestId('editor-settings-back'))
    expect(screen.queryByTestId('editor-settings')).toBeNull()
  })
})
