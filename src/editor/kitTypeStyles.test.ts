import { afterEach, describe, expect, it } from 'vitest'

import {
  ensureKitTypeStyles,
  KIT_DISPLAY_FAMILY,
  KIT_DISPLAY_FONT,
} from './kitTypeStyles'

function css(): string {
  return document.querySelector('style[data-pb-kit-type]')?.textContent ?? ''
}

describe('ensureKitTypeStyles', () => {
  afterEach(() => {
    document.querySelectorAll('style[data-pb-kit-type]').forEach((node) => {
      node.remove()
    })
  })

  it('injects once', () => {
    ensureKitTypeStyles()
    ensureKitTypeStyles()
    expect(document.querySelectorAll('style[data-pb-kit-type]')).toHaveLength(1)
    expect(
      document
        .querySelector('style[data-pb-kit-type]')
        ?.getAttribute('data-pb-kit-type'),
    ).toBe('1')
  })

  it('declares upright-only Lora faces so <em> synthesizes the kit oblique', () => {
    ensureKitTypeStyles()
    const faces = css().match(/@font-face \{[^}]*\}/g) ?? []
    expect(faces).toHaveLength(3)
    expect(css()).not.toMatch(/italic/)
    for (const script of ['cyrillic', 'latin-ext', 'latin']) {
      const face = faces.find((f) =>
        f.includes(`url('/fonts/lora-${script}-wght-normal.woff2')`),
      )
      expect(face, script).toBeDefined()
      expect(face).toContain("font-family: 'Lora Upright';")
      expect(face).toContain('font-style: normal;')
      expect(face).toContain('font-display: swap;')
      expect(face).toContain('font-weight: 400 700;')
      expect(face).toContain("format('woff2-variations')")
    }
    const latin = faces.find((f) => f.includes('lora-latin-wght'))
    expect(latin).toMatch(/unicode-range: U\+0000-00FF, U\+0131/)
  })

  it('scopes the kit xs / sm line-heights', () => {
    ensureKitTypeStyles()
    expect(css()).toMatch(
      /\.pb-kit-type \{\s*--text-xs--line-height: 1\.4;\s*--text-sm--line-height: 1\.45;\s*\}/,
    )
  })

  it('exposes the display font stack with the heading fallback', () => {
    expect(KIT_DISPLAY_FAMILY).toBe('Lora Upright')
    expect(KIT_DISPLAY_FONT).toBe("'Lora Upright', var(--font-heading)")
  })

  it('no-ops when document is unavailable', () => {
    const held = globalThis.document
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: undefined,
    })
    expect(() => {
      ensureKitTypeStyles()
    }).not.toThrow()
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: held,
    })
    expect(document.querySelector('style[data-pb-kit-type]')).toBeNull()
  })
})
