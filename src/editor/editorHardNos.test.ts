import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EDITOR_CHROME_CSS } from './editorChromeTokens'

const here = dirname(fileURLToPath(import.meta.url))

describe('editor hard-nos (kit v0.9.3)', () => {
  it('uses tone-only filmstrip selection and black used badges', () => {
    const css = readFileSync(join(here, 'Filmstrip.css'), 'utf8')
    expect(css).toMatch(/aria-selected[^}]*var\(--sel\)/)
    expect(css).not.toMatch(
      /filmstrip-item\[aria-selected[^\]]*\][^{]*\{[^}]*outline:\s*2px\s+solid\s+var\(--select\)/,
    )
    expect(css).toMatch(
      /\.filmstrip-placed[^}]*--badge-bg:\s*color-mix\(in srgb, var\(--primary\)/,
    )
  })

  it('suppresses canvas focus ring and uses grab cursor while data-panning', () => {
    expect(EDITOR_CHROME_CSS).toContain(
      '.e7-canvas[data-panning], .e7-canvas[data-panning]:focus-visible { outline: none }',
    )
    expect(EDITOR_CHROME_CSS).toContain(
      '.e7-canvas[data-panning] .pasteboard-scroll { cursor: grab }',
    )
    expect(EDITOR_CHROME_CSS).toContain(
      '.e7-canvas[data-panning] button.spread-frame:focus-visible::after',
    )
  })

  it('keeps spreads list selection on #CACACA tone', () => {
    expect(EDITOR_CHROME_CSS).toContain(
      `.e7-item[aria-selected=true], .e7-item[aria-selected=true]:hover { background: #CACACA }`,
    )
  })
})
