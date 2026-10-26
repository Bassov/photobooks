import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { InspectorStub } from './InspectorStub'

describe('InspectorStub', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders stub inspector copy', () => {
    render(<InspectorStub />)
    expect(screen.getByTestId('inspector-stub')).toBeTruthy()
    expect(screen.getByText('Inspector')).toBeTruthy()
    expect(
      screen.getByText(/Select a frame on the canvas to edit crop/),
    ).toBeTruthy()
  })
})
