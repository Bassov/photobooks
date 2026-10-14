import { test } from 'vitest'
import { applyBookOp, placementCountByAsset, unplacedAssetIds } from '../index'
import { largeBook } from '../testing/fixtures'

const book = largeBook(40, 1000)
const firstSpread = book.spreads[0]
const firstFrame = firstSpread?.frames[0]
const SELECTOR_BUDGET_MS = 20
const OP_BUDGET_MS = 5

test('ops and selectors on 40×1000 book', async ({ bench }) => {
  if (firstSpread === undefined || firstFrame === undefined) {
    throw new Error('largeBook fixture missing spread/frame')
  }

  const t0 = performance.now()
  placementCountByAsset(book)
  unplacedAssetIds(book)
  const selectorMs = performance.now() - t0
  if (selectorMs > SELECTOR_BUDGET_MS) {
    throw new Error(
      `selectors ${String(selectorMs)}ms > ${String(SELECTOR_BUDGET_MS)}ms`,
    )
  }

  const t1 = performance.now()
  applyBookOp(book, {
    type: 'place',
    spreadId: firstSpread.id,
    frameId: firstFrame.id,
    assetId: firstFrame.assetId ?? 'asset-0',
  })
  const opMs = performance.now() - t1
  if (opMs > OP_BUDGET_MS) {
    throw new Error(`place op ${String(opMs)}ms > ${String(OP_BUDGET_MS)}ms`)
  }

  await bench('placementCountByAsset', () => {
    placementCountByAsset(book)
  }).run()

  await bench('unplacedAssetIds', () => {
    unplacedAssetIds(book)
  }).run()

  await bench('applyBookOp place no-op on filled', () => {
    applyBookOp(book, {
      type: 'place',
      spreadId: firstSpread.id,
      frameId: firstFrame.id,
      assetId: firstFrame.assetId ?? 'asset-0',
    })
  }).run()
})
