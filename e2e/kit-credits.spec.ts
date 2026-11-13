import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from './fixtures/coverage'

// Kit photo credits (moved from uikit/scripts/qa.mjs v0.6.0, uikit-qa-split-1):
// credit links in the kit chrome, #/full has no kit credit line, the #/credits
// page, the index footer link and PHOTO-CREDITS.md cover every bundled hi/ photo.

test.use({ viewport: { width: 1440, height: 900 } })

const UIKIT = path.resolve(process.cwd(), 'uikit')
const credit = '[data-testid="kit-photo-credits"] [data-testid="photo-credit"]'

test('v6 credit links underline on hover only', async ({ page }) => {
  await page.goto('/uikit/#/screen/library')
  const a = page.locator(`${credit} a`).first()
  await expect(a).toHaveCSS('text-decoration-line', 'none')
  await a.hover()
  await expect(a).toHaveCSS('text-decoration-line', 'underline')
})

test('v6→v8 #/full/library: no kit credit line, only the in-product Welcome caption', async ({
  page,
}) => {
  await page.goto('/uikit/#/full/library')
  await page.waitForTimeout(500)
  await expect(page.locator('[data-testid="photo-credit"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="screen-credit"]')).toHaveCount(1)
})

test('v6 #/credits page lists the 10 Commons photos + the CC0 set', async ({
  page,
}) => {
  await page.goto('/uikit/#/credits')
  await expect(
    page.locator('[data-testid="credits-hi"] [data-testid="photo-credit"]'),
  ).toHaveCount(10)
  expect(
    await page.locator('[data-testid="credits-cc0"] li').count(),
  ).toBeGreaterThanOrEqual(20)
})

test('v6 index footer links to Photo credits', async ({ page }) => {
  await page.goto('/uikit/#/')
  await expect(page.locator('[data-testid="footer-credits"]')).toHaveAttribute(
    'href',
    '#/credits',
  )
})

test('v6 PHOTO-CREDITS.md: a TASL row per bundled hi/ photo; files present, nothing extra', () => {
  const md = fs.readFileSync(path.join(UIKIT, 'PHOTO-CREDITS.md'), 'utf8')
  const hi = path.join(UIKIT, 'public', 'photos', 'hi')
  const ids = [
    'c18',
    'c18b',
    'c13',
    'r2',
    'x-tatra',
    'r7',
    'c25',
    'r8',
    'r6',
    'x-valley',
  ]
  expect(ids.filter((i) => !md.includes(`hi/${i}.jpg`))).toEqual([])
  expect(ids.filter((i) => !fs.existsSync(path.join(hi, `${i}.jpg`)))).toEqual(
    [],
  )
  expect(fs.readdirSync(hi)).toHaveLength(ids.length)
})
