import { afterEach, describe, expect, it } from 'vitest'
import {
  EDITOR_CHROME_CSS,
  ensureEditorChromeStyles,
  fmtN,
  mmToCm,
  pageLabel,
  pagesOf,
  resetEditorChromeStylesForTests,
} from './editorChromeTokens'

describe('editorChromeTokens', () => {
  afterEach(() => {
    resetEditorChromeStylesForTests()
  })

  it('re-exports kit page helpers', () => {
    expect(pagesOf(3)).toBe(6)
    expect(pageLabel(0)).toBe('1')
    expect(pageLabel(1)).toBe('2–3')
    expect(fmtN(21.05)).toBe('21.1')
    expect(mmToCm(210)).toBe(21)
  })

  it('styles "Add folder…" as the kit ink 500 chip, half opacity when disabled', () => {
    expect(EDITOR_CHROME_CSS).toContain(
      '.film-chip.film-add-folder { color: #393738; font-weight: 500; padding: 0 10px }',
    )
    expect(EDITOR_CHROME_CSS).toContain(
      '.film-chip.film-add-folder[data-disabled] { opacity: .5 }',
    )
  })

  it('injects chrome CSS once and reuses a pre-existing style node', () => {
    expect(EDITOR_CHROME_CSS).toContain('#CACACA')
    expect(EDITOR_CHROME_CSS).toContain('data-panning')
    expect(EDITOR_CHROME_CSS).toContain('cursor: grab')
    expect(EDITOR_CHROME_CSS).toContain('.editor-panel-l')
    expect(EDITOR_CHROME_CSS).toContain('.e7 .pasteboard')
    expect(EDITOR_CHROME_CSS).toContain('.e7 .editor-workspace')
    ensureEditorChromeStyles()
    ensureEditorChromeStyles()
    expect(document.querySelectorAll('#pb-editor-chrome-v93')).toHaveLength(1)

    resetEditorChromeStylesForTests()
    expect(document.getElementById('pb-editor-chrome-v93')).toBeNull()

    const pre = document.createElement('style')
    pre.id = 'pb-editor-chrome-v93'
    document.head.appendChild(pre)
    ensureEditorChromeStyles()
    expect(document.querySelectorAll('#pb-editor-chrome-v93')).toHaveLength(1)
    expect(pre.isConnected).toBe(true)
  })
})
