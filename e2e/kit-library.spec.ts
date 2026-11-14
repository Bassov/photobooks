import fs from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit library (moved from uikit/scripts/qa.mjs §4 / v5 / v6 / v6.1, uikit-qa-split-1;
// v7.1 / v8 / v0.9 / v0.9.1 / kit-sync W4, uikit-qa-split-3):
// the first run → Create Library → picker flow, the library home (rows, covers,
// Create book, card menu), the library bar (search + sort) and Settings → library folder.
// Smoke ports also fail on a console error / warning, page error or failed request,
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

// ───────── v7.1 / v8 / v0.9 / v0.9.1 / kit-sync W4 (uikit-qa-split-3) ─────────

const SRC = path.resolve(process.cwd(), 'uikit', 'src')
const readSrc = (f: string) => fs.readFileSync(path.join(SRC, f), 'utf8')
const A5 = { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' }

interface DemoApi {
  reset: () => void
  state: () => { path: string; books: unknown[] }
  go: (view: string) => void
}

/** no finite animation still running (enter transitions done; spinners loop forever) */
async function settled(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .every(
            (a) =>
              a.playState !== 'running' ||
              a.effect?.getComputedTiming().iterations === Infinity,
          ),
      ),
    )
    .toBe(true)
}

/** qa.mjs: go("#/demo") + __demo.reset(), the library path set, `books` seeded, the library view */
async function demoLibrary(page: Page, books: unknown[]) {
  await open(page, '#/demo')
  await page.evaluate((books) => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    d.reset()
    d.state().path = '~/Pictures/Photobooks'
    d.state().books = books
    d.go('library')
  }, books)
}

/** a switch turned on (clicked only when it is off) */
async function switchOn(sw: Locator) {
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click()
  await expect(sw).toHaveAttribute('aria-checked', 'true')
}

test('v7.1 P2 #5 / #7: Home shows both rows of books; Create book dialog has no rendered borders', async ({
  page,
}) => {
  await open(page, '#/feature/recents-home')
  await settled(page)
  // v7.1 P2 #5: Home demo frame shows both rows of books (nothing clipped/scrolling)
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="demo"] *')]
          .filter(
            (e) =>
              e.scrollHeight > e.clientHeight + 2 &&
              /auto|scroll|hidden/.test(getComputedStyle(e).overflowY) &&
              e.clientHeight > 200,
          )
          .map(
            (e) =>
              `${e.tagName} ${String(e.clientHeight)}/${String(e.scrollHeight)}`,
          ),
      ),
    )
    .toEqual([])
  // v7.1 P2 #7: Create book dialog has no rendered borders (no border-t, Cancel is a ghost button)
  await D(page, '[data-testid="new-book"]').first().click()
  await expect(page.locator('[role=dialog]')).toBeVisible()
  await settled(page)
  const d = await page.evaluate(() => {
    const dl = document.querySelector('[role=dialog]')
    if (!dl) return null
    const bad: string[] = []
    for (const e of [dl, ...dl.querySelectorAll('*')]) {
      const s = getComputedStyle(e)
      for (const k of ['Top', 'Right', 'Bottom', 'Left'] as const)
        if (
          parseFloat(s[`border${k}Width`]) > 0 &&
          s[`border${k}Style`] !== 'none' &&
          !s[`border${k}Color`].includes('rgba(0, 0, 0, 0)')
        )
          bad.push(`${e.tagName}.${k}`)
    }
    return {
      bad,
      cancel: [...dl.querySelectorAll('button')].some(
        (b) => b.textContent.trim() === 'Cancel',
      ),
    }
  })
  expect(d).toEqual({ bad: [], cancel: true })
})

test("recents-home: v8 §2 '...' menu: same alignment on every card; outside click and Esc close it; Esc returns focus to the trigger", async ({
  page,
}) => {
  const errs = await open(page, '#/feature/recents-home')
  const al = await D(page, '[data-testid="book-menu-slot"]').evaluateAll((s) =>
    s.map((e) => {
      const cap = e.closest('[data-testid="book-caption"]') ?? e.parentElement
      return Math.round(
        (cap?.getBoundingClientRect().right ?? 0) -
          e.getBoundingClientRect().right,
      )
    }),
  )
  expect(al.length).toBeGreaterThan(1)
  expect([...new Set(al)]).toEqual([0])
  const tile = D(page, '[data-testid="book-menu"]').first()
  const menu = page.locator('[role=menu]')
  await tile.click()
  await expect(menu).toHaveCount(1)
  await page.mouse.click(5, 450)
  await expect(menu).toHaveCount(0)
  await tile.click()
  await expect(menu).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  expect(
    await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset.testid,
    ),
  ).toBe('book-menu')
  expect(errs).toEqual([])
})

