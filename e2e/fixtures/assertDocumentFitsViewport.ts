import { expect, type Page } from '@playwright/test'

/** Assert documentElement does not exceed the viewport (no page H/V scroll). */
export async function assertDocumentFitsViewport(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      scrollHeight: doc.scrollHeight,
      clientHeight: doc.clientHeight,
    }
  })

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth)
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight)
}

/**
 * Assert a named horizontal scrollport overflows its client box.
 * Optionally nudges scrollLeft to prove the element is the scrollport.
 * Vertical scrollports (e.g. pasteboard) need a separate axis option when added.
 */
export async function assertNamedScrollport(
  page: Page,
  testId: string,
  options?: { nudgeHorizontal?: boolean },
): Promise<void> {
  const nudgeHorizontal = options?.nudgeHorizontal ?? true

  const metrics = await page.evaluate(
    ({ id, nudge }) => {
      const scroll = document.querySelector(`[data-testid="${id}"]`)
      if (!(scroll instanceof HTMLElement)) {
        throw new Error(`scrollport missing: ${id}`)
      }
      const before = scroll.scrollLeft
      if (nudge) {
        scroll.scrollLeft = Math.min(scroll.scrollWidth, before + 480)
      }
      return {
        scrollWidth: scroll.scrollWidth,
        clientWidth: scroll.clientWidth,
        scrollLeft: scroll.scrollLeft,
        scrollBefore: before,
        nudged: nudge,
      }
    },
    { id: testId, nudge: nudgeHorizontal },
  )

  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
  if (metrics.nudged) {
    expect(metrics.scrollLeft).toBeGreaterThan(metrics.scrollBefore)
  }
}
