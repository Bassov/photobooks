import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// site-demos-port: the kit's "Site demos (archive)" section (#/archive). It is reached from the kit nav, says it is an
// archive and not a design source, lists every demo of DEMO PRs #557 / #508, and each demo opens with paint (pixels of
// a clipped screenshot) and no console errors. Demo 9 (the bookcase) is main's personal site, so its row opens that page.

// tall enough for the 390 × 844 phone frame to sit in the viewport (the screenshot clip must)
test.use({ viewport: { width: 1440, height: 1000 } })

const PORTED = [
  'site-demo-1',
  'site-demo-2',
  'site-demo-3',
  'site-demo-4',
  'site-demo-5',
  'site-demo-6',
  'site-demo-7',
  'site-demo-8',
  'site-fresh-a',
  'site-fresh-b',
  'site-fresh-c',
]
const ROWS = [...PORTED.slice(0, 8), 'site-demo-9', ...PORTED.slice(8)]

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

/** the GL demos keep the main thread busy while they first draw: one screenshot can take seconds */
const PAINT = { timeout: 20_000 }
/** paint probe: distinct colours on a 9 × 9 grid over the box (a blank page has one) */
async function colours(box: Locator) {
  const b = await box.boundingBox()
  const [w, h] = [b?.width ?? 0, b?.height ?? 0]
  const grid = Array.from({ length: 81 }, (_, i) => ({
    x: (((i % 9) + 0.5) / 9) * w,
    y: ((Math.floor(i / 9) + 0.5) / 9) * h,
  }))
  const px = await pixelsAt(box, grid)
  return new Set(px.map((c) => c.join(','))).size
}

test('the kit nav opens the archive index, which lists every demo and is not a design source', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await page.goto('/uikit/#/')
  await page.locator('[data-nav="archive"]').click()
  await expect(page).toHaveURL(/#\/archive$/)
  await expect(page.getByTestId('site-archive')).toBeVisible()
  await expect(page.locator('[data-nav="archive"]')).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByTestId('site-archive-note')).toContainText(
    'not a design source',
  )
  const rows = page.getByTestId('site-archive-row')
  await expect(rows).toHaveCount(ROWS.length)
  expect(
    await rows.evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-demo')),
    ),
  ).toEqual(ROWS)
  // demo 9 is main's personal site: the archive keeps no copy of it
  await expect(
    page.locator(
      '[data-demo="site-demo-9"] [data-testid="site-archive-desktop"]',
    ),
  ).toHaveAttribute('href', '#/full/personal-site')
  // the demos are no design-source feature pages
  const kitPages = await page.evaluate(
    () => (window as unknown as { __kit: { pages: string[] } }).__kit.pages,
  )
  expect(
    kitPages.filter((s) => ROWS.includes(s) || s.startsWith('site-archive')),
  ).toEqual([])
  expect(errors).toEqual([])
})

/** [horizontal, vertical] page-level overflow of the document */
const pageOverflow = (page: Page) =>
  page.evaluate(() => {
    const d = document.documentElement
    return [d.scrollWidth > innerWidth, d.scrollHeight > innerHeight]
  })

test('an unknown archive slug shows not-found', async ({ page }) => {
  await page.goto('/uikit/#/archive/site-demo-404')
  await expect(page.getByTestId('not-found')).toBeVisible()
})

for (const slug of PORTED) {
  test(`archived ${slug} opens from the index with paint and no console errors`, async ({
    page,
  }) => {
    const errors = collectErrors(page)
    await page.goto('/uikit/#/archive')
    await page
      .locator(`[data-demo="${slug}"] [data-testid="site-archive-desktop"]`)
      .click()
    await expect(page).toHaveURL((u) => u.hash === `#/archive/${slug}`)
    await expect(page.getByTestId('site-archive-demo')).toHaveAttribute(
      'data-demo',
      slug,
    )
    await expect
      .poll(() => colours(page.getByTestId('site-archive-demo')), PAINT)
      .toBeGreaterThan(1)
    // no page-level scroll: the demo scrolls inside its own root
    expect(await pageOverflow(page)).toEqual([false, false])

    await page.goto('/uikit/#/archive')
    await page
      .locator(`[data-demo="${slug}"] [data-testid="site-archive-phone-link"]`)
      .click()
    const iframe = page.locator('iframe')
    expect(
      (await iframe.getAttribute('src'))?.endsWith(`#/archive/${slug}`),
    ).toBe(true)
    const box = await iframe.boundingBox()
    expect([box?.width, box?.height]).toEqual([390 + 16, 844 + 16])
    // the demo inside the phone frame: the iframe's own document has the demo root
    await expect(
      page.frameLocator('iframe').getByTestId('site-archive-demo'),
    ).toHaveAttribute('data-demo', slug)
    await expect.poll(() => colours(iframe), PAINT).toBeGreaterThan(1)
    expect(errors).toEqual([])
  })
}
