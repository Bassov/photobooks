import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openPrintFixture } from './fixtures/printJob'
import { dialog as exportDialog, openFixture } from './fixtures/siteExport'

// design-r37-dialog-title-prod (Designer walkthrough-ux-review p4, Must M144):
// the Print, Export site and Publish dialog titles track like the kit
// `.heading` title (uikit/src/index.css `letter-spacing: -0.005em`, −0.105px
// at 21px). Kit text widths at 1440 × 900 (p4/out/check.json `.texts`):
// Print 47.89, Export site 106.22, "Publish to your site" 186.55.

test.use({
  viewport: { width: 1440, height: 900 },
  channel: 'chromium',
  launchOptions: { args: ['--font-render-hinting=none'] },
})

const KIT_TRACKING = -0.105

interface TitleRead {
  text: string
  letterSpacing: number
  width: number
}

/** The dialog title's computed tracking and the width of its text run. */
async function readTitle(scope: Locator): Promise<TitleRead> {
  return scope.locator('.pb-dialog-title').evaluate((el) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    return {
      text: el.textContent.trim(),
      letterSpacing: Number.parseFloat(getComputedStyle(el).letterSpacing),
      width: range.getBoundingClientRect().width,
    }
  })
}

async function expectKitTitle(
  scope: Locator,
  text: string,
  kitWidth: number,
): Promise<void> {
  const read = await readTitle(scope)
  expect(read.text).toBe(text)
  expect(Math.abs(read.letterSpacing - KIT_TRACKING)).toBeLessThanOrEqual(0.001)
  expect(Math.abs(read.width - kitWidth)).toBeLessThanOrEqual(0.3)
}

const openPill = async (page: Page, pill: string, testId: string) => {
  await page.getByTestId(pill).click()
  const dialog = page.getByTestId(testId)
  await expect(dialog).toBeVisible()
  return dialog
}

test('the Export site dialog title tracks −0.105px like the kit', async ({
  page,
}) => {
  await openFixture(page)
  await page.getByTestId('export-site').click()
  await expect(exportDialog(page)).toHaveAttribute('data-step', 'opts')

  await expectKitTitle(exportDialog(page), 'Export site', 106.22)
})

test('the Publish dialog title tracks −0.105px like the kit', async ({
  page,
}) => {
  await openFixture(page)
  const dialog = await openPill(page, 'publish', 'publish-dialog')
  await expect(dialog).toHaveAttribute('data-step', 'connect')

  await expectKitTitle(dialog, 'Publish to your site', 186.55)
})

test('the Print dialog title tracks −0.105px like the kit', async ({
  page,
}, testInfo) => {
  await openPrintFixture(
    page,
    `print-r37-${String(testInfo.workerIndex)}-${String(Date.now())}`,
  )
  const dialog = await openPill(page, 'print', 'print-dialog')
  await expect(dialog).toHaveAttribute('data-step', 'opts')

  await expectKitTitle(dialog, 'Print', 47.89)
})
