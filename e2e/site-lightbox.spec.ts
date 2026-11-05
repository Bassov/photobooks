import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  applyCpuThrottling,
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  collectFrameStatsArtifact,
} from './perf/perfFixture'

/** Sample site (`src/site/sampleSite.ts`): Alps 190×230, 11 spreads; Sea 280×210. */
const ALPS = '/site.html?book=alps'
const SEA = '/site.html?book=sea'
const SPREADS = 11

interface Box {
  x: number
  y: number
  width: number
  height: number
}

const lightbox = (page: Page) => page.getByTestId('lightbox')
const indicator = (page: Page) => page.getByTestId('site-fullscreen-indicator')
const book = (page: Page) => page.getByTestId('site-fullscreen-book')

async function rect(page: Page, testId: string): Promise<Box> {
  return page.getByTestId(testId).evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
}

function expectRect(actual: Box, expected: Box, tolerance = 0.5) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(tolerance)
  }
}

/** Rects of the visible lightbox controls (arrows, Zoom, Close). */
async function controlRects(page: Page): Promise<Box[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-pager-control]')]
      .filter((el) => getComputedStyle(el).visibility !== 'hidden')
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      }),
  )
}

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height

/** Every photo on the mounted lightbox slides is loaded and decoded. */
async function lightboxDecoded(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const images = [
      ...document.querySelectorAll<HTMLImageElement>(
        '[data-testid="lightbox"] img',
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

async function openLightbox(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await page.getByTestId('site-fullscreen-btn').click()
  await expect(lightbox(page)).toBeVisible()
}

test.describe('site lightbox', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Fullscreen sits after Share; the spread fits clear of every control', async ({
    page,
  }) => {
    await page.goto(`${ALPS}#p2`)
    const share = await rect(page, 'site-share')
    const button = await rect(page, 'site-fullscreen-btn')
    expect(button.x - (share.x + share.width)).toBeCloseTo(8, 1)
    expect(button.x + button.width).toBeCloseTo(1200, 1)
    expect(button.y).toBeCloseTo(share.y, 1)
    await expect(page.getByTestId('site-open')).toHaveCSS('cursor', 'zoom-in')

    await page.getByTestId('site-fullscreen-btn').click()
    await expect(indicator(page)).toHaveText('Pages 2–3 · 2 / 11')
    await expect(lightbox(page)).toHaveAttribute(
      'aria-label',
      'Alps — fullscreen',
    )
    await expect(lightbox(page)).toBeFocused()
    const spread = await rect(page, 'site-fullscreen-book')
    expectRect(spread, { x: 69.04, y: 64, width: 1301.91, height: 788 })
    const controls = await controlRects(page)
    expect(controls).toHaveLength(4)
    for (const control of controls) {
      expect(intersects(control, spread)).toBe(false)
    }
  })

  test('a landscape book fits the width', async ({ page }) => {
    await openLightbox(page, `${SEA}#p2`)
    expectRect(await rect(page, 'site-fullscreen-book'), {
      x: 64,
      y: 212,
      width: 1312,
      height: 492,
    })
  })

  test('keys step, Esc closes on the lightbox slide and focus returns to the opener', async ({
    page,
  }) => {
    await openLightbox(page, ALPS)
    await expect(indicator(page)).toHaveText('Cover')
    await page.keyboard.press('ArrowRight')
    await expect(indicator(page)).toHaveText('Page 1 · 1 / 11')
    await page.keyboard.press('Space')
    await expect(indicator(page)).toHaveText('Pages 2–3 · 2 / 11')
    await page.keyboard.press('End')
    await expect(indicator(page)).toHaveText('Page 20 · 11 / 11')
    await page.keyboard.press('ArrowLeft')
    await expect(indicator(page)).toHaveText('Pages 18–19 · 10 / 11')
    await page.keyboard.press('Home')
    await expect(indicator(page)).toHaveText('Cover')
    await lightbox(page).getByRole('button', { name: 'Next spread' }).click()
    await expect(indicator(page)).toHaveText('Page 1 · 1 / 11')

    await page.keyboard.press('Escape')
    await expect(lightbox(page)).toHaveCount(0)
    await expect(page.getByTestId('site-page-indicator')).toHaveText(
      'Page 1 · 1 / 11',
    )
    await expect(page.getByTestId('site-fullscreen-btn')).toBeFocused()
  })

  test('a stage click opens, a stage swipe steps; a 120 px swipe steps the lightbox', async ({
    page,
  }) => {
    await page.goto(ALPS)
    const stage = await rect(page, 'site-stage')
    const cy = stage.y + stage.height / 2
    await page.mouse.move(stage.x + 500, cy)
    await page.mouse.down()
    await page.mouse.move(stage.x + 380, cy, { steps: 4 })
    await page.mouse.up()
    await expect(page.getByTestId('site-page-indicator')).toHaveText(
      'Page 1 · 1 / 11',
    )
    await expect(lightbox(page)).toHaveCount(0)

    await page.getByTestId('site-open').click()
    await expect(indicator(page)).toHaveText('Page 1 · 1 / 11')
    await page.mouse.move(800, 450)
    await page.mouse.down()
    await page.mouse.move(680, 450, { steps: 4 })
    await page.mouse.up()
    await expect(indicator(page)).toHaveText('Pages 2–3 · 2 / 11')
    await expect(lightbox(page)).toHaveAttribute('data-zoom', '1.00')
    await page.getByTestId('site-fullscreen-close').click()
    await expect(page.getByTestId('site-page-indicator')).toHaveText(
      'Pages 2–3 · 2 / 11',
    )
    await expect(page.getByTestId('site-open')).toBeFocused()
  })

  test('double-click zooms about the point, a drag pans to the clamp, Esc closes zoomed', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openLightbox(page, `${ALPS}#p2`)
    const before = await rect(page, 'site-fullscreen-book')
    const p = { x: 500, y: 300 }
    await page.mouse.dblclick(p.x, p.y)
    await expect(lightbox(page)).toHaveAttribute('data-zoom', '2.00')
    await expect(page.getByTestId('site-fullscreen-zoom')).toHaveAttribute(
      'aria-label',
      'Zoom out',
    )
    const after = await rect(page, 'site-fullscreen-book')
    const fx = (p.x - before.x) / before.width
    const fy = (p.y - before.y) / before.height
    expect(Math.abs(after.x + fx * after.width - p.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.y + fy * after.height - p.y)).toBeLessThanOrEqual(1)

    await page.mouse.move(700, 450)
    await page.mouse.down()
    await page.mouse.move(1400, 880, { steps: 6 })
    await page.mouse.up()
    const panned = await rect(page, 'site-fullscreen-book')
    // Clamped: the painted spread covers the fit area, left / top edges on it.
    expect(panned.x).toBeCloseTo(64, 0)
    expect(panned.y).toBeCloseTo(64, 0)
    await expect(indicator(page)).toHaveText('Pages 2–3 · 2 / 11')

    await page.keyboard.press('ArrowRight')
    await expect(lightbox(page)).toHaveAttribute('data-zoom', '1.00')
    await page.keyboard.press('+')
    await expect(lightbox(page)).toHaveAttribute('data-zoom', '1.50')
    await page.keyboard.press('Escape')
    await expect(lightbox(page)).toHaveCount(0)
  })

  test('Ctrl + wheel zooms about the cursor', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openLightbox(page, `${ALPS}#p2`)
    const before = await rect(page, 'site-fullscreen-book')
    await page.mouse.move(900, 500)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -100)
    await page.keyboard.up('Control')
    await expect(lightbox(page)).toHaveAttribute('data-zoom', '2.72')
    const after = await rect(page, 'site-fullscreen-book')
    const fx = (900 - before.x) / before.width
    expect(Math.abs(after.x + fx * after.width - 900)).toBeLessThanOrEqual(1)
  })

  test('reduced motion: slides and zoom do not animate', async ({ page }) => {
    await openLightbox(page, `${ALPS}#p2`)
    const slide = page.locator(
      '[data-testid="lightbox-slide"][data-active="true"]',
    )
    await expect(slide).toHaveCSS('transition-property', 'transform, opacity')
    await expect(slide).toHaveCSS('transition-duration', '0.2s')
    // The layer animates only for a discrete change: read it in that frame.
    const zoomInLayerTransition = () =>
      page.evaluate(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }))
        await new Promise(requestAnimationFrame)
        const layer = document.querySelector(
          '[data-testid="site-fullscreen-layer"]',
        )
        if (layer === null) throw new Error('no layer')
        return getComputedStyle(layer).transitionProperty
      })
    expect(await zoomInLayerTransition()).toContain('transform')
    await page.keyboard.press('0')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(slide).toHaveCSS('transition-property', 'none')
    expect(await zoomInLayerTransition()).toBe('none')
  })
})

