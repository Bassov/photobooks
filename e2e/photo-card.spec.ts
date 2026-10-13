import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const samplePng = join(fixturesDir, 'sample-3x2.png')
const sampleOrient6 = join(fixturesDir, 'sample-orient6.jpg')
const largeJpeg = join(fixturesDir, 'large-24mp.jpg')

function ensureFixtures(): void {
  execFileSync(process.execPath, [join(fixturesDir, 'write-sample-png.mjs')], {
    stdio: 'inherit',
  })
  execFileSync(process.execPath, [join(fixturesDir, 'write-exif-jpeg.mjs')], {
    stdio: 'inherit',
  })
  if (!existsSync(largeJpeg)) {
    execFileSync(
      process.execPath,
      [join(fixturesDir, 'generate-large-jpeg.mjs')],
      { stdio: 'inherit' },
    )
  }
}

test.beforeAll(() => {
  ensureFixtures()
})

test('photo card shows metadata for PNG via input fallback', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('photo-file-input').setInputFiles(samplePng)

  const card = page.getByTestId('photo-card')
  await expect(card).toBeVisible()
  await expect(page.getByTestId('photo-dimensions')).toHaveText('30×20')
  await expect(page.getByTestId('photo-aspect')).toHaveText('3:2')
  await expect(page.getByTestId('photo-size')).not.toBeEmpty()
  await expect(page.getByTestId('photo-preview')).toBeVisible()
})

test('EXIF orientation 6 swaps corrected dimensions', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('photo-file-input').setInputFiles(sampleOrient6)

  await expect(page.getByTestId('photo-card')).toBeVisible()
  await expect(page.getByTestId('photo-card')).toHaveAttribute(
    'data-orientation',
    '6',
  )
  // Stored 40×20 with Orientation=6 → corrected 20×40, aspect 1:2
  await expect(page.getByTestId('photo-dimensions')).toHaveText('20×40')
  await expect(page.getByTestId('photo-aspect')).toHaveText('1:2')
  await expect(page.getByTestId('photo-preview')).toBeVisible()
})

test('unsupported TIFF shows error', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('photo-file-input').setInputFiles({
    name: 'scan.tiff',
    mimeType: 'image/tiff',
    buffer: Buffer.from('II*\u0000fake'),
  })

  await expect(page.getByTestId('photo-error')).toBeVisible()
  await expect(page.getByTestId('photo-error')).toContainText('Unsupported')
  await expect(page.getByTestId('photo-card')).toHaveCount(0)
})

test('24MP JPEG import stays within LoAF budget', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?loaf=1')
  await page.waitForFunction(() => {
    return (
      (window as Window & { __photobooksPerf?: unknown }).__photobooksPerf !==
      undefined
    )
  })

  await page.evaluate(() => {
    ;(
      window as Window & {
        __photobooksPerf?: { clearLoafEntries: () => void }
      }
    ).__photobooksPerf?.clearLoafEntries()
  })

  await page.getByTestId('photo-file-input').setInputFiles(largeJpeg)
  await expect(page.getByTestId('photo-card')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByTestId('photo-dimensions')).toHaveText('6000×4000')

  await page.evaluate(() => {
    ;(
      window as Window & {
        __photobooksPerf?: { assertNoExcessiveBlocking: (ms: number) => void }
      }
    ).__photobooksPerf?.assertNoExcessiveBlocking(200)
  })
})
