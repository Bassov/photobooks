import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { applyLayout } from './fixtures/layoutTiles'
import { openLibraryBook } from './fixtures/openLibraryBook'

// Designer interface-size §4 / Must IS5 (item interface-size-popovers):
// positioned popovers portal to <body>, outside the zoomed #root. The element
// React Aria positions stays unzoomed and its content root zooms, so at scale
// s every popover is R(s): the same state at 100 % in a W/s × H/s window,
// values × s (±0.5 px), and it stays inside the window.

// Unhinted text, as the Designer measures: hinted glyph advances round per
// font size, so a text-sized box would not scale linearly with the zoom.
test.use({ launchOptions: { args: ['--font-render-hinting=none'] } })

const KEY = 'photobooks.ui.scale.v1'
const W = 3840
const H = 2160

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const rectOf = (l: Locator): Promise<Rect> =>
  l.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })

/** The leftmost frame whose top-left (+20 px) is in the window. */
async function leftmost(frames: Locator, page: Page): Promise<Rect> {
  await expect(frames.first()).toBeVisible()
  const size = page.viewportSize()
  if (size === null) throw new Error('no viewport')
  const all = (await Promise.all((await frames.all()).map(rectOf))).filter(
    (r) => r.x + 20 < size.width && r.y >= 0 && r.y + 20 < size.height,
  )
  return all.reduce((a, b) => (b.x < a.x ? b : a))
}

/** One open popover: its box and the element it is anchored to. */
interface Shot {
  pop: Rect
  anchor: Rect
}

async function shot(pop: Locator, anchor: Locator): Promise<Shot> {
  await expect(pop).toBeVisible()
  // React Aria places the overlay a frame after it mounts: wait until two
  // reads 100 ms apart agree.
  let last = ''
  await expect
    .poll(
      async () => {
        const prev = last
        last = JSON.stringify(await rectOf(pop))
        return last === prev
      },
      { intervals: [100] },
    )
    .toBe(true)
  // Paint: the popover is what the window shows at its centre.
  expect(
    await pop.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const css = document.head.appendChild(document.createElement('style'))
      css.textContent = '* { pointer-events: auto !important }'
      const top = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + r.height / 2,
      )
      css.remove()
      return top !== null && el.contains(top)
    }),
    'popover on top at its centre',
  ).toBe(true)
  return { pop: await rectOf(pop), anchor: await rectOf(anchor) }
}

/** The window at 100 % (W/s × H/s), then the stored choice at W × H. */
async function atReference(page: Page, s: number): Promise<void> {
  await page.setViewportSize({ width: W / s, height: H / s })
  await expect(page.locator('html')).toHaveAttribute('data-ui-scale', '100')
}

async function atScale(page: Page, s: number): Promise<void> {
  await page.evaluate(
    ([k, v]) => {
      localStorage.setItem(k, v)
    },
    [KEY, String(s * 100)] as const,
  )
  await page.setViewportSize({ width: W, height: H })
  await expect(page.locator('html')).toHaveAttribute(
    'data-ui-scale',
    String(s * 100),
  )
}

function expectInside(r: Rect, what: string): void {
  expect(r.x, `${what} left`).toBeGreaterThanOrEqual(0)
  expect(r.y, `${what} top`).toBeGreaterThanOrEqual(0)
  expect(r.x + r.w, `${what} right`).toBeLessThanOrEqual(W)
  expect(r.y + r.h, `${what} bottom`).toBeLessThanOrEqual(H)
}

/** Popover edges against its anchor: start / end / centre, below / above. */
const sides = ({ pop, anchor }: Shot) => ({
  x: [
    pop.x - anchor.x,
    pop.x + pop.w - (anchor.x + anchor.w),
    pop.x + pop.w / 2 - (anchor.x + anchor.w / 2),
  ],
  y: [pop.y - (anchor.y + anchor.h), anchor.y - (pop.y + pop.h)],
})