test.describe('site lightbox on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('390 × 844 touch: a tap opens, no arrows, 8 px sides', async ({
    page,
  }) => {
    await page.goto(ALPS)
    await page.getByTestId('site-open').tap()
    await expect(lightbox(page)).toBeVisible()
    await expect(
      lightbox(page).getByRole('button', { name: 'Next spread' }),
    ).toHaveCount(0)
    await page.keyboard.press('ArrowRight')
    await expect(indicator(page)).toHaveText('Page 1 · 1 / 11')
    await page.keyboard.press('ArrowRight')
    await expect(indicator(page)).toHaveText('Pages 2–3 · 2 / 11')
    // The step slides for 200 ms; the settled rect is the fitted one.
    await expect
      .poll(async () => (await rect(page, 'site-fullscreen-book')).x)
      .toBeCloseTo(8, 1)
    expectRect(await rect(page, 'site-fullscreen-book'), {
      x: 8,
      y: 316.82,
      width: 374,
      height: 226.36,
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390)
  })
})

test.describe('site lightbox sharp photos', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

  test('at 3× on DPR 2 the photo loads the 3200 derivative', async ({
    page,
  }) => {
    await openLightbox(page, `${ALPS}#p2`)
    // The sample has one file per photo: offer the export's widths (same
    // bytes) so the browser's pick shows which derivative `sizes` asks for.
    await page.evaluate(() => {
      for (const img of document.querySelectorAll<HTMLImageElement>(
        '[data-testid="lightbox"] img[sizes]',
      )) {
        const src = img.getAttribute('src') ?? ''
        img.srcset = [800, 1600, 3200]
          .map((w) => `${src}?w=${String(w)} ${String(w)}w`)
          .join(', ')
      }
    })
    const currentSrc = () =>
      book(page)
        .locator('img[sizes]')
        .first()
        .evaluate((img: HTMLImageElement) => img.currentSrc)
    await expect.poll(currentSrc).toContain('?w=1600')
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('+')
    await expect(lightbox(page)).toHaveAttribute('data-zoom', '3.00')
    await expect.poll(currentSrc).toContain('?w=3200')
    await page.keyboard.press('0')
    await expect(lightbox(page)).toHaveAttribute('data-zoom', '1.00')
    await expect(book(page).locator('img[sizes]').first()).toHaveAttribute(
      'sizes',
      '1641px',
    )
  })
})

