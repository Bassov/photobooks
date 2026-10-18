import { expect, test } from '@playwright/test'

/**
 * Intentionally timing-dependent: ~half of runs lose a race against a 50ms
 * deadline. Kept out of the default suite (testIgnore + dedicated config).
 * Burn-in with --repeat-each=10 --retries=0 must fail.
 */
test('timer races a 50ms deadline', async () => {
  const delayMs = Math.random() * 100
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
  expect(delayMs).toBeLessThan(50)
})
