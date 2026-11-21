import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Interface size §3: under `#root { zoom: s }` a raw viewport unit is s× too
 * big, so app code uses the `--app-*` tokens (styles/app.css) or the
 * `h-app` / `min-h-app` utilities. `src/site` (the visitor site) is excluded.
 */
const ROOTS = ['src/editor', 'src/ui', 'src/render']

/** Kit-mirrored files (a drift test keeps them byte-identical with uikit). */
const KIT_MIRRORED = new Set([
  // uikit/src/features/unsupported.css; switches with item interface-size-kit.
  'src/editor/UnsupportedBrowserScreen.css',
])

const RAW_UNIT = /\d(?:dvh|svh|lvh|vh|vw)\b/
const TAILWIND_VIEWPORT = /\b(?:min-|max-)?[hw]-(?:dvh|svh|lvh|screen)\b/
/** `calc(var(--app-vw) -2rem)` is invalid CSS: calc needs a space after ±. */
const UNSPACED_TOKEN_MATH = /var\(--app-[a-z]+\)\s*[-+](?!\s)/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return sourceFiles(path)
    }
    return /\.(?:css|ts|tsx)$/.test(entry.name) &&
      !/\.(?:test|spec)\.tsx?$/.test(entry.name)
      ? [path]
      : []
  })
}

function rawViewportUnits(text: string): string[] {
  return text
    .split('\n')
    .flatMap((line, i) =>
      RAW_UNIT.test(line) ||
      TAILWIND_VIEWPORT.test(line) ||
      UNSPACED_TOKEN_MATH.test(line)
        ? [`${String(i + 1)}: ${line.trim()}`]
        : [],
    )
}

describe('viewport units', () => {
  it('finds raw units and Tailwind viewport classes', () => {
    expect(rawViewportUnits('a { height: 100svh }\nb { width: 1px }')).toEqual([
      '1: a { height: 100svh }',
    ])
    expect(rawViewportUnits('x\n<div className="h-dvh w-full">')).toEqual([
      '2: <div className="h-dvh w-full">',
    ])
    expect(rawViewportUnits('min(12rem, 40vw)')).toHaveLength(1)
    expect(rawViewportUnits('max-h-screen')).toHaveLength(1)
    expect(rawViewportUnits('height: var(--app-dvh); h-app min-h-app')).toEqual(
      [],
    )
    expect(rawViewportUnits('calc(var(--app-vw) -2rem)')).toHaveLength(1)
    expect(rawViewportUnits('calc(var(--app-vh) +1px)')).toHaveLength(1)
    expect(rawViewportUnits('calc(var(--app-vw) - 2rem)')).toEqual([])
  })

  it('keeps raw vh / dvh / svh / vw out of src/editor, src/ui and src/render', () => {
    const files = ROOTS.flatMap(sourceFiles)
    expect(files.length).toBeGreaterThan(100)
    const hits = files
      .filter((file) => !KIT_MIRRORED.has(file.split('\\').join('/')))
      .flatMap((file) =>
        rawViewportUnits(readFileSync(file, 'utf8')).map(
          (hit) => `${file}:${hit}`,
        ),
      )
    expect(hits).toEqual([])
  })
})
