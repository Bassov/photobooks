import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// Designer parity site-settings (M113): Settings nav icons paint the kit's
// muted ink, the Hosting R2 tokens link icon is 12×12.

const MUTED = [83, 81, 82]
const SECTIONS = ['library', 'hosting', 'site', 'print']

async function openSettings(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(() => {
    window.__photobooksProject?.startSessionEditor()
  })
  await expect(page.getByTestId('go-library')).toBeEnabled({ timeout: 15_000 })
  await page.getByTestId('editor-settings-open').click()
}

/** Darkest pixel in the box: the fully covered stroke ink. */
async function darkest(box: Locator) {
  const b = await box.boundingBox()
  if (b === null) throw new Error('icon not visible')
  const points = Array.from(
    { length: Math.floor(b.width) * Math.floor(b.height) },
    (_, i) => ({
      x: i % Math.floor(b.width),
      y: Math.floor(i / Math.floor(b.width)),
    }),
  )
  const px = await pixelsAt(box, points)
  return px.reduce((a, p) =>
    (p[0] ?? 0) + (p[1] ?? 0) + (p[2] ?? 0) <
    (a[0] ?? 0) + (a[1] ?? 0) + (a[2] ?? 0)
      ? p
      : a,
  )
}

test('M113: Settings nav icons paint the muted ink', async ({ page }) => {
  await openSettings(page)
  for (const id of SECTIONS) {
    const row = page.getByTestId(`settings-nav-${id}`)
    const icon = row.locator('svg.pb-icon')
    expect(await icon.evaluate((el) => getComputedStyle(el).color), id).toBe(
      `rgb(${MUTED.join(', ')})`,
    )
    // Computed colour is exact; the darkest pixel may be anti-aliased lighter.
    const ink = await darkest(icon)
    for (const [i, c] of MUTED.entries()) {
      expect(ink[i], `${id} channel ${String(i)}`).toBeGreaterThanOrEqual(c - 2)
      expect(ink[i], `${id} channel ${String(i)}`).toBeLessThanOrEqual(c + 40)
    }
    // The label keeps the darker button ink.
    expect(await row.evaluate((el) => getComputedStyle(el).color)).not.toBe(
      `rgb(${MUTED.join(', ')})`,
    )
  }
})

test('M113: Hosting R2 tokens link icon is 12×12', async ({ page }) => {
  await openSettings(page)
  await page.getByTestId('settings-nav-hosting').click()
  const icon = page.getByTestId('hosting-docs').locator('svg.pb-icon')
  const box = await icon.boundingBox()
  expect(box?.width).toBe(12)
  expect(box?.height).toBe(12)
  const ink = await darkest(icon)
  expect((ink[0] ?? 255) + (ink[1] ?? 255) + (ink[2] ?? 255)).toBeLessThan(
    3 * 160,
  )
})
