import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import {
  imposition,
  type ImposedSheet,
  type ImposedSlot,
  type ImpositionLayout,
} from './imposition'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number } }

/** The 2-up sheets a sheet becomes once 4-up sheets are cut across. */
function saddleSheets(sheet: ImposedSheet, rows: number): ImposedSheet[] {
  return Array.from({ length: rows }, (_, row) => ({
    front: sheet.front.slice(row * 2, row * 2 + 2),
    back: sheet.back.slice(row * 2, row * 2 + 2),
  }))
}

/** Stack the sheets in order, fold them in the middle, read every page. */
function readFolded(saddles: ImposedSheet[]): ImposedSlot[] {
  const firstHalf = saddles.flatMap(({ front, back }) => [front[1], back[0]])
  const secondHalf = [...saddles]
    .reverse()
    .flatMap(({ front, back }) => [back[1], front[0]])
  return [...firstHalf, ...secondHalf].map((slot) => slot ?? null)
}

describe('imposition (property)', () => {
  it('folded sheets read 1..N with minimal padding, back cover last', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.constantFrom<ImpositionLayout>('2up', '4up'),
        (pages, layout) => {
          const perSheet = layout === '2up' ? 4 : 8
          const { rows, blanks, sheets } = imposition(pages, layout)

          const read = readFolded(
            sheets.flatMap((sheet) => saddleSheets(sheet, rows)),
          )

          expect(read.filter((slot) => slot !== null)).toEqual(
            Array.from({ length: pages }, (_, index) => index + 1),
          )
          expect(read).toHaveLength(pages + blanks)
          expect(blanks).toBeGreaterThanOrEqual(0)
          expect(blanks).toBeLessThan(perSheet)
          expect((pages + blanks) % perSheet).toBe(0)
          if (pages > 1) expect(read.at(-1)).toBe(pages)
        },
      ),
      { seed: gates.pbt.seed, numRuns: 400 },
    )
  })
})
