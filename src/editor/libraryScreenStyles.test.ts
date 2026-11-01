import { afterEach, describe, expect, it } from 'vitest'

import { ensureLibraryScreenStyles } from './libraryScreenStyles'

describe('ensureLibraryScreenStyles', () => {
  afterEach(() => {
    document.querySelectorAll('style[data-pb-library]').forEach((node) => {
      node.remove()
    })
  })

  it('injects library CSS once', () => {
    ensureLibraryScreenStyles()
    ensureLibraryScreenStyles()
    const nodes = document.querySelectorAll('style[data-pb-library]')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.textContent).toMatch(/\.pb-library/)
    expect(nodes[0]?.textContent).toMatch(/pb-lib-create/)
    expect(nodes[0]?.textContent).toMatch(/pb-lib-change\[data-hovered\]/)
    expect(nodes[0]?.textContent).toMatch(/pb-book-object-title em/)
    expect(nodes[0]?.textContent).toMatch(/pb-lib-book-actions/)
    expect(document.querySelectorAll('style[data-pb-kit-type]')).toHaveLength(1)
  })

  it('sets kit Lora display text at 400 in the upright family (round 10, M64)', () => {
    ensureLibraryScreenStyles()
    const css =
      document.querySelector('style[data-pb-library]')?.textContent ?? ''
    const rule = (sel: string) =>
      new RegExp(`\\n${sel.replace(/\./g, '\\.')} \\{([^}]*)\\}`).exec(
        css,
      )?.[1] ?? ''
    const family = "font-family: 'Lora Upright', var(--font-heading);"
    expect(rule('.pb-library-headline')).toContain('margin-bottom: 0;')
    expect(rule('.pb-library-headline')).toContain(family)
    expect(rule('.pb-library-headline')).toContain('font-weight: 400;')
    expect(rule('.pb-library-heading')).toContain('margin: 0;')
    expect(rule('.pb-library-heading')).toContain(family)
    expect(rule('.pb-library-heading')).toContain('font-weight: 400;')
    expect(rule('.pb-library-heading')).toContain('letter-spacing: normal;')
    expect(rule('.pb-book-object-title')).toContain(family)
    expect(rule('.pb-book-object-title')).toContain('font-weight: 400;')
    expect(css).not.toMatch(/font-weight: var\(--heading-weight\)/)
  })

  it('restores kit spacing the button reset drops (round 10, M64 / M66)', () => {
    ensureLibraryScreenStyles()
    const css =
      document.querySelector('style[data-pb-library]')?.textContent ?? ''
    expect(css).toMatch(
      /\.pb-library \.pb-button\.pb-lib-create \{\s*margin-top: calc\(var\(--spacing\) \* 8\);/,
    )
    expect(css).toMatch(
      /\.pb-button\.pb-settings-back \{\s*border-width: 0;\s*gap: calc\(var\(--spacing\) \* 1\);\s*padding-left: calc\(var\(--spacing\) \* 1\.5\);\s*padding-right: calc\(var\(--spacing\) \* 2\.5\);\s*\}/,
    )
  })

  it('styles the rename pill with the kit ring and keeps search focus quiet', () => {
    ensureLibraryScreenStyles()
    const css =
      document.querySelector('style[data-pb-library]')?.textContent ?? ''
    expect(css).toMatch(
      /\.pb-lib-rename:focus \{\s*box-shadow: 0 0 0 2px var\(--background\), 0 0 0 4px var\(--ring\);/,
    )
    expect(css).toMatch(/\.pb-lib-rename \{[^}]*border: 0;/)
    expect(css).not.toMatch(/\.pb-lib-quiet:focus/)
  })

  it('no-ops when document is unavailable', () => {
    const held = globalThis.document
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: undefined,
    })
    expect(() => {
      ensureLibraryScreenStyles()
    }).not.toThrow()
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: held,
    })
  })
})
