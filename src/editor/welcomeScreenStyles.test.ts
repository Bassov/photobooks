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
    expect(nodes[0]?.textContent).toMatch(
      /\.pb-welcome-headline\s*\{[^}]*font-weight:\s*400/,
    )
    expect(document.querySelectorAll('style[data-pb-kit-type]')).toHaveLength(1)
  })

  it('drops the UA h1 margin and uses the upright display family (round 10, M65)', () => {
    ensureWelcomeScreenStyles()
    const css =
      document.querySelector('style[data-pb-welcome]')?.textContent ?? ''
    const headline = /\n\.pb-welcome-headline \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(headline).toMatch(/^\s*margin-bottom: 0;/)
    expect(headline).toContain(
      "font-family: 'Lora Upright', var(--font-heading);",
    )
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
