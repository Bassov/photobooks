import type { Locator } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt, topAt } from './fixtures/paintProbe'

// personal-site D36 (K2): the room's foot right group is Share · Fullscreen · Play (gap 24) on the desktop; on a phone
// Share sits 20 px left of Play and there is no Fullscreen. Share copies the link: "Copied" for 2000 ms, same width.

const SITE = '/uikit/#/full/personal-site?book=lake-trip&gl=0'

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

const near = (a: number, b: number, d = 0.5) => {
  expect(Math.abs(a - b), `${String(a)} ≈ ${String(b)}`).toBeLessThanOrEqual(d)
}

test.describe('desktop 1440×900: Share · Fullscreen · Play', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the foot right group is gapped 24; the K1 checkpoints hold', async ({
    page,
  }) => {
    await page.goto(SITE)
    const room = page.getByTestId('ss-reader-page')
    await expect(room).toHaveAttribute('data-mode', 'desk')
    const share = await box(room.getByTestId('site-share'))
    const full = await box(room.getByTestId('site-fullscreen-btn'))
    const playBtn = room.getByTestId('site-play')
    const play = await box(playBtn)
    near(share.x + share.width + 24, full.x)
    near(full.x + full.width + 24, play.x)
    near(play.x + play.width, 1416)
    near((await box(playBtn.locator('..'))).y, 846)
    const pager = await box(room.getByTestId('site-label').locator('..'))
    near(pager.y, 846)
    near(pager.x + pager.width / 2, 720)
  })

  test('Share reads Copied for 2000 ms at the same width', async ({ page }) => {
    await page.goto(SITE)
    const share = page.getByTestId('site-share')
    const [label, copied] = [
      share.locator('span').first(),
      share.locator('span').last(),
    ]
    await expect(label).toBeVisible()
    await expect(copied).toBeHidden()
    const w0 = (await box(share)).width
    // click and time the "Copied" state in the page: from the click to the attribute's removal
    const ms = await share.evaluate(
      (el) =>
        new Promise<number>((done) => {
          const t0 = performance.now()
          new MutationObserver((_, o) => {
            if (el.hasAttribute('data-copied')) return
            o.disconnect()
            done(performance.now() - t0)
          }).observe(el, { attributes: true })
          ;(el as HTMLButtonElement).click()
        }),
    )
    expect(ms).toBeGreaterThanOrEqual(1990)
    expect(ms).toBeLessThan(2400)
    await expect(label).toBeVisible()
    near((await box(share)).width, w0)
  })

  test('mid-copy: the label reads Copied, the width is unchanged', async ({
    page,
  }) => {
    await page.goto(SITE)
    const share = page.getByTestId('site-share')
    const w0 = (await box(share)).width
    await share.click()
    await expect(share).toHaveAttribute('data-copied', '')
    await expect(share.locator('span').last()).toBeVisible()
    await expect(share.locator('span').first()).toBeHidden()
    await expect(share.locator('span').last()).toHaveText('Copied')
    near((await box(share)).width, w0)
    await expect(share).not.toHaveAttribute('data-copied', '', {
      timeout: 4000,
    })
    await expect(share.locator('span').first()).toBeVisible()
  })

  test('Fullscreen opens the lightbox over the page, painted; Esc closes it and refocuses the button', async ({
    page,
  }) => {
    await page.goto(SITE)
    const btn = page.getByTestId('site-fullscreen-btn')
    await btn.click()
    const lb = page.getByTestId('lightbox')
    await expect(lb).toBeVisible()
    await expect(page.getByTestId('site-fullscreen-indicator')).toHaveText(
      'Page 1',
    )
    const slide = page
      .getByTestId('site-fullscreen-book')
      .locator(':scope > div')
    const s = await box(slide)
    // the lightbox is on top of the site head
    const [top = []] = await topAt(page.locator('body'), { x: 720, y: 20 })
    expect(top.some((ids) => ids.includes('lightbox'))).toBe(true)
    // Page 1 (the right half) is paper, unlike the lightbox's backdrop
    const [bg = [], paper = []] = await pixelsAt(lb, [
      { x: 4, y: 4 },
      { x: s.x + s.width * 0.75, y: s.y + s.height / 2 },
    ])
    expect(paper).not.toEqual(bg)
    expect(paper.slice(0, 3).every((v) => v > 240)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(lb).toHaveCount(0)
    await expect(btn).toBeFocused()
  })
})

test.describe('phone 390×844: Share beside Play', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('Share right + 20 = Play left; no Fullscreen; header row 128.25', async ({
    page,
  }) => {
    await page.goto(SITE)
    const room = page.getByTestId('ss-reader-page')
    await expect(room).toHaveAttribute('data-mode', 'port')
    const share = await box(room.getByTestId('site-share'))
    const play = await box(room.getByTestId('site-play'))
    near(share.x + share.width + 20, play.x)
    await expect(page.getByTestId('site-fullscreen-btn')).toHaveCount(0)
    near((await box(room.getByTestId('site-all-books'))).y, 128.25)
  })
})
