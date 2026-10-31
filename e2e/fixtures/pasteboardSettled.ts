import { expect, type Page } from '@playwright/test'

/**
 * Wait until the pasteboard camera has followed the final chrome layout: the
 * import status line is gone (the dock stops resizing) and the viewport size
 * the pasteboard rendered, and refit to in the same commit, is the live size.
 */
export async function waitForPasteboardSettled(page: Page): Promise<void> {
  await expect(page.getByTestId('filmstrip-status')).toHaveCount(0, {
    timeout: 30_000,
  })
  await expect
    .poll(() =>
      page.getByTestId('pasteboard-scroll').evaluate((el) => {
        const node = el as HTMLElement
        return (
          node.dataset.viewportWidth === String(node.clientWidth) &&
          node.dataset.viewportHeight === String(node.clientHeight)
        )
      }),
    )
    .toBe(true)
}
