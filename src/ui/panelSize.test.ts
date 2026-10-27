import fc from 'fast-check'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PANEL_DEFAULTS,
  PANEL_MAX,
  PANEL_MIN,
  clampPanelWidth,
  dragPanelWidth,
  keyPanelWidth,
  loadPanelWidth,
  savePanelWidth,
} from './panelSize'

describe('panelSize', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('clamps any width into [min, max] and is idempotent', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true }), (w) => {
        const c = clampPanelWidth(w)
        expect(c).toBeGreaterThanOrEqual(PANEL_MIN)
        expect(c).toBeLessThanOrEqual(PANEL_MAX)
        expect(clampPanelWidth(c)).toBe(c)
      }),
    )
    expect(clampPanelWidth(Number.NaN)).toBe(PANEL_MIN)
  })

  it('drags the left edge with the pointer and the right edge against it', () => {
    expect(dragPanelWidth('left', 200, 20)).toBe(220)
    expect(dragPanelWidth('right', 300, 20)).toBe(280)
    expect(dragPanelWidth('left', 200, 1000)).toBe(PANEL_MAX)
    expect(dragPanelWidth('right', 200, 1000)).toBe(PANEL_MIN)
  })

  it('steps by 8, or 32 with Shift, mirrored on the right panel', () => {
    expect(keyPanelWidth('left', 200, 'ArrowRight', false)).toBe(208)
    expect(keyPanelWidth('left', 200, 'ArrowLeft', true)).toBe(168)
    expect(keyPanelWidth('right', 300, 'ArrowRight', false)).toBe(292)
    expect(keyPanelWidth('right', 300, 'ArrowLeft', true)).toBe(332)
    expect(keyPanelWidth('left', 360, 'ArrowRight', true)).toBe(PANEL_MAX)
    expect(keyPanelWidth('left', 200, 'Enter', false)).toBeNull()
  })

  it('round-trips a saved width per side', () => {
    savePanelWidth('left', 250)
    expect(loadPanelWidth('left')).toBe(250)
    expect(loadPanelWidth('right')).toBe(PANEL_DEFAULTS.right)
  })

  it('clamps stored out-of-range values and ignores garbage', () => {
    window.localStorage.setItem('photobooks.panel.left', '9999')
    expect(loadPanelWidth('left')).toBe(PANEL_MAX)
    window.localStorage.setItem('photobooks.panel.left', 'abc')
    expect(loadPanelWidth('left')).toBe(PANEL_DEFAULTS.left)
  })

  it('falls back to defaults when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(loadPanelWidth('right')).toBe(PANEL_DEFAULTS.right)
    expect(() => {
      savePanelWidth('right', 280)
    }).not.toThrow()
  })
})
