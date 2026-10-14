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
  options?: { nudgeHorizontal?: boolean; axis?: 'horizontal' | 'vertical' },
): Promise<void> {
  const axis = options?.axis ?? 'horizontal'
  const nudge = options?.nudgeHorizontal ?? true

  const metrics = await page.evaluate(
    ({ id, shouldNudge, scrollAxis }) => {
      const scroll = document.querySelector(`[data-testid="${id}"]`)
      if (!(scroll instanceof HTMLElement)) {
        throw new Error(`scrollport missing: ${id}`)
      }
      if (scrollAxis === 'vertical') {
        const before = scroll.scrollTop
        if (shouldNudge) {
          scroll.scrollTop = Math.min(scroll.scrollHeight, before + 480)
        }
        return {
          extent: scroll.scrollHeight,
          client: scroll.clientHeight,
          position: scroll.scrollTop,
          before,
          nudged: shouldNudge,
        }
      }
      const before = scroll.scrollLeft
      if (shouldNudge) {
        scroll.scrollLeft = Math.min(scroll.scrollWidth, before + 480)
      }
      return {
        extent: scroll.scrollWidth,
        client: scroll.clientWidth,
        position: scroll.scrollLeft,
        before,
        nudged: shouldNudge,
      }
    },
    { id: testId, shouldNudge: nudge, scrollAxis: axis },
  )

  expect(metrics.extent).toBeGreaterThan(metrics.client)
  if (metrics.nudged) {
    expect(metrics.position).toBeGreaterThan(metrics.before)
  }
}
