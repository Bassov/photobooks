import assert from 'node:assert/strict'
import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { ASSET_DRAG_MIME } from './fixtures/dropAssetOnFrame'
import { openLibraryBook } from './fixtures/openLibraryBook'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'
import { PERF_BUDGETS } from './perf/budgets'

// Designer cover-editor (READY 2026-11-05), 1440 × 900, 19 × 23 cm "Lake
// trip" at Fit: the printed sheet is 848 px wide; the 15 mm wrap band is
// 30.14 px at 20 pages; the spine is 24.11 / 39.44 / 61.39 px at 20 / 60 /
// 120 pages. A3 landscape (42 × 29.7 cm): band 14.42 px, under the 18 px
// chip threshold.

interface Box {
  x: number
  y: number
  width: number
  height: number
}

function near(actual: number, expected: number, what: string): void {
  expect(
    Math.abs(actual - expected),
    `${what}: ${String(actual)}`,
  ).toBeLessThanOrEqual(0.5)
}

async function rectOf(page: Page, testId: string): Promise<Box> {
  return page
    .getByTestId(testId)
    .evaluate((el) => el.getBoundingClientRect().toJSON() as Box)
}

async function dispatch(
  page: Page,
  op: Record<string, unknown>,
): Promise<void> {
  await page.evaluate((bookOp) => {
    const api = window.__photobooksProject
    if (!api?.dispatchBookOpForTests) {
      throw new Error('dispatchBookOpForTests missing')
    }
    api.dispatchBookOpForTests(bookOp)
  }, op)
}

async function openCover(page: Page): Promise<void> {
  await page.getByTestId('cover-list-item').click()
  await expect(page.getByTestId('cover-sheet')).toBeVisible()
  await page.mouse.move(1439, 899)
}

async function typePages(page: Page, pages: number): Promise<void> {
  await page.getByTestId('book-title').click()
  const field = page.getByTestId('book-pages-input')
  await field.fill(String(pages))
  await field.press('Enter')
  await openCover(page)
}

/** Spine and spine-text boxes once the spine reaches `widthPx` (±0.5). */
async function settledSpine(
  page: Page,
  widthPx: number,
): Promise<{ spine: Box; text: Box }> {
  await expect
    .poll(async () => (await rectOf(page, 'cover-spine')).width)
    .toBeCloseTo(widthPx, 0)
  const [spine, text] = await Promise.all([
    rectOf(page, 'cover-spine'),
    rectOf(page, 'cover-spine-text'),
  ])
  return { spine, text }
}

function expectCentred(spine: Box, text: Box, what: string): void {
  near(text.x + text.width / 2, spine.x + spine.width / 2, `${what} centre x`)
  near(text.y + text.height / 2, spine.y + spine.height / 2, `${what} centre y`)
}

test.describe('cover sheet at Fit (19 × 23 cm)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    await openCover(page)
  })

  test('Pages 20 → 60 → 120 widen the spine; its text stays centred both ways', async ({
    page,
  }) => {
    const sheet = await rectOf(page, 'cover-sheet')
    near(sheet.width, 848, 'sheet width')
    for (const [pages, widthPx] of [
      [20, 24.11],
      [60, 39.44],
      [120, 61.39],
    ] as const) {
      await typePages(page, pages)
      await expect(page.getByTestId('cover-spine-hint')).toHaveText(
        `Generic print profile · ${String(pages)} pages`,
      )
      for (const direction of ['top-to-bottom', 'bottom-to-top'] as const) {
        await dispatch(page, {
          type: 'setCoverStyle',
          patch: { spineDirection: direction },
        })
        await expect(page.getByTestId('cover-spine-text')).toHaveAttribute(
          'data-direction',
          direction,
        )
        const { spine, text } = await settledSpine(page, widthPx)
        near(spine.width, widthPx, `${String(pages)} pages spine`)
        expectCentred(spine, text, `${String(pages)} pages ${direction}`)
      }
    }
  })

  test('the wrap band shows the chip; the overlays let pointers through', async ({
    page,
  }) => {
    const [sheet, cover] = await Promise.all([
      rectOf(page, 'cover-sheet'),
      rectOf(page, 'canvas-cover'),
    ])
    near(cover.y - sheet.y, 30.14, 'top band')
    near(cover.x - sheet.x, 30.14, 'left band')
    const chip = page.getByTestId('cover-wrap-chip')
    await expect(chip).toHaveText('Wrap 15 mm')
    const chipBox = await rectOf(page, 'cover-wrap-chip')
    near(chipBox.y - sheet.y, (30.14 - 14) / 2, 'chip top')
    near(sheet.x + sheet.width - (chipBox.x + chipBox.width), 8, 'chip right')
    for (const id of [
      'cover-wrap',
      'cover-wrap-chip',
      'cover-hinge-back',
      'cover-hinge-front',
      'cover-safe-back',
      'cover-safe-front',
    ]) {
      await expect(page.getByTestId(id), id).toHaveCSS('pointer-events', 'none')
    }
  })
})

test('A3 landscape: the band is under 18 px, so no chip', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLibraryBook(page, 'Wide', { widthMm: 420, heightMm: 297 })
  await openCover(page)
  const [sheet, cover] = await Promise.all([
    rectOf(page, 'cover-sheet'),
    rectOf(page, 'canvas-cover'),
  ])
  near(sheet.width, 848, 'sheet width')
  near(cover.y - sheet.y, 14.42, 'top band')
  await expect(page.getByTestId('cover-wrap')).toBeAttached()
  await expect(page.getByTestId('cover-wrap-chip')).toHaveCount(0)
})

