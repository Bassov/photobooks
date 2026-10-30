import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import { parseBook } from '../parse'
import type { Book } from '../schema'
import { applyTemplate } from '../templates/apply'
import {
  assertAgrees,
  bookCommands,
  commandFactories,
  modelOf,
  type BookModel,
  type BookRun,
} from '../testing/bookModel'
import { makeBook, makeSpread } from '../testing/fixtures'
import { applyBookOp, type BookOp } from './applyBookOp'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

function initialBook(): Book {
  return applyTemplate(
    makeBook({ spreads: [makeSpread({ id: 'spread-1', frames: [] })] }),
    'spread-1',
    'one-per-page',
  )
}

function setup(): { model: BookModel; real: BookRun } {
  const book = initialBook()
  return { model: modelOf(book), real: { book } }
}

function parses(book: Book): void {
  const result = parseBook(JSON.parse(JSON.stringify(book)))
  expect(result.ok).toBe(true)
}

describe('editor command sequences', () => {
  it('keeps the book valid and equal to the model after every step', () => {
    assertAgrees(setup().model, initialBook())
    fc.assert(
      fc.property(bookCommands({ parse: parses }), (commands) => {
        fc.modelRun(setup, commands)
      }),
      runs,
    )
  })

  it('catches a swap that drops a placement and shrinks it', () => {
    const buggy = (book: Book, op: BookOp): Book => {
      const next = applyBookOp(book, op)
      if (op.type !== 'swap' || next === book) {
        return next
      }
      return applyBookOp(next, {
        type: 'unplace',
        spreadId: op.spreadIdB,
        frameId: op.frameIdB,
      })
    }
    const result = fc.check(
      fc.property(bookCommands({ apply: buggy, parse: parses }), (commands) => {
        fc.modelRun(setup, commands)
      }),
      { seed: runs.seed, numRuns: 1000 },
    )
    expect(result.failed).toBe(true)
    const [shrunk] = result.counterexample ?? [[]]
    expect([...shrunk].length).toBeLessThanOrEqual(5)
    // 1000 runs + shrinking: explicit budget so a loaded box does not hit the 5s default.
  }, 20_000)

  // Shrunk sequences from past failures are replayed here verbatim.
  describe('regression sequences', () => {
    const c = commandFactories({ parse: parses })
    const cases: Record<string, ReturnType<typeof c.swap>[]> = {
      'swap of two placed frames keeps both placements': [
        c.addToGallery([0, 1]),
        c.place(0, 0, 0),
        c.place(0, 1, 1),
        c.swap(0, 0, 0, 1),
      ],
      'removing a placed asset clears its frame': [
        c.addToGallery([0]),
        c.place(0, 0, 0),
        c.removeFromGallery(0),
      ],
      'template reflow keeps the placement prefix': [
        c.addToGallery([0]),
        c.place(0, 0, 0),
        c.applyTemplate(0, 3),
        c.addSpread(0),
        c.moveSpread(0, 1),
      ],
    }
    for (const [name, commands] of Object.entries(cases)) {
      it(name, () => {
        fc.modelRun(setup, commands)
      })
    }
  })
})
