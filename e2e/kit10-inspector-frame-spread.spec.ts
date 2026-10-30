import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'

// uikit/src/index.css: --muted-foreground #535152, --field #D7D7D7.
const MUTED = 'rgb(83, 81, 82)'
const FIELD = 'rgb(215, 215, 215)'

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
})

const eyebrow = (page: Page, name: string) =>
  page.locator('.inspector-eyebrow', { hasText: name }).first()

async function paint(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      bg: s.backgroundColor,
      color: s.color,
      transform: s.textTransform,
      weight: s.fontWeight,
    }
  })
}

test.describe('kit v0.10 inspector (demo steps 16, 20)', () => {
  test('step 16: frame selected shows Photo context, kit sections, no blue', async ({
    page,
  }) => {
    await page.getByTestId('spread-frame').first().click()
    await expect(page.getByTestId('inspector-context')).toHaveText('Photo')

    for (const name of ['Position & size', 'Arrange']) {
      const heading = eyebrow(page, name)
      await expect(heading).toBeVisible()
      const style = await heading.evaluate((el) => {
        const s = getComputedStyle(el)
        return {
          color: s.color,
          transform: s.textTransform,
          weight: s.fontWeight,
        }
      })
      expect(style).toEqual({
        color: MUTED,
        transform: 'uppercase',
        weight: '600',
      })
    }

    const field = page.getByRole('textbox', { name: 'Width' }).locator('..')
    expect(
      await field.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(FIELD)

    // Sections the product has no behavior for yet stay hidden (D2).
    const panel = page.getByTestId('inspector-panel')
    for (const hidden of ['Caption', 'Frame style', 'Adjust', 'Align']) {
      await expect(panel.getByText(hidden, { exact: true })).toHaveCount(0)
    }
    await expect(page.getByTestId('frame-delete')).toBeVisible()

    // Shipped behavior survives the restyle: lock disables the geometry fields.
    await page.getByTestId('frame-lock').click()
    await expect(page.getByRole('textbox', { name: 'Width' })).toBeDisabled()
    await page.getByTestId('frame-lock').click()
    await expect(page.getByRole('textbox', { name: 'Width' })).toBeEnabled()
    await expect(page.getByTestId('z-front')).toBeVisible()
    await assertDocumentFitsViewport(page)
  })

  test('step 20: nothing selected shows Spread properties, Layout and Grid', async ({
    page,
  }) => {
    await expect(page.getByTestId('inspector-panel')).toHaveAttribute(
      'data-inspector-view',
      'spread',
    )
    await expect(page.getByTestId('inspector-context')).toHaveText('Spread')
    await expect(page.getByTestId('inspector-spread-properties')).toBeVisible()
    expect((await paint(page, 'inspector-spread-properties')).color).toBe(MUTED)

    await page.getByTestId('inspector-tab-spread').click()
    await expect(eyebrow(page, 'Layout').first()).toBeVisible()
    await expect(page.getByTestId('layout-tile').first()).toBeVisible()
    await expect(eyebrow(page, 'Layout grid')).toBeVisible()
    // The grid override (Use master / Custom) is P2 layout-grids-parent-inherit.
    await expect(page.getByText('Use master')).toHaveCount(0)
    await assertDocumentFitsViewport(page)
  })

  test('inspector is 300 px wide and has no horizontal overflow', async ({
    page,
  }) => {
    await page.getByTestId('spread-frame').first().click()
    const metrics = await page
      .getByTestId('inspector-panel')
      .evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        overflowX: el.scrollWidth > el.clientWidth,
      }))
    expect(metrics.width).toBeCloseTo(300, 0)
    expect(metrics.overflowX).toBe(false)
  })
})