/**
 * R(s) for a popover: the size × s, and where it hangs off its anchor (the
 * aligned edge or centre, the gap) × s, ±0.5 px; inside the window. Measured
 * against the anchor because the trigger is app chrome: a text-sized trigger
 * rounds its label a few app px apart under the zoom (interface-size-core).
 */
function expectR(ref: Shot, at: Shot, s: number, what: string): void {
  const msg = `${what} ${JSON.stringify({ ref, at })}`
  const [a, r] = [sides(at), sides(ref)]
  const best = (now: number[], was: number[]) =>
    Math.min(...now.map((v, i) => Math.abs(v - (was[i] ?? Infinity) * s)))
  expect(
    Math.abs(at.pop.w - ref.pop.w * s),
    `${msg} width`,
  ).toBeLessThanOrEqual(0.5)
  expect(
    Math.abs(at.pop.h - ref.pop.h * s),
    `${msg} height`,
  ).toBeLessThanOrEqual(0.5)
  expect(best(a.x, r.x), `${msg} x`).toBeLessThanOrEqual(0.5)
  expect(best(a.y, r.y), `${msg} gap`).toBeLessThanOrEqual(0.5)
  expectInside(at.pop, what)
}

/**
 * Closes a popover with the pointer: a click on React Aria's modal underlay
 * (it takes the click, the app under it gets nothing) and a move away for a
 * tooltip. A key press would leave keyboard modality, and React Aria then
 * shows no tooltip on hover.
 */
async function dismiss(page: Page, pop: Locator): Promise<void> {
  const size = page.viewportSize()
  if (size === null) throw new Error('no viewport')
  await page.mouse.click(5, size.height - 5)
  await expect(pop).toHaveCount(0)
}

const menuOf = (page: Page, testId: string) =>
  page.locator('.pb-menu-popover', { has: page.getByTestId(testId) })

const tooltip = (page: Page) => page.getByRole('tooltip')

