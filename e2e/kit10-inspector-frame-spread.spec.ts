import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expandDisclosure } from './fixtures/expandDisclosure'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'

// uikit/src/index.css: --muted-foreground #535152, --field #D7D7D7.
const MUTED = 'rgb(83, 81, 82)'
// --foreground (--t-text #393738).
const FOREGROUND = 'rgb(57, 55, 56)'
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

const GRID = /^Grid$/

const eyebrow = (page: Page, name: string | RegExp) =>
  page.locator('.inspector-eyebrow', { hasText: name }).first()

async function paint(target: Locator) {
  return target.evaluate((el) => {
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
    // Kit disclosures start collapsed; the headings are the triggers.
    await expandDisclosure(page, 'Position & size')
    await expandDisclosure(page, 'Arrange')
    // Kit SectionHeader (uikit/src/components/app/ui.tsx:51): the eyebrow is
    // muted at rest and turns foreground while its trigger is hovered.
    await eyebrow(page, 'Arrange').hover()
    await expect(eyebrow(page, 'Arrange')).toHaveCSS('color', FOREGROUND)
    await page.getByTestId('inspector-context').hover()

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

    // Caption, Frame style and Adjust now show (uikit/src/sandbox/
    // context-inspector.tsx:71; e2e/design-inspector-book-cover.spec.ts #19).
    // Align has no behavior yet and stays hidden (D2).
    const panel = page.getByTestId('inspector-panel')
    for (const hidden of ['Align']) {
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

  test('step 20: nothing selected shows the Spread context, Layout and Grid', async ({
    page,
  }) => {
    await expect(page.getByTestId('inspector-panel')).toHaveAttribute(
      'data-inspector-view',
      'spread',
    )
    await expect(page.getByTestId('inspector-context')).toHaveText('Spread')
    // uikit/src/sandbox/context-inspector.tsx:56-63: no Spread properties
    // block; the muted eyebrow paint is asserted on the Grid eyebrow (kit
    // Section title="Grid", context-inspector.tsx:224).
    await expect(page.getByTestId('inspector-spread-properties')).toHaveCount(0)
    await expect(eyebrow(page, GRID)).toBeVisible()
    expect((await paint(eyebrow(page, GRID))).color).toBe(MUTED)

    await expect(eyebrow(page, 'Layout').first()).toBeVisible()
    await expect(page.getByTestId('layout-tile').first()).toBeVisible()
    await expect(eyebrow(page, GRID)).toBeVisible()
    // Kit grid override switch (context-inspector.tsx:227): Use master / Custom.
    const source = page
      .getByTestId('grid-section-spread')
      .getByRole('radiogroup', { name: 'Grid source' })
    await expect(source.getByRole('radio')).toHaveCount(2)
    await expect(source.locator('label')).toHaveText(['Use master', 'Custom'])
    await expect(
      source.getByRole('radio', { name: 'Use master' }),
    ).toBeChecked()
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
