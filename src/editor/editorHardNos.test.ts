import { describe, expect, it } from 'vitest'
import { EDITOR_CHROME_CSS } from './editorChromeTokens'
import { folderSkippedStatusText } from './useChromeImport'

describe('editor hard-nos (kit v0.9.3)', () => {
  it('uses tone-only filmstrip/template selection and black used badges', () => {
    expect(EDITOR_CHROME_CSS).toContain(
      '.filmstrip-item[aria-selected=true] { background: #CACACA }',
    )
    // Owner design change (round 10, M67): the selected segment is the kit
    // raised chrome pill (SegmentedControl.css), not a #CACACA tone fill.
    expect(EDITOR_CHROME_CSS).not.toContain('.pb-segmented__segment--selected')
    expect(EDITOR_CHROME_CSS).toContain(
      '.filmstrip-placed { border-radius: 9999px; background: rgb(0 0 0/.55); color: #fff }',
    )
    expect(EDITOR_CHROME_CSS).toContain('.editor-dock { background: #E1E1E1 }')
  })

  it('suppresses canvas focus ring and uses grab cursor while data-panning', () => {
    expect(EDITOR_CHROME_CSS).toContain(
      '.e7-canvas[data-panning], .e7-canvas[data-panning]:focus-visible { outline: none }',
    )
    expect(EDITOR_CHROME_CSS).toContain(
      '.e7-canvas[data-panning] .pasteboard-scroll { cursor: grab }',
    )
    expect(EDITOR_CHROME_CSS).toContain(
      '.e7-canvas[data-panning] button.spread-frame[aria-pressed=true]:focus-visible::after',
    )
  })

  it('draws Frame/Text cursors white-with-black-outline and Hand as grab', () => {
    expect(EDITOR_CHROME_CSS).toMatch(
      /\.cursor-tool-frame \{ cursor: url\("data:image\/svg\+xml,[^"]*%23232223[^"]*%23ffffff[^"]*"\) 12 12, crosshair \}/,
    )
    expect(EDITOR_CHROME_CSS).toMatch(
      /\.cursor-tool-text \{ cursor: url\("data:image\/svg\+xml,[^"]*%23232223[^"]*%23ffffff[^"]*"\) 7 11, text \}/,
    )
    expect(EDITOR_CHROME_CSS).toContain(
      '.e7-canvas.cursor-grab .pasteboard-scroll { cursor: grab }',
    )
  })

  it('lets the canvas dots show through the canvas inner wrapper', () => {
    expect(EDITOR_CHROME_CSS).toContain(
      '.editor-canvas-inner { background: transparent }',
    )
  })

  it('keeps spreads list selection on #CACACA tone', () => {
    expect(EDITOR_CHROME_CSS).toContain(
      `.e7-item[aria-selected=true], .e7-item[aria-selected=true]:hover { background: #CACACA }`,
    )
  })

  it('formats folder skip summaries for the status line (not toast copy)', () => {
    expect(folderSkippedStatusText(1)).toBe('1 non-image file skipped')
    expect(folderSkippedStatusText(3)).toBe('3 non-image files skipped')
    expect(folderSkippedStatusText(2)).not.toMatch(/toast/i)
  })
})
