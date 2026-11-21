import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import type { Book } from '../core'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
} from './bookStore'
import { isCoverSelected, setCoverSelected } from './coverSelection'
import { enterCropMode, getCropTarget } from './cropMode'
import { getTextEdit, startTextEdit } from './textEditStore'
import { getEditorStatus, isStatusPillVisible } from './editorStatus'
import { getSelectedEndpaper, setEndpaperSelected } from './endpaperSelection'
import {
  getFrameSelection,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import {
  getLeftPanelTab,
  resetLeftPanelTabForTests,
  setLeftPanelTab,
} from './leftPanelTabStore'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
  setActiveSpreadId,
  subscribeSpreadRevealRequest,
} from './photoRootSession'
import {
  jumpToPlacement,
  PLACED_STATUS_MS,
  placedStatus,
  placeLabel,
  resetPlacedJumpForTests,
} from './placedJump'

const P = 'photo'

/** Spreads s0..s4 (Page 1, Pages 2–3, 4–5, 6–7, Page 8); `P` sits on s1/a and s2/b. */
function seed(extra: Partial<Book> = {}): void {
  const base = makeBook({
    spreads: [
      makeSpread({ id: 's0', frames: [makeFrame({ id: 'x' })] }),
      makeSpread({
        id: 's1',
        frames: [makeFrame({ id: 'a', assetId: P })],
      }),
      makeSpread({
        id: 's2',
        frames: [
          makeFrame({ id: 'top', z: 2 }),
          makeFrame({ id: 'b', assetId: P, z: 1, locked: true }),
        ],
      }),
      makeSpread({ id: 's3', frames: [] }),
      makeSpread({ id: 's4', frames: [] }),
    ],
    ...extra,
  })
  resetBookStore({
    book: base,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const selectedFrame = () => {
  const selection = getFrameSelection()
  return selection === null
    ? null
    : `${selection.spreadId}/${selection.frameIds.join(',')}`
}

describe('placeLabel / placedStatus', () => {
  const ids = ['s0', 's1', 's2', 's3', 's4']

  it('names places as the spread list does', () => {
    expect(
      placeLabel({ kind: 'frame', spreadId: 's0', frameId: 'x' }, ids),
    ).toBe('Page 1')
    expect(
      placeLabel({ kind: 'frame', spreadId: 's1', frameId: 'a' }, ids),
    ).toBe('Pages 2–3')
    expect(
      placeLabel({ kind: 'frame', spreadId: 's4', frameId: 'z' }, ids),
    ).toBe('Page 8')
    expect(placeLabel({ kind: 'cover', panel: 'front' }, ids)).toBe('Cover')
    expect(placeLabel({ kind: 'cover', panel: 'spine' }, ids)).toBe(
      'Cover · spine',
    )
    expect(placeLabel({ kind: 'cover', panel: 'back' }, ids)).toBe(
      'Cover · back',
    )
    expect(placeLabel({ kind: 'endpaper', side: 'front' }, ids)).toBe(
      'Endpaper · front',
    )
    expect(placeLabel({ kind: 'endpaper', side: 'back' }, ids)).toBe(
      'Endpaper · back',
    )
  })

  it('reads "Placed on" for one place and "Placed i of n ·" (a pill) for more', () => {
    expect(placedStatus(0, 1, 'Page 1')).toBe('Placed on Page 1')
    expect(isStatusPillVisible(placedStatus(0, 1, 'Page 1'))).toBe(false)
    expect(placedStatus(1, 2, 'Pages 4–5')).toBe('Placed 2 of 2 · Pages 4–5')
    expect(isStatusPillVisible('Placed 2 of 2 · Pages 4–5')).toBe(true)
    expect(isStatusPillVisible('Placed 2 of 2')).toBe(false)
    expect(isStatusPillVisible('Placed 10 of 12 · Page 8')).toBe(true)
    expect(isStatusPillVisible('xPlaced 1 of 2 · Page 1')).toBe(false)
    expect(isStatusPillVisible('Placed a of 2 · Page 1')).toBe(false)
    expect(isStatusPillVisible('Placed 1 of b · Page 1')).toBe(false)
  })
})

describe('jumpToPlacement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    seed()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetPlacedJumpForTests()
    resetFrameSelection()
    setCoverSelected(false)
    resetActiveSpreadIdForTests()
    resetLeftPanelTabForTests()
    resetBookStore()
  })

  it('cycles the places from the first spread and wraps (B2, B3)', () => {
    setActiveSpreadId('s0')

    jumpToPlacement(P)
    expect(getActiveSpreadId()).toBe('s1')
    expect(selectedFrame()).toBe('s1/a')
    expect(getEditorStatus()).toBe('Placed 1 of 2 · Pages 2–3')

    jumpToPlacement(P)
    expect(getActiveSpreadId()).toBe('s2')
    expect(selectedFrame()).toBe('s2/b')
    expect(getEditorStatus()).toBe('Placed 2 of 2 · Pages 4–5')

    jumpToPlacement(P)
    expect(selectedFrame()).toBe('s1/a')
  })

  it('starts at a place on the active spread', () => {
    setActiveSpreadId('s2')

    jumpToPlacement(P)

    expect(selectedFrame()).toBe('s2/b')
  })

  it('wraps to the first place when none is at or after the active spread', () => {
    setActiveSpreadId('s3')

    jumpToPlacement(P)

    expect(selectedFrame()).toBe('s1/a')
  })

  it('forgets the last jump once the selection moved away', () => {
    setActiveSpreadId('s0')
    jumpToPlacement(P)
    expect(selectedFrame()).toBe('s1/a')

    setFrameSource({ spreadId: 's2', frameId: 'top' })
    setActiveSpreadId('s1')
    jumpToPlacement(P)

    // Not "next after s1/a" by memory: the active spread s1 wins again.
    expect(selectedFrame()).toBe('s1/a')
    expect(getEditorStatus()).toBe('Placed 1 of 2 · Pages 2–3')
  })

  it('keeps a memory per asset only', () => {
    setActiveSpreadId('s0')
    jumpToPlacement(P)
    jumpToPlacement('nowhere')

    jumpToPlacement(P)

    expect(selectedFrame()).toBe('s2/b')
  })

  it('switches Masters to Pages and adds no history step (B9)', () => {
    setLeftPanelTab('masters')
    const history = getHistorySnapshot()
    const book = getBookStoreSnapshot().book

    jumpToPlacement(P)

    expect(getLeftPanelTab()).toBe('pages')
    expect(getHistorySnapshot()).toEqual(history)
    expect(getBookStoreSnapshot().book).toBe(book)
  })

  it('clears the status after 2500 ms', () => {
    jumpToPlacement(P)
    vi.advanceTimersByTime(PLACED_STATUS_MS - 1)
    expect(getEditorStatus()).not.toBe('')

    vi.advanceTimersByTime(1)

    expect(getEditorStatus()).toBe('')
  })

  it('does nothing for an unplaced photo', () => {
    setActiveSpreadId('s0')

    jumpToPlacement('nowhere')

    expect(selectedFrame()).toBeNull()
    expect(getActiveSpreadId()).toBe('s0')
    expect(getEditorStatus()).toBe('')
  })

  it('selects the cover and the endpapers as their rows do', () => {
    const { book } = getBookStoreSnapshot()
    seed({
      cover: { ...book.cover, spine: { ...book.cover.spine, assetId: P } },
      endpapers: {
        front: { ...book.endpapers.front, assetId: P },
        back: { ...book.endpapers.back, assetId: P },
      },
    })
    setActiveSpreadId('s0')

    // From the first spread: s1/a, s2/b, back endpaper, then wrap to cover.
    jumpToPlacement(P)
    jumpToPlacement(P)
    jumpToPlacement(P)
    expect(getSelectedEndpaper()).toBe('back')
    expect(isCoverSelected()).toBe(false)
    expect(getEditorStatus()).toBe('Placed 5 of 5 · Endpaper · back')

    jumpToPlacement(P)
    expect(isCoverSelected()).toBe(true)
    expect(getSelectedEndpaper()).toBeNull()
    expect(getEditorStatus()).toBe('Placed 1 of 5 · Cover · spine')

    jumpToPlacement(P)
    expect(getSelectedEndpaper()).toBe('front')
    expect(isCoverSelected()).toBe(false)
    expect(getEditorStatus()).toBe('Placed 2 of 5 · Endpaper · front')
  })

  it('starts from the selected cover or endpaper position', () => {
    const { book } = getBookStoreSnapshot()
    seed({
      endpapers: {
        front: book.endpapers.front,
        back: { ...book.endpapers.back, assetId: P },
      },
    })
    setActiveSpreadId('s1')
    setEndpaperSelected('front')

    jumpToPlacement(P)

    expect(selectedFrame()).toBe('s1/a')
    resetFrameSelection()
    setCoverSelected(true)

    jumpToPlacement(P)

    expect(selectedFrame()).toBe('s1/a')
  })

  it('starts at the selected endpaper or cover row, not the active spread', () => {
    const { book } = getBookStoreSnapshot()
    seed({
      endpapers: {
        front: { ...book.endpapers.front, assetId: P },
        back: { ...book.endpapers.back, assetId: P },
      },
    })
    setActiveSpreadId('s2')
    setEndpaperSelected('front')
    jumpToPlacement(P)
    expect(getEditorStatus()).toBe('Placed 1 of 4 · Endpaper · front')

    resetPlacedJumpForTests()
    setActiveSpreadId('s0')
    setEndpaperSelected('back')
    jumpToPlacement(P)
    expect(getEditorStatus()).toBe('Placed 4 of 4 · Endpaper · back')

    resetPlacedJumpForTests()
    setActiveSpreadId('s2')
    setCoverSelected(true)
    jumpToPlacement(P)
    expect(getEditorStatus()).toBe('Placed 1 of 4 · Endpaper · front')
  })

  it('starts at the first place with no active spread', () => {
    resetActiveSpreadIdForTests()

    jumpToPlacement(P)

    expect(selectedFrame()).toBe('s1/a')
  })

  it('memory needs the same frame on the same spread', () => {
    setActiveSpreadId('s0')
    jumpToPlacement(P)
    expect(selectedFrame()).toBe('s1/a')

    setActiveSpreadId('s0')
    setFrameSource({ spreadId: 's0', frameId: 'a' })
    jumpToPlacement(P)

    expect(selectedFrame()).toBe('s1/a')
  })

  it('memory of an endpaper ends once that endpaper is not selected', () => {
    const { book } = getBookStoreSnapshot()
    seed({
      cover: { ...book.cover, spine: { ...book.cover.spine, assetId: P } },
      endpapers: {
        front: book.endpapers.front,
        back: { ...book.endpapers.back, assetId: P },
      },
    })
    setActiveSpreadId('s3')
    jumpToPlacement(P)
    expect(getSelectedEndpaper()).toBe('back')

    setActiveSpreadId('s0')
    setEndpaperSelected(null)
    jumpToPlacement(P)

    expect(selectedFrame()).toBe('s1/a')
  })

  it('resetting forgets the last jump', () => {
    setActiveSpreadId('s0')
    jumpToPlacement(P)
    resetPlacedJumpForTests()

    jumpToPlacement(P)

    expect(selectedFrame()).toBe('s1/a')
  })

  it('ends crop mode and commits text editing first', () => {
    enterCropMode('s1', 'a')
    expect(getCropTarget()).not.toBeNull()
    startTextEdit({ spreadId: 's0', frameId: 'x' })

    jumpToPlacement(P)

    expect(getCropTarget()).toBeNull()
    expect(getTextEdit()).toBeNull()
  })

  it('uses "Placed on" for a single place', () => {
    seed({
      spreads: [
        makeSpread({ id: 's0', frames: [makeFrame({ id: 'x', assetId: P })] }),
      ],
    })

    jumpToPlacement(P)

    expect(getEditorStatus()).toBe('Placed on Page 1')
  })
})

