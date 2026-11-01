import { describe, expect, it } from 'vitest'
import { formatZoomPercent } from './camera'
import {
  bookSettingsSubtitle,
  bookSizeLine,
  DEFAULT_EDITOR_PANELS,
  isPanelToggleChord,
  isSpacePanCode,
  nextZoomIn,
  nextZoomOut,
  PAGE_MAX,
  PAGE_MIN,
  pageLabel,
  pagesNote,
  pagesOf,
  panelHotkeyAction,
  toggleAllEditorPanels,
  toggleEditorPanel,
  zoomChromeLabel,
} from './editorChromePanels'

describe('editorChromePanels', () => {
  it('toggles one panel and all panels', () => {
    expect(toggleEditorPanel(DEFAULT_EDITOR_PANELS, 'l')).toEqual({
      l: false,
      b: true,
      r: true,
    })
    expect(toggleAllEditorPanels({ l: true, b: false, r: false })).toEqual({
      l: false,
      b: false,
      r: false,
    })
    expect(toggleAllEditorPanels({ l: false, b: false, r: false })).toEqual({
      l: true,
      b: true,
      r: true,
    })
  })

  it('maps panel hotkeys only when regions exist', () => {
    const all = { left: true, bottom: true, right: true }
    expect(panelHotkeyAction('[', all)).toEqual({ kind: 'toggle', key: 'l' })
    expect(panelHotkeyAction('\\', all)).toEqual({ kind: 'toggle', key: 'b' })
    expect(panelHotkeyAction(']', all)).toEqual({ kind: 'toggle', key: 'r' })
    expect(panelHotkeyAction('I', all)).toEqual({ kind: 'toggle', key: 'r' })
    expect(panelHotkeyAction('[', { ...all, left: false })).toEqual({
      kind: 'none',
    })
    expect(panelHotkeyAction('x', all)).toEqual({ kind: 'none' })
  })

  it('classifies Space pan and Cmd+. chord', () => {
    expect(isSpacePanCode('Space')).toBe(true)
    expect(isSpacePanCode('KeyA')).toBe(false)
    expect(isPanelToggleChord(true, '.')).toBe(true)
    expect(isPanelToggleChord(true, ',')).toBe(false)
    expect(isPanelToggleChord(false, '.')).toBe(false)
  })

  it('notes the kit 20–120 page range in spreads of 2', () => {
    expect([PAGE_MIN, PAGE_MAX]).toEqual([20, 120])
    expect(pagesNote(0)).toBe('Add 10 spreads to reach the 20-page minimum')
    expect(pagesNote(6)).toBe('Add 7 spreads to reach the 20-page minimum')
    expect(pagesNote(17)).toBe('Add 2 spreads to reach the 20-page minimum')
    expect(pagesNote(18)).toBe('Add 1 spread to reach the 20-page minimum')
    expect(pagesNote(19)).toBe('Add 1 spread to reach the 20-page minimum')
    expect(pagesNote(20)).toBe('Pages are added in spreads of 2')
    expect(pagesNote(120)).toBe('Pages are added in spreads of 2')
    expect(pagesNote(121)).toBe('Remove 1 spreads to stay within 120 pages')
    expect(pagesNote(122)).toBe('Remove 1 spreads to stay within 120 pages')
    expect(pagesNote(123)).toBe('Remove 2 spreads to stay within 120 pages')
  })

  it('names the book in the Book settings meta line', () => {
    expect(bookSettingsSubtitle('Back', 'Front')).toBe(
      'Back · applies to the whole book',
    )
    expect(bookSettingsSubtitle('', 'Front')).toBe(
      'Front · applies to the whole book',
    )
    expect(bookSettingsSubtitle('', '')).toBe(
      'Untitled book · applies to the whole book',
    )
  })

  it('labels a 6-page and an 8-page book like the kit list (M46)', () => {
    expect([0, 1, 2, 3].map((i) => pageLabel(i, 4))).toEqual([
      '1',
      '2–3',
      '4–5',
      '6',
    ])
    expect([0, 1, 2, 3, 4].map((i) => pageLabel(i, 5))).toEqual([
      '1',
      '2–3',
      '4–5',
      '6–7',
      '8',
    ])
    // A one-spread book is page 1 only.
    expect(pageLabel(0, 1)).toBe('1')
  })

  it('formats kit page and zoom chrome labels', () => {
    expect(pagesOf(3)).toBe(6)
    expect(pageLabel(0)).toBe('1')
    expect(pageLabel(2)).toBe('4–5')
    expect(zoomChromeLabel(0.5, 0.5)).toBe('Fit')
    expect(zoomChromeLabel(0.4985, 0.5)).toBe('Fit')
    expect(zoomChromeLabel(0.5, null)).toBe(formatZoomPercent(0.5))
    expect(zoomChromeLabel(0.52, 0.5)).toBe(formatZoomPercent(0.52))
    expect(zoomChromeLabel(0.4, 0.5)).toBe(formatZoomPercent(0.4))
    expect(zoomChromeLabel(1005, 1000)).toBe('Fit')
    expect(zoomChromeLabel(0, null)).toBe(formatZoomPercent(0))
    expect(nextZoomOut(1)).toBe(0.8)
    expect(nextZoomOut(0.25)).toBe(0.25)
    expect(nextZoomIn(1)).toBe(1.25)
    expect(nextZoomIn(8)).toBe(8)
    expect(
      bookSizeLine({
        widthMm: 300,
        heightMm: 300,
        spreads: 3,
        saveLabel: 'saved',
      }),
    ).toBe('30 × 30 cm · 6 pages · saved')
    expect(
      bookSizeLine({
        widthMm: 210,
        heightMm: 297,
        spreads: 1,
        saveLabel: null,
      }),
    ).toBe('21 × 29.7 cm · 2 pages')
  })
})
