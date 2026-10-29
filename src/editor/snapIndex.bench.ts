import { test } from 'vitest'
import { buildSnapIndex, snapRect } from './snapIndex'

const QUERY_BUDGET_MS = 0.5
const FRAMES = Array.from({ length: 60 }, (_, i) => ({
  x: (i % 10) * 40,
  y: Math.floor(i / 10) * 45,
  width: 35,
  height: 40,
}))
const index = buildSnapIndex(FRAMES, [], {
  widthMm: 420,
  heightMm: 297,
  pageCount: 2,
})
const OPTIONS = { pxPerMm: 2, altKey: false }
const RECT = { x: 101, y: 98, width: 35, height: 40 }

test('snapRect query on a dense spread', async ({ bench }) => {
  const t0 = performance.now()
  snapRect(index, RECT, OPTIONS)
  const single = performance.now() - t0
  if (single > QUERY_BUDGET_MS) {
    throw new Error(
      `snapRect single query ${String(single)}ms > ${String(QUERY_BUDGET_MS)}ms`,
    )
  }

  await bench('snapRect dense spread', () => {
    snapRect(index, RECT, OPTIONS)
  }).run()
})
