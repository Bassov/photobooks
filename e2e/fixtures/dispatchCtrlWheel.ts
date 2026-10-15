import type { Page } from '@playwright/test'

export async function dispatchCtrlWheel(
  page: Page,
  deltaY: number,
  times: number,
): Promise<void> {
  await page.getByTestId('pasteboard-scroll').evaluate(
    (el, input) => {
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
    },
    { deltaY, times },
  )
  await page.waitForTimeout(200)
}
