import { writeFile } from 'node:fs/promises'
import { expect, test } from './fixtures/coverage'

/** 3 fixtures × 3 edges × (4 WebP + 3 JPEG) qualities. */
const VARIANTS = 63

test('derivative lab encodes every candidate and every variant decodes', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await page.goto('/dev/derivative-lab.html')
  const lab = page.locator('#lab')
  await expect(lab).toHaveAttribute('data-lab-state', 'done', {
    timeout: 220_000,
  })

  const variants = page.getByTestId('lab-variant')
  await expect(variants).toHaveCount(VARIANTS)
  const widths = await variants.locator('img').evaluateAll((imgs) =>
    Promise.all(
      imgs.map(async (node) => {
        const img = node as HTMLImageElement
        await img.decode()
        return img.naturalWidth
      }),
    ),
  )
  expect(widths).toHaveLength(VARIANTS)
  for (const width of widths) {
    expect(width).toBeGreaterThan(0)
  }
  // One pick per edge × format; the values follow the browser's encoder, so
  // config (`DERIVATIVE_PRESETS`) is not pinned to them here.
  await expect(page.getByTestId('lab-picks').locator('li')).toHaveCount(6)
  await expect(page.getByTestId('lab-table')).toContainText(
    '| sky | 1600-webp-q75 | 1600×1200 |',
  )
  // The page owns its scrollport: no page-level scroll.
  const pageScroll = await page.evaluate(() => [
    document.documentElement.scrollWidth - window.innerWidth,
    document.documentElement.scrollHeight - window.innerHeight,
  ])
  expect(pageScroll).toEqual([0, 0])

  // The measured picks + table (PR body evidence) land in the test output dir.
  const picks = await page.getByTestId('lab-picks').innerText()
  const table = await page.getByTestId('lab-table').innerText()
  await writeFile(
    test.info().outputPath('derivative-lab.md'),
    `${picks}\n\n${table}\n`,
  )
})
