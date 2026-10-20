import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  MUTED_FOREGROUND_LIGHT_AA,
  checkCssTokens,
  checkMutedForegroundAa,
  findCssTokenViolations,
  readMutedForegroundLight,
} from './check-css-tokens.mjs'

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

describe('muted-foreground AA lock', () => {
  it('reads the first --muted-foreground hex', () => {
    expect(
      readMutedForegroundLight(
        ':root { --muted-foreground: #6A6761; } html[data-theme="b-dark"] { --muted-foreground: #9a968f; }',
      ),
    ).toBe('#6a6761')
    expect(readMutedForegroundLight('.x { color: red; }')).toBeNull()
  })

  it('accepts the product tokens.css light muted-foreground', () => {
    expect(checkMutedForegroundAa(ROOT)).toEqual([])
    expect(MUTED_FOREGROUND_LIGHT_AA).toBe('#6a6761')
  })

  it('flags a lighter muted-foreground that would break AA', () => {
    const tmp = path.join(ROOT, '.cache', 'muted-fg-aa-fixture')
    fs.mkdirSync(path.join(tmp, 'src', 'ui'), { recursive: true })
    fs.writeFileSync(
      path.join(tmp, 'src', 'ui', 'tokens.css'),
      ':root { --muted-foreground: #74716b; }\n',
      'utf8',
    )
    const hits = checkMutedForegroundAa(tmp)
    expect(hits).toHaveLength(1)
    expect(hits[0]?.rule).toBe('muted-foreground-aa')
  })
})
