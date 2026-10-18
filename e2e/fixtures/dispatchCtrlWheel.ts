import type { Page } from '@playwright/test'

/**
 * Dispatches ctrl/meta wheel zoom events. Events are posted in one task so the
 * app's per-frame wheel coalescing (usePasteboardCamera) matches trackpad bursts.
 * By default waits briefly afterward for paint/settle; pass `settleMs: 0` to
 * assert LoAF on the burst+paint window before gesture settle/mount work.
 */
export async function dispatchCtrlWheel(
  page: Page,
  deltaY: number,
  times: number,
  options?: { settleMs?: number },
): Promise<void> {
  await page.getByTestId('pasteboard-scroll').evaluate(
    async (el, input) => {
      const rect = el.getBoundingClientRect()
      for (let index = 0; index < input.times; index += 1) {
        el.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: input.deltaY,
            ctrlKey: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            bubbles: true,
            cancelable: true,
          }),
        )
      }
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    },
    { deltaY, times },
  )
  const settleMs = options?.settleMs ?? 200
  if (settleMs > 0) {
    await page.waitForTimeout(settleMs)
  }
}
