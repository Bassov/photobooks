import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  applyCpuThrottling,
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  collectFrameStatsArtifact,
} from './perf/perfFixture'

/** Sample site (`src/site/sampleSite.ts`): Alps has 11 spreads, Sea 4. */
const ALPS = '/site.html?book=alps'
const SPREADS = 11

const LABELS = [
  'Cover',
  'Page 1 · 1 / 11',
  ...Array.from(
    { length: SPREADS - 2 },
    (_, i) =>
      `Pages ${String(2 * (i + 1))}–${String(2 * (i + 1) + 1)} · ${String(i + 2)} / 11`,
  ),
  'Page 20 · 11 / 11',
]

const indicator = (page: Page) => page.getByTestId('site-page-indicator')

/** Step forward to `slide` (from slide − 1): odd slides by key, even by Next. */
async function stepTo(page: Page, slide: number): Promise<void> {
  if (slide === 0) return
  if (slide % 2 === 1) {
    await page.keyboard.press('ArrowRight')
    return
  }
  await page.getByRole('button', { name: 'Next spread' }).click()
}

async function rect(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
}

function expectSameRect(
  actual: { x: number; y: number; width: number; height: number },
  expected: typeof actual,
) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(0.5)
  }
}

/** Every photo on the mounted slides is loaded and decoded. */
async function slidesDecoded(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const images = [
      ...document.querySelectorAll<HTMLImageElement>('.site-slide img'),
    ]
    await Promise.all(
      images.map(async (img) => {
        if (!img.complete) {
          await new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true })
            img.addEventListener('error', resolve, { once: true })
          })
        }
        await img.decode().catch(() => undefined)
      }),
    )
  })
}

/** Widest right edge of any element, and the page's horizontal overflow. */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    right: Math.max(
      ...[...document.querySelectorAll('body *')].map(
        (el) => el.getBoundingClientRect().right,
      ),
    ),
  }))
}

