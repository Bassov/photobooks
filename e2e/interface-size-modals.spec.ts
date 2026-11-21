import type { Browser, Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openLibraryBook } from './fixtures/openLibraryBook'

// Designer interface-size §4 (item interface-size-modals), Must IS5 dialog
// part: modal overlays are portalled outside the #root zoom, so their overlay
// root carries `zoom: var(--ui-scale)`. Each dialog / toast at 3840×2160 and
// scale s must equal R(s): the same state at 100 % in a W/s × H/s window,
// values × s (±0.5 px).

// The headless shell rounds text advances; the full build scales text exactly.
test.use({ channel: 'chromium' })

const KEY = 'photobooks.ui.scale.v1'
const W = 3840
const H = 2160
const TOL = 0.5

interface Box {
  x: number
  y: number
  width: number
  height: number
  /** Computed border widths (CSS px of the element), left+right / top+bottom. */
  borderX: number
  borderY: number
}

async function boxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const px = (v: string) => Number.parseFloat(v)
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      borderX: px(cs.borderLeftWidth) + px(cs.borderRightWidth),
      borderY: px(cs.borderTopWidth) + px(cs.borderBottomWidth),
    }
  })
}

/** Library with one book (in-memory library), as in the library chrome spec. */
async function openLibraryWithBook(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) throw new Error('missing api')
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) throw new Error(attached.code ?? 'attach')
    const created = await api.createBookInLibrary()
    if (!created.ok) throw new Error(created.code ?? 'create')
    await api.leaveEditorForLibrary()
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
}

interface Scenario {
  name: string
  /** Where the overlay pins the box: dialogs centre, toasts bottom-right. */
  anchor: 'center' | 'end'
  /** Opens the overlay and returns the box to measure. */
  open: (page: Page) => Promise<Locator>
}

const scenarios: Scenario[] = [
  {
    name: 'Create book dialog',
    anchor: 'center',
    open: async (page) => {
      await openLibraryWithBook(page)
      await page.getByTestId('new-book').click()
      return page.getByTestId('create-book-dialog')
    },
  },
  {
    name: 'Print dialog',
    anchor: 'center',
    open: async (page) => {
      await openLibraryBook(page)
      await page.getByTestId('print').click()
      const dialog = page.getByTestId('print-dialog')
      await expect(dialog).toHaveAttribute('data-step', 'opts')
      return dialog
    },
  },
  {
    name: 'AlertDialog (remove book)',
    anchor: 'center',
    open: async (page) => {
      await openLibraryWithBook(page)
      await page.locator('[data-testid^="book-menu-"]').first().click({
        force: true,
      })
      await page.getByRole('menuitem', { name: 'Remove…' }).click()
      return page.getByRole('alertdialog')
    },
  },
  {
    name: 'toast',
    anchor: 'end',
    open: async (page) => {
      await page.goto('/?specimen')
      const feedback = page.getByTestId('specimen-feedback')
      await feedback.getByRole('button', { name: 'Show error toast' }).click()
      return page.locator('.pb-toast').filter({ hasText: '3 files skipped' })
    },
  },
]

/** Open the overlay and wait until its box stops moving (enter animations). */
async function settledBox(page: Page, scenario: Scenario): Promise<Box> {
  const locator = await scenario.open(page)
  await expect(locator).toBeVisible()
  let last = await boxOf(locator)
  await expect
    .poll(async () => {
      const next = await boxOf(locator)
      const same = JSON.stringify(next) === JSON.stringify(last)
      last = next
      return same
    })
    .toBe(true)
  return last
}

/**
 * Screen px a zoomed border loses: Chrome paints a border of b·s CSS px at
 * DPR 1 as whole device px (floor, at least 1), e.g. the toast's 1 px border
 * is 1 px, not 1.5, at 150 %. Everything else scales exactly.
 */
function borderSnapLoss(border: number, s: number): number {
  const side = (border / 2) * s
  if (side === 0) return 0
  return 2 * (side - Math.max(1, Math.floor(side)))
}

/**
 * R(s): the same state at 100 % in a W/s × H/s window, values × s, with the
 * border snap taken off around the box's anchor.
 */
async function expectedBox(
  browser: Browser,
  baseURL: string | undefined,
  scenario: Scenario,
  s: number,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const context = await browser.newContext({
    ...(baseURL === undefined ? {} : { baseURL }),
    viewport: { width: W / s, height: H / s },
  })
  try {
    const r = await settledBox(await context.newPage(), scenario)
    const lossX = borderSnapLoss(r.borderX, s)
    const lossY = borderSnapLoss(r.borderY, s)
    const shift = scenario.anchor === 'center' ? 0.5 : 1
    return {
      x: r.x * s + lossX * shift,
      y: r.y * s + lossY * shift,
      width: r.width * s - lossX,
      height: r.height * s - lossY,
    }
  } finally {
    await context.close()
  }
}

for (const [choice, s] of [
  ['125', 1.25],
  ['150', 1.5],
] as const) {
  test.describe(`4K at ${choice} %`, () => {
    test.use({ viewport: { width: W, height: H } })

    for (const scenario of scenarios) {
      test(`${scenario.name} = R(${String(s)})`, async ({
        page,
        browser,
        baseURL,
      }) => {
        const want = await expectedBox(browser, baseURL, scenario, s)

        await page.addInitScript(
          ([k, v]) => {
            localStorage.setItem(k, v)
          },
          [KEY, choice] as const,
        )
        const got = await settledBox(page, scenario)
        await expect(page.locator('html')).toHaveAttribute(
          'data-ui-scale',
          choice,
        )

        const msg = JSON.stringify({ got, want })
        expect(Math.abs(got.x - want.x), msg).toBeLessThanOrEqual(TOL)
        expect(Math.abs(got.y - want.y), msg).toBeLessThanOrEqual(TOL)
        expect(Math.abs(got.width - want.width), msg).toBeLessThanOrEqual(TOL)
        expect(Math.abs(got.height - want.height), msg).toBeLessThanOrEqual(TOL)

        // Inside the viewport.
        expect(got.x, msg).toBeGreaterThanOrEqual(0)
        expect(got.y, msg).toBeGreaterThanOrEqual(0)
        expect(got.x + got.width, msg).toBeLessThanOrEqual(W)
        expect(got.y + got.height, msg).toBeLessThanOrEqual(H)

        // Paint: the overlay is what the user sees at its own centre.
        const onTop = await page.evaluate(
          ({ x, y }) =>
            document.elementFromPoint(x, y)?.closest('.pb-dialog, .pb-toast')
              ?.className ?? '',
          { x: got.x + got.width / 2, y: got.y + got.height / 2 },
        )
        expect(onTop).toMatch(/\bpb-(dialog|toast)\b/)
      })
    }
  })
}
