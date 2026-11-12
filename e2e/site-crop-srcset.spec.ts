import { expect, test } from './fixtures/coverage'

/** Unlisted sample (`src/site/sampleSite.ts`): a 3:2 photo filling a portrait frame. */
const CROP = '/site.html?book=crop#p1'
const WIDTHS = [480, 960, 1600, 2400]

test.describe('site srcset of a cropped photo', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })

  test('page 1 loads a candidate at least as wide as the photo is drawn', async ({
    page,
  }) => {
    await page.goto(CROP)
    const img = page
      .getByTestId('site-spread')
      .getByTestId('spread-frame-image')
    await expect(img).toBeVisible()
    // The sample has one file per photo: offer the export's widths (same
    // bytes) so the browser's pick shows which width `sizes` asks for.
    await img.evaluate((el: HTMLImageElement, widths) => {
      const src = el.getAttribute('src') ?? ''
      el.srcset = widths
        .map((w) => `${src}?w=${String(w)} ${String(w)}w`)
        .join(', ')
    }, WIDTHS)
    const picked = () =>
      img.evaluate((el: HTMLImageElement) =>
        Number(/[?&]w=(\d+)/.exec(el.currentSrc)?.[1] ?? 0),
      )
    await expect.poll(picked).toBeGreaterThan(0)

    const drawn = await img.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const frame = el.closest('[data-testid="spread-frame"]') ?? el
      const f = frame.getBoundingClientRect()
      const hit = document.elementsFromPoint(
        f.x + f.width / 2,
        f.y + f.height / 2,
      )
      return { width: r.width, frame: f.width, painted: hit.includes(el) }
    })
    // Cropped: the photo is drawn wider than its frame.
    expect(drawn.width).toBeGreaterThan(drawn.frame * 1.5)
    expect(drawn.painted).toBe(true)
    // No upscale at DPR 1: the picked candidate covers the drawn width.
    expect(await picked()).toBeGreaterThanOrEqual(drawn.width)
  })
})
