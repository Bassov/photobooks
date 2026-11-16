import { describe, expect, it } from 'vitest'
import { imposition, sheetCount } from './imposition'

describe('imposition', () => {
  it('2-up: 8 pages on 2 sheets, outer sheet first', () => {
    expect(imposition(8, '2up')).toEqual({
      columns: 2,
      rows: 1,
      blanks: 0,
      sheets: [
        { front: [8, 1], back: [2, 7] },
        { front: [6, 3], back: [4, 5] },
      ],
    })
  })

  it('2-up: 13 pages pad to 16 with blanks before the back cover', () => {
    const { blanks, sheets } = imposition(13, '2up')

    expect(blanks).toBe(3)
    expect(sheets).toEqual([
      { front: [13, 1], back: [2, null] },
      { front: [null, 3], back: [4, null] },
      { front: [12, 5], back: [6, 11] },
      { front: [10, 7], back: [8, 9] },
    ])
  })

  it('4-up: two saddle sheets a side, top then bottom', () => {
    expect(imposition(8, '4up')).toEqual({
      columns: 2,
      rows: 2,
      blanks: 0,
      sheets: [{ front: [8, 1, 6, 3], back: [2, 7, 4, 5] }],
    })
    expect(imposition(13, '4up').sheets).toEqual([
      { front: [13, 1, null, 3], back: [2, null, 4, null] },
      { front: [12, 5, 10, 7], back: [6, 11, 8, 9] },
    ])
  })

  it('a single page opens the booklet; no pages, no sheets', () => {
    expect(imposition(1, '2up')).toMatchObject({
      blanks: 3,
      sheets: [{ front: [null, 1], back: [null, null] }],
    })
    expect(imposition(0, '4up')).toMatchObject({ blanks: 0, sheets: [] })
  })

  it('counts sheets of paper', () => {
    expect([8, 13, 16, 17].map((pages) => sheetCount(pages, '2up'))).toEqual([
      2, 4, 4, 5,
    ])
    expect([8, 13, 16, 17].map((pages) => sheetCount(pages, '4up'))).toEqual([
      1, 2, 2, 3,
    ])
  })
})