describe('jumpToPlacement asks for one frame-targeted reveal (B4)', () => {
  const requests: [string, string | null][] = []
  let unsubscribe: (() => void) | null = null

  beforeEach(() => {
    seed()
    setActiveSpreadId('s2')
    requests.length = 0
    unsubscribe = subscribeSpreadRevealRequest((spreadId, frameId) => {
      requests.push([spreadId, frameId])
    })
  })

  afterEach(() => {
    unsubscribe?.()
    resetPlacedJumpForTests()
    resetFrameSelection()
    setCoverSelected(false)
    resetActiveSpreadIdForTests()
    resetBookStore()
  })

  it('reveals the frame itself, not its spread, and selects it', () => {
    jumpToPlacement(P)

    expect(requests).toEqual([['s2', 'b']])
    expect(selectedFrame()).toBe('s2/b')
    expect(getActiveSpreadId()).toBe('s2')
  })

  it('a re-click on the same place asks the same reveal (it scrolls 0 px)', () => {
    seed({
      spreads: [
        makeSpread({ id: 's0', frames: [makeFrame({ id: 'x', assetId: P })] }),
      ],
    })

    jumpToPlacement(P)
    jumpToPlacement(P)

    expect(requests).toEqual([
      ['s0', 'x'],
      ['s0', 'x'],
    ])
  })

  it('a jump to the cover asks no reveal', () => {
    const { book } = getBookStoreSnapshot()
    seed({
      cover: { ...book.cover, front: { ...book.cover.front, assetId: 'q' } },
    })

    jumpToPlacement('q')

    expect(isCoverSelected()).toBe(true)
    expect(requests).toEqual([])
  })
})
