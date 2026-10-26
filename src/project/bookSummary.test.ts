import { describe, expect, it } from 'vitest'

import { makeBook, makeSpread } from '../core/testing/fixtures'
import { bookSummaryFromBook } from './bookSummary'

describe('bookSummaryFromBook', () => {
  it('copies id, title, spread count, and page trim', () => {
    const book = makeBook({
      id: 'b1',
      title: 'Fog',
      settings: { trim: { widthMm: 200, heightMm: 250 } },
      spreads: [makeSpread({ id: 's1' }), makeSpread({ id: 's2' })],
    })
    expect(bookSummaryFromBook(book)).toEqual({
      id: 'b1',
      title: 'Fog',
      spreadCount: 2,
      pageWidthMm: 200,
      pageHeightMm: 250,
    })
  })

  it('uses empty title when the document omits title', () => {
    const book = makeBook({ id: 'b2' })
    expect(bookSummaryFromBook(book).title).toBe('')
  })
})
