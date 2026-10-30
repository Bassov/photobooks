import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MastersCanvasStub } from './MastersCanvasStub'
import { resetLeftPanelTabForTests, setLeftPanelTab } from './leftPanelTabStore'

describe('MastersCanvasStub', () => {
  afterEach(() => {
    cleanup()
    resetLeftPanelTabForTests()
  })

  it('renders nothing on Pages and the empty state on Masters', () => {
    render(<MastersCanvasStub />)
    expect(screen.queryByTestId('masters-canvas-stub')).toBeNull()
    act(() => {
      setLeftPanelTab('masters')
    })
    expect(screen.getByTestId('masters-canvas-stub').textContent).toContain(
      'No masters yet',
    )
    act(() => {
      setLeftPanelTab('pages')
    })
    expect(screen.queryByTestId('masters-canvas-stub')).toBeNull()
  })
})
