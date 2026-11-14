import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt, topAt, type Point } from './fixtures/paintProbe'

// Designer parity Round 24 (personal-site M106, M107, M110): the phone Page
// turn paints its pages with and without WebGL, a phone tap opens a book at
// the cover, and the desktop room's site name leads home.

const ALPS = '/site.html?book=alps'
/** the room fade + the desktop cover delay (SiteRoom FADE_MS + COVER_DELAY_MS), with margin */
const OPEN_SETTLED_MS = 240 + 120 + 600

const label = (page: Page) => page.getByTestId('site-label')

/** Points of a 9 × 9 grid inside the page box, 8 % in from its edges. */
const grid = (w: number, h: number): Point[] =>
  Array.from({ length: 81 }, (_, i) => ({
    x: w * (0.08 + (0.84 * (i % 9)) / 8),
    y: h * (0.08 + (0.84 * Math.floor(i / 9)) / 8),
  }))

/** Grid points inside the page box whose paint is not the paper. */
async function inkOnPage(page: Page): Promise<number> {
  const bed = page.getByTestId('pt-bed')
  const paper = await bed.evaluate((el) =>
    (getComputedStyle(el).backgroundColor.match(/\d+/g) ?? []).map(Number),
  )
  const b = await bed.boundingBox()
  if (b === null) throw new Error('no page box')
  const px = await pixelsAt(bed, grid(b.width, b.height))
  return px.filter((p) =>
    paper.slice(0, 3).some((c, i) => Math.abs((p[i] ?? c) - c) > 24),
  ).length
}

test.describe('390 × 844 portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  for (const [name, url, drawn] of [
    ['WebGL', ALPS, '1'],
    ['gl=0', `${ALPS}&gl=0`, '0'],
  ] as const) {
    test(`Page turn paints the cover, page 1 and page 2 (${name})`, async ({
      page,
    }) => {
      await page.goto(url)
      const stage = page.getByTestId('pt-stage')
      await expect(label(page)).toHaveText('Cover')
      await expect(stage).toHaveAttribute('data-gl', drawn)
      // a blank sheet is all paper: the photo covers a good part of the page
      await expect.poll(() => inkOnPage(page)).toBeGreaterThanOrEqual(20)
      for (const at of [/^Page 1 of/, /^Page 2 of/]) {
        await stage.focus()
        await page.keyboard.press('ArrowRight')
        await expect(label(page)).toHaveText(at)
        await expect.poll(() => inkOnPage(page)).toBeGreaterThanOrEqual(20)
      }
    })
  }

  test('a tap on a home book opens it at the cover', async ({ page }) => {
    await page.goto('/site.html')
    await page.getByTestId('ss9-book').first().tap()
    await expect(page.getByTestId('site-room')).toHaveAttribute(
      'data-mode',
      'port',
    )
    await page.waitForTimeout(OPEN_SETTLED_MS)
    await expect(label(page)).toHaveText('Cover')
    expect(new URL(page.url()).hash).toBe('')
  })
})

test.describe('1440 × 900 room', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a click on a home book still turns the cover to page 1', async ({
    page,
  }) => {
    await page.goto('/site.html')
    await page.getByTestId('ss9-book').first().click()
    await expect(label(page)).toHaveText('Page 1 of 20')
    expect(new URL(page.url()).hash).toBe('#p1')
  })

  test('the site name is a link home: one history step back', async ({
    page,
  }) => {
    await page.goto('/site.html')
    const home = page.url()
    await page.getByTestId('ss9-book').first().click()
    await expect(page.getByTestId('site-room')).toBeVisible()

    const name = page
      .getByTestId('site-room')
      .getByRole('link', { name: 'A. Photographer' })
    await expect(name).toHaveAttribute('data-testid', 'site-name')
    await expect(name).toHaveCSS('cursor', 'pointer')
    await expect(name).toHaveCSS('font-weight', '500')
    // on top of the GL reader's canvas, which overhangs the book
    await expect(page.getByTestId('ps-reader-gl')).toHaveAttribute(
      'data-gl',
      'ready',
    )
    expect((await topAt(name))[0]).toContain('site-name')
    await name.click()

    await expect(page.getByTestId('site-room')).toHaveCount(0)
    await expect(page.getByTestId('site-home')).toBeVisible()
    expect(page.url()).toBe(home)
    // the room was the one step: forward reopens it
    await page.goForward()
    await expect(page.getByTestId('site-room')).toBeVisible()
  })
})
