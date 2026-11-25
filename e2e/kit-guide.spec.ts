import fs from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { imposition as prodImposition } from '../src/core/print/imposition'
import { imposition as kitImposition } from '../uikit/src/kit/guide/imposition'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// Kit product walkthrough (walkthrough-port, ported from #565): the KitBar
// "Walkthrough" item is painted on the kit home and opens #/guide; the guide
// lists 21 chapters, every figure is decoded and painted, every kit link on it
// resolves, and its imposition panel is the prod imposition.

test.use({ viewport: { width: 1440, height: 900 } })

const CHAPTERS = 21
const kitDir = path.resolve(process.cwd(), 'uikit', 'src', 'kit')
const readKit = (f: string) =>
  JSON.parse(fs.readFileSync(path.join(kitDir, f), 'utf8')) as {
    slug?: string
    id?: string
  }[]
const slugs = readKit('pages.json').map((p) => p.slug)
const screens = readKit('screens.json').map((s) => s.id)

/** the topmost painted element at the box centre lies inside the locator's element */
async function paintedOnTop(loc: Locator) {
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return top !== null && el.contains(top)
  })
}

/** A kit hash link that names an existing page: a feature, screen, guide chapter (`ids`), the demo or credits. */
function resolves(h: string, ids: string[]) {
  const [, kind = '', id = ''] = /^#\/([a-z]+)\/?(.*)$/.exec(h) ?? []
  const pages: Record<string, (id: string) => boolean> = {
    feature: (s) => slugs.includes(s),
    screen: (s) => screens.includes(s),
    guide: (s) => s === '' || ids.includes(s),
    demo: (s) => s === '',
    credits: (s) => s === '',
  }
  return pages[kind]?.(id) ?? false
}

async function openGuide(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('requestfailed', (r) => errors.push(`requestfailed ${r.url()}`))
  await page.goto('/uikit/#/guide')
  await expect(page.getByTestId('guide-toc')).toBeVisible()
}

test('kit home: the Walkthrough nav item is painted and opens #/guide', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/uikit/#/')
  const nav = page.locator('[data-nav="guide"]')
  await expect(nav).toBeVisible()
  await expect(nav).toHaveText('Walkthrough')
  await expect(nav).toHaveAttribute('role', 'link')
  expect(await paintedOnTop(nav)).toBe(true)
  await expect(nav).not.toHaveAttribute('aria-current', 'page')

  await nav.click()
  await expect(page).toHaveURL(/#\/guide$/)
  await expect(page.locator('[data-nav="guide"]')).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page).toHaveTitle('Walkthrough · Photobooks UI kit')
  const toc = page.getByTestId('guide-toc')
  await expect(toc).toBeVisible()
  // the chapters + "All features"
  await expect(toc.getByRole('link')).toHaveCount(CHAPTERS + 1)
  await expect(toc.getByRole('link').last()).toHaveText('All features')
  expect(await paintedOnTop(toc.getByRole('link').first())).toBe(true)
  await expect(page.locator('section[data-guide-chapter]')).toHaveCount(
    CHAPTERS,
  )
  await expect(page.locator('h1')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('the Walkthrough nav item opens #/guide from the keyboard', async ({
  page,
}) => {
  await page.goto('/uikit/#/components')
  const nav = page.locator('[data-nav="guide"]')
  await nav.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/guide$/)
  await expect(page.getByTestId('guide-toc')).toBeVisible()
})

test('every guide figure is decoded and painted', async ({ page }) => {
  const errors: string[] = []
  await openGuide(page, errors)
  const figures = page.locator('[data-testid="guide"] figure img')
  const n = await figures.count()
  // every chapter but "Settings and shortcuts" (a shortcuts table) has a figure
  expect(n).toBe(CHAPTERS - 1)
  for (let i = 0; i < n; i++) {
    const img = figures.nth(i)
    const src = (await img.getAttribute('src')) ?? ''
    // centred: scrollIntoViewIfNeeded can leave the figure under the sticky KitBar
    await img.evaluate((e) => {
      e.scrollIntoView({ block: 'center' })
    })
    await expect
      .poll(() =>
        img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth),
      )
      .toBeGreaterThan(0)
    // a figure is a screenshot: its painted pixels are not one flat colour
    const b = await img.boundingBox()
    const w = b?.width ?? 0
    const h = b?.height ?? 0
    // a dense grid: text-only figures (hosting, site texts) are mostly flat panel
    const grid = Array.from({ length: 32 * 24 }, (_, k) => ({
      x: (w * ((k % 32) + 0.5)) / 32,
      y: (h * (Math.floor(k / 32) + 0.5)) / 24,
    }))
    const rgba = await pixelsAt(img, grid)
    expect(
      new Set(rgba.map((p) => p.slice(0, 3).join())).size,
      `${src} paints more than one colour`,
    ).toBeGreaterThan(1)
    // nothing covers it: the topmost element at its centre is the figure (image or a callout)
    expect(await paintedOnTop(img.locator('..')), `${src} on top`).toBe(true)
  }
  expect(errors).toEqual([])
})

