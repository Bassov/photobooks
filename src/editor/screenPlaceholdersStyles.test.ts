import { afterEach, describe, expect, it } from 'vitest'

import { ensureScreenPlaceholderStyles } from './screenPlaceholdersStyles'

describe('ensureScreenPlaceholderStyles', () => {
  afterEach(() => {
    document
      .querySelectorAll('style[data-pb-screen-placeholders]')
      .forEach((node) => {
        node.remove()
      })
  })

  it('injects placeholder CSS once', () => {
    ensureScreenPlaceholderStyles()
    ensureScreenPlaceholderStyles()
    const nodes = document.querySelectorAll(
      'style[data-pb-screen-placeholders]',
    )
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.textContent).toMatch(/\.pb-screen/)
  })

  it('no-ops when document is unavailable', () => {
    const held = globalThis.document
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: undefined,
    })
    expect(() => {
      ensureScreenPlaceholderStyles()
    }).not.toThrow()
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: held,
    })
  })
})
