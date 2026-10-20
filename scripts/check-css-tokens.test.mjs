import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkCssTokens, findCssTokenViolations } from './check-css-tokens.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const chrome = path.join(ROOT, 'src', 'editor', 'EditorShell.css')

describe('findCssTokenViolations', () => {
  it('allows token references', () => {
    const css = `.x { color: var(--foreground); font-size: var(--text-sm); border-radius: var(--radius-sm); }`
    expect(findCssTokenViolations(chrome, css)).toEqual([])
  })

  it('flags raw hex and font-size', () => {
    const css = `.x { color: #ff0000; font-size: 14px; }`
    const hits = findCssTokenViolations(chrome, css)
    expect(hits.some((h) => h.rule === 'color')).toBe(true)
    expect(hits.some((h) => h.rule === 'font-size')).toBe(true)
  })

  it('skips token file path', () => {
    const tokens = path.join(ROOT, 'src', 'ui', 'tokens.css')
    const css = `:root { --x: #fff; font-size: 12px; }`
    expect(findCssTokenViolations(tokens, css)).toEqual([])
  })
})

describe('checkCssTokens', () => {
  it('reports no violations on the product tree', () => {
    expect(checkCssTokens(ROOT)).toEqual([])
  })
})
