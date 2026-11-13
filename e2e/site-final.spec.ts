import type { Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
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
    await expect(page.getByTestId('site-room')).toBeVisible()
    await expect(page.getByTestId('site-about')).toContainText('Sea')
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

/** Designer personal-site P5: the book page is the room (D36, D40–D42). */
const ALPS = `${HOME}?book=alps`

/** Foot row at the bottom: Share · Fullscreen · Play, 24 px apart. */
async function footRow(page: Page, right: number, y: number) {
  const share = await box(page, 'site-share')
  const full = await box(page, 'site-fullscreen-btn')
  const play = await box(page, 'site-play')
  near(play.x + play.width, right)
  near(play.y, y)
  near(play.height, 44)
  near(full.y, y)
  near(full.x + full.width, play.x - 24)
  near(share.y, y)
  near(share.x + share.width, full.x - 24)
}

/** The ways back from a room opened over the home (D41): each is one history step. */
const LEAVE = {
  Back: async (page: Page) => {
    await page.goBack()
  },
  Escape: (page: Page) => page.keyboard.press('Escape'),
  'All books': (page: Page) => page.getByTestId('site-all-books').click(),
}

test.describe('site room (P5)', () => {
  for (const [vw, vh] of [
    [1440, 900],
    [1920, 1080],
  ] as const) {
    test(`${String(vw)} × ${String(vh)}: name, All books, foot row and pager sit on the Spec checkpoints`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vw, height: vh })
      await page.goto(ALPS)
      await expect(page.getByTestId('site-label')).toHaveText('Cover')
      await expect(page.getByTestId('site-room')).toHaveAttribute(
        'data-mode',
        'desk',
      )
      await assertDocumentFitsViewport(page)

      const name = await box(page, 'site-name')
      near(name.x, 24)
      near(name.y, 20)
      const all = await box(page, 'site-all-books')
      near(all.x + all.width, vw - 24)
      near(all.y, 20)
      await footRow(page, vw - 24, vh - 54)
      const pager = await box(page, 'site-pager')
      near(pager.x + pager.width / 2, vw / 2)
      near(pager.y, vh - 54)
      near((await box(page, 'site-about')).x, 24)
      await expect(page.getByTestId('site-prev')).toBeVisible()
      await expect(page.getByTestId('site-next')).toBeVisible()

      // paint: Play is on top; the reader paints the book, not the paper
      expect((await topAt(page.getByTestId('site-play')))[0]).toContain(
        'site-play',
      )
      await expect(page.getByTestId('ps-reader-gl')).toHaveAttribute(
        'data-gl',
        'ready',
      )
      // the closed cover: right of the room's centre line
      const [centre] = await pixelsAt(page.getByTestId('site-room'), [
        { x: vw / 2 + 100, y: vh / 2 - 40 },
      ])
      expect(centre?.slice(0, 3)).not.toStrictEqual(BG)
    })
  }

  test.describe('390 × 844 portrait', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('header sits 52 px over the page turn; no Fullscreen, Prev or Next', async ({
      page,
    }) => {
      await page.goto(ALPS)
      const room = page.getByTestId('site-room')
      await expect(room).toHaveAttribute('data-mode', 'port')
      await expect(page.getByTestId('site-label')).toHaveText('Cover')

      const back = await box(page, 'site-all-books')
      const play = await box(page, 'site-play')
      const share = await box(page, 'site-share')
      const stage = await box(page, 'pt-stage')
      near(back.x, 16)
      near(back.height, 44)
      near(back.y, stage.y - 52)
      near(play.y, back.y)
      near(play.x + play.width, 374)
      near(share.x + share.width, play.x - 20)
      for (const id of [
        'site-fullscreen-btn',
        'site-prev',
        'site-next',
        'site-pager',
        'site-name',
      ]) {
        await expect(page.getByTestId(id)).toHaveCount(0)
      }
      await assertDocumentFitsViewport(page)
      expect((await topAt(page.getByTestId('site-play')))[0]).toContain(
        'site-play',
      )
      const s = page.getByTestId('pt-stage')
      const b = await s.boundingBox()
      const [centre] = await pixelsAt(s, [
        { x: (b?.width ?? 0) / 2, y: (b?.height ?? 0) / 2 },
      ])
      expect(centre?.slice(0, 3)).not.toStrictEqual(BG)
    })

    test('?reader=carousel swaps the page turn for the strip', async ({
      page,
    }) => {
      await page.goto(`${ALPS}&reader=carousel`)
      await expect(page.getByTestId('ps-strip')).toBeVisible()
      await expect(page.getByTestId('pt-stage')).toHaveCount(0)
    })
  })

  test.describe('844 × 390 landscape', () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true })

    test('back and Play share the top row over the reader; no Fullscreen', async ({
      page,
    }) => {
      await page.goto(ALPS)
      await expect(page.getByTestId('site-room')).toHaveAttribute(
        'data-mode',
        'land',
      )
      const back = await box(page, 'site-all-books')
      const play = await box(page, 'site-play')
      const share = await box(page, 'site-share')
      const reader = await box(page, 'ps-reader')
      near(back.x, 16)
      near(back.y, 8)
      near(play.y, 8)
      near(play.x + play.width, 828)
      near(share.x + share.width, play.x - 20)
      near(reader.x + reader.width / 2, 422)
      near(reader.x, 136)
      await assertDocumentFitsViewport(page)
      for (const id of ['site-fullscreen-btn', 'site-prev', 'site-next']) {
        await expect(page.getByTestId(id)).toHaveCount(0)
      }
    })
  })

  test('no WebGL2: the CSS reader', async ({ page }) => {
    await page.addInitScript(() => {
      const proto = HTMLCanvasElement.prototype
      const get = Object.getOwnPropertyDescriptor(proto, 'getContext')
        ?.value as (this: HTMLCanvasElement, ...a: unknown[]) => unknown
      Object.defineProperty(proto, 'getContext', {
        value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
          return id === 'webgl2' ? null : get.call(this, id, ...rest)
        },
      })
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${ALPS}#p4`)
    await expect(page.getByTestId('site-label')).toHaveText('Pages 4–5 of 20')
    const reader = page.getByTestId('ps-reader')
    await expect(reader.locator('canvas')).toHaveCount(0)
    await expect(reader.locator('.sd-rbook')).toBeVisible()
    await expect(reader.getByTestId('spread-frame-image').first()).toBeVisible()
  })

  test('#p4 deep link opens Pages 4–5', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${ALPS}#p4`)
    await expect(page.getByTestId('site-label')).toHaveText('Pages 4–5 of 20')
    await expect(page.getByTestId('ps-reader')).toHaveAttribute(
      'data-view',
      '3',
    )
  })

  test('a direct URL has a plain All books link to the home', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(ALPS)
    const all = page.getByTestId('site-all-books')
    await expect(all).toHaveText('All books')
    await all.click()
    await expect(page.getByTestId('site-case')).toBeVisible()
    await expect(page.getByTestId('site-room')).toHaveCount(0)
    expect(new URL(page.url()).search).toBe('')
  })

  for (const how of Object.keys(LEAVE) as (keyof typeof LEAVE)[]) {
    test(`over the home: the cover turns at once; ${how} is one history step back`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(HOME)
      await expect(page.getByTestId('site-case')).toHaveAttribute('data-laid')
      const depth = await page.evaluate(() => history.length)
      const book = page.getByTestId('ss9-book').first()

      // hover prefetches; the click opens the room without a navigation
      await book.hover()
      await book.click()
      const room = page.getByTestId('site-room')
      await expect(room).toHaveAttribute('data-over', '')
      await expect(page.getByTestId('site-case')).toBeAttached()
      expect(new URL(page.url()).search).toMatch(/^\?book=/)
      expect(await page.evaluate(() => history.length)).toBe(depth + 1)
      await expect(page.getByTestId('site-label')).toHaveText('Page 1 of 20')

      await LEAVE[how](page)

      await expect(room).toHaveCount(0)
      expect(new URL(page.url()).search).toBe('')
      expect(await page.evaluate(() => history.length)).toBe(depth + 1)
      await expect(page.getByTestId('site-case')).toBeVisible()
    })
  }
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
