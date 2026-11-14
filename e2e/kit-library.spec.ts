import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit library (moved from uikit/scripts/qa.mjs §4 / v5 / v6 / v6.1, uikit-qa-split-1):
// the first run → Create Library → picker flow, the library home (rows, covers,
// Create book, card menu), the library bar (search + sort) and Settings → library folder.
// Every test also fails on a console error / warning, page error or failed request,
// like the qa.mjs smoke() helper.

test.use({ viewport: { width: 1440, height: 900 } })

const demo = (page: Page) => page.getByTestId('demo')
const D = (page: Page, s: string) => page.locator(`[data-testid="demo"] ${s}`)

function watchErrors(page: Page) {
  const errs: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      errs.push(`${m.type()}: ${m.text().slice(0, 240)}`)
  })
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errs.push(`requestfailed: ${r.url()}`))
  return errs
}

async function open(page: Page, hash: string) {
  const errs = watchErrors(page)
  await page.goto(`/uikit/${hash}`)
  await expect(demo(page)).toBeVisible()
  return errs
}

async function createLibrary(page: Page) {
  await D(page, '[data-testid="create-library"]').click()
  await D(page, '[data-testid="picker-select"]').click()
  await expect(D(page, '[data-testid="home-empty"]')).toBeVisible()
}

/** Tab until every id in `want` took focus; a control is named by test id, else aria-label. */
async function tabRings(page: Page, want: string[]) {
  const seen: Record<string, string> = {}
  for (let k = 0; k < 120 && want.some((t) => !(t in seen)); k++) {
    await page.keyboard.press('Tab')
    const r = await page.evaluate(focusRing, '[data-testid="demo"]')
    if (r && !(r[0] in seen)) seen[r[0]] = r[1]
  }
  return want.map((t) => [t, seen[t] ?? 'not reached'])
}

function focusRing(sel: string): [string, string] | null {
  const e = document.activeElement as HTMLElement | null
  if (!e?.closest(sel)) return null
  const id =
    e.dataset.testid ??
    e.getAttribute('aria-label') ??
    (e.getAttribute('href')?.startsWith('mailto:') ? 'mailto' : null)
  // an <input> inside a <label> rings on the label
  const cs = getComputedStyle(
    e.matches('input') ? (e.closest('label') ?? e) : e,
  )
  return id
    ? [
        id,
        `${e.matches(':focus-visible') ? '' : 'not focus-visible '}${cs.outlineStyle} ${cs.outlineWidth}`,
      ]
    : null
}

async function text(l: Locator) {
  return ((await l.textContent()) ?? '').trim()
}

test('recents-home: home mock fills whole rows (no orphan card)', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/recents-home')
  await expect(page.getByTestId('book-card').first()).toBeVisible()
  const tops = await page
    .locator('[data-testid="book-card"]')
    .evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().top)),
    )
  const first = tops.filter((t) => t === tops[0]).length
  expect(
    tops.length % first,
    `${String(tops.length)} books, ${String(first)} per row`,
  ).toBe(0)
  expect(errs).toEqual([])
})

test('screen settings: Change library folder updates the path', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/settings')
  await D(page, '[data-testid="change-library"]').click()
  await page.getByRole('button', { name: 'Choose folder…' }).click()
  await page.getByRole('button', { name: 'Mountains', exact: true }).click()
  await D(page, '[data-testid="picker-select"]').click()
  await expect(D(page, '[data-testid="library-path"]').first()).toHaveText(
    /Mountains/,
  )
  expect(errs).toEqual([])
})

test('open-save-project: first run → Create Library → picker → empty library', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/open-save-project')
  await createLibrary(page)
  await expect(D(page, '[data-testid="library-path"]')).toBeVisible()
  expect(errs).toEqual([])
})

test('screen settings: v5.2 Settings note says Interface, not Appearance', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/settings')
  const t = await page.locator('body').innerText()
  expect(t).not.toMatch(/Appearance/)
  expect(t).toMatch(/Interface/)
  expect(errs).toEqual([])
})

