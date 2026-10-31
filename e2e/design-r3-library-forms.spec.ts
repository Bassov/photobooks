import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'

// Values measured on the rendered kit `#/demo` (1440x900), steps 07 / 43 / 46:
// uikit/src/demo-parts/library.tsx:53-54 (rename Input), uikit/src/features/
// library.tsx:123-127 (LibSearch), uikit/src/features/create-book.tsx:30-33.
const FIELD = 'rgb(215, 215, 215)'
const KIT_RING =
  'rgb(225, 225, 225) 0px 0px 0px 2px, rgb(58, 56, 57) 0px 0px 0px 4px'

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

async function openLibraryWithBook(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) {
      throw new Error('missing api')
    }
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) {
      throw new Error(attached.code ?? 'attach')
    }
    const created = await api.createBookInLibrary()
    if (!created.ok) {
      throw new Error(created.code ?? 'create')
    }
    await api.leaveEditorForLibrary()
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
}

async function openRename(page: Page): Promise<Locator> {
  await page.locator('[data-testid^="book-card"]').first().hover()
  await page.locator('[data-testid^="book-menu-"]').first().click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  const input = page.getByTestId('rename-input')
  await expect(input).toBeVisible()
  return input
}

async function expectQuietFocus(box: Locator): Promise<void> {
  await expect(box).toHaveCSS('outline-style', 'none')
  await expect(box).toHaveCSS('box-shadow', 'none')
  await expect(box).toHaveCSS('background-color', FIELD)
}

test('library rename (step 43): kit pill, focused with the kit ring', async ({
  page,
}) => {
  await openLibraryWithBook(page)
  const input = await openRename(page)
  // Kit keeps focus in the field after the menu closes (no click needed).
  await expect(input).toBeFocused()
  await expect(input).toHaveCSS('border-radius', '8px')
  await expect(input).toHaveCSS('border-top-width', '0px')
  await expect(input).toHaveCSS('border-bottom-width', '0px')
  await expect(input).toHaveCSS('padding', '8px')
  await expect(input).toHaveCSS('height', '28px')
  await expect(input).toHaveCSS('background-color', FIELD)
  await expect(input).toHaveCSS('outline-style', 'none')
  await expect(input).toHaveCSS('color', 'rgb(57, 55, 56)')
  await expect(input).toHaveCSS('font-size', '13px')
  const shadow = await input.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(shadow).toContain(KIT_RING)
})

test('library rename (step 43): Enter commits, Escape cancels', async ({
  page,
}) => {
  await openLibraryWithBook(page)
  const card = page.locator('[data-testid^="book-card"]').first()
  const before = (await card.textContent()) ?? ''

  const escaped = await openRename(page)
  await page.keyboard.type('Ignored title')
  await page.keyboard.press('Escape')
  await expect(escaped).toHaveCount(0)
  await expect(card).not.toContainText('Ignored title')
  expect((await card.textContent()) ?? '').toBe(before)

  await openRename(page)
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Lake trip')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('rename-input')).toHaveCount(0)
  await expect(card).toContainText('Lake trip')
})

test('library search (step 46): quiet focus, no dark ring', async ({
  page,
}) => {
  await openLibraryWithBook(page)
  const input = page.getByTestId('lib-search-input')
  await input.fill('zzz')
  await expect(input).toBeFocused()
  await expect(page.getByTestId('lib-no-results')).toBeVisible()
  await expectQuietFocus(page.getByTestId('lib-search'))
  await expect(input).toHaveCSS('outline-style', 'none')
  await expect(input).toHaveCSS('box-shadow', 'none')
})

test('create book custom size (step 07): Width / Height focus without a dark border', async ({
  page,
}) => {
  await openLibraryWithBook(page)
  await page.getByTestId('new-book').click()
  await page.getByTestId('create-preset').click()
  await page.getByRole('listbox').getByRole('option').last().click()
  for (const id of ['create-custom-w', 'create-custom-h']) {
    const input = page.getByTestId(id)
    await input.fill('19')
    await expect(input).toBeFocused()
    const wrap = input.locator('..')
    await expectQuietFocus(wrap)
    await expect(wrap).toHaveCSS('border-top-color', FIELD)
    await expect(input).toHaveCSS('outline-style', 'none')
    await expect(input).toHaveCSS('box-shadow', 'none')
  }
})
