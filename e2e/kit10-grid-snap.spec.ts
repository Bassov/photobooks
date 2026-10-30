import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'

// uikit/src/index.css: --muted-foreground #535152, --field #D7D7D7,
// --grid-line rgb(83 81 82 / .6) (:187). Top-bar toggles (design-create-library-chrome #7):
// ghost at rest, on = --color-sel #CACACA (uikit/src/index.css:98), as the kit's
// chrome.tsx:211 view toggle (ghost, pressed fill) — black / dark fills are reserved.
const MUTED = 'rgb(83, 81, 82)'
const FIELD = 'rgb(215, 215, 215)'
const TOGGLE_ON = 'rgb(202, 202, 202)'
const TOGGLE_OFF = 'rgba(0, 0, 0, 0)'
const GRID_LINE = 'rgba(83, 81, 82, 0.6)'

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
})

const background = (page: import('@playwright/test').Page, testId: string) =>
  page
    .getByTestId(testId)
    .evaluate((el) => getComputedStyle(el).backgroundColor)

test.describe('kit v0.10 grid and snap (demo steps 14, 20)', () => {
  test('step 14: top bar grid and snap toggles are gray, view-only', async ({
    page,
  }) => {
    const grid = page.getByTestId('grid-topbar-toggle')
    const snap = page.getByTestId('snap-topbar-toggle')
    await expect(grid).toHaveAttribute('aria-pressed', 'false')
    // Fills are read at rest (pointer away, transition settled).
    await page.mouse.move(0, 400)
    await expect
      .poll(() => background(page, 'grid-topbar-toggle'))
      .toBe(TOGGLE_OFF)

    await grid.click()
    await expect(grid).toHaveAttribute('aria-pressed', 'true')
    await page.mouse.move(0, 400)
    await expect
      .poll(() => background(page, 'grid-topbar-toggle'))
      .toBe(TOGGLE_ON)

    const snapBefore = await snap.getAttribute('aria-pressed')
    await snap.click()
    await expect(snap).not.toHaveAttribute('aria-pressed', snapBefore ?? '')
    const flipped = await snap.getAttribute('aria-pressed')
    await page.mouse.move(0, 400)
    await expect
      .poll(() => background(page, 'snap-topbar-toggle'))
      .toBe(flipped === 'true' ? TOGGLE_ON : TOGGLE_OFF)

    // Toggles change the view only: no undo entry is created.
    await expect(page.getByTestId('undo')).toBeDisabled()
    await assertDocumentFitsViewport(page)
  })

  test('step 14: grid renders in gray with no blue or teal', async ({
    page,
  }) => {
    await page.getByTestId('grid-topbar-toggle').click()
    const content = page.getByTestId('grid-overlay-content').first()
    await expect(content).toBeVisible()
    const paint = await content.evaluate((el) => {
      const s = getComputedStyle(el)
      return { stroke: s.stroke, dash: el.getAttribute('stroke-dasharray') }
    })
    expect(paint.stroke).toBe(GRID_LINE)
    expect(paint.dash).toBeTruthy()
    const fill = await page
      .getByTestId('grid-overlay-column')
      .first()
      .evaluate((el) => getComputedStyle(el).fill)
    expect(fill).toBe('rgba(83, 81, 82, 0.1)')
    await assertDocumentFitsViewport(page)
  })

  test('step 20: spread Layout grid section has kit structure and tokens', async ({
    page,
  }) => {
    const section = page.getByTestId('grid-section-spread')
    await expect(section).toBeVisible()
    const heading = section.locator('.inspector-eyebrow')
    await expect(heading).toHaveText('Layout grid')
    expect(
      await heading.evaluate((el) => {
        const s = getComputedStyle(el)
        return { color: s.color, transform: s.textTransform }
      }),
    ).toEqual({ color: MUTED, transform: 'uppercase' })
    await expect(section.getByTestId('grid-summary')).toHaveText('2×2')

    for (const label of [
      'Top',
      'Bottom',
      'Inside',
      'Outside',
      'Columns',
      'Rows',
      'Column gutter',
      'Row gutter',
    ]) {
      await expect(section.getByRole('textbox', { name: label })).toBeVisible()
    }
    const field = section.getByRole('textbox', { name: 'Top' }).locator('..')
    expect(
      await field.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(FIELD)

    // Section eye toggle mirrors the top bar toggle (one shared view state).
    const eye = section.getByTestId('grid-toggle')
    await eye.click()
    await expect(page.getByTestId('grid-topbar-toggle')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByTestId('grid-overlay').first()).toBeVisible()
    await assertDocumentFitsViewport(page)
  })

  test('step 20: out-of-range column count clamps', async ({ page }) => {
    const section = page.getByTestId('grid-section-spread')
    const columns = section.getByRole('textbox', { name: 'Columns' })
    await columns.fill('99')
    await columns.press('Enter')
    await expect(section.getByTestId('grid-summary')).toHaveText('12×2')
    await columns.fill('0')
    await columns.press('Enter')
    await expect(section.getByTestId('grid-summary')).toHaveText('1×2')
    await assertDocumentFitsViewport(page)
  })
})
