import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import {
  bookPrintProfile,
  genericPrintProfile,
  setPrintProfile,
  validatePrintSettings,
} from './index'
import { makeBook, makeCustomPrintProfile } from './testing/fixtures'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

const mm = fc.double({ min: 0, max: 20, noNaN: true })

describe('profile resolution order (property, D6)', () => {
  it('built-in → library custom → snapshot → Generic with an issue', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (builtInId, inLibrary, withSnapshot) => {
          const id = builtInId ? 'generic' : 'custom-lab'
          const library = makeCustomPrintProfile({ id, safeMarginMm: 1 })
          const snapshot = makeCustomPrintProfile({ id, safeMarginMm: 2 })
          const book = makeBook({
            printProfile: {
              id,
              overrides: {},
              ...(withSnapshot ? { snapshot } : {}),
            },
          })
          const customs = inLibrary ? [library] : []
          const expected = builtInId
            ? genericPrintProfile()
            : inLibrary
              ? library
              : withSnapshot
                ? snapshot
                : genericPrintProfile()
          expect(bookPrintProfile(book, customs)).toEqual(expected)
          const unknown = !builtInId && !inLibrary && !withSnapshot
          expect(
            validatePrintSettings(book, customs).some(
              ({ code }) => code === 'unknown-profile',
            ),
          ).toBe(unknown)
        },
      ),
      runs,
    )
  })
})

describe('setPrintProfile (property, D4)', () => {
  it('clamps the bleed, takes the safe margin, keeps the rest and is idempotent', () => {
    fc.assert(
      fc.property(mm, mm, mm, mm, (bleedMm, a, b, safeMarginMm) => {
        const profile = makeCustomPrintProfile({
          bleedMinMm: Math.min(a, b),
          bleedMaxMm: Math.max(a, b),
          safeMarginMm,
        })
        const book = makeBook({
          settings: { bleedMm, safeMarginMm: 5 },
        })
        const next = setPrintProfile(book, profile.id, [profile])
        expect(next.settings.bleedMm).toBeGreaterThanOrEqual(profile.bleedMinMm)
        expect(next.settings.bleedMm).toBeLessThanOrEqual(profile.bleedMaxMm)
        if (bleedMm >= profile.bleedMinMm && bleedMm <= profile.bleedMaxMm) {
          expect(next.settings.bleedMm).toBe(bleedMm)
        }
        expect(next.settings.safeMarginMm).toBe(safeMarginMm)
        expect(next.settings.trim).toEqual(book.settings.trim)
        expect(next.spreads).toBe(book.spreads)
        expect(bookPrintProfile(next)).toEqual(profile)
        expect(setPrintProfile(next, profile.id, [profile])).toEqual(next)
      }),
      runs,
    )
  })
})
