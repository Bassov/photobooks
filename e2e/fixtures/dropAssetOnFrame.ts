import { expect, type Locator, type Page } from '@playwright/test'

/** Mime for filmstrip → pasteboard asset drag (must match `ASSET_DRAG_MIME` in app). */
export const ASSET_DRAG_MIME = 'application/x-photobooks-asset'

/**
 * A drop selects the target frame (kit: uikit/src/sandbox/canvas.tsx:170-171).
 * Most specs start from "placed, nothing selected": clear it with the frame's
 * own click toggle (Esc would also dismiss the inspector's Spread context).
 */
export async function clearDropSelection(page: Page): Promise<void> {
  const selected = page.locator(
    '[data-testid="spread-frame"][aria-pressed="true"]',
  )
  await expect(selected).toHaveCount(1)
  await selected.click()
  await expect(selected).toHaveCount(0)
}

/**
 * Synthesize a gallery asset drop onto a spread frame (kit hard-no: drag place only).
 * The drop's selection is cleared unless `keepSelection` is set.
 */
export async function dropAssetOnFrame(
  page: Page,
  assetId: string,
  frame: Locator,
  { keepSelection = false }: { keepSelection?: boolean } = {},
): Promise<void> {
  // A panel toggle just before the drop animates the spread; wait for the
  // frame to hold still so the synthetic point lands inside it.
  let prev = ''
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await frame.boundingBox())
        const settled = now === prev
        prev = now
        return settled
      },
      { intervals: [100] },
    )
    .toBe(true)
  const box = await frame.boundingBox()
  if (box === null) {
    throw new Error('frame has no box')
  }
  const point = {
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  }
  await page.evaluate(
    ({ mime, id, point: p }) => {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(mime, id)
      document.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer }),
      )
      const scroll = document.querySelector('[data-testid="pasteboard-scroll"]')
      if (!(scroll instanceof HTMLElement)) {
        throw new Error('missing pasteboard scroll')
      }
      scroll.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          ...p,
        }),
      )
      scroll.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          ...p,
        }),
      )
      document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    },
    { mime: ASSET_DRAG_MIME, id: assetId, point },
  )
  if (!keepSelection) {
    await clearDropSelection(page)
  }
}

/** Wait for a filmstrip tile's asset id, then drag-place it onto the first empty frame. */
export async function dragPlaceFirstFilmstripItem(
  page: Page,
  itemIndex = 0,
  options: { keepSelection?: boolean } = {},
): Promise<string> {
  const item = page.getByTestId('filmstrip-item').nth(itemIndex)
  await expect
    .poll(async () => {
      const id = await item.getAttribute('data-asset-id')
      return id !== null && id !== ''
    })
    .toBe(true)
  const assetId = await item.getAttribute('data-asset-id')
  if (assetId === null || assetId === '') {
    throw new Error('filmstrip item missing data-asset-id')
  }
  const frame = page
    .getByRole('button', { name: 'Place photo', exact: true })
    .first()
  await dropAssetOnFrame(page, assetId, frame, options)
  return assetId
}
