import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'

// Kit refs: uikit/src/features/library.tsx:87 (bar h-14), :127 (search focus),
// :171 (card pt-8), :228 (container px-12), :238 (heading row pt-10), :261-263 (rename Input);
// uikit/src/demo-parts/settings.tsx:24-50 (rows, cache size), :28-29 (content top).

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

test('library: heading row, create button and card sit on the kit offsets', async ({
  page,
}) => {
  await openLibraryWithBook(page)
  const m = await page.evaluate(() => {
    const box = (selector: string) => {
      const el = document.querySelector(selector)
      if (!el) {
        throw new Error(selector)
      }
      const b = el.getBoundingClientRect()
      return { x: b.x, y: b.y, bottom: b.bottom }
    }
    return {
      bar: box('[data-testid=library-bar]'),
      h1: box('h1'),
      h1Margin: getComputedStyle(document.querySelector('h1') ?? document.body)
        .marginTop,
      btn: box('[data-testid=new-book]'),
      card: box('[data-testid=book-card]'),
    }
  })
  expect(m.bar.bottom).toBe(56)
  expect(m.h1Margin).toBe('0px')
  expect(m.h1.x).toBe(128) // (1440 - 1280) / 2 + px-12
  // Row = pt-10 (40) + 40px button; heading is bottom-aligned in the row.
  expect(m.btn.y).toBe(56 + 40)
  expect(m.h1.y).toBeLessThan(m.btn.bottom)
  expect(m.h1.y).toBeGreaterThanOrEqual(m.btn.y)
  // Card starts after the row's pb-2 (8) and carries its own pt-8 inside.
  expect(m.card.y).toBe(m.btn.bottom + 8)
})

// Rendered #/demo: the kit's focus-within outline is cancelled by outline-hidden,
// so focus is the flat field fill with no ring (design-r3-library-forms).
test('library: search focus is the kit flat fill without a ring', async ({
  page,
}) => {
  await openLibraryWithBook(page)
  await page.getByTestId('lib-search-input').focus()
  await expect(page.getByTestId('lib-search-input')).toBeFocused()
  const search = page.getByTestId('lib-search')
  await expect(search).toHaveCSS('outline-style', 'none')
  await expect(search).toHaveCSS('box-shadow', 'none')
  await expect(search).toHaveCSS('background-color', 'rgb(215, 215, 215)')
})

test('library: rename input is the field pill with the kit focus ring', async ({
  page,
}) => {
  await openLibraryWithBook(page)
  await page.locator('[data-testid^="book-card"]').first().hover()
  await page.locator('[data-testid^="book-menu-"]').first().click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  const input = page.getByTestId('rename-input')
  await input.click()
  await expect(input).toBeFocused()
  await expect(input).toHaveCSS('border-radius', '8px')
  await expect(input).toHaveCSS('height', '28px')
  await expect(input).toHaveCSS('outline-style', 'none')
  const shadow = await input.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(shadow).toContain('0px 0px 0px 2px')
  expect(shadow).toContain('0px 0px 0px 4px')
})

test('settings: aligned top, borderless folder tile, real preview cache size', async ({
  page,
}) => {
  await openLibraryWithBook(page)
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('photobooks-derived', {
      create: true,
    })
    const handle = await dir.getFileHandle('r2-size-probe', { create: true })
    const writable = await handle.createWritable()
    await writable.write(new Uint8Array(3 * 1024 * 1024))
    await writable.close()
  })
  await page.getByTestId('library-settings').click()
  await expect(page.getByTestId('settings')).toBeVisible()

  const title = page.getByTestId('settings-section-title')
  await expect(title).toHaveCSS('margin-top', '0px')
  const tops = await page.evaluate(() => {
    const top = (testId: string): number =>
      document.querySelector(`[data-testid=${testId}]`)?.getBoundingClientRect()
        .y ?? Number.NaN
    return top('settings-section-title') - top('settings-scroll')
  })
  expect(tops).toBe(24) // py-6, kit settings.tsx:28

  const tile = page
    .getByTestId('library-settings-panel')
    .locator('span.grid')
    .first()
  await expect(tile).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')

  await expect(page.getByTestId('settings-preview-cache')).toHaveText(
    /^[3-9](\.\d)? MB$|^\d{2,} MB$/,
  )
  await expect(page.getByText('Rebuilt automatically if cleared')).toBeVisible()

  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('photobooks-derived')
    await dir.removeEntry('r2-size-probe')
  })
})
