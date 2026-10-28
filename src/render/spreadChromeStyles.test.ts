import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  spreadFrameControlStyle,
  spreadFrameSelectedStyle,
} from './spreadChromeStyles'

const css = readFileSync('src/render/SpreadView.css', 'utf8')

describe('spreadChromeStyles', () => {
  it('leaves layout alone; pressed ring is CSS ::after not inline outline', () => {
    expect(spreadFrameSelectedStyle.outline).toBeUndefined()
    const layout = { left: 1, top: 2, width: 3, height: 4, zIndex: 5 }
    expect(spreadFrameControlStyle(layout, false)).toEqual(layout)
    expect(spreadFrameControlStyle(layout, true)).toEqual(layout)
    expect(spreadFrameControlStyle(layout, true).outline).toBeUndefined()
  })
})

describe('SpreadView.css selection-only chrome', () => {
  it('paints ring/outline only for the pressed frame; no unselected edge', () => {
    expect(css).toContain("button.spread-frame[aria-pressed='true']::after")
    expect(css).toContain('outline: 2px solid var(--select)')
    expect(css).toContain('outline-offset: 1px')
    expect(css).toContain('var(--shadow-ring-white)')
    expect(css).not.toContain('focus-visible::after')
    expect(css).not.toMatch(/\.spread-frame\s*\{[^}]*(outline|box-shadow)/)
  })
})
