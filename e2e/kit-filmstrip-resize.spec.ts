import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit filmstrip resize (Designer walkthrough-ux-review §B, item filmstrip-resize-kit): the dock top
// edge is a separator; thumb height H is `auto` (follows the window height) or 56 .. max px,
// persisted per device in localStorage["photobooks.filmstrip.thumb.v2"].

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: {
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--font-render-hinting=none'],
  },
})

const V2 = 'photobooks.filmstrip.thumb.v2'
const D = (page: Page, s: string) => page.locator(`[data-testid="demo"] ${s}`)
const sep = (page: Page) => D(page, '[data-testid="thumb-resizer"]')
const thumb = (page: Page) =>
  D(page, '[data-testid="filmstrip"] [role="row"] img').first()
const strip = (page: Page) =>
  D(page, '[data-testid="filmstrip"] [role="row"] .truncate')

interface DemoApi {
  reset: () => void
  state: () => {
    path: string
    books: unknown[]
    open: string | null
  }
  go: (view: string) => void
}

/** #/demo with one book open in the editor; `photos` adds the sample folder */
async function demoBook(page: Page, photos = true) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    d.reset()
    const s = d.state()
    s.path = '~/Pictures/Photobooks'
    s.books = [
      {
        id: 's1',
        title: 'Resize',
        book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
      },
    ]
    s.open = 's1'
    d.go('editor')
  })
  await expect(D(page, '[data-testid="dock"]')).toBeVisible()
  if (!photos) return
  await page.locator('[data-testid="demo-add-folder"]').first().click()
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Select/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await expect(thumb(page)).toBeVisible()
}

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}
const thumbH = async (page: Page) => (await box(thumb(page))).height
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), V2)

for (const [w, h, px] of [
  [1440, 900, 76],
  [2560, 1440, 122],
  [3840, 2160, 160],
] as const) {
  test(`auto thumb height at ${String(w)}×${String(h)} is ${String(px)} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: h })
    await demoBook(page)
    await expect.poll(() => thumbH(page)).toBeCloseTo(px, 0)
    await expect(sep(page)).toHaveAttribute('aria-valuenow', String(px))
  })
}

test('drag the dock edge up 52 px: 128 px, chip only while dragging', async ({
  page,
}) => {
  await demoBook(page)
  await expect(sep(page)).toHaveAttribute('aria-orientation', 'horizontal')
  await expect(sep(page)).toHaveAttribute('aria-label', 'Resize photos')
  await expect(sep(page)).toHaveAttribute('aria-valuemin', '56')
  await expect(sep(page)).toHaveAttribute('aria-valuemax', '240')
  const b = await box(sep(page))
  expect(b.height).toBe(9)
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2
  // paint: the separator centre is the separator, not the canvas or a thumb
  const hit = await page.evaluate(
    (p) => document.elementsFromPoint(p.x, p.y)[0]?.getAttribute('data-testid'),
    { x, y },
  )
  expect(hit).toBe('thumb-resizer')
  expect(await sep(page).evaluate((e) => getComputedStyle(e).cursor)).toBe(
    'ns-resize',
  )
  await page.mouse.move(x, y)
  await expect(D(page, '[data-testid="thumb-resizer-pill"]')).toBeVisible()
  await page.mouse.down()
  await page.mouse.move(x, y - 30, { steps: 3 })
  await page.mouse.move(x, y - 52, { steps: 3 })
  const chip = D(page, '[data-testid="thumb-resizer-chip"]')
  await expect(chip).toHaveText('128 px')
  const cb = await box(chip)
  const edge = (await box(D(page, '[data-testid="dock"]'))).y
  expect(edge - (cb.y + cb.height)).toBeCloseTo(30, 0)
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '128')
  await page.mouse.up()
  await expect(chip).toHaveCount(0)
  await expect.poll(() => thumbH(page)).toBeCloseTo(128, 0)
  expect(await stored(page)).toBe('128')
})

test('keys on the focused separator; double-click returns to auto', async ({
  page,
}) => {
  await demoBook(page)
  const s = sep(page)
  await s.focus()
  const now = (v: number) =>
    expect(s).toHaveAttribute('aria-valuenow', String(v))
  await page.keyboard.press('ArrowUp')
  await now(84)
  await expect(strip(page)).toHaveCount(0)
  await page.keyboard.press('ArrowUp')
  await now(92)
  // filename strip at H >= 90 only
  await expect(strip(page).first()).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await now(84)
  await expect(strip(page)).toHaveCount(0)
  await page.keyboard.press('Home')
  await now(56)
  await expect.poll(() => thumbH(page)).toBeCloseTo(56, 0)
  await page.keyboard.press('End')
  await now(240)
  expect(await stored(page)).toBe('240')
  await page.keyboard.press('Enter')
  await now(76)
  expect(await stored(page)).toBe('auto')
  await page.keyboard.press('Home')
  await now(56)
  await s.dblclick()
  await now(76)
  await expect.poll(() => thumbH(page)).toBeCloseTo(76, 0)
  expect(await stored(page)).toBe('auto')
})

test('reload keeps H; old key ignored; a short window re-clamps without writing', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('photobooks.filmstrip.thumbHeight', '96')
  })
  await demoBook(page)
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '76')
  await sep(page).focus()
  await page.keyboard.press('End')
  await page.reload()
  await demoBook(page)
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '240')
  await expect.poll(() => thumbH(page)).toBeCloseTo(240, 0)
  // 600 high: max = min(240, floor(0.5 · 552) − 64) = 212
  await page.setViewportSize({ width: 1440, height: 600 })
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '212')
  await expect(sep(page)).toHaveAttribute('aria-valuemax', '212')
  await expect.poll(() => thumbH(page)).toBeCloseTo(212, 0)
  expect(await stored(page)).toBe('240')
})

test('the empty-state row follows H', async ({ page }) => {
  await demoBook(page, false)
  const empty = D(page, '[data-testid="film-empty"]')
  await expect(empty).toBeVisible()
  expect((await box(empty)).height).toBeCloseTo(76, 0)
  await sep(page).focus()
  await page.keyboard.press('Home')
  await expect.poll(async () => (await box(empty)).height).toBeCloseTo(56, 0)
})
