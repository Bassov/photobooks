import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt, topAt } from './fixtures/paintProbe'
import {
  applyCpuThrottling,
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  collectFrameStatsArtifact,
} from './perf/perfFixture'

/** Designer personal-site P4: the home is the bookcase (D37, D38, D42, D43). */
const HOME = '/site.html'
const BG = [244, 243, 240]

async function box(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect()
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
      }
    })
}

/** Every face-out book is drawn by GL, or the browser has no WebGL2. */
async function glSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document.createElement('canvas').getContext('webgl2') === null ||
      [...document.querySelectorAll('[data-testid="book3d"]')].every(
        (b) => b.getAttribute('data-gl') === 'ready',
      ),
    undefined,
    { timeout: 20_000 },
  )
}

/** Two idle callbacks after `load`: past the moment Book3D asks for GL. */
async function pastIdle(page: Page): Promise<void> {
  await page.waitForLoadState('load')
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestIdleCallback(() => {
          requestIdleCallback(() => {
            done()
          })
        })
      }),
  )
}

const near = (actual: number, expected: number) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5)
}

test.describe('site home (bookcase)', () => {
  for (const [vw, vh, caseX, caseW] of [
    [1440, 900, 141.33, 1157.33],
    [1920, 1080, 245, 1430],
  ] as const) {
    test(`${String(vw)} × ${String(vh)}: name, lead and case sit on the Spec checkpoints`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vw, height: vh })
      await page.goto(HOME)
      await expect(page.getByTestId('site-case')).toHaveAttribute('data-laid')

      const name = await box(page, 'site-name')
      const lead = await box(page, 'site-lead')
      const shelf = await box(page, 'site-case')
      near(name.x, 24)
      near(name.y, 20)
      expect(name.fontSize).toBe(16)
      near(lead.x, caseX)
      near(lead.y, 104)
      near(lead.width, 640)
      expect(lead.fontSize).toBe(24)
      near(shelf.x, caseX)
      // 40 px under the lead (206.38 under the kit's two-line lead)
      near(shelf.y, lead.y + lead.height + 40)
      near(shelf.width, caseW)
      const bay = await box(page, 'site-bay')
      near(bay.x, caseX + 28)
      await expect(page).toHaveTitle('Sample photobooks')
      expect(
        await page.locator('meta[name="theme-color"]').getAttribute('content'),
      ).toBe('#f4f3f0')
      expect(
        await page.evaluate(() => getComputedStyle(document.body).background),
      ).toContain('rgb(244, 243, 240)')
    })
  }

  test('390 × 844: the phone column, no horizontal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(HOME)
    await expect(page.getByTestId('site-case')).toHaveAttribute('data-laid')

    const name = await box(page, 'site-name')
    const lead = await box(page, 'site-lead')
    const shelf = await box(page, 'site-case')
    near(name.x, 16)
    near(name.y, 16)
    expect(name.fontSize).toBe(15)
    near(lead.x, 16)
    near(lead.y, 72)
    expect(lead.fontSize).toBe(19)
    near(shelf.x, 16)
    near(shelf.y, 184)
    near(shelf.width, 358)
    near((await box(page, 'site-bay')).x, 34)
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBe(0)
  })

  test('the home sets in Site Inter Display, Cyrillic included', async ({
    page,
  }) => {
    await page.goto(HOME)
    const lead = page.getByTestId('site-lead')
    await expect(lead).toBeVisible()

    await expect
      .poll(() =>
        page.evaluate(async () => {
          await document.fonts.load('16px "Site Inter Display"', 'Озеро')
          return document.fonts.check('16px "Site Inter Display"', 'Озеро')
        }),
      )
      .toBe(true)
    expect(
      await lead.evaluate((el) => getComputedStyle(el).fontFamily),
    ).toContain('Site Inter Display')
  })

  test('books are links to their pages and paint on the shelf', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(HOME)
    await expect(page.getByTestId('site-case')).toHaveAttribute('data-laid')

    const books = page.getByTestId('ss9-book')
    await expect(books).toHaveCount(3)
    expect(
      await books.evaluateAll((links) =>
        links.map((a) => [a.tagName, a.getAttribute('href')]),
      ),
    ).toStrictEqual([
      ['A', './site.html?book=alps'],
      ['A', './site.html?book=sea'],
      ['A', './site.html?book=lake'],
    ])
    for (const book of await books.all()) {
      expect((await topAt(book))[0]).toContain('ss9-book')
      const [centre] = await pixelsAt(book, [
        {
          x: ((await book.boundingBox())?.width ?? 0) / 2,
          y: ((await book.boundingBox())?.height ?? 0) / 2,
        },
      ])
      expect(centre?.slice(0, 3)).not.toStrictEqual(BG)
    }

    await books.nth(1).click()
    await expect(page.getByTestId('site-book-page')).toBeVisible()
    await expect(page.getByTestId('site-title')).toHaveText('Sea')
  })

  test('the case never shifts: hidden until laid out, then still through the GL handoff', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      const w = window as unknown as { __shift: number }
      w.__shift = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          w.__shift += (e as unknown as { value: number }).value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto(HOME)
    await expect(page.getByTestId('site-case')).toHaveAttribute('data-laid')
    const before = await box(page, 'site-case')

    await glSettled(page)

    expect(await box(page, 'site-case')).toStrictEqual(before)
    expect(
      await page.evaluate(
        () => (window as unknown as { __shift: number }).__shift,
      ),
    ).toBe(0)
  })

  test('?gl=0 keeps the CSS books', async ({ page }) => {
    await page.goto(`${HOME}?gl=0`)
    await expect(page.getByTestId('site-case')).toHaveAttribute('data-laid')
    await pastIdle(page)

    await expect(page.locator('canvas.sd-b3gl')).toHaveCount(0)
    await expect(page.locator('[data-gl]')).toHaveCount(0)
    await expect(
      page.getByTestId('book3d').locator('.sd-b3').first(),
    ).toBeVisible()
  })

  test('an empty site shows no case', async ({ page }) => {
    await page.goto(`${HOME}?empty=1`)

    await expect(page.getByTestId('site-empty')).toHaveText(
      'No published books yet.',
    )
    await expect(page.getByTestId('site-case')).toHaveCount(0)
  })
})

test.describe('frame-budget gates', () => {
  test('hovering along the shelf of the site home stays within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${HOME}?perf=1`)
    await page.waitForFunction(() => window.__photobooksPerf !== undefined)
    await expect(page.getByTestId('site-case')).toHaveAttribute('data-laid')
    await glSettled(page)
    await applyCpuThrottling(page)
    await clearPerfScenario(page)
    await page.evaluate(browserBeginLoafScenarioWindow)

    for (const book of await page.getByTestId('ss9-book').all()) {
      const b = await book.boundingBox()
      expect(b).not.toBeNull()
      await page.mouse.move(
        (b?.x ?? 0) + (b?.width ?? 0) / 2,
        (b?.y ?? 0) + (b?.height ?? 0) / 2,
        { steps: 12 },
      )
    }
    await page.mouse.move(8, 8, { steps: 12 })

    await page.evaluate(browserAssertNoLoaf, 0)
    const deltas = await page.evaluate(() =>
      [...(window.__photobooksPerf?.getFramePacingStats().deltasMs ?? [])].sort(
        (a, b) => a - b,
      ),
    )
    expect(deltas.length).toBeGreaterThan(10)
    // ≥ 58 fps median
    expect(deltas[Math.floor(deltas.length / 2)]).toBeLessThanOrEqual(1000 / 58)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