/** Drag `assetId` over and drop it at the sheet point (fx, fy), in sheet shares. */
async function dropAt(
  page: Page,
  assetId: string,
  fx: number,
  fy: number,
): Promise<void> {
  const sheet = await rectOf(page, 'cover-sheet')
  await page.evaluate(
    ({ mime, id, x, y }) => {
      const target = document.elementFromPoint(x, y)
      if (target === null) throw new Error('nothing under the drop point')
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(mime, id)
      const at = {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: x,
        clientY: y,
      }
      target.dispatchEvent(new DragEvent('dragover', at))
      target.dispatchEvent(new DragEvent('drop', at))
    },
    {
      mime: ASSET_DRAG_MIME,
      id: assetId,
      x: sheet.x + sheet.width * fx,
      y: sheet.y + sheet.height * fy,
    },
  )
}

test('a drop on the front wrap band sets the cover photo; the back band refuses it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?fixture=painter')
  await openCover(page)
  const front = page.getByTestId('cover-front')
  await expect(front).toHaveAttribute('data-photo-id', 'painter-a')
  // Right band, mid height: outside the front board, inside its photo box.
  const sheet = await rectOf(page, 'cover-sheet')
  const band = (await rectOf(page, 'canvas-cover')).x - sheet.x
  const fx = 1 - band / 2 / sheet.width
  const before = await page.screenshot({
    clip: {
      x: sheet.x + sheet.width * fx - 4,
      y: sheet.y + sheet.height / 2 - 4,
      width: 8,
      height: 8,
    },
  })

  await dropAt(page, 'painter-b', 1 - fx, 0.5)
  await expect(front).toHaveAttribute('data-photo-id', 'painter-a')

  await dropAt(page, 'painter-b', fx, 0.5)
  await expect(front).toHaveAttribute('data-photo-id', 'painter-b')
  // Paint check: the band point now shows the new photo under the veil.
  const hit = await page.evaluate(
    ({ x, y }) =>
      document
        .elementsFromPoint(x, y)
        .map((el) => el.getAttribute('data-testid')),
    { x: sheet.x + sheet.width * fx, y: sheet.y + sheet.height / 2 },
  )
  expect(hit[0]).toBe('cover-front-photo')
  await expect
    .poll(async () => {
      const after = await page.screenshot({
        clip: {
          x: sheet.x + sheet.width * fx - 4,
          y: sheet.y + sheet.height / 2 - 4,
          width: 8,
          height: 8,
        },
      })
      return after.equals(before)
    })
    .toBe(false)
})

/** Mutation counts under the cover views and under every other painter. */
async function watchMutations(page: Page): Promise<void> {
  await page.evaluate(() => {
    const cover = '[data-testid="cover-list-item"], [data-testid="cover-sheet"]'
    const others = [
      ...document.querySelectorAll(
        '[data-testid^="spread-list-item-"], [data-testid^="endpaper-list-item-"]',
      ),
    ]
    const counts = { cover: 0, others: 0 }
    const watch = (el: Element, key: keyof typeof counts) => {
      new MutationObserver((records) => {
        counts[key] += records.length
      }).observe(el, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      })
    }
    document.querySelectorAll(cover).forEach((el) => {
      watch(el, 'cover')
    })
    others.forEach((el) => {
      watch(el, 'others')
    })
    Object.assign(window, { __coverMutations: counts })
  })
}

async function readMutations(
  page: Page,
): Promise<{ cover: number; others: number }> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __coverMutations: { cover: number; others: number }
        }
      ).__coverMutations,
  )
}

test.describe('frame-budget gates', () => {
  test('a Pages change re-renders only the cover views, within budget', async ({
    page,
  }, testInfo) => {
    await pagesGate(page, testInfo)
  })
})

/**
 * Pages +4 on the 40-spread painter book (Book settings replaces the canvas,
 * so the list Cover is the cover view on screen): zero LoAF, the INP budget,
 * and the existing spread / endpaper rows untouched.
 */
async function pagesGate(page: Page, testInfo: TestInfo): Promise<void> {
  test.setTimeout(120_000)
  await enablePerfScenario(page, '/?fixture=painter&perf=1')
  await openCover(page)
  await page.getByTestId('book-title').click()
  const field = page.getByTestId('book-pages-input')
  const pages = Number(await field.inputValue())
  const next = pages + 4 <= 120 ? pages + 4 : pages - 4
  await field.fill(String(next))
  const spreads = page.getByTestId('pasteboard-scroll')
  const before = Number(await spreads.getAttribute('data-spread-count'))
  await watchMutations(page)

  await clearPerfScenario(page)
  await page.evaluate(browserStartLoafScripts)
  await page.evaluate(browserBeginLoafScenarioWindow)
  await field.press('Enter')
  await expect(spreads).toHaveAttribute(
    'data-spread-count',
    String(before + (next - pages) / 2),
  )
  // Two settled frames after the edit's own work.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      }),
  )
  const rows = await page.evaluate(browserTakeLoafScripts)
  console.log(
    `cover-editor-perf pages: ${String(rows.length)} LoAF ${JSON.stringify(rows)}`,
  )
  await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
  await page.evaluate((budgetMs) => {
    window.__photobooksPerf?.assertInpWithinBudget(budgetMs)
  }, PERF_BUDGETS.inpMs * PERF_BUDGETS.cpuThrottleRate)

  const counts = await readMutations(page)
  assert(counts.cover > 0, 'the cover views follow the page count')
  expect(counts.others, 'existing spread and endpaper rows').toBe(0)
  await collectFrameStatsArtifact(page, testInfo)
}
