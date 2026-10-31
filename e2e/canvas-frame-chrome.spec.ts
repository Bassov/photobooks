import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
})

test.describe('look parity: canvas frame chrome', () => {
  test('an empty frame shows the kit "Drop photo" hint', async ({ page }) => {
    const frame = page.getByTestId('spread-frame').first()
    await expect(frame).toHaveAttribute('data-filled', 'false')
    await expect(frame.getByTestId('frame-empty-label')).toHaveText(
      'Drop photo',
    )
    await expect(frame.locator('[data-glyph="image-plus"]')).toBeVisible()
  })

  test('hovering an unselected frame draws the select outline', async ({
    page,
  }) => {
    const frame = page.getByTestId('spread-frame').first()
    await expect(frame).not.toHaveAttribute('aria-pressed', 'true')
    const outline = () =>
      frame.evaluate((el) => {
        const style = getComputedStyle(el, '::after')
        return `${style.outlineStyle} ${style.outlineWidth}`
      })
    await expect.poll(outline).toBe('solid 1px')
    const color = () =>
      frame.evaluate((el) => getComputedStyle(el, '::after').outlineColor)
    await expect.poll(color).toMatch(/^(rgba\(.*, 0\)|transparent)$/)
    await frame.hover()
    await expect
      .poll(color)
      .not.toMatch(/^(rgba\(.*, 0\)|transparent|rgba\(0, 0, 0, 0\))$/)
  })

  test('selecting a frame shows no size tag and no rotate handle', async ({
    page,
  }) => {
    const frame = page.getByTestId('spread-frame').first()
    await frame.click()
    await expect(frame).toHaveAttribute('aria-pressed', 'true')
    // Owner design change (round 7, M52): no size tag exists in any mode.
    await expect(page.getByTestId('frame-size-tag')).toHaveCount(0)
    // Kit select tool has no rotate knob (uikit/src/sandbox/canvas.tsx:224,443).
    await expect(frame.getByTestId('rotate-handle')).toHaveCount(0)
    await expect(frame.locator('.spread-frame-rotate-line')).toHaveCount(0)
  })
})
