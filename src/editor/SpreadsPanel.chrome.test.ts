import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const panelCss = readFileSync(join(here, 'SpreadsPanel.css'), 'utf8')
const shellCss = readFileSync(join(here, 'EditorShell.css'), 'utf8')

function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('}', start))
}

describe('left list kit chrome', () => {
  it('paints the panel on the bar tone', () => {
    expect(rule(panelCss, '.editor-spreads')).toContain(
      'background: var(--chrome)',
    )
  })

  it('selects a row with the tone fill and no ring', () => {
    expect(
      rule(
        panelCss,
        ".e7-item[aria-selected='true'],\n.e7-item[aria-selected='true']:hover",
      ),
    ).toContain('background: var(--sel)')
    const item = rule(panelCss, '.e7-item')
    expect(item).toContain('outline: none')
    expect(item).toContain('box-shadow: none')
    expect(rule(panelCss, '.editor-spread-thumb')).toContain('outline: none')
  })

  it('uses sub colour for labels and foreground when selected', () => {
    expect(rule(panelCss, '.e7-item [data-label]')).toContain(
      'color: var(--muted-foreground)',
    )
    expect(
      rule(panelCss, ".e7-item[aria-selected='true'] [data-label]"),
    ).toContain('color: var(--foreground)')
  })

  it('draws the mode segment on a field track with a raised selected segment', () => {
    expect(rule(shellCss, '.editor-left-tabs')).toContain(
      'background: var(--field)',
    )
    expect(rule(panelCss, '.editor-spreads-mode')).toContain(
      'background: var(--field)',
    )
    const selected = rule(shellCss, ".editor-left-tab[aria-selected='true']")
    expect(selected).toContain('background: var(--chrome)')
    expect(selected).toContain('box-shadow: var(--shadow-segment)')
    expect(selected).not.toContain('var(--select)')
  })
})
