import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  makeBookWithAsset,
  makeFrame,
  makeSpread,
} from '../core/testing/fixtures'
import { placeAsset } from '../core'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { SpreadRowEmpty } from './SpreadRowEmpty'

function seed(frames: ReturnType<typeof makeFrame>[]): void {
  resetBookStore({
    book: {
      ...makeBookWithAsset('a', { place: false }),
      spreads: [makeSpread({ id: 's1', frames })],
    },
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('SpreadRowEmpty', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('counts photo frames without an asset', () => {
    seed([
      makeFrame({ id: 'f0', assetId: 'a' }),
      makeFrame({ id: 'f1' }),
      makeFrame({ id: 'f2' }),
    ])
    render(<SpreadRowEmpty spreadId="s1" />)
    expect(screen.getByTestId('spread-row-empty').textContent).toBe('2 empty')
  })

  it('ignores text frames', () => {
    seed([makeFrame({ id: 'f0' }), makeFrame({ id: 'f1', kind: 'text' })])
    render(<SpreadRowEmpty spreadId="s1" />)
    expect(screen.getByTestId('spread-row-empty').textContent).toBe('1 empty')
  })

  it('follows the spread when a photo is placed', () => {
    seed([makeFrame({ id: 'f0' }), makeFrame({ id: 'f1' })])
    render(<SpreadRowEmpty spreadId="s1" />)
    const snap = getBookStoreSnapshot()
    act(() => {
      resetBookStore({
        book: placeAsset(snap.book, 's1', 'f0', 'a'),
        sessionMeta: snap.sessionMeta,
        importRunning: false,
        importExpectedCount: 0,
      })
    })
    expect(screen.getByTestId('spread-row-empty').textContent).toBe('1 empty')
  })

  it('renders nothing when every photo frame is filled', () => {
    seed([makeFrame({ id: 'f0', assetId: 'a' })])
    render(<SpreadRowEmpty spreadId="s1" />)
    expect(screen.queryByTestId('spread-row-empty')).toBeNull()
  })

  it('renders nothing for an unknown spread', () => {
    seed([makeFrame({ id: 'f0' })])
    render(<SpreadRowEmpty spreadId="nope" />)
    expect(screen.queryByTestId('spread-row-empty')).toBeNull()
  })
})