test.describe('site viewer', () => {
  test('catalog lists the published books and opens one; the title goes back', async ({
    page,
  }) => {
    await page.goto('/site.html')

    const catalog = page.getByTestId('site-catalog')
    await expect(catalog.getByRole('heading', { name: 'Books' })).toBeVisible()
    await expect(catalog).toContainText('A. Photographer · 2 photobooks')
    await expect(page.getByTestId('site-book')).toHaveCount(2)
    await expect(page).toHaveTitle('Sample photobooks')

    await page.getByTestId('site-book').first().click()
    await expect(page.getByTestId('site-book-page')).toBeVisible()
    await expect(page.getByTestId('site-title')).toHaveText('Alps')
    await expect(page.getByTestId('site-author')).toHaveText(
      'by A. Photographer · 20 pages',
    )
    await expect(page).toHaveTitle('Alps · Sample photobooks')

    await page.getByTestId('site-title-link').click()
    await expect(page.getByTestId('site-catalog')).toBeVisible()
  })

  test('an empty site says nothing is published yet', async ({ page }) => {
    await page.goto('/site.html?empty=1')

    await expect(page.getByTestId('site-catalog')).toContainText(
      'No published books yet.',
    )
    await expect(page.getByTestId('site-book')).toHaveCount(0)
  })

  test('slides read Cover, then every spread; stage and pager never move', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(ALPS)
    await expect(indicator(page)).toHaveText('Cover')

    const stage = await rect(page, 'site-stage')
    const pager = await rect(page, 'site-pager')
    expect(stage.width).toBeCloseTo(760, 1)
    expect(stage.height).toBeCloseTo(760 / ((2 * 190) / 230), 1)
    for (const [slide, label] of LABELS.entries()) {
      await stepTo(page, slide)
      await expect(indicator(page)).toHaveText(label)
      await expect(page.getByTestId('site-spread')).toHaveAttribute(
        'data-slide',
        String(slide),
      )
      expectSameRect(await rect(page, 'site-stage'), stage)
      expectSameRect(await rect(page, 'site-pager'), pager)
    }
    await expect(indicator(page)).toHaveText('Page 20 · 11 / 11')
    await expect(
      page.getByRole('button', { name: 'Next spread' }),
    ).toBeDisabled()
    expect(new URL(page.url()).hash).toBe('#p20')

    await page.keyboard.press('Home')
    await expect(indicator(page)).toHaveText('Cover')
    expect(new URL(page.url()).hash).toBe('')
  })

  test('Share reads "Link copied" at the same width, then Share again after 2 s', async ({
    page,
  }) => {
    await page.goto(ALPS)
    const share = page.getByTestId('site-share')
    await expect(share).toContainText('Share')
    const before = await rect(page, 'site-share')
    const spread = await rect(page, 'site-stage')

    await share.click()
    const pressed = Date.now()

    const copied = share.locator('.site-share-label').nth(1)
    await expect(copied).toBeVisible()
    await expect(share.locator('.site-share-label').first()).toBeHidden()
    await expect(page.getByTestId('site-share-status')).toHaveText(
      /^Link copied: http:\/\/[^#]+\/site\.html\?book=alps$/,
    )
    expectSameRect(await rect(page, 'site-share'), before)
    expectSameRect(await rect(page, 'site-stage'), spread)
    await expect(copied).toBeHidden({ timeout: 4000 })
    const elapsed = Date.now() - pressed
    expect(elapsed).toBeGreaterThanOrEqual(1900)
    expect(elapsed).toBeLessThan(3500)
    expectSameRect(await rect(page, 'site-share'), before)
  })

  test('the cover sits on the page shadow; a single page asks for its drawn width', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(ALPS)
    await expect(indicator(page)).toHaveText('Cover')

    const shadow = await page
      .getByTestId('site-spread')
      .locator('.cover-spread')
      .evaluate((el) => getComputedStyle(el).boxShadow)
    expect(shadow).toContain('0px 12px 32px 0px')

    await stepTo(page, 1)
    await expect(indicator(page)).toHaveText(LABELS[1] ?? '')
    const img = page
      .getByTestId('site-spread')
      .getByTestId('spread-frame-image')
    const drawn = await img.evaluate((el) => el.getBoundingClientRect().width)
    expect(drawn).toBeCloseTo(760 * 0.42, 0)
    await expect(img).toHaveAttribute(
      'sizes',
      /min\(319px, calc\(\(100vw - 64px\) \* 0\.42\)\)$/,
    )
  })

  test('#p6 opens the spread holding page 6', async ({ page }) => {
    await page.goto(`${ALPS}#p6`)

    await expect(indicator(page)).toHaveText('Pages 6–7 · 4 / 11')
    await page.keyboard.press('ArrowRight')
    await expect(indicator(page)).toHaveText('Pages 8–9 · 5 / 11')
    expect(new URL(page.url()).hash).toBe('#p8')
  })

  test('390 × 844: narrow layout, no horizontal scroll, nothing past the right edge', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    for (const url of ['/site.html', ALPS]) {
      await page.goto(url)
      await expect(page.getByTestId('site')).toBeVisible()
      await slidesDecoded(page)
      const overflow = await horizontalOverflow(page)
      expect(overflow.scrollWidth).toBe(overflow.clientWidth)
      expect(overflow.right).toBeLessThanOrEqual(390)
    }
    const stage = await rect(page, 'site-stage')
    expect(stage.width).toBeCloseTo(350, 1)
    const share = await rect(page, 'site-share')
    const meta = await rect(page, 'site-author')
    expect(share.y).toBeGreaterThan(meta.y + meta.height)
    expect(share.x).toBeCloseTo(20, 0)
  })
})

test.describe('frame-budget gates', () => {
  test('stepping through every spread of the site viewer stays within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await page.goto(`${ALPS}&perf=1`)
    await page.waitForFunction(() => window.__photobooksPerf !== undefined)
    await expect(indicator(page)).toHaveText('Cover')
    await applyCpuThrottling(page)
    await slidesDecoded(page)
    await clearPerfScenario(page)
    await page.evaluate(browserBeginLoafScenarioWindow)

    for (let slide = 1; slide <= SPREADS; slide += 1) {
      await page.keyboard.press('ArrowRight')
      await expect(indicator(page)).toHaveText(LABELS[slide] ?? '')
      // The next neighbour mounts with this step; its photos decode before the next one.
      await slidesDecoded(page)
    }

    await page.evaluate(browserAssertNoLoaf, 0)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