for (const s of [1.25, 1.5]) {
  test.describe(`s = ${String(s)} at ${String(W)}×${String(H)}`, () => {
    test('editor: zoom menu, tool tooltip and frame menu = R(s)', async ({
      page,
    }) => {
      await page.setViewportSize({ width: W / s, height: H / s })
      await openLibraryBook(page)
      await applyLayout(page, 'Two portraits', { restorePanel: true })

      const zoom = page.getByTestId('zoom-menu')
      const zoomMenu = page.locator('.pb-menu-popover', {
        has: page.getByRole('menuitem', { name: 'Fit spread' }),
      })
      const tool = page.getByTestId('tool-frame')
      // Editor frames are buttons; preview frames are inert divs.
      const frames = page.locator('button[data-testid="spread-frame"]')
      const frameMenu = menuOf(page, 'frame-menu')
      const anchor = page.getByTestId('frame-menu-anchor')

      const take = async () => {
        // React Aria shows a hover tooltip only in pointer modality, which a
        // pointermove sets; hover() alone enters the button before it moves.
        await page.mouse.move(1, 1)
        await tool.hover()
        const t = await shot(tooltip(page), tool)
        await page.mouse.move(1, 1)
        await expect(tooltip(page)).toHaveCount(0)

        await zoom.click()
        const z = await shot(zoomMenu, zoom)
        await dismiss(page, zoomMenu)

        const f0 = await leftmost(frames, page)
        const p = { x: f0.x + 20, y: f0.y + 20 }
        await page.mouse.click(p.x, p.y, { button: 'right' })
        const f = await shot(frameMenu, anchor)
        await dismiss(page, frameMenu)
        return { z, t, f, p }
      }

      await atReference(page, s)
      const ref = await take()
      await atScale(page, s)
      const at = await take()

      expectR(ref.z, at.z, s, 'zoom menu')
      // Gap trigger → menu: 4 app px at 100 %, 4·s here.
      expect(at.z.pop.y - (at.z.anchor.y + at.z.anchor.h)).toBeCloseTo(4 * s, 0)
      expectR(ref.t, at.t, s, 'tooltip')
      // The frame menu hangs off a zero-size anchor at the pointer.
      expectR(ref.f, at.f, s, 'frame menu')
      // Round 34 Must M135 (item design-r34-is-prod): the anchor is at the
      // pointer at any scale (not s × it), and the menu's top-left sits
      // off the pointer by the 100 % offset × s (±1 px).
      for (const [run, k] of [
        [ref, 1],
        [at, s],
      ] as const) {
        expect(
          Math.abs(run.f.anchor.x - run.p.x),
          'anchor x',
        ).toBeLessThanOrEqual(1)
        expect(
          Math.abs(run.f.anchor.y - run.p.y),
          'anchor y',
        ).toBeLessThanOrEqual(1)
        const dx = (run.f.pop.x - run.p.x) / k
        const dy = (run.f.pop.y - run.p.y) / k
        expect(
          Math.abs(dx - (ref.f.pop.x - ref.p.x)),
          'menu x',
        ).toBeLessThanOrEqual(1)
        expect(
          Math.abs(dy - (ref.f.pop.y - ref.p.y)),
          'menu y',
        ).toBeLessThanOrEqual(1)
      }
    })

    test('library: sort menu, book menu and Page size select = R(s)', async ({
      page,
    }) => {
      await page.setViewportSize({ width: W / s, height: H / s })
      await openLibraryBook(page)
      await page.getByTestId('go-library').click()
      await expect(page.getByTestId('library-screen')).toBeVisible()

      const sort = page.getByTestId('lib-sort')
      const sortMenu = menuOf(page, 'lib-sort-menu')
      const book = page.locator('[data-testid^="book-menu-"]').first()
      const bookMenu = page.locator('.pb-menu-popover', {
        has: page.getByRole('menuitem', { name: 'Rename' }),
      })
      const preset = page.getByTestId('create-preset')
      const sizes = page.locator('.pb-list-select__popover')

      const take = async () => {
        await sort.click()
        const so = await shot(sortMenu, sort)
        await dismiss(page, sortMenu)

        await book.click({ force: true })
        const b = await shot(bookMenu, book)
        await dismiss(page, bookMenu)

        await page.getByTestId('new-book').click()
        await preset.click()
        const se = await shot(sizes, preset)
        await dismiss(page, sizes)
        const dialog = page.getByTestId('create-book-dialog')
        await dialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(dialog).toHaveCount(0)
        return { so, b, se }
      }

      await atReference(page, s)
      const ref = await take()
      await atScale(page, s)
      const at = await take()

      expectR(ref.so, at.so, s, 'sort menu')
      expectR(ref.b, at.b, s, 'book menu')
      // The size list hangs off its trigger: left edges aligned, the trigger's
      // width, gap 4·s, rows × s. (The dialog around the trigger zooms in lane
      // interface-size-modals; the list holds either way.)
      const { pop, anchor } = at.se
      expect(pop.x).toBeCloseTo(anchor.x, 0)
      expect(Math.abs(pop.w - anchor.w)).toBeLessThanOrEqual(0.5)
      expect(
        Math.abs(pop.y - (anchor.y + anchor.h) - 4 * s),
      ).toBeLessThanOrEqual(0.5)
      expect(Math.abs(pop.h - ref.se.pop.h * s)).toBeLessThanOrEqual(0.5)
      expectInside(pop, 'size list')
    })
  })
}

test('100 %: a menu taller than the window scrolls inside it (IS10)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLibraryBook(page)
  await page.setViewportSize({ width: 1440, height: 200 })
  await page.getByTestId('zoom-menu').click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const m = await menu.evaluate((el) => ({
    scroll: el.scrollHeight > el.clientHeight,
    bottom:
      el.closest('.pb-menu-popover')?.getBoundingClientRect().bottom ?? 1e9,
  }))
  expect(m.scroll).toBe(true)
  expect(m.bottom).toBeLessThanOrEqual(200)
})
