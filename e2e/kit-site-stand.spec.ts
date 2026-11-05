import type { Locator } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// site-stand (DEMO branch): the kit site stand holds demo 6, demo 7 and fresh C.
// On a phone the kit body's 1280 min-width made fresh C read innerWidth 1280 at
// first render and keep the desktop grid: the open book covered the lead and
// the title, the lead wrapped in a ~100 px column, the nav did not fit.

const SLUGS = ['site-demo-6', 'site-demo-7', 'site-fresh-c']

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** whether the element itself is painted at the centre of its box (not covered) */
function paintedAt(l: Locator) {
  return l.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return !!hit && el.contains(hit)
  })
}

test('the site-demos entry lists exactly the three stand demos', async ({
  page,
}) => {
  await page.goto('/uikit/#/full/site-demos')
  const links = page.getByTestId('site-demo-link')
  await expect(links).toHaveText(SLUGS)
  await expect(links.first()).toHaveAttribute('href', '#/full/site-demo-6')
})

test.describe('phone 390×844', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('fresh C takes the phone layout: full-width lead, book below it, Menu in the header', async ({
    page,
  }) => {
    await page.goto('/uikit/#/full/site-fresh-c')
    await expect(page.getByTestId('sfc')).toHaveClass(/sfc-phone/)
    const leadEl = page.locator('.sfc-lead').first()
    const titleEl = page.locator('.sfc-now .sfc-title')
    const lead = await box(leadEl)
    const title = await box(titleEl)
    const reader = await box(page.locator('.sd-reader'))
    expect(lead.width).toBeGreaterThanOrEqual(300)
    // the open book sits between the lead and the title, overlapping neither
    expect(reader.y).toBeGreaterThanOrEqual(lead.y + lead.height)
    expect(title.y).toBeGreaterThanOrEqual(reader.y + reader.height)
    expect(await paintedAt(leadEl)).toBe(true)
    expect(await paintedAt(titleEl)).toBe(true)
    const menu = await box(page.getByTestId('sfc-menu-btn'))
    expect(menu.x + menu.width).toBeLessThanOrEqual(390)
  })
})
