import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt, topAt } from './fixtures/paintProbe'

// personal-site K3 (kit): Settings → Site gets the Intro row; the site home lead
// reads it per D37 (intro, else "Photobooks by {author}.", else no lead).

const KIT = '/uikit/#/full/site-settings'
const INTRO =
  'Photographs of lakes, coasts and the people I travel with, made into books.'
// with INTRO: past two lines at 320 px
const LONG =
  'Most of them were taken on slow trips north, by train and on foot, over the last ten years.'

interface Demo {
  reset: () => void
  go: (stage: string) => void
  state: () => {
    path: string
    books: { id: string; title: string; published?: boolean }[]
    open: string | null
    site: { title: string; author: string; intro: string }
  }
}

test.use({ viewport: { width: 1440, height: 900 } })

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** #/demo Settings → Site with the given intro */
async function settings(page: Page, intro: string) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate((i) => {
    const d = (window as unknown as { __demo: Demo }).__demo
    d.reset()
    const s = d.state()
    s.path = '~/Pictures/Photobooks'
    s.site = { ...s.site, intro: i }
    d.go('settings')
  }, intro)
  await page.getByTestId('settings-nav-site').click()
}

/** #/demo site with one published book and the given Settings → Site texts */
async function site(page: Page, texts: { author: string; intro: string }) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate((t) => {
    const d = (window as unknown as { __demo: Demo }).__demo
    d.reset()
    const s = d.state()
    s.path = '~/Pictures/Photobooks'
    s.books = [
      {
        id: 's1',
        title: 'Fog',
        published: true,
        book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
      } as never,
    ]
    s.open = 's1'
    s.site = { ...s.site, ...t }
    d.go('site')
  }, texts)
  await expect(page.getByTestId('site-case')).toBeVisible()
}

test.describe('kit Settings → Site texts', () => {
  test('Site rows: Site title, Author, Intro with the hint and the sample', async ({
    page,
  }) => {
    await page.goto(KIT)
    await page
      .getByTestId('scenarios')
      .getByRole('tab', { name: 'Site', exact: true })
      .click()
    const rows = page.getByTestId('site-texts')
    await expect(rows).toContainText('Site title')
    await expect(rows).toContainText('Author')
    const row = page.getByTestId('site-intro-row')
    await expect(row).toContainText('Intro')
    await expect(row).toContainText('The first lines of your site')
    const v = page.getByTestId('site-intro')
    await expect(v).toHaveText(INTRO)
    await expect(v).toHaveCSS('text-align', 'right')
    expect((await box(v)).width).toBeLessThanOrEqual(320)
  })

  test('a long intro clamps at 2 lines; nothing paints below them', async ({
    page,
  }) => {
    await settings(page, `${INTRO} ${LONG}`)
    const v = page.getByTestId('site-intro')
    const m = await v.evaluate((e) => ({
      lh: parseFloat(getComputedStyle(e).lineHeight),
      h: e.getBoundingClientRect().height,
      overflow: e.scrollHeight > e.clientHeight,
    }))
    expect(Math.abs(m.h - 2 * m.lh)).toBeLessThanOrEqual(0.5)
    expect(m.overflow).toBe(true)
    // paint: the band where a third line would sit is the row's own colour
    const row = page.getByTestId('site-intro-row')
    const r = await box(row)
    const b = await box(v)
    const y = b.y - r.y + b.height + 3
    const xs = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => b.x - r.x + f * b.width)
    const [bg, ...band] = await pixelsAt(row, [
      { x: 4, y },
      ...xs.map((x) => ({ x, y })),
    ])
    for (const px of band) expect(px).toEqual(bg)
    // the clamped text itself paints: some pixel inside the value differs from the row
    const inside = await pixelsAt(
      row,
      Array.from({ length: 40 }, (_, i) => ({
        x: b.x - r.x + ((i + 0.5) / 40) * b.width,
        y: b.y - r.y + b.height / 4,
      })),
    )
    expect(inside.some((px) => px.join() !== bg?.join())).toBe(true)
  })

  test('an empty intro reads "Not set", painted on top', async ({ page }) => {
    await settings(page, '')
    const v = page.getByTestId('site-intro')
    await expect(v).toHaveText('Not set')
    expect((await topAt(v))[0]).toContain('site-intro')
  })
})

test.describe('kit site lead (D37)', () => {
  test('the lead is the intro', async ({ page }) => {
    await site(page, { author: 'Aleksandr Basov', intro: 'Lakes and coasts.' })
    await expect(page.getByTestId('site-lead')).toHaveText('Lakes and coasts.')
  })

  test('no intro: "Photobooks by {author}."', async ({ page }) => {
    await site(page, { author: 'Aleksandr Basov', intro: ' ' })
    await expect(page.getByTestId('site-lead')).toHaveText(
      'Photobooks by Aleksandr Basov.',
    )
  })

  test('no intro, no author: no lead; the case moves up to 104', async ({
    page,
  }) => {
    await site(page, { author: '', intro: '' })
    await expect(page.getByTestId('site-lead')).toHaveCount(0)
    const home = await box(page.getByTestId('site-home'))
    const c = await box(page.getByTestId('site-case'))
    expect(Math.abs(c.y - home.y - 104)).toBeLessThanOrEqual(0.5)
  })

  test('room → Fullscreen opens the lightbox', async ({ page }) => {
    await site(page, { author: 'Aleksandr Basov', intro: INTRO })
    await expect(page.getByTestId('site-lead')).toHaveText(INTRO)
    await page.getByTestId('ss9-book').first().click()
    await page.getByTestId('site-fullscreen-btn').click()
    await expect(page.getByTestId('lightbox')).toBeVisible()
  })
})