test('every kit link on the guide resolves to a page', async ({ page }) => {
  const errors: string[] = []
  await openGuide(page, errors)
  const ids = await page
    .locator('section[id]')
    .evaluateAll((s) => s.map((e) => e.id))
  const hrefs = await page
    .locator('[data-testid="guide"] a[href], [data-testid="guide-toc"] a[href]')
    .evaluateAll((as) => [
      ...new Set(as.map((a) => a.getAttribute('href') ?? '')),
    ])
  expect(hrefs.filter((h) => !resolves(h, ids))).toEqual([])
  const features = hrefs.filter((h) => h.startsWith('#/feature/'))
  expect(features.length).toBe(slugs.length)
  // a feature link opens its kit page, not the not-found page
  for (const h of features) {
    await page.goto(`/uikit/${h}`)
    await expect(page.locator('[data-testid="not-found"]')).toHaveCount(0)
    await expect(
      page.locator('[data-nav="next"], [data-nav="prev"]').first(),
    ).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('TOC and deep links land the chapter under the bar; the 2-up / 4-up panel switches sheets', async ({
  page,
}) => {
  const errors: string[] = []
  await openGuide(page, errors)
  const toc = page.getByTestId('guide-toc')
  await toc.locator('[data-guide-link="print-home"]').click()
  await expect(page).toHaveURL(/#\/guide\/print-home$/)
  await expect(toc.locator('[data-guide-link="print-home"]')).toHaveAttribute(
    'aria-current',
    'location',
  )
  // under the 72px bar; the scroll lands on a whole pixel, the chapter top may sit on a fraction
  const offBar = (id: string) => () =>
    page
      .locator(`#${id}`)
      .evaluate((e) => Math.abs(e.getBoundingClientRect().top - 72))
  await expect.poll(offBar('print-home')).toBeLessThan(1)

  const panel = page.getByTestId('guide-imposition')
  const sheets = panel.locator('[data-sheet]')
  await expect(sheets).toHaveCount(5) // 20 pages, 2-up: 4 pages a sheet
  await expect(panel.locator('[data-skip]')).toHaveCount(1) // "Cut across" is 4-up only
  await panel.getByRole('radio', { name: '4-up' }).click()
  await expect(sheets).toHaveCount(3) // 20 + 4 blank, 8 pages a sheet
  await expect(panel.locator('[data-skip]')).toHaveCount(0)
  await expect(panel.locator('[data-cut]').first()).toBeVisible()

  await page.goto('/uikit/#/')
  await page.goto('/uikit/#/guide/hosting')
  await expect.poll(offBar('hosting')).toBeLessThan(1)
  expect(errors).toEqual([])
})

test('the guide imposition copy equals prod imposition()', () => {
  for (const layout of ['2up', '4up'] as const)
    for (let pages = 1; pages <= 120; pages++)
      expect(kitImposition(pages, layout)).toEqual(
        prodImposition(pages, layout),
      )
})
