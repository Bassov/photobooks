import { test } from 'vitest'
import { aspectRatio } from './aspectRatio'
import { normalizeOrientation } from './normalizeOrientation'

test('normalizeOrientation all values', async ({ bench }) => {
  await bench('normalizeOrientation all values', () => {
    for (let o = 1; o <= 8; o += 1) {
      normalizeOrientation(o as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, 6000, 4000)
    }
  }).run()
})

test('aspectRatio 6000x4000', async ({ bench }) => {
  await bench('aspectRatio 6000x4000', () => {
    aspectRatio(6000, 4000)
  }).run()
})