test.describe('frame-budget gates', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('lightbox zoom and 11 steps stay within frame-budget gates, transform only', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await page.goto(`${ALPS}&perf=1`)
    await page.waitForFunction(() => window.__photobooksPerf !== undefined)
    await page.getByTestId('site-fullscreen-btn').click()
    await expect(indicator(page)).toHaveText('Cover')
    await applyCpuThrottling(page)
    await lightboxDecoded(page)
    await clearPerfScenario(page)
    await page.evaluate(() => {
      const w = window as unknown as {
        __lbShifts: number
        __lbStyled: Set<string>
      }
      w.__lbShifts = 0
      w.__lbStyled = new Set()
      new PerformanceObserver((list) => {
        w.__lbShifts += list.getEntries().length
      }).observe({ type: 'layout-shift' })
      const root = document.querySelector('[data-testid="lightbox"]')
      if (root === null) throw new Error('no lightbox')
      new MutationObserver((records) => {
        for (const record of records) {
          const el = record.target as HTMLElement
          w.__lbStyled.add(
            el.dataset.testid ?? el.getAttribute('aria-label') ?? el.tagName,
          )
        }
      }).observe(root, {
        attributes: true,
        attributeFilter: ['style'],
        subtree: true,
      })
    })
    await page.evaluate(browserBeginLoafScenarioWindow)

    const slideBox = () =>
      page
        .locator('[data-testid="lightbox-slide"][data-active="true"]')
        .evaluate((el: HTMLElement) => el.style.cssText)
    const boxBefore = await slideBox()
    await page.mouse.move(720, 450)
    await page.keyboard.down('Control')
    for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, -30)
    await page.keyboard.up('Control')
    await expect(lightbox(page)).not.toHaveAttribute('data-zoom', '1.00')
    await page.mouse.move(720, 450)
    await page.mouse.down()
    await page.mouse.move(600, 380, { steps: 8 })
    await page.mouse.up()
    // Only the zoom layer's transform / will-change and the dialog's cursor.
    expect(await slideBox()).toBe(boxBefore)
    const styled = await page.evaluate(() => [
      ...(window as unknown as { __lbStyled: Set<string> }).__lbStyled,
    ])
    expect(styled.sort()).toStrictEqual(['lightbox', 'site-fullscreen-layer'])
    const layerStyle = await page
      .getByTestId('site-fullscreen-layer')
      .evaluate((el: HTMLElement) => [...el.style].sort())
    expect(
      layerStyle.filter((p) => p !== 'transform' && p !== 'will-change'),
    ).toStrictEqual([])
    // Zoom and pan shift nothing (steps re-centre the position line's text).
    expect(
      await page.evaluate(
        () => (window as unknown as { __lbShifts: number }).__lbShifts,
      ),
    ).toBe(0)
    await page.keyboard.press('0')

    for (let slide = 1; slide <= SPREADS; slide += 1) {
      // The neighbour was requested eagerly with the last step: loaded now.
      await expect
        .poll(() =>
          page.evaluate(() =>
            [
              ...document.querySelectorAll<HTMLImageElement>(
                '[data-testid="lightbox"] img',
              ),
            ].every((img) => img.complete),
          ),
        )
        .toBe(true)
      await page.keyboard.press('ArrowRight')
      await expect(indicator(page)).toHaveText(
        slide === SPREADS
          ? 'Page 20 · 11 / 11'
          : slide === 1
            ? 'Page 1 · 1 / 11'
            : `Pages ${String(2 * slide - 2)}–${String(2 * slide - 1)} · ${String(slide)} / 11`,
      )
      await lightboxDecoded(page)
    }

    await page.evaluate(browserAssertNoLoaf, 0)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
