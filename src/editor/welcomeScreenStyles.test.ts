import { afterEach, describe, expect, it } from 'vitest'

import { ensureWelcomeScreenStyles } from './welcomeScreenStyles'

describe('ensureWelcomeScreenStyles', () => {
  afterEach(() => {
    document.querySelectorAll('style[data-pb-welcome]').forEach((node) => {
      node.remove()
    })
  })

  it('injects welcome CSS once', () => {
    ensureWelcomeScreenStyles()
    ensureWelcomeScreenStyles()
    const nodes = document.querySelectorAll('style[data-pb-welcome]')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.textContent).toMatch(/\.pb-welcome/)
    expect(nodes[0]?.textContent).toMatch(/pb-welcome-create/)
  })

  it('no-ops when document is unavailable', () => {
    const held = globalThis.document
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: undefined,
    })
    expect(() => {
      ensureWelcomeScreenStyles()
    }).not.toThrow()
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: held,
    })
  })
})