test('recents-home: v6 Home: no New book tile; covers in a row share a baseline', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/recents-home')
  await page.mouse.move(1, 1)
  await expect(page.locator('[data-testid="new-book-tile"]')).toHaveCount(0)
  await expect
    .poll(async () => {
      const bottoms = await page
        .locator('[data-testid="book-cover"]')
        .evaluateAll((els) =>
          els
            .slice(0, 4)
            .map((e) => Math.round(e.getBoundingClientRect().bottom)),
        )
      return new Set(bottoms).size
    })
    .toBe(1)
  expect(errs).toEqual([])
})

test("open-save-project: v6 flow: one welcome button 'Create Library' (text only) → picker → empty library with path + Change in the top bar", async ({
  page,
}) => {
  const errs = await open(page, '#/feature/open-save-project')
  await expect(
    D(page, '[data-testid="welcome"]').locator('button'),
  ).toHaveCount(1)
  const b = D(page, '[data-testid="create-library"]')
  expect(await text(b)).toBe('Create Library')
  await expect(b.locator('svg')).toHaveCount(0)
  await createLibrary(page)
  const bar =
    (await D(page, '[data-testid="library-card"]').first().textContent()) ?? ''
  expect(bar).toMatch(/Change/)
  expect(bar).toMatch(/\//)
  const ex =
    (await D(page, '[data-testid="example-book"]').first().textContent()) ?? ''
  expect(ex).toMatch(/Fog/)
  expect(ex).toMatch(/Example/)
  const t =
    (await D(page, '[data-testid="home-empty"]').first().textContent()) ?? ''
  expect(t).toMatch(/Your library is ready/i)
  expect(t).toMatch(/Your first story/)
  expect(t).toMatch(/starts here\./)
  const nb = D(page, '[data-testid="new-book"]').first()
  expect(await text(nb)).toBe('Create book')
  await expect(nb.locator('svg')).toHaveCount(0)
  expect(errs).toEqual([])
})

test("open-save-project: v6 Change in the empty library's top bar → confirm dialog", async ({
  page,
}) => {
  const errs = await open(page, '#/feature/open-save-project')
  await createLibrary(page)
  await D(page, '[data-testid="change-library"]').click()
  await expect(page.locator('[role="alertdialog"]')).toHaveCount(1)
  expect(errs).toEqual([])
})

test('recents-home: library bar: focus-visible outline solid on search + sort', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/recents-home')
  const rings = await tabRings(page, ['lib-search-input', 'lib-sort'])
  expect(rings).toEqual([
    ['lib-search-input', 'solid 2px'],
    ['lib-sort', 'solid 2px'],
  ])
  expect(errs).toEqual([])
})

test('recents-home: v6.1 library search + sort: quiet field tone on chrome, no border, no black', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/recents-home')
  const st = await D(
    page,
    '[data-testid="lib-search"], [data-testid="lib-sort"]',
  ).evaluateAll((els) =>
    els.map((e) => {
      const s = getComputedStyle(e)
      const bar = e.closest('[data-testid=library-bar]')
      const black =
        /rgb\((\d+), (\d+), (\d+)\)/.test(s.color) &&
        (s.color.match(/\d+/g) ?? []).slice(0, 3).every((n) => +n < 40)
      return {
        bg: s.backgroundColor,
        border: s.borderTopWidth,
        shadow: s.boxShadow,
        black,
        bar: bar ? getComputedStyle(bar).backgroundColor : '',
      }
    }),
  )
  const want = {
    bg: 'rgb(215, 215, 215)',
    border: '0px',
    shadow: 'none',
    black: false,
    bar: 'rgb(225, 225, 225)',
  }
  expect(st).toEqual([want, want])
  expect(errs).toEqual([])
})

test('recents-home: v6.1 library still: Create book in header, Rename in card menu, no New-book tile, no sample book', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/recents-home')
  expect(await D(page, '[data-testid="new-book"]').innerText()).toBe(
    'Create book',
  )
  await expect(D(page, '[data-testid="new-book-tile"]')).toHaveCount(0)
  expect((await demo(page).textContent()) ?? '').not.toMatch(/sample book/i)
  const card = D(page, '[data-testid="book-card"]').first()
  await card.hover()
  await card.locator('button[aria-label="Book actions"]').click()
  await expect(page.getByRole('menuitem', { name: /Rename/ })).toHaveCount(1)
  expect(errs).toEqual([])
})
