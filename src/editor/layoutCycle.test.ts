import { afterEach, describe, expect, it, vi } from 'vitest'
import { fc } from '@fast-check/vitest'
import type { Book, Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { enterCropMode, exitCropMode } from './cropMode'
import { cycleSet, stepLayout } from './layoutCatalog'
import { clearLiveGeometry, publishLiveGeometry } from './liveGeometry'
import { cancelTextEdit, startTextEdit } from './textEditStore'
import {
  cycleLayout,
  layoutCycleBlocked,
  layoutCycleOf,
  subscribeLayoutCycleBlocked,
} from './layoutCycle'
import { resetLeftPanelTabForTests, setLeftPanelTab } from './leftPanelTabStore'
import { addSavedTemplate, resetSavedTemplatesForTests } from './savedTemplates'

const frames = (count: number, text = false): Frame[] => [
  ...Array.from({ length: count }, (_, i) =>
    makeFrame({ id: `f${String(i)}`, z: i }),
  ),
  ...(text
    ? [
        makeFrame({
          id: 'caption',
          z: count,
          kind: 'text',
          content: { type: 'static', text: 'Hi' },
        }),
      ]
    : []),
]

const PAIR = [
  { x: 0, y: 0, w: 50, h: 100 },
  { x: 50, y: 0, w: 50, h: 100 },
]

/** Page 1, spread 2–3 with `count` photo frames, last page. */
function bookWith(count: number, templateId?: string, text = false): Book {
  return makeBook({
    spreads: [
      makeSpread({ id: 's0', frames: frames(1) }),
      makeSpread({
        id: 's1',
        frames: frames(count, text),
        ...(templateId === undefined ? {} : { templateId }),
      }),
      makeSpread({ id: 's2', frames: frames(1) }),
    ],
  })
}

function seed(book: Book): void {
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const spreadOf = (id: string) =>
  getBookStoreSnapshot().book.spreads.find((spread) => spread.id === id)
const names = (book: Book, index: number) =>
  layoutCycleOf(book, index, []).set.map((item) => item.name)

afterEach(() => {
  resetBookStore()
  resetSavedTemplatesForTests()
  resetLeftPanelTabForTests()
})

describe('cycleSet / stepLayout', () => {
  const set = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('keeps the items with the slot count, in order; none for 0 slots', () => {
    const items = [
      { id: 'one', rects: [{ x: 0, y: 0, width: 1, height: 1 }] },
      { id: 'two', rects: [] },
      { id: 'three', rects: [{ x: 0, y: 0, width: 2, height: 2 }] },
    ]
    expect(cycleSet(items, 1).map((item) => item.id)).toEqual(['one', 'three'])
    expect(cycleSet(items, 0)).toEqual([])
  })

  it('wraps at both ends; Custom gives the first / last; empty gives none', () => {
    expect(stepLayout(set, 'c', 1)?.id).toBe('a')
    expect(stepLayout(set, 'a', -1)?.id).toBe('c')
    expect(stepLayout(set, 'a', 1)?.id).toBe('b')
    expect(stepLayout(set, 'custom', 1)?.id).toBe('a')
    expect(stepLayout(set, undefined, -1)?.id).toBe('c')
    expect(stepLayout<{ id: string }>([], 'a', 1)).toBeUndefined()
  })
})

describe('layoutCycleOf', () => {
  it('is the picker list with the spread photo-frame count, in picker order', () => {
    expect(names(bookWith(1), 1)).toEqual([
      'Full bleed',
      'Panorama',
      'Framed single',
    ])
    expect(names(bookWith(2), 1)).toEqual(['One per page', 'Offset pair'])
    expect(names(bookWith(3), 1)).toEqual([
      'Hero + two',
      'Three across',
      'Landscape + 2 portraits',
    ])
    expect(names(bookWith(5), 1)).toEqual(['Hero + grid'])
    expect(names(bookWith(0), 1)).toEqual([])
    // Text frames are not photo frames (D3).
    expect(names(bookWith(2, undefined, true), 1)).toEqual([
      'One per page',
      'Offset pair',
    ])
    // Single page 1 (one photo frame): the single-page picker set.
    expect(names(bookWith(2), 0)).toEqual([
      'Full bleed',
      'One per page',
      'Panorama',
      'Framed single',
    ])
  })

  it('appends My templates of this page shape in save order', () => {
    const mine = [
      addSavedTemplate('Spread pair', PAIR, 2),
      addSavedTemplate('Page pair', PAIR, 1),
    ]
    const cycle = layoutCycleOf(bookWith(2), 1, mine)
    expect(cycle.set.map((item) => item.name)).toEqual([
      'One per page',
      'Offset pair',
      'Spread pair',
    ])
  })

  it('names the current layout via its alias; Custom when not in the set', () => {
    expect(layoutCycleOf(bookWith(2, 'offset-pair'), 1, [])).toMatchObject({
      index: 1,
      name: 'Offset pair',
    })
    expect(layoutCycleOf(bookWith(2, 'two-portraits'), 1, [])).toMatchObject({
      index: 0,
      name: 'One per page',
    })
    expect(layoutCycleOf(bookWith(2), 1, [])).toMatchObject({
      index: -1,
      name: 'Custom',
    })
    expect(layoutCycleOf(bookWith(2), 9, [])).toEqual({
      set: [],
      index: -1,
      name: 'Custom',
    })
  })
})

describe('cycleLayout', () => {
  it('applies the next layout, keeps frame ids and coalesces into one step', () => {
    seed(bookWith(3, 'hero-two'))
    expect(cycleLayout('s1', 1)).toBe(true)
    expect(spreadOf('s1')?.templateId).toBe('three-across')
    expect(spreadOf('s1')?.frames.map((frame) => frame.id)).toEqual([
      'f0',
      'f1',
      'f2',
    ])
    cycleLayout('s1', 1)
    cycleLayout('s1', 1)
    expect(spreadOf('s1')?.templateId).toBe('hero-two')
    expect(getHistorySnapshot().undoLabel).toBe('Change layout')
    // From Custom, ‹ applies the last layout.
    seed(bookWith(3))
    cycleLayout('s1', -1)
    expect(spreadOf('s1')?.templateId).toBe('landscape-two-portraits')
    cycleLayout('s1', 1)
    cycleLayout('s1', 1)
    undoBook()
    expect(spreadOf('s1')?.templateId).toBeUndefined()
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('applies a saved layout of the set with the same history step', () => {
    const saved = addSavedTemplate('Mine', PAIR, 2)
    seed(bookWith(2, 'offset-pair'))
    cycleLayout('s1', 1)
    expect(spreadOf('s1')?.templateId).toBe(saved.id)
    expect(getHistorySnapshot().undoLabel).toBe('Change layout')
  })

  it('does nothing without a cycle (no photo frame, one layout, unknown)', () => {
    seed(bookWith(5, 'hero-grid'))
    const before = getBookStoreSnapshot().book
    expect(cycleLayout('s1', 1)).toBe(false)
    expect(cycleLayout('s1', -1)).toBe(false)
    expect(cycleLayout('missing', 1)).toBe(false)
    seed(bookWith(0))
    expect(cycleLayout('s1', 1)).toBe(false)
    expect(getBookStoreSnapshot().book.spreads[1]?.frames).toEqual([])
    expect(before.spreads[1]?.templateId).toBe('hero-grid')
  })

  it('n × › then n × ‹ returns to the start (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 2, 3),
        fc.nat({ max: 7 }),
        (count, presses) => {
          const set = layoutCycleOf(bookWith(count), 1, []).set
          const start = set[presses % set.length]?.id
          seed(bookWith(count, start))
          for (let i = 0; i < presses; i += 1) {
            cycleLayout('s1', 1)
          }
          // A full lap is the identity: the set wraps.
          const expected = set[(2 * presses) % set.length]?.id
          expect(spreadOf('s1')?.templateId).toBe(expected)
          for (let i = 0; i < presses; i += 1) {
            cycleLayout('s1', -1)
          }
          expect(spreadOf('s1')?.templateId).toBe(start)
          expect(spreadOf('s1')?.frames).toHaveLength(count)
        },
      ),
    )
  })
})

describe('layoutCycleBlocked', () => {
  it('blocks in Masters and notifies subscribers', () => {
    let calls = 0
    const off = subscribeLayoutCycleBlocked(() => {
      calls += 1
    })
    expect(layoutCycleBlocked()).toBe(false)
    setLeftPanelTab('masters')
    expect(layoutCycleBlocked()).toBe(true)
    expect(calls).toBe(1)
    off()
    setLeftPanelTab('pages')
    expect(calls).toBe(1)
  })

  it('blocks during a crop, a text edit and a live frame gesture', () => {
    seed(
      makeBook({
        spreads: [
          makeSpread({
            id: 's1',
            frames: [makeFrame({ id: 'f0', assetId: 'a0' })],
          }),
        ],
      }),
    )
    enterCropMode('s1', 'f0')
    expect(layoutCycleBlocked()).toBe(true)
    exitCropMode()
    expect(layoutCycleBlocked()).toBe(false)
    startTextEdit({ spreadId: 's1', frameId: 'caption' })
    expect(layoutCycleBlocked()).toBe(true)
    cancelTextEdit()
    expect(layoutCycleBlocked()).toBe(false)
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb(0)
        return 1
      })
    publishLiveGeometry({
      spreadId: 's1',
      frameId: 'f0',
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotationDeg: 0,
    })
    expect(layoutCycleBlocked()).toBe(true)
    clearLiveGeometry()
    raf.mockRestore()
    expect(layoutCycleBlocked()).toBe(false)
  })
})