test("v0.9 §2 empty library hides book-count / no '0 books'", async ({
  page,
}) => {
  await demoLibrary(page, [])
  await expect(D(page, '[data-testid="home-empty"]')).toBeVisible()
  await expect(
    page.locator('[data-testid="demo"] [data-testid="book-count"]'),
  ).toHaveCount(0)
  expect(await demo(page).innerText()).not.toMatch(/\b0 books\b/)
})

test('v0.9.1 §1 Create book dialog shared (title + Page size) on demo and library', async ({
  page,
}) => {
  await open(page, '#/demo')
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.reset()
  })
  const dialog = page.locator('[role=dialog]')
  const createDialog = page.locator('[data-testid="create-book-dialog"]')
  await page
    .getByRole('button', { name: /Create library/i })
    .first()
    .click()
  await dialog.getByRole('button', { name: /Choose|Select|Use/i }).click()
  await expect(dialog).toHaveCount(0)
  await page
    .getByRole('button', { name: /Create book/ })
    .first()
    .click()
  await expect(createDialog).toHaveCount(1)
  expect(await dialog.getByText('Page size').count()).toBeGreaterThanOrEqual(1)
  await page.keyboard.press('Escape')
  await open(page, '#/feature/recents-home')
  await page
    .getByRole('button', { name: /Create book/ })
    .first()
    .click()
  await expect(createDialog).toHaveCount(1)
  expect(await dialog.getByText('Page size').count()).toBeGreaterThanOrEqual(1)
})

test('v0.9.1 §4 demo uses inline rename (no rename-dialog)', () => {
  const src = readSrc('demo-parts/library.tsx')
  expect(src).not.toMatch(/rename-dialog/)
  expect(src).toMatch(/rename-input/)
})

test('v0.9.1 §9 demo library has Search + Sort', async ({ page }) => {
  await demoLibrary(page, [
    { id: 's1', title: 'Alpha', book: A5 },
    { id: 's2', title: 'Beta', book: A5 },
  ])
  await expect(page.locator('[data-testid="lib-search"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="lib-sort"]')).toHaveCount(1)
})

test('v0.9.1 §10/16 menu slot absolute right-0 (no -mr-1.5); Published chip not bg-black/55', () => {
  const src = readSrc('features/library.tsx')
  expect(src).toMatch(/book-menu-slot/)
  expect(src).toMatch(/absolute right-0/)
  expect(src).not.toMatch(/-mr-1\.5/)
  expect(src).not.toMatch(/book-published[\s\S]{0,80}bg-black\/55/)
})

test("v0.9.1 §15 FolderPicker has no 'system dialog (emulated)'", () => {
  expect(readSrc('features/screens.tsx')).not.toMatch(
    /system dialog \(emulated\)/,
  )
})

test('kit-sync W4 → KS11: library card title over the photo rgb(245, 245, 245); no console errors in the W4 walk', async ({
  page,
}) => {
  // replays the kit-sync W4 walk (book "Lake trip": cover inspector, Linen, Book settings, endpapers) up to Library
  const errs = await open(page, '#/demo')
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.reset()
  })
  const c = (sel: string) => page.locator(sel).first().click()
  await c('[data-testid="create-library"]')
  await c('[data-testid="picker-select"]')
  await c('[data-testid="demo"] [data-testid="new-book"]')
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await c('[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-item="cover"]')
  await expect(D(page, '[data-testid="insp-cover"]')).toBeVisible()
  const material = D(page, '[data-testid="cover-material"]')
  await material.selectOption('Linen')
  await expect(material).toHaveValue('Linen')
  await c('[data-testid="book-title"]')
  await expect(D(page, '[data-testid="insp-book"]')).toBeVisible()
  await switchOn(D(page, '[role=switch][aria-label="Endpapers"]'))
  await c('[data-item="ef"]')
  await expect(D(page, '[data-testid="canvas-endpaper"]')).toHaveCount(1)
  await c('[data-testid="editor-library"]')
  await expect(
    D(page, '[data-testid="book-cover"] .lib-obj div[style*="color"]').first(),
  ).toHaveCSS('color', 'rgb(245, 245, 245)')
  expect(errs).toEqual([])
})
