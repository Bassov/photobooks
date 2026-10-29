import { expect, test } from './fixtures/coverage'
import { ASSET_DRAG_MIME } from './fixtures/dropAssetOnFrame'

test.describe('look parity: page labels and drop-target visuals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=painter')
    await expect(page.getByTestId('spread-view').first()).toBeVisible()
  })

  test('page labels sit under each spread with kit numbering', async ({
    page,
  }) => {
    const labels = page.getByTestId('page-labels')
    await expect(labels.first()).toBeVisible()
    await expect(labels.first().locator('.page-label')).toHaveText(['', '1'])
    await expect(labels.nth(1).locator('.page-label')).toHaveText(['2', '3'])
  })

  test('an asset drag shows the gap pill and the chip on the hovered frame', async ({
    page,
  }) => {
    const frame = page.getByTestId('spread-frame').first()
    const gap = page.getByTestId('pasteboard-gap').first()
    await expect(gap).toHaveCSS('opacity', '0')

    await page.evaluate(
      ({ mime }) => {
        const box = document
          .querySelector('[data-testid="spread-frame"]')
          ?.getBoundingClientRect()
        const x = (box?.x ?? 0) + (box?.width ?? 0) / 2
        const y = (box?.y ?? 0) + 8
        const dataTransfer = new DataTransfer()
        dataTransfer.setData(mime, 'painter-a')
        document.dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, dataTransfer }),
        )
        document
          .querySelector('[data-testid="pasteboard-scroll"]')
          ?.dispatchEvent(
            new DragEvent('dragover', {
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
              dataTransfer,
            }),
          )
      },
      { mime: ASSET_DRAG_MIME },
    )

    await expect(gap).toHaveCSS('opacity', '1')
    await expect(page.getByTestId('page-labels').first()).toHaveCSS(
      'visibility',
      'hidden',
    )
    await expect(frame).toHaveAttribute('data-drop-hover', 'true')
    await expect(frame).toHaveAttribute(
      'data-drop-label',
      /^Release to (place|replace)$/,
    )
  })
})
