import { test } from 'vitest'
import { clamp } from './clamp'

test('clamp mid-range', async ({ bench }) => {
  await bench('clamp mid-range', () => {
    clamp(50, 0, 100)
  }).run()
})
