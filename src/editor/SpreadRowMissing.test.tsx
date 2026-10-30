import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  items: [] as { assetId?: string }[] | undefined,
  missing: new Set<string>(),
}))

vi.mock('./bookStore', () => ({
  subscribeSpread: () => () => undefined,
  getSpreadPaintSnapshot: () =>
    state.items === undefined
      ? undefined
      : { resolved: { items: state.items } },
}))
vi.mock('./relink', () => ({
  subscribeRelink: () => () => undefined,
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
  })

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
})
