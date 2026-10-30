import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'

// Kit refs: uikit/src/components/ui/select.tsx (ListBox popover), features/create-book.tsx
// (Segmented, "Width (cm)"), sandbox/chrome.tsx (TopBar, view toggle), index.css:98 (--color-sel).
const SEL = 'rgb(202, 202, 202)'
const CLEAR = 'rgba(0, 0, 0, 0)'

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

async function openLibraryWithBook(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 })
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

test('create dialog: kit Select below the title, segmented orientation, cm fields', async ({
  page,
}) => {
  await openLibraryWithBook(page)
  await page.getByTestId('new-book').click()
  const dialog = page.getByTestId('create-book-dialog')
  await expect(dialog).toBeVisible()

  // Custom trigger (RAC keeps a visually-hidden <select> for forms), invisible radio.
  expect(
    await page.getByTestId('create-preset').evaluate((el) => el.tagName),
  ).toBe('BUTTON')
  const radio = dialog.getByRole('radio', { name: 'Portrait' })
  await expect(radio).toHaveCSS('opacity', '0')
  await expect(dialog.getByTestId('create-orientation')).toBeVisible()

  const trigger = page.getByTestId('create-preset')
  const triggerBottom = await trigger.evaluate(
    (el) => el.getBoundingClientRect().bottom,
  )
  await trigger.click()
  const list = page.getByRole('listbox')
  await expect(list).toBeVisible()
  const listTop = await list.evaluate((el) => el.getBoundingClientRect().top)
  expect(listTop).toBeGreaterThanOrEqual(triggerBottom - 1)
  const current = page.getByRole('option', { name: /A5 · 14\.8/ })
  await expect(current.locator('svg')).toHaveCount(1)
  await page.getByRole('option', { name: /A5 · 14\.8/ }).hover()
  await expect(current).toHaveCSS('background-color', SEL)

  await page.getByRole('option', { name: 'Custom size…' }).click()
  await expect(page.getByText('Width (cm)')).toBeVisible()
  await expect(page.getByText('Height (cm)')).toBeVisible()
  await expect(page.getByTestId('create-orientation')).toHaveCount(0)
})

test('library: confirm dialogs carry the leading icon tile; sort shows a check', async ({
  page,
}) => {
  await openLibraryWithBook(page)
  await page.getByTestId('change-library').click()
  const change = page.getByRole('alertdialog')
  await expect(change).toBeVisible()
  await expect(change.locator('.pb-alert-dialog-head > span svg')).toHaveCount(
    1,
  )
  await change.getByRole('button', { name: 'Cancel' }).click()

  await page.locator('[data-testid^="book-menu-"]').first().click({
    force: true,
  })
  await page.getByRole('menuitem', { name: 'Remove…' }).click()
  const remove = page.getByRole('alertdialog')
  await expect(remove.locator('.pb-alert-dialog-head > span svg')).toHaveCount(
    1,
  )
  await remove.getByRole('button', { name: 'Cancel' }).click()

  await page.getByTestId('lib-sort').click()
  const checked = page.getByRole('menuitemradio', { name: 'Last edited' })
  await expect(checked.locator('.pb-menu-item__check svg')).toHaveCount(1)
  await expect(
    page
      .getByRole('menuitemradio', { name: 'Title' })
      .locator('.pb-menu-item__check svg'),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')
})

test('library: no-results clear link is plain text, search focus is a hairline', async ({
  page,
}) => {
  await openLibraryWithBook(page)
  await page.getByTestId('lib-search-input').fill('zzzz')
  const clear = page.getByTestId('lib-clear-search')
  await expect(clear).toBeVisible()
  await expect(clear).toHaveCSS('border-top-width', '0px')
  await expect(clear).toHaveCSS('background-color', CLEAR)
  await expect(clear).toHaveCSS('text-decoration-line', 'underline')
  await expect(page.getByTestId('lib-search')).toHaveCSS('outline-width', '2px')
  await clear.click()
  await expect(page.getByTestId('lib-no-results')).toHaveCount(0)
})

test('settings: no rule between the nav and the content', async ({ page }) => {
  await openLibraryWithBook(page)
  await page.getByTestId('library-settings').click()
  await expect(page.getByTestId('settings')).toBeVisible()
  await expect(
    page.getByTestId('settings-nav-library').locator('..'),
  ).toHaveCSS('border-right-width', '0px')
})

test.describe('editor chrome', () => {
  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await openSessionEditor(page)
  })

  test('top bar: no folder button, plain undo/redo, gear opens Settings', async ({
    page,
  }) => {
    await expect(page.getByTestId('choose-photo-folder')).toHaveCount(0)
    await expect(page.getByTestId('film-add-folder')).toBeVisible()
    for (const id of ['undo', 'redo']) {
      const button = page.getByTestId(id)
      await expect(button).toBeDisabled()
      await expect(button).toHaveCSS('background-color', CLEAR)
      await expect(button).toHaveCSS('border-top-color', CLEAR)
    }
    await page.getByTestId('editor-settings-open').click()
    await expect(page.getByTestId('editor-settings')).toBeVisible()
    await page.getByTestId('editor-settings-back').click()
    await expect(page.getByTestId('editor-settings')).toHaveCount(0)
  })

  test('view toggles are ghost at rest and #CACACA when on', async ({
    page,
  }) => {
    const grid = page.getByTestId('grid-topbar-toggle')
    await page.mouse.move(0, 400)
    await expect(grid).toHaveCSS('background-color', CLEAR)
    await grid.click()
    await page.mouse.move(0, 400)
    await expect(grid).toHaveAttribute('aria-pressed', 'true')
    await expect(grid).toHaveCSS('background-color', SEL)
  })

  test('panel splitters are invisible at rest', async ({ page }) => {
    // Kit default: inspector always mounted and open (uikit/src/features/parts.tsx:26).
    await expect(page.getByTestId('panel-r')).toHaveAttribute(
      'data-open',
      'true',
    )
    await page.mouse.move(0, 400)
    const splitter = page.getByTestId('resize-right')
    await expect(splitter).toBeVisible()
    const line = await splitter.evaluate((el) => {
      const style = getComputedStyle(el, '::after')
      return { bg: style.backgroundColor, border: style.borderTopWidth }
    })
    expect(line.bg).toBe(CLEAR)
    expect(line.border).toBe('0px')
  })
})
