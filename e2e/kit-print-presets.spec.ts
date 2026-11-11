import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// design-r21-kit-presets (Designer printer-presets M102, M103): prod is the
// reference. M102: a new kit book on Generic takes Generic's bleed (3 mm) and
// safe margin (5 mm), not the old 8 mm fallback. M103: a page too small on
// both sides gets one warning per side in prod's words (profileText.test.ts).

test.use({ viewport: { width: 1440, height: 900 } })

const demo = (page: Page) => page.getByTestId('demo')

/** A new book with the Create book default page size: A5 portrait, 14.8 × 21 cm. */
async function openNewBook(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  await demo(page).getByTestId('create-library').click()
  await page.getByTestId('picker-select').click()
  await demo(page).getByTestId('new-book').click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page.getByTestId('create-book').click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
}

async function goStage(page: Page, stage: 'settings' | 'editor') {
  await page.evaluate((s) => {
    ;(window as unknown as { __demo: { go: (s: string) => void } }).__demo.go(s)
  }, stage)
}

test.beforeEach(async ({ page }) => {
  await openNewBook(page)
})

test('a new book on Generic shows Generic bleed 3 mm and safe 5 mm', async ({
  page,
}) => {
  await demo(page).getByTestId('book-title').click()
  const panel = demo(page).getByTestId('insp-book')
  await expect(panel.getByTestId('book-print-profile')).toHaveValue('generic')
  await expect(panel.getByTestId('book-bleed')).toHaveText('B3mm')
  await expect(panel.getByTestId('book-safe')).toHaveText('S5mm')
})

test('A5 against a 30–50 cm profile shows one warning per side, in prod words', async ({
  page,
}) => {
  await goStage(page, 'settings')
  await demo(page).getByText('Print presets', { exact: true }).first().click()
  await demo(page).getByTestId('print-new').click()
  const dialog = page.getByTestId('print-profile-dialog')
  await dialog.getByLabel('Name').fill('Large format')
  await dialog.getByLabel('Smallest page side').fill('300')
  await dialog.getByLabel('Largest page side').fill('500')
  await dialog.getByTestId('pp-save').click()
  await expect(dialog).toHaveCount(0)

  await goStage(page, 'editor')
  await demo(page).getByTestId('book-title').click()
  const panel = demo(page).getByTestId('insp-book')
  await panel.getByTestId('book-print-profile').selectOption({
    label: 'Large format',
  })
  await expect(
    panel.getByTestId('book-print-issue').filter({ hasText: 'takes pages' }),
  ).toHaveText([
    'Large format takes pages from 30 cm. This page is 14.8 cm wide.',
    'Large format takes pages from 30 cm. This page is 21 cm high.',
  ])
})
