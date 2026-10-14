import { Profiler } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { addSpread, placeAsset } from '../core'
import { makeBook } from '../core/testing/fixtures'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import {
  dispatchBookOp,
  getSpreadPaintSnapshot,
  resetBookStore,
  subscribeSpread,
} from './bookStore'

function twoSpreadBook() {
  let book = makeBook({
    id: 'two',
    spreads: [],
    gallery: ['a'],
    assets: { a: {} },
  })
  book = addSpread(book, { id: 's0' })
  book = addSpread(book, { id: 's1' })
  const left = book.spreads[0]?.frames[0]
  const right = book.spreads[1]?.frames[0]
  if (left === undefined || right === undefined) {
    throw new Error('expected frames')
  }
  book = placeAsset(book, 's0', left.id, 'a')
  book = placeAsset(book, 's1', right.id, 'a')
  return book
}

describe('per-spread paint subscription', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('notifies only the edited spread and keeps the sibling snapshot', () => {
    const book = twoSpreadBook()
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map([['a', 'data:image/svg+xml,sibling']]),
      importRunning: false,
      importExpectedCount: 0,
    })
    const siblingBefore = getSpreadPaintSnapshot('s1')
    let siblingNotified = 0
    const unsubscribe = subscribeSpread('s1', () => {
      siblingNotified += 1
    })

    const frameId = book.spreads[0]?.frames[0]?.id
    if (frameId === undefined) {
      throw new Error('expected frame')
    }
    dispatchBookOp({
      type: 'unplace',
      spreadId: 's0',
      frameId,
    })

    expect(siblingNotified).toBe(0)
    expect(getSpreadPaintSnapshot('s1')).toBe(siblingBefore)
    unsubscribe()
  })

  it('refreshes a neighbor when adding a spread changes its page role', () => {
    const book = twoSpreadBook()
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const before = getSpreadPaintSnapshot('s1')
    expect(before?.resolved.spreadWidthMm).toBe(book.settings.trim.widthMm)
    expect(before?.resolved.pageCuts).toEqual([])

    dispatchBookOp({ type: 'addSpread', id: 's2' })

    const after = getSpreadPaintSnapshot('s1')
    expect(after).not.toBe(before)
    expect(after?.resolved.spreadWidthMm).toBe(book.settings.trim.widthMm * 2)
    expect(after?.resolved.pageCuts).toEqual([
      { orientation: 'vertical', offsetMm: book.settings.trim.widthMm },
    ])
  })

  it('does not update the sibling painted output when one spread changes', () => {
    const book = twoSpreadBook()
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map([['a', 'data:image/svg+xml,sibling']]),
      importRunning: false,
      importExpectedCount: 0,
    })
    const renders = { count: 0 }
    function Harness() {
      return (
        <>
          <ConnectedSpreadView spreadId="s0" />
          <Profiler
            id="s1"
            onRender={() => {
              renders.count += 1
            }}
          >
            <ConnectedSpreadView spreadId="s1" />
          </Profiler>
        </>
      )
    }
    render(<Harness />)
    const before = renders.count
    const frameId = book.spreads[0]?.frames[0]?.id
    if (frameId === undefined) {
      throw new Error('expected frame')
    }
    act(() => {
      dispatchBookOp({
        type: 'unplace',
        spreadId: 's0',
        frameId,
      })
    })

    expect(renders.count).toBe(before)
    expect(screen.getAllByTestId('spread-frame-image')).toHaveLength(1)
  })
})
