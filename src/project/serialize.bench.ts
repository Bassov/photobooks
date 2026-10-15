import { test } from 'vitest'

import { serializeBook } from '../core'
import { largeBook } from '../core/testing/fixtures'

const book = largeBook(40, 1000)
const SERIALIZE_BUDGET_MS = 50

test('serializeBook on 1000-asset book', async ({ bench }) => {
  const t0 = performance.now()
  serializeBook(book)
  const serializeMs = performance.now() - t0
  if (serializeMs > SERIALIZE_BUDGET_MS) {
    throw new Error(
      `serializeBook ${String(serializeMs)}ms > ${String(SERIALIZE_BUDGET_MS)}ms`,
    )
  }

  await bench('serializeBook 1000 assets', () => {
    serializeBook(book)
  }).run()
})
