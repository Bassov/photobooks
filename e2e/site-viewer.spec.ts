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
/** The CSS reader: its pages are DOM (the GL reader paints them in a canvas). */
const ALPS_CSS = `${ALPS}&gl=0`
const SPREADS = 11

/** Desktop reader views: the cover, every spread, the back cover. */
const LABELS = [
  'Cover',
  'Page 1 of 20',
  ...Array.from(
    { length: SPREADS - 2 },
    (_, i) => `Pages ${String(2 * (i + 1))}–${String(2 * (i + 1) + 1)} of 20`,
  ),
  'Page 20 of 20',
  'Back cover',
]

const label = (page: Page) => page.getByTestId('site-label')
const reader = (page: Page) => page.getByTestId('ps-reader')

/** Step forward once (odd views by key, even by Next) and wait for rest. */
async function stepTo(page: Page, view: number): Promise<void> {
  if (view === 0) return
  if (view % 2 === 1) await page.keyboard.press('ArrowRight')
  else await page.getByTestId('site-next').click()
  await expect(reader(page)).toHaveAttribute('data-view', String(view))
  await expect(reader(page)).toHaveAttribute('data-turn', 'rest')
}

async function rect(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .first()
    .evaluate((el) => {
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

/** Every photo the room has mounted is loaded and decoded. */
async function photosDecoded(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const images = [
      ...document.querySelectorAll<HTMLImageElement>(
        '[data-testid="site-room"] img',
      ),
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
  test('the home shelves the published books and opens one; All books goes back', async ({
    page,
  }) => {
    await page.goto('/site.html')

    await expect(page.getByTestId('site-name')).toHaveText('A. Photographer')
    await expect(page.getByTestId('ss9-book')).toHaveCount(3)
    await expect(page).toHaveTitle('Sample photobooks')

    await page.getByTestId('ss9-book').first().click()
    await expect(page.getByTestId('site-room')).toBeVisible()
    await expect(page.getByTestId('site-about')).toContainText('Alps')
    await expect(page.getByTestId('site-about')).toContainText('20 pages')
    await expect(page).toHaveTitle('Alps · Sample photobooks')

    await page.getByTestId('site-all-books').click()
    await expect(page.getByTestId('site-room')).toHaveCount(0)
    await expect(page.getByTestId('site-home')).toBeVisible()
  })

  test('an empty site says nothing is published yet', async ({ page }) => {
    await page.goto('/site.html?empty=1')

    await expect(page.getByTestId('site-empty')).toHaveText(
      'No published books yet.',
    )
    await expect(page.getByTestId('ss9-book')).toHaveCount(0)
  })

  test('views read Cover, every spread, Back cover; reader and pager never move', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(ALPS_CSS)
    await expect(label(page)).toHaveText('Cover')

    const book = await rect(page, 'ps-reader')
    const pager = await rect(page, 'site-pager')
    const hashes: string[] = []
    for (const [view, text] of LABELS.entries()) {
      await stepTo(page, view)
      await expect(label(page)).toHaveText(text)
      expectSameRect(await rect(page, 'ps-reader'), book)
      expectSameRect(await rect(page, 'site-pager'), pager)
      hashes.push(new URL(page.url()).hash)
    }
    expect(hashes[SPREADS]).toBe('#p20')
    await expect(page.getByTestId('site-next')).toBeDisabled()

    await page.keyboard.press('Home')
    await expect(label(page)).toHaveText('Cover')
    await expect(reader(page)).toHaveAttribute('data-turn', 'rest')
    expect(new URL(page.url()).hash).toBe('')
  })

  test('Share reads "Copied" at the same width, then Share again after 2 s', async ({
    page,
  }) => {
    await page.goto(ALPS)
    const share = page.getByTestId('site-share')
    await expect(share).toContainText('Share')
    const before = await rect(page, 'site-share')
    const book = await rect(page, 'ps-reader')

    // Stamp the press and the hide in the page: a Node clock read after
    // click() resolves runs late under load and shortens the gap.
    await share.evaluate((el) => {
      const times: { pressed?: number; hidden?: number } = {}
      Object.assign(window, { shareTimes: times })
      el.addEventListener(
        'click',
        () => {
          times.pressed = performance.now()
        },
        { capture: true, once: true },
      )
      const watch = new MutationObserver(() => {
        if (el.hasAttribute('data-copied') || times.pressed === undefined)
          return
        times.hidden = performance.now()
        watch.disconnect()
      })
      watch.observe(el, { attributeFilter: ['data-copied'] })
    })
    await share.click()

    const copied = share.locator('span').nth(1)
    await expect(share).toHaveAttribute('data-copied', '')
    await expect(copied).toBeVisible()
    await expect(copied).toHaveAttribute('aria-live', 'polite')
    await expect(share.locator('span').first()).toBeHidden()
    expectSameRect(await rect(page, 'site-share'), before)
    expectSameRect(await rect(page, 'ps-reader'), book)
    await expect(copied).toBeHidden({ timeout: 4000 })
    const elapsed = await page.evaluate(() => {
      const { shareTimes } = window as unknown as {
        shareTimes: { pressed?: number; hidden?: number }
      }
      if (shareTimes.pressed === undefined || shareTimes.hidden === undefined)
        throw new Error('no Share press or hide recorded')
      return shareTimes.hidden - shareTimes.pressed
    })
    expect(elapsed).toBeGreaterThanOrEqual(1900)
    expect(elapsed).toBeLessThan(3500)
    expectSameRect(await rect(page, 'site-share'), before)
  })

  test('the reader rests closed on view 0; page 1 is a right page of the book', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(ALPS_CSS)
    await expect(label(page)).toHaveText('Cover')
    await expect(reader(page)).toHaveAttribute('data-view', '0')
    await expect(reader(page).getByTestId('spread-view')).toHaveCount(0)

    await stepTo(page, 1)
    await expect(label(page)).toHaveText('Page 1 of 20')
    const fit = await reader(page).evaluate((el) => {
      const b = el.querySelector('.sd-rbook')?.getBoundingClientRect()
      const img = el
        .querySelector('[data-testid="spread-frame-image"]')
        ?.getBoundingClientRect()
      if (b === undefined || img === undefined) throw new Error('no page')
      return { mid: b.x + b.width / 2, right: b.right, x: img.x, r: img.right }
    })
    expect(fit.x).toBeGreaterThanOrEqual(fit.mid - 0.5)
    expect(fit.r).toBeLessThanOrEqual(fit.right + 0.5)
  })

  test('#p6 opens the spread holding page 6', async ({ page }) => {
    await page.goto(`${ALPS}#p6`)

    await expect(label(page)).toHaveText('Pages 6–7 of 20')
    await page.keyboard.press('ArrowRight')
    await expect(label(page)).toHaveText('Pages 8–9 of 20')
    await expect.poll(() => new URL(page.url()).hash).toBe('#p8')
  })

  test('390 × 844: narrow layout, no horizontal scroll, nothing past the right edge', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    for (const [url, root] of [
      ['/site.html', 'site'],
      [ALPS, 'site-room'],
    ] as const) {
      await page.goto(url)
      await expect(page.getByTestId(root)).toBeVisible()
      await photosDecoded(page)
      const overflow = await horizontalOverflow(page)
      expect(overflow.scrollWidth).toBe(overflow.clientWidth)
      expect(overflow.right).toBeLessThanOrEqual(390)
    }
    await expect(page.getByTestId('pt-stage')).toBeVisible()
    await expect(page.getByTestId('site-fullscreen-btn')).toHaveCount(0)
    await expect(page.getByTestId('site-prev')).toHaveCount(0)
    await expect(page.getByTestId('site-next')).toHaveCount(0)
  })
})

test.describe('frame-budget gates', () => {
  test('stepping through every view of the site reader stays within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    // The CSS reader: CI's software GL (SwiftShader) spends ~33 ms per draw.
    await page.goto(`${ALPS_CSS}&perf=1`)
    await page.waitForFunction(() => window.__photobooksPerf !== undefined)
    await expect(label(page)).toHaveText('Cover')
    await applyCpuThrottling(page)
    await photosDecoded(page)
    await clearPerfScenario(page)
    await page.evaluate(browserBeginLoafScenarioWindow)

    for (let view = 1; view < LABELS.length; view += 1) {
      await page.keyboard.press('ArrowRight')
      await expect(label(page)).toHaveText(LABELS[view] ?? '')
      await expect(reader(page)).toHaveAttribute('data-turn', 'rest')
      await photosDecoded(page)
    }

    await page.evaluate(browserAssertNoLoaf, 0)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
