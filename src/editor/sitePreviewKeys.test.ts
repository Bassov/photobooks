import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { sitePreviewKey, type KeyMods } from './sitePreviewKeys'

const NONE: KeyMods = { alt: false, ctrl: false, meta: false, shift: false }

describe('sitePreviewKey', () => {
  it('Esc closes, with or without modifiers', () => {
    expect(sitePreviewKey('Escape', NONE, 2, 5)).toEqual({ kind: 'close' })
    expect(sitePreviewKey('Escape', { ...NONE, meta: true }, 0, 5)).toEqual({
      kind: 'close',
    })
  })

  it('Tab is trapped; Shift+Tab goes back', () => {
    expect(sitePreviewKey('Tab', NONE, 0, 5)).toEqual({
      kind: 'tab',
      back: false,
    })
    expect(sitePreviewKey('Tab', { ...NONE, shift: true }, 0, 5)).toEqual({
      kind: 'tab',
      back: true,
    })
  })

  it('arrows step and Home / End jump to the cover / last spread', () => {
    expect(sitePreviewKey('ArrowRight', NONE, 2, 5)).toEqual({
      kind: 'slide',
      slide: 3,
    })
    expect(sitePreviewKey('ArrowLeft', NONE, 2, 5)).toEqual({
      kind: 'slide',
      slide: 1,
    })
    expect(sitePreviewKey('Home', NONE, 3, 5)).toEqual({
      kind: 'slide',
      slide: 0,
    })
    expect(sitePreviewKey('End', NONE, 0, 5)).toEqual({
      kind: 'slide',
      slide: 5,
    })
  })

  it('clamps at the cover and the last spread', () => {
    expect(sitePreviewKey('ArrowLeft', NONE, 0, 5)).toEqual({
      kind: 'slide',
      slide: 0,
    })
    expect(sitePreviewKey('ArrowRight', NONE, 5, 5)).toEqual({
      kind: 'slide',
      slide: 5,
    })
  })

  it('Shift still steps; Alt / Ctrl / Meta do not', () => {
    expect(
      sitePreviewKey('ArrowRight', { ...NONE, shift: true }, 1, 5),
    ).toEqual({ kind: 'slide', slide: 2 })
    for (const mod of ['alt', 'ctrl', 'meta'] as const) {
      expect(sitePreviewKey('ArrowRight', { ...NONE, [mod]: true }, 1, 5)).toBe(
        null,
      )
    }
  })

  it('editor keys do nothing', () => {
    for (const key of ['Delete', 'Backspace', 'z', ' ', 'Enter', 'ArrowUp']) {
      expect(sitePreviewKey(key, NONE, 1, 5)).toBe(null)
    }
  })
})

const mods = fc.record({
  alt: fc.boolean(),
  ctrl: fc.boolean(),
  meta: fc.boolean(),
  shift: fc.boolean(),
})
const key = fc.oneof(
  fc.constantFrom('ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape', 'Tab'),
  fc.string({ maxLength: 3 }),
)
const position = fc
  .integer({ min: 0, max: 60 })
  .chain((n) => fc.tuple(fc.constant(n), fc.integer({ min: 0, max: n })))

describe('sitePreviewKey properties', () => {
  it('a step always lands in [0, n]', () => {
    fc.assert(
      fc.property(key, mods, position, (k, m, [n, slide]) => {
        const action = sitePreviewKey(k, m, slide, n)
        if (action?.kind === 'slide') {
          expect(action.slide).toBeGreaterThanOrEqual(0)
          expect(action.slide).toBeLessThanOrEqual(n)
        }
      }),
    )
  })

  it('Alt / Ctrl / Meta never step', () => {
    fc.assert(
      fc.property(key, mods, position, (k, m, [n, slide]) => {
        fc.pre(m.alt || m.ctrl || m.meta)
        expect(sitePreviewKey(k, m, slide, n)?.kind).not.toBe('slide')
      }),
    )
  })

  it('an arrow moves at most one slide', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ArrowLeft', 'ArrowRight'),
        position,
        (k, [n, slide]) => {
          const action = sitePreviewKey(k, NONE, slide, n)
          expect(action?.kind).toBe('slide')
          if (action?.kind === 'slide') {
            expect(Math.abs(action.slide - slide)).toBeLessThanOrEqual(1)
          }
        },
      ),
    )
  })
})
