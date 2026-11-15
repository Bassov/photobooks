import { expect, type Page } from '@playwright/test'

/**
 * Waits until the pasteboard camera is at rest: no live zoom gesture paint on
 * the world (usePasteboardCamera clears it on settle) and the first spread's
 * box unchanged between two samples taken a poll interval apart.
 */
export async function settleCamera(page: Page): Promise<void> {
  let previous = ''
  await expect
    .poll(async () => {
      const sample = await page
        .getByTestId('pasteboard-scroll')
        .evaluate(async (el) => {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                resolve()
              })
            })
          })
          const world = el.querySelector('[data-testid="pasteboard-world"]')
          const live =
            world instanceof HTMLElement &&
            (world.dataset.gesture !== undefined ||
              world.style.transform !== '')
          const spread = el
            .querySelector('[data-testid="spread-view"]')
            ?.getBoundingClientRect()
          return live || spread === undefined
            ? 'live'
            : [spread.x, spread.y, spread.width, spread.height].join(',')
        })
      const held = sample !== 'live' && sample === previous
      previous = sample
      return held
    })
    .toBe(true)
}

/**
 * Dispatches ctrl/meta wheel zoom events. Events are posted in one task so the
 * app's per-frame wheel coalescing (usePasteboardCamera) matches trackpad bursts.
 * By default waits for the camera to settle afterward; pass `settle: false` to
 * assert LoAF on the burst+paint window before gesture settle/mount work.
 */
export async function dispatchCtrlWheel(
  page: Page,
  deltaY: number,
  times: number,
  options?: { settle?: boolean },
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
  if (options?.settle !== false) {
    await settleCamera(page)
  }
}
