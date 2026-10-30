import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  items: [] as { assetId?: string }[] | undefined,
  missing: new Set<string>(),
  spreadListeners: new Set<() => void>(),
  relinkListeners: new Set<() => void>(),
}))

vi.mock('./bookStore', () => ({
  subscribeSpread: (_id: string, listener: () => void) => {
    state.spreadListeners.add(listener)
    return () => state.spreadListeners.delete(listener)
  },
  getSpreadPaintSnapshot: () =>
    state.items === undefined
      ? undefined
      : { resolved: { items: state.items } },
}))
vi.mock('./relink', () => ({
  subscribeRelink: (listener: () => void) => {
    state.relinkListeners.add(listener)
    return () => state.relinkListeners.delete(listener)
  },
  getProblemRevisionSnapshot: () => 'rev',
}))
vi.mock('./relink/hatch', () => ({
  missingAssetChecker: () => (id: string) => state.missing.has(id),
}))

import { SpreadRowMissing } from './SpreadRowMissing'

describe('SpreadRowMissing', () => {
  beforeEach(() => {
    state.items = [{ assetId: 'a' }, { assetId: 'b' }]
    state.missing = new Set()
    state.spreadListeners.clear()
    state.relinkListeners.clear()
  })

  afterEach(cleanup)

  it('renders nothing when no placed photo is missing', () => {
    render(<SpreadRowMissing spreadId="s0" />)
    expect(screen.queryByTestId('spread-row-missing')).toBeNull()
  })

  it('renders nothing for an unknown spread', () => {
    state.items = undefined
    render(<SpreadRowMissing spreadId="s0" />)
    expect(screen.queryByTestId('spread-row-missing')).toBeNull()
  })

  it('shows the missing badge when a placed photo is missing', () => {
    state.missing = new Set(['b'])
    render(<SpreadRowMissing spreadId="s0" />)
    expect(screen.getByTestId('spread-row-missing').textContent).toBe('missing')
  })

  it('re-renders when the spread changes', () => {
    render(<SpreadRowMissing spreadId="s0" />)
    expect(screen.queryByTestId('spread-row-missing')).toBeNull()
    state.missing = new Set(['a'])
    act(() => {
      for (const l of state.spreadListeners) {
        l()
      }
    })
    expect(screen.getByTestId('spread-row-missing')).toBeTruthy()
  })

  it('re-renders when a relink event fires', () => {
    state.missing = new Set(['a'])
    render(<SpreadRowMissing spreadId="s0" />)
    expect(screen.getByTestId('spread-row-missing')).toBeTruthy()
    state.missing = new Set()
    act(() => {
      for (const l of state.relinkListeners) {
        l()
      }
    })
    expect(screen.queryByTestId('spread-row-missing')).toBeNull()
  })

  it('unsubscribes from both stores on unmount', () => {
    const { unmount } = render(<SpreadRowMissing spreadId="s0" />)
    expect(state.spreadListeners.size).toBe(1)
    expect(state.relinkListeners.size).toBe(1)
    unmount()
    expect(state.spreadListeners.size).toBe(0)
    expect(state.relinkListeners.size).toBe(0)
  })
})
