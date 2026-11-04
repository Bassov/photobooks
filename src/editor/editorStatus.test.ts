import { afterEach, describe, expect, it } from 'vitest'
import {
  getEditorStatus,
  guideStatus,
  isStatusPillVisible,
  STATUS_FRAME_DRAG,
  setEditorStatus,
  subscribeEditorStatus,
  unplacedFromSpreadStatus,
} from './editorStatus'

describe('editorStatus', () => {
  afterEach(() => {
    setEditorStatus('')
  })

  it('notifies subscribers until they unsubscribe and ignores the same text', () => {
    let calls = 0
    const unsubscribe = subscribeEditorStatus(() => {
      calls += 1
    })
    setEditorStatus('Photos swapped')
    setEditorStatus('Photos swapped')
    expect(calls).toBe(1)
    expect(getEditorStatus()).toBe('Photos swapped')
    unsubscribe()
    setEditorStatus('Photo moved')
    expect(calls).toBe(1)
    expect(getEditorStatus()).toBe('Photo moved')
  })

  it.each([
    [1, '1 photo was unplaced from the spread'],
    [3, '3 photos were unplaced from the spread'],
  ])('states %i unplaced photos as %s', (count, sentence) => {
    expect(unplacedFromSpreadStatus(count)).toBe(sentence)
  })

  const twoPages = { pages: 2, pageWidthMm: 210 } as const

  it.each([
    [0, 'Vertical guide at 0 mm (left page)'],
    [-3, 'Vertical guide at -3 mm (left page)'],
    [105.5, 'Vertical guide at 105.5 mm (left page)'],
    // The spine and the right edge read as a full page, kit rounding.
    [210, 'Vertical guide at 210 mm (right page)'],
    [315.3, 'Vertical guide at 105.3 mm (right page)'],
    [420, 'Vertical guide at 210 mm (right page)'],
  ])(
    'reads a vertical guide at %f mm of a two-page spread as %s',
    (mm, text) => {
      expect(guideStatus('vertical', mm, twoPages)).toBe(text)
    },
  )

  it('reads a single page in its own mm with its side, none without one', () => {
    expect(guideStatus('vertical', 42.5, { pages: 1, side: 'right' })).toBe(
      'Vertical guide at 42.5 mm (right page)',
    )
    expect(guideStatus('vertical', 42.5, { pages: 1, side: 'left' })).toBe(
      'Vertical guide at 42.5 mm (left page)',
    )
    expect(guideStatus('vertical', 42.5, { pages: 1, side: null })).toBe(
      'Vertical guide at 42.5 mm',
    )
  })

  it('reads a horizontal guide in mm from the top, no page', () => {
    expect(guideStatus('horizontal', 300.2, twoPages)).toBe(
      'Horizontal guide at 300.2 mm',
    )
  })

  it('paints the frame drag hint and guide statuses as the pill, nothing else', () => {
    expect(isStatusPillVisible(STATUS_FRAME_DRAG)).toBe(true)
    expect(isStatusPillVisible('Vertical guide at 5 mm (left page)')).toBe(true)
    expect(isStatusPillVisible('Horizontal guide at 5 mm')).toBe(true)
    expect(isStatusPillVisible('Photos swapped')).toBe(false)
    expect(isStatusPillVisible('Moved: Vertical guide at 5 mm')).toBe(false)
    expect(isStatusPillVisible('')).toBe(false)
  })
})
