import { describe, expect, it } from 'vitest'
import {
  bookSizeLine,
  DEFAULT_EDITOR_PANELS,
  isPanelToggleChord,
  isSpacePanCode,
  nextZoomIn,
  nextZoomOut,
  pageLabel,
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
      r: false,
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

  it('formats kit page and zoom chrome labels', () => {
    expect(pagesOf(3)).toBe(6)
    expect(pageLabel(0)).toBe('1')
    expect(pageLabel(2)).toBe('4–5')
    expect(zoomChromeLabel(1)).toBe('Fit')
    expect(zoomChromeLabel(0.995)).toBe('Fit')
    expect(zoomChromeLabel(1.02)).toBe('102%')
    expect(zoomChromeLabel(1.5)).toBe('150%')
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
