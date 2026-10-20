import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createRootTree } from './rootTree'

vi.mock('../App', () => ({
  default: function MockApp() {
    return <div data-testid="mock-app">app</div>
  },
}))

describe('createRootTree', () => {
  it('renders the specimen page for ?specimen', () => {
    render(createRootTree('?specimen'))
    expect(screen.getByTestId('specimen')).toBeTruthy()
  })

  it('renders App otherwise', () => {
    render(createRootTree(''))
    expect(screen.getByTestId('mock-app')).toBeTruthy()
  })
})
