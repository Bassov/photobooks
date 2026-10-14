import { test } from 'vitest'
import { resolveSpread } from '../index'
import { largeBook } from '../testing/fixtures'

const book = largeBook(40, 1000)
const middleId = book.spreads[20]?.id ?? 'spread-0'
const RESOLVE_BUDGET_MS = 5

test('resolveSpread on 40-spread book', async ({ bench }) => {
  const t0 = performance.now()
  resolveSpread(book, middleId)
  const single = performance.now() - t0
  if (single > RESOLVE_BUDGET_MS) {
    throw new Error(
      `resolveSpread single call ${String(single)}ms > ${String(RESOLVE_BUDGET_MS)}ms`,
    )
  }

  await bench('resolveSpread middle', () => {
    resolveSpread(book, middleId)
  }).run()
})
