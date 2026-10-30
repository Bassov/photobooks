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
    expect(nodes[0]?.textContent).toMatch(/heading-weight/)
    expect(nodes[0]?.textContent).toMatch(/pb-lib-change\[data-hovered\]/)
    expect(nodes[0]?.textContent).toMatch(/pb-book-object-title em/)
    expect(nodes[0]?.textContent).toMatch(/pb-lib-book-actions/)
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
